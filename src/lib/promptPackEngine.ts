/**
 * PPTGod · Prompt Pack engine (server-side)
 *
 * 1. `buildRuleBasedPack` — deterministic, *source-grounded* fallback: every
 *    point and number comes from the user's material (no generic filler).
 * 2. `buildPackInstructions` / `buildPackUserInput` — LLM prompt contract whose
 *    JSON output is merged through `sanitizePackStyle` / `sanitizePackSlides`.
 */
import { analyzeDocumentAndRecommendStyles } from "@/lib/documentAnalyzer";
import {
  DESIGN_DIRECTIONS,
  PACK_LAYOUTS,
  defaultAudienceFor,
  directionToStyle,
  getDesignDirection,
  newPackSlideId,
  pickDesignDirection,
  type DesignDirection,
  type PackDatum,
  type PackInsight,
  type PackLanguage,
  type PackLayout,
  type PackSlide,
  type PromptPack,
} from "@/lib/promptPack";
import type { DocumentAnalysisResult } from "@/types/prompt";

export interface PackRequestInput {
  text: string;
  fileName: string;
  topic?: string;
  audience?: string;
  slideCount?: number;
  language: PackLanguage;
  directionId?: string;
}

interface SourceSection {
  heading: string;
  sentences: string[];
  facts: PackDatum[];
  raw: string;
}

/* ---------------------------------------------------------------- parsing */

const HEADING_RES: RegExp[] = [
  /^#{1,4}\s+(.+)$/,
  /^[一二三四五六七八九十]{1,3}[、.．]\s*(.+)$/,
  /^(第[一二三四五六七八九十\d]{1,3}[章节部分课讲单元].*)$/,
  /^\d{1,2}(?:\.\d{1,2}){0,2}[\s、.．]\s*([^。；;！!？?]{2,28})$/,
  /^((?:abstract|introduction|background|related work|method(?:s|ology)?|experiments?|results?|discussion|conclusions?|摘要|引言|背景|方法|实验|结果|讨论|结论|小结|总结|展望)\b.{0,20})$/i,
];

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function detectHeading(line: string, next: string | undefined): string | null {
  if (line.length > 36) return null;
  for (const re of HEADING_RES) {
    const m = line.match(re);
    if (m) {
      const h = (m[1] ?? line).replace(/[#*]/g, "").trim();
      if (!/[。；;！!？?，,]$/.test(h)) return h;
    }
  }
  // Short stand-alone line followed by a longer paragraph.
  if (
    line.length >= 2 &&
    line.length <= 18 &&
    !/[。；;！!？?，,：:.]$/.test(line) &&
    next !== undefined &&
    next.length > line.length + 12
  ) {
    return line.replace(/[#*]/g, "").trim();
  }
  return null;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])|\n|(?<=[a-z0-9)]\.)\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[\s\-*•·>\d.、()（）]+(?=\S)/, "").trim())
    .filter((s) => s.length >= 8 && s.length <= 220);
}

const VALUE_RE =
  /-?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|％|倍|个百分点|pp|亿元|万元|亿|万|元|美元|kg|km|cm|mm|N|m\/s²|m\/s|ms|秒|分钟|小时|天|年|个|人|次|家|项|篇|BLEU|FLOPs|GB|TB|x)(?![A-Za-z])/g;
const LABEL_TRAIL_RE =
  /(?:达到|分别为|依次为|为|是|约|仅|共|取得|达|有|由|的|降至|提升至|增至|延长至|缩短至|受到|=|:|：)\s*$/;
const LABEL_LEAD_RE =
  /^(?:首先|其次|然后|最后|其中|本季度|本期|已知|保持|测得|使用|本|该|在|和|与|及|的|其|将|从|使|而|且|并|则|约|求|比|含)+/;
const VERB_ONLY_RE = /^(?:增至|降至|延长至|缩短至|高于|低于|增长|上升|下降|提升至?|减少)$/;

function cleanLabel(raw: string): string {
  let label = raw
    .replace(/[（(][^（()）]*[)）]/g, "")
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 2; i += 1) label = label.replace(LABEL_TRAIL_RE, "").trim();
  label = label.replace(LABEL_LEAD_RE, "").trim();
  if (label.length > 12) {
    const de = label.lastIndexOf("的");
    const tail = de >= 0 ? label.slice(de + 1).trim() : "";
    if (tail.length >= 2) {
      label = tail;
    } else {
      const cut = label.slice(-12);
      const sp = cut.indexOf(" ");
      label = (sp > 0 && sp < 5 && /[A-Za-z]/.test(cut) === false ? cut.slice(sp + 1) : cut).replace(LABEL_LEAD_RE, "").trim();
    }
  }
  return label;
}

function extractFacts(text: string): PackDatum[] {
  const out: PackDatum[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(VALUE_RE)) {
    const start = m.index ?? 0;
    const before = text.slice(Math.max(0, start - 32), start);
    // Stay inside the current clause and after any previous number.
    const clause = (before.split(/[，,。；;：:、\n]/).pop() ?? "").replace(
      /^.*\d(?:\.\d+)?\s*(?:[A-Za-z%％²\/]+|个百分点|亿元|万元|亿|万|元|天|秒|年|个|人|次|家|项|篇)?\s*/,
      ""
    );
    const label = cleanLabel(clause);
    if (label.length < 2 || VERB_ONLY_RE.test(label) || /^[\d\s.]+$/.test(label)) continue;
    const value = m[0].replace(/\s+/g, "");
    if (/^(?:19|20)\d{2}年$/.test(value)) continue;
    const key = `${label}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, value });
    if (out.length >= 8) break;
  }
  return out;
}

function unitOf(value: string): string {
  return value.replace(/[-\d.,]/g, "");
}

function parseSections(text: string): { title: string; sections: SourceSection[] } {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  let title = "";
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;
  lines.forEach((line, idx) => {
    if (idx === 0 && line.length <= 40 && !/[。；;]$/.test(line)) {
      title = line.replace(/^#+\s*/, "");
      return;
    }
    const heading = detectHeading(line, lines[idx + 1]);
    if (heading) {
      current = { heading, body: [] };
      sections.push(current);
      return;
    }
    if (!current) {
      current = { heading: "概述", body: [] };
      sections.push(current);
    }
    current.body.push(line);
  });

  const parsed = sections
    .map((s) => {
      const raw = s.body.join("\n");
      return { heading: s.heading.slice(0, 28), sentences: splitSentences(raw), facts: extractFacts(raw), raw };
    })
    .filter((s) => s.sentences.length > 0 || s.facts.length > 0);

  // Unstructured text: chunk sentences into pseudo-sections.
  if (parsed.length <= 1) {
    const all = splitSentences(text);
    const chunkSize = Math.max(3, Math.ceil(all.length / 6));
    const chunks: SourceSection[] = [];
    for (let i = 0; i < all.length; i += chunkSize) {
      const sents = all.slice(i, i + chunkSize);
      const raw = sents.join("");
      chunks.push({
        heading: shorten(sents[0], 16),
        sentences: sents,
        facts: extractFacts(raw),
        raw,
      });
    }
    return { title, sections: chunks.length ? chunks : parsed };
  }
  return { title, sections: parsed };
}

function shorten(s: string, max: number): string {
  const clean = s.replace(/[。；;！!？?]+$/, "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const punct = Math.max(cut.lastIndexOf("，"), cut.lastIndexOf(","), cut.lastIndexOf("、"));
  return (punct > max * 0.5 ? cut.slice(0, punct) : cut) + "…";
}

/* ---------------------------------------------------------------- layout */

function dominantUnitFacts(facts: PackDatum[]): PackDatum[] {
  const counts = new Map<string, number>();
  for (const f of facts) counts.set(unitOf(f.value), (counts.get(unitOf(f.value)) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? facts.filter((f) => unitOf(f.value) === top[0]) : [];
}

function chooseLayout(sec: SourceSection, prev: PackLayout | null): PackLayout {
  const h = sec.heading;
  const t = sec.raw;
  if (/^(?:核心)?结论$|^conclusions?$/i.test(h)) return "quote";
  if (/例题|解题|求解|演算|推导/.test(h + t.slice(0, 120))) return prev === "process" ? "image-text" : "process";
  const sameUnit = dominantUnitFacts(sec.facts).length >= 3;
  let pick: PackLayout = "image-text";
  if (sameUnit) pick = "chart";
  else if (sec.facts.length >= 2) pick = "big-number";
  else if (/对比|相比|vs\.?|VS|优于|不同于|传统|反比|正比|区别|而非/.test(t)) pick = "comparison";
  else if (new Set(t.match(/(?:19|20)\d{2}/g) ?? []).size >= 2) pick = "timeline";
  else if (/步骤|第一步|首先|其次|然后|最后|流程|阶段|step/i.test(t)) pick = "process";
  else if (/[“"「][^”"」]{10,80}[”"」]/.test(t)) pick = "quote";
  else if (sec.facts.length === 1) pick = "big-number";
  if (pick === prev && pick !== "chart") {
    return pick === "image-text" ? "process" : "image-text";
  }
  return pick;
}

function visualFor(layout: PackLayout, sec: SourceSection | null, data: PackDatum[], d: DesignDirection, topic: string): string {
  switch (layout) {
    case "cover":
      return `大标题 + 一句话副标题，大面积留白；配图遵循：${d.imagery.split("；")[0]}`;
    case "agenda":
      return "编号目录 01–0N，章节名 + 一句话说明";
    case "section":
      return "章节编号满版主色块，一句话主旨";
    case "big-number":
      return data[0]
        ? `把「${data[0].value}」放大为视觉中心（数字字体），下方一句话解读${data.length > 1 ? `，其余 ${data.length - 1} 个数字并列小卡片` : ""}`
        : "关键数字放大展示，配一句解读";
    case "chart":
      return `柱状图：${data.map((x) => x.label).slice(0, 5).join(" / ")}，高亮最大值，直接标注数据标签`;
    case "comparison":
      return "左右两栏对照，差异项用强调色标注，中间用 VS 分隔";
    case "timeline":
      return "横向时间轴，节点为资料中的年份/阶段";
    case "process":
      return "3–4 步带编号箭头流程，每步一个关键词 + 一句说明";
    case "quote":
      return "居中大号引言 + 出处，背景用浅底色";
    case "summary":
      return "3 条结论卡片 + 底部致谢 / Q&A";
    default:
      return `一侧放与「${sec?.heading ?? topic}」相关的示意图或照片，另一侧 3 条要点`;
  }
}

function pointsFor(layout: PackLayout, sents: string[]): string[] {
  const max = layout === "big-number" || layout === "quote" ? 2 : 4;
  return sents.slice(0, max).map((s) => shorten(s, 60));
}

/* ---------------------------------------------------------------- builder */

export function analyzeMaterial(text: string, fileName: string, topic: string): DocumentAnalysisResult {
  return analyzeDocumentAndRecommendStyles({
    text,
    fileName,
    suggestedTopic: topic,
    suggestedSubtitle: "",
    styles: [],
  });
}

const TONE_LABEL: Record<string, string> = {
  executive: "决策型（结论先行）",
  storytelling: "叙事型",
  analytical: "分析型（证据优先）",
  inspiring: "启发型",
};

export function buildRuleBasedPack(input: PackRequestInput): {
  pack: PromptPack;
  analysis: DocumentAnalysisResult;
} {
  const text = input.text.slice(0, 16000);
  const { title, sections } = parseSections(text);
  const topic = (input.topic || title || sections[0]?.heading || input.fileName.replace(/\.[^.]+$/, "") || "我的演示").slice(0, 60);
  const analysis = analyzeMaterial(text, input.fileName, topic);
  const direction = input.directionId && input.directionId !== "auto"
    ? getDesignDirection(input.directionId)
    : pickDesignDirection(analysis.detectedScenario, text);
  const autoPicked = !input.directionId || input.directionId === "auto";
  const detectedAudience = analysis.suggestedAudience || "通用听众";
  const audience = (
    input.audience || (autoPicked ? defaultAudienceFor(direction.id, detectedAudience) : detectedAudience)
  ).slice(0, 40);
  const scenario =
    !autoPicked || direction.scenarios.includes(analysis.detectedScenario)
      ? analysis.detectedScenario
      : direction.scenarios[0] ?? analysis.detectedScenario;
  const target = Math.max(5, Math.min(24, Math.round(input.slideCount || analysis.suggestedSlideCount || 10)));

  const CLOSING_RE = /总结|小结|结论|展望|conclusion|summary/i;
  const lastIdx = sections.length - 1;
  const closingIdx = [lastIdx, lastIdx - 1].find((i) => i > 0 && CLOSING_RE.test(sections[i]?.heading ?? "")) ?? -1;
  const closingSec = closingIdx >= 0 ? sections[closingIdx] : null;
  const body = sections.filter((s) => s !== closingSec);
  const useAgenda = body.length >= 3 && target >= 7;
  const allSourceFacts = body.flatMap((s) => s.facts);
  const useFactsPage = allSourceFacts.length >= 3 && target >= 9;
  let budget = target - 2 - (useAgenda ? 1 : 0) - (useFactsPage ? 1 : 0);

  // Fit sections into budget: drop thinnest when too many, split richest when too few.
  let units: { sec: SourceSection; sents: string[]; part: number; parts: number }[] = body.map((sec) => ({
    sec,
    sents: sec.sentences,
    part: 1,
    parts: 1,
  }));
  if (units.length > budget) {
    const keep = [...units]
      .sort((a, b) => b.sec.raw.length + b.sec.facts.length * 80 - (a.sec.raw.length + a.sec.facts.length * 80))
      .slice(0, budget);
    units = units.filter((u) => keep.includes(u));
  }
  let guard = 0;
  while (units.length < budget && guard < 40) {
    guard += 1;
    const idx = units.reduce((best, u, i) => (u.sents.length > (units[best]?.sents.length ?? 0) ? i : best), 0);
    const u = units[idx];
    if (!u || u.sents.length < 3) break;
    const mid = Math.ceil(u.sents.length / 2);
    const total = u.parts + 1;
    const a = { ...u, sents: u.sents.slice(0, mid), parts: total };
    const b = { sec: u.sec, sents: u.sents.slice(mid), part: u.part + 1, parts: total };
    units.splice(idx, 1, a, b);
  }
  budget = units.length;

  const slides: PackSlide[] = [];
  const firstSentence = sections[0]?.sentences[0] ?? "";
  slides.push({
    id: newPackSlideId(),
    layout: "cover",
    title: shorten(topic, 30),
    points: [shorten(firstSentence || `${scenario} · ${audience}`, 40)],
    data: [],
    visual: visualFor("cover", null, [], direction, topic),
    note: `开场：介绍主题「${topic}」与本次分享的目的（面向${audience}）。`,
    source: input.fileName || "资料",
  });
  if (useAgenda) {
    const heads = body.slice(0, 6).map((s) => s.heading);
    slides.push({
      id: newPackSlideId(),
      layout: "agenda",
      title: "内容概览",
      points: heads,
      data: [],
      visual: visualFor("agenda", null, [], direction, topic),
      note: `本次共 ${heads.length} 个部分：${heads.join("、")}。`,
      source: "资料章节结构",
    });
  }
  if (useFactsPage) {
    const top = allSourceFacts.slice(0, 4);
    slides.push({
      id: newPackSlideId(),
      layout: "big-number",
      title: "关键数据一览",
      points: top.map((f) => `${f.label}：${f.value}`),
      data: top,
      visual: visualFor("big-number", null, top, direction, topic),
      note: `先用 ${top.length} 个关键数字建立整体印象，后文逐一展开。`,
      source: "资料中的数字事实",
    });
  }
  let prev: PackLayout | null = useFactsPage ? "big-number" : null;
  for (const u of units) {
    const layout: PackLayout = u.part === 1 ? chooseLayout(u.sec, prev) : prev === "image-text" ? "process" : "image-text";
    const data =
      layout === "chart"
        ? dominantUnitFacts(u.sec.facts).slice(0, 6)
        : layout === "big-number"
          ? u.sec.facts.slice(0, 3)
          : [];
    let title = u.parts > 1 ? `${u.sec.heading}（${u.part}/${u.parts}）` : u.sec.heading;
    if (layout === "big-number" && data[0] && u.parts === 1) {
      const claim = `${u.sec.heading}：${data[0].label} ${data[0].value}`;
      if (claim.length <= 26) title = claim;
    }
    slides.push({
      id: newPackSlideId(),
      layout,
      title: shorten(title, 30),
      points: pointsFor(layout, u.sents),
      data,
      visual: visualFor(layout, u.sec, data, direction, topic),
      note: shorten(u.sents.slice(0, 3).join(""), 180),
      source: `资料 · ${u.sec.heading}`,
    });
    prev = layout;
  }
  const takeaways = (closingSec?.sentences.length ? closingSec.sentences : body.map((s) => s.sentences[0]).filter(Boolean))
    .slice(0, 3)
    .map((s) => shorten(s, 40));
  slides.push({
    id: newPackSlideId(),
    layout: "summary",
    title: closingSec ? shorten(closingSec.heading, 24) : "核心结论",
    points: takeaways.length ? takeaways : ["回顾要点", "答疑交流"],
    data: [],
    visual: visualFor("summary", null, [], direction, topic),
    note: "总结核心结论，邀请提问。",
    source: closingSec ? `资料 · ${closingSec.heading}` : "全文提炼",
  });

  const allFacts = sections.flatMap((s) => s.facts).slice(0, 6);
  const insight: PackInsight = {
    topic,
    subtitle: "",
    audience,
    scenario,
    slideCount: slides.length,
    requestedSlides: target,
    talkMinutes: Math.max(3, Math.round(slides.length * 1.4)),
    tone: TONE_LABEL[analysis.suggestedTone] ?? analysis.suggestedTone,
    keyFacts: allFacts.map((f) => `${f.label} ${f.value}`),
    sections: body.map((s) => s.heading).slice(0, 8),
    fileName: input.fileName,
    charCount: text.length,
  };
  const rationale = `资料识别为「${scenario}」，面向${audience}；${direction.name}强调${direction.keywords
    .slice(0, 2)
    .join("与")}，${allFacts.length ? `能让资料中的 ${allFacts.length} 组关键数据更醒目` : "能让论点层次更清晰"}。`;

  return {
    analysis,
    pack: {
      version: 1,
      engine: "smart",
      insight,
      style: directionToStyle(direction, rationale),
      slides,
    },
  };
}

/* ---------------------------------------------------------------- LLM contract */

const LANG_HINT: Record<PackLanguage, string> = {
  zh: "所有文字使用简体中文",
  en: "All slide text in English",
  bilingual: "标题中文 + 英文副标题，正文中文",
};

export function buildPackInstructions(slideCount: number, language: PackLanguage): string {
  const layouts = PACK_LAYOUTS.map((l) => `${l.id}（${l.label}：${l.hint}）`).join("；");
  const directions = DESIGN_DIRECTIONS.map((d) => `${d.id}=${d.name}`).join("；");
  return `你是一位顶级演示文稿策划与视觉设计总监。任务：阅读用户资料，产出一份可直接交给 ChatGPT/Gamma/Kimi/Claude 生成 PPT 的「提示词包」。只输出一个合法 JSON 对象，不要任何解释。

JSON 结构：
{
  "style": {
    "directionId": "从以下最接近的基底中选一个 id：${directions}",
    "name": "为这份资料定制的设计方向名（≤16字，具体、可想象，例如“Nature 期刊式克制学术风”）",
    "reference": "可参照的真实设计范例（杂志/品牌/发布会/期刊）",
    "rationale": "为什么这个风格适合这份资料与受众（≤80字）",
    "keywords": ["3-5 个风格关键词"],
    "colors": [{"role":"背景","hex":"#RRGGBB"},{"role":"浅底/卡片","hex":"#RRGGBB"},{"role":"正文","hex":"#RRGGBB"},{"role":"次要文字","hex":"#RRGGBB"},{"role":"主色","hex":"#RRGGBB"},{"role":"强调色","hex":"#RRGGBB"}],
    "chartColors": ["#RRGGBB","#RRGGBB","#RRGGBB","#RRGGBB"],
    "headingFont": "真实可用的中文/英文标题字体", "bodyFont": "正文字体", "numberFont": "数字字体",
    "layoutGrammar": "栅格、对齐、留白、页眉页脚规则（≤80字）",
    "imagery": "图片/插画风格（≤60字）", "chartStyle": "图表规范（≤60字）",
    "dos": ["3 条必须"], "donts": ["3 条禁止"]
  },
  "slides": [
    {"layout":"版式 id","title":"结论式标题（≤24字）","points":["2-4 条要点，每条≤40字，必须来自资料"],"data":[{"label":"指标","value":"数值+单位（必须是资料原文数字）"}],"visual":"这一页的视觉/图表建议（≤60字）","note":"演讲备注（≤120字）","source":"资料出处（章节名）"}
  ]
}

要求：
1. 恰好 ${slideCount} 页；第 1 页 cover，最后 1 页 summary；版式从以下选择并交替使用，严禁连续 3 页相同版式：${layouts}。
2. 有数字的内容优先用 big-number / chart，并把原文数字放入 data；没有数字就不要用这两个版式，绝不编造数据。
3. 色板需满足正文与背景对比度 ≥ 7:1，主色与背景 ≥ 4.5:1；配色要与资料主题气质一致（学术克制、教学亲和、商业专业、发布会极简等）。
4. ${LANG_HINT[language]}。`;
}

export function buildPackUserInput(input: PackRequestInput, rule: PromptPack, slideCount: number): string {
  const i = rule.insight;
  return [
    `主题：${i.topic}`,
    `受众：${i.audience}`,
    `场景（规则识别，可修正）：${i.scenario}`,
    `目标页数：${slideCount}`,
    i.sections.length ? `资料章节：${i.sections.join(" / ")}` : "",
    i.keyFacts.length ? `资料中的数字事实：${i.keyFacts.join("；")}` : "资料中没有可用的数字事实",
    input.directionId && input.directionId !== "auto"
      ? `用户指定风格基底：${getDesignDirection(input.directionId).name}（请在此基础上为资料定制）`
      : "",
    `资料原文：\n${input.text.slice(0, 12000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
