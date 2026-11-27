/**
 * PPTGod · Prompt Pack engine (server-side)
 *
 * 1. `buildRuleBasedPack` — deterministic, *source-grounded* engine: every
 *    assertion title, bullet and number comes from the user's material (zero
 *    fabricated numbers, zero `(1/2)` directory labels).
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
  isWeakTopicTitle,
  newPackSlideId,
  pickDesignDirection,
  type DesignDirection,
  type PackDatum,
  type PackDensity,
  type PackInsight,
  type PackLanguage,
  type PackLayout,
  type PackSlide,
  type PackStyle,
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
  density?: PackDensity;
  directionId?: string;
  anchorStyle?: PackStyle;
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
  /^\d{1,2}(?:\.\d{1,2}){0,2}[\s、.．]\s*([^。；;！!？?]{2,36})$/,
  /^((?:(?:abstract|introduction|background|related work|method(?:s|ology)?|architecture|experiments?|evaluation|results?|discussion|limitations?|conclusions?)\b|摘要|引言|背景|方法|实验|结果|讨论|结论|小结|总结|展望).{0,24})$/i,
];

function cleanLine(line: string): string {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function detectHeading(line: string, next: string | undefined): string | null {
  if (line.length > 42) return null;
  for (const re of HEADING_RES) {
    const m = line.match(re);
    if (m) {
      const h = (m[1] ?? line).replace(/[#*]/g, "").trim();
      if (!/[。；;！!？?，,]$/.test(h)) return h;
    }
  }
  if (
    line.length >= 2 &&
    line.length <= 22 &&
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
    .filter((s) => s.length >= 8 && s.length <= 260);
}

const VALUE_RE =
  /(?:\$\s*\d+(?:,\d{3})*(?:\.\d+)?\s*(?:[MBK]|billion|million|thousand)?\b|-?\d+(?:,\d{3})*(?:\.\d+)?\s*(?:%|％|倍|个百分点|pp|pts|亿条|亿元|亿人|亿次|亿个|万条|万元|万家|万人|万名|万次|万篇|万页|万个|万台|亿|万|元|美元|USD|kg|km|cm|mm|N|m\/s²|m\/s|ms|s|Hz|GHz|fps|秒|分钟|小时|天|days?|年|个|人|次|家|项|篇|页|条|块|层|头|步|轮|张|套|台|款|组|份|名|位|BLEU|FLOPs|GB|TB|MB|tokens?|params?|parameters?|layers?|heads?|epochs?|GPUs?|[MBK]|x)(?![A-Za-z]))/gi;

// Require a real unit when stripping prior numbers in the same clause so identifiers
// like `AIME 2024`, `WMT 2014`, `MATH-500`, `DeepSeek-R1` are never wiped out.
const PRIOR_METRIC_WITH_CONN_RE =
  /^.*\d(?:\.\d+)?\s*(?:%|％|倍|个百分点|pp|pts|亿条|亿元|亿人|亿次|亿个|万条|万元|万家|万人|万名|万次|万篇|万页|万个|万台|亿|万|元|美元|USD|kg|km|cm|mm|N|m\/s²|m\/s|ms|s|Hz|GHz|fps|秒|分钟|小时|天|days?|个|人|次|家|项|篇|页|条|块|层|头|步|轮|张|套|台|款|组|份|名|位|BLEU|GB|TB|MB)(?![A-Za-z0-9])[\u4e00-\u9fffA-Za-z0-9_\s]{0,10}?(?:与|和|及|以及|或|并)\s*/i;
const PRIOR_METRIC_ONLY_RE =
  /^.*\d(?:\.\d+)?\s*(?:%|％|倍|个百分点|pp|pts|亿条|亿元|亿人|亿次|亿个|万条|万元|万家|万人|万名|万次|万篇|万页|万个|万台|亿|万|元|美元|USD|kg|km|cm|mm|N|m\/s²|m\/s|ms|s|Hz|GHz|fps|秒|分钟|小时|天|days?|个|人|次|家|项|篇|页|条|块|层|头|步|轮|张|套|台|款|组|份|名|位|BLEU|GB|TB|MB)(?![A-Za-z0-9])\s*/i;

const LABEL_TRAIL_RE =
  /(?:达到|分别为|依次为|控制在|压缩|降低约?|减少约?|显著降低|提升至?|增至|降至|延长至|缩短至|高出|高于|低于|超过|定义为使|生成|使用|取得|实现|仅用|仅为|约为?|同样|约|仅|共|为|是|达|有|由|的|与|和|及|受到|(?:基准|评测|任务|实验)?(?:上|中)|achieves?|achieving|reaches?|reaching|drops?|unlocks?|gains?|is|are|of|by|to|at|with|only|over|about|around|and|or|=|:|：)\s*$/i;
const LABEL_LEAD_RE =
  /^(?:首先|其次|然后|最后|再次|其中|同时|此外|阶段[一二三四五六\d]+|本季度|本期|已知|保持|测得|通过拒绝采样筛选|完成文献语料清洗与|筛选|构建|生成|引入|设计|目标将|目标|核心指标目标|确保|使用|仅用|将|本|该|在|也?在|和|与|及|的|其|从|使|而|且|并|则|约|求|含|(?:in|on|at|for|with|and|or|the|a|an|our|this|that|its|we|it)\s+)+/i;
const ACTION_VERB_ONLY_RE =
  /^(?:增至|降至|延长至|缩短至|增加到|减小到|高于|低于|超过|定义为|物体在水平面|增长|上升|下降|提升至?|减少|压缩|筛选|构建|生成|使用|引入|包含|发表|训练|仅用|取得|达到|实现|up|down|to|by|at|is|are|and|or|with|of|for|achieving|reaching|unlock|drops?)$/i;
const GENERIC_SUBJECT_RE =
  /^(?:单模型|基础模型|该模型|本模型|本文|模型|系统|方法|方案|物体|质量为|DeepSeek-R1(?:-Zero)?|Transformer(?:\s*\(big\))?)$/i;
const EN_POST_STOP_RE =
  /^(?:over|than|for|at|in|on|with|and|or|to|from|of|by|as|is|are|was|were|that|which|where|when|while|compared)$/i;
const ZH_METRIC_SUFFIX_RE =
  /^(Pass@\d+|准确率|百分位|召回率|精确率|渗透率|留存率|续约率|增长率|流失率|幻觉率|达成率|吞吐量|延迟)/i;

function trimLeftAtTokenBoundary(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  let cutIdx = input.length - maxLen;
  // Never slice in the middle of an ASCII identifier like `Codeforces`, `MATH-500`, `Pass@1`.
  const isTokenChar = (ch: string | undefined) => Boolean(ch && /[A-Za-z0-9_@+/.-]/.test(ch));
  if (cutIdx > 0 && isTokenChar(input[cutIdx - 1]) && isTokenChar(input[cutIdx])) {
    let wordStart = cutIdx - 1;
    while (wordStart > 0 && isTokenChar(input[wordStart - 1])) wordStart -= 1;
    if (input.length - wordStart <= maxLen + 8) {
      cutIdx = wordStart;
    } else {
      while (cutIdx < input.length && isTokenChar(input[cutIdx])) cutIdx += 1;
    }
  }
  return input.slice(cutIdx).trim();
}

function cleanLabel(raw: string): string {
  let label = raw
    .replace(/[（(][^（()）]*[)）]/g, "")
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 4; i += 1) label = label.replace(LABEL_TRAIL_RE, "").trim();
  for (let i = 0; i < 3; i += 1) label = label.replace(LABEL_LEAD_RE, "").trim();
  for (let i = 0; i < 2; i += 1) label = label.replace(LABEL_TRAIL_RE, "").trim();

  const isMostlyLatin = /[A-Za-z]/.test(label) && !/[\u4e00-\u9fff]/.test(label);
  if (isMostlyLatin) {
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length > 3) label = words.slice(-3).join(" ");
    label = trimLeftAtTokenBoundary(label, 22);
    return label.replace(LABEL_LEAD_RE, "").trim();
  }

  // Condense `蒸馏版 32B 模型在 AIME 2024` -> `32B蒸馏 AIME 2024`
  const distillMatch = label.match(/蒸馏版\s*(\d+[BMK])\s*模型(?:也?在\s*)?(.+)$/i);
  if (distillMatch) {
    return `${distillMatch[1]}蒸馏 ${distillMatch[2].replace(LABEL_TRAIL_RE, "").trim()}`.slice(0, 18);
  }

  // Condense `比同尺寸直接做强化学习的模型高出` -> `较同尺寸RL`
  if (/^比.{2,16}高出?$/.test(label) || /^比.{2,16}$/.test(label)) {
    const shortCmp = label
      .replace(/^比(?:此前)?/, "较")
      .replace(/同尺寸直接做强化学习的模型/, "同尺寸RL")
      .replace(/最好结果/, "最优基线");
    if (shortCmp.length <= 14) return shortCmp;
  }

  if (label.length > 15) {
    const de = label.lastIndexOf("的");
    const tail = de >= 0 ? label.slice(de + 1).trim() : "";
    if (tail.length >= 2 && tail.length <= 15) {
      label = tail;
    } else {
      label = trimLeftAtTokenBoundary(label, 15).replace(LABEL_LEAD_RE, "").trim();
    }
  }
  return label;
}

function extractPostNoun(after: string): string {
  const rawClause = after.split(/[.,;!?，。；！？：:、\n]/)[0]?.trim() ?? "";
  if (!rawClause) return "";

  // 1. Leading benchmark metric token such as `Pass@1`, `准确率`, `百分位`
  const metricMatch = rawClause.match(ZH_METRIC_SUFFIX_RE);
  if (metricMatch) return metricMatch[1];

  // 2. Pure English post-noun (e.g. `42% visual tokens`, `96.3% percentile`)
  if (!/[\u4e00-\u9fff]/.test(rawClause)) {
    const words = rawClause.split(/\s+/).filter(Boolean);
    const picked: string[] = [];
    for (const w of words) {
      const clean = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9%+@/.-]+$/g, "");
      if (!clean || EN_POST_STOP_RE.test(clean)) break;
      picked.push(clean);
      if (picked.length >= 2) break;
    }
    return picked.join(" ");
  }

  // 3. Chinese / mixed noun immediately following `[verb] + [number+classifier]`
  //    e.g. `60 万条推理数据与...` -> `推理数据`, `8 块 P100 GPU 训练...` -> `P100 GPU`
  const stopped =
    rawClause
      .split(/(?:与|和|及|以及|或|并|二次微调|半自动标注|蒸馏至|堆叠而成|训练|用于|进行|实现|以内|以上|的力)/)[0]
      ?.trim() ?? "";
  if (!stopped) return "";
  const cleaned = cleanLabel(stopped.replace(/^的\s*/, ""));
  if (cleaned.length >= 2 && cleaned.length <= 14 && !ACTION_VERB_ONLY_RE.test(cleaned)) {
    return cleaned;
  }
  return "";
}

function extractSentenceBenchmarkContext(sentenceBefore: string): string {
  const lastSentence = sentenceBefore.split(/[。！？!?;；\n]/).pop() ?? "";
  const loc = lastSentence.match(/在\s*([^，,。；;]{2,22}?)(?:竞赛基准|翻译任务|竞赛评测|基准|任务|评测)?(?:上|中)\s*[，,]/);
  if (!loc) return "";
  return cleanLabel(loc[1]);
}

function extractFacts(text: string): PackDatum[] {
  const out: PackDatum[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(VALUE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const rawVal = m[0];

    // Skip model-parameter identifiers (`32B 模型`, `7B model`) when they act as subject modifiers.
    if (
      !/^\$/.test(rawVal) &&
      /\d\s*[BMK]$/i.test(rawVal) &&
      /^\s*(?:模型|参数模型|开源模型|稠密模型|蒸馏模型|model|models|dense|base|instruct)/i.test(
        text.slice(end, end + 16)
      )
    ) {
      continue;
    }

    const sliceStart = Math.max(0, start - 56);
    let before = text.slice(sliceStart, start);
    if (
      sliceStart > 0 &&
      /[A-Za-z0-9_@+/.-]/.test(before[0] ?? "") &&
      /[A-Za-z0-9_@+/.-]/.test(text[sliceStart - 1] ?? "")
    ) {
      before = before.replace(/^[A-Za-z0-9_@+/.-]+\s*/, "");
    }

    // Do not split on commas inside thousands-formatted numbers like `12,000` or `3,420`.
    const rawClause = before.split(/(?<!\d),(?!\d)|[，。；;：:、\n]/).pop() ?? "";
    const clause = rawClause
      .replace(PRIOR_METRIC_WITH_CONN_RE, "")
      .replace(PRIOR_METRIC_ONLY_RE, "");

    let label = cleanLabel(clause);
    const postNoun = extractPostNoun(text.slice(end, end + 36));
    const benchCtx = extractSentenceBenchmarkContext(before);

    if (benchCtx && (!label || GENERIC_SUBJECT_RE.test(label) || ACTION_VERB_ONLY_RE.test(label))) {
      label = benchCtx;
    }

    if (postNoun) {
      if (label.length < 2 || ACTION_VERB_ONLY_RE.test(label) || GENERIC_SUBJECT_RE.test(label)) {
        label = benchCtx && ZH_METRIC_SUFFIX_RE.test(postNoun) ? `${benchCtx} ${postNoun}` : postNoun;
      } else if (ZH_METRIC_SUFFIX_RE.test(postNoun) && !label.includes(postNoun) && label.length <= 12) {
        label = `${label} ${postNoun}`;
      } else if (!/[\u4e00-\u9fff]/.test(clause) && label.split(/\s+/).length <= 1) {
        label = postNoun;
      }
    }

    if (label === "训练" && /天|小时|分钟|秒|days?|s\b/i.test(rawVal)) {
      label = "训练耗时";
    }
    if (
      label.length < 2 ||
      ACTION_VERB_ONLY_RE.test(label) ||
      /^[\d\s.+/-]+$/.test(label)
    ) {
      continue;
    }

    const value = rawVal.replace(/\s+/g, (ws, offset, full) => {
      const rest = full.slice(offset + ws.length);
      return /^[A-Za-z]{2,}/.test(rest) ? " " : "";
    });
    if (/^(?:19|20)\d{2}年$/.test(value)) continue;
    const key = `${label}|${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: label.slice(0, 22), value });
    if (out.length >= 8) break;
  }
  return out;
}

function unitOf(value: string): string {
  return value.replace(/[-\d.,]/g, "");
}

function balanceQuotes(strVal: string): string {
  let out = strVal;
  if (out.includes("“") && !out.includes("”")) out = out.replace(/“/g, "");
  if (out.includes("「") && !out.includes("」")) out = out.replace(/「/g, "");
  return out.trim();
}

function shortenClause(s: string, max: number): string {
  const clean = s.replace(/[。；;！!？?，,、\s]+$/, "").trim();
  if (clean.length <= max) return balanceQuotes(clean);
  const windowStr = clean.slice(0, max + 1);
  // Find last clause comma/semicolon that is NOT inside `12,000`
  let clausePunct = -1;
  for (let i = windowStr.length - 1; i >= Math.min(10, Math.floor(max * 0.42)); i -= 1) {
    const ch = windowStr[i];
    if (ch === "，" || ch === "；" || ch === ";" || ch === "：") {
      clausePunct = i;
      break;
    }
    if (ch === "," && !(/\d/.test(windowStr[i - 1] ?? "") && /\d/.test(windowStr[i + 1] ?? ""))) {
      clausePunct = i;
      break;
    }
  }
  if (clausePunct >= 0) {
    return balanceQuotes(windowStr.slice(0, clausePunct).trim());
  }
  const listPunct = windowStr.lastIndexOf("、");
  if (listPunct >= Math.floor(max * 0.55)) {
    return balanceQuotes(windowStr.slice(0, listPunct).trim());
  }
  let cutEnd = max;
  while (
    cutEnd > max - 8 &&
    /[A-Za-z0-9_@+/.-]/.test(clean[cutEnd - 1] ?? "") &&
    /[A-Za-z0-9_@+/.-]/.test(clean[cutEnd] ?? "")
  ) {
    cutEnd -= 1;
  }
  return `${balanceQuotes(clean.slice(0, cutEnd).trim())}…`;
}

function parseSections(text: string): { title: string; sections: SourceSection[] } {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  let title = "";
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;
  lines.forEach((line, idx) => {
    if (idx === 0 && line.length <= 42 && !/[。；;]$/.test(line)) {
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
      current = { heading: "核心背景", body: [] };
      sections.push(current);
    }
    current.body.push(line);
  });

  const parsed = sections
    .map((s) => {
      const raw = s.body.join("\n");
      return {
        heading: s.heading.slice(0, 28),
        sentences: splitSentences(raw),
        facts: extractFacts(raw),
        raw,
      };
    })
    .filter((s) => s.sentences.length > 0 || s.facts.length > 0);

  if (parsed.length <= 1) {
    const all = splitSentences(text);
    const chunkSize = Math.max(3, Math.ceil(all.length / 6));
    const chunks: SourceSection[] = [];
    for (let i = 0; i < all.length; i += chunkSize) {
      const sents = all.slice(i, i + chunkSize);
      const raw = sents.join("");
      chunks.push({
        heading: shortenClause(sents[0] ?? "要点", 18),
        sentences: sents,
        facts: extractFacts(raw),
        raw,
      });
    }
    return { title, sections: chunks.length ? chunks : parsed };
  }
  return { title, sections: parsed };
}

/* ----------------------------------------------------- assertion headlines */

const LEAD_FILLER_RE =
  /^(?:本文(?:提出|探讨|研究|旨在)?|本研究(?:拟|旨在)?|实验(?:结果)?表明|研究表明|具体而言|其中|首先|其次|再次|最后|在此基础上)[，,：:\s]*/;

/**
 * Synthesizes an Assertion-Evidence conclusion headline (<= 28 chars) from the
 * slide's actual sentences & metrics instead of copying bare directory labels
 * or emitting `(1/2)` / `(2/2)` suffixes.
 */
function buildAssertionTitle(
  secHeading: string,
  sents: string[],
  data: PackDatum[],
  layout: PackLayout
): string {
  const cleanHeading = secHeading
    .replace(/^(?:[一二三四五六七八九十\d]{1,3}[、.．\s]+|第[一二三四五六七八九十\d]{1,3}[章节部分课讲单元]\s*)/, "")
    .trim();
  const lead = (sents[0] ?? "")
    .replace(/（[^（）]{1,14}）|\([^()]{1,14}\)/g, "")
    .replace(/[。；;！!？?]+$/, "")
    .trim();

  if (!lead) return shortenClause(cleanHeading || secHeading, 26);

  const clauses = lead
    .split(/(?<!\d),(?!\d)|[，；;]/)
    .map((c) => balanceQuotes(c.replace(LEAD_FILLER_RE, "").trim()))
    .filter(Boolean);

  // 1. Explicit scientific/experimental takeaway clause (`说明...`, `证明...`, `揭示了...`)
  const conclusionClause = clauses.find((c) =>
    /^(?:说明|表明|证明|揭示了?|验证了?|确保)/.test(c)
  );
  if (conclusionClause && conclusionClause.length >= 7 && conclusionClause.length <= 24) {
    const core = conclusionClause.replace(/^(?:说明|表明|证明|验证了?)/, "").trim();
    if (core.length >= 6 && core.length <= 20 && cleanHeading.length <= 6) {
      return `${cleanHeading}：${core}`;
    }
    return shortenClause(core.length >= 8 ? core : conclusionClause, 26);
  }

  const c0 = clauses[0] ?? lead;
  const c1 = clauses[1] ?? "";

  // 2. Setup / prepositional / `...表明` clause -> promote or combine with `c1`
  if (/^为(?:了|解决)/.test(c0) && c1.length >= 8 && c1.length <= 26) {
    return c1;
  }
  if (/表明$|指出$|发现$/.test(c0) && c1) {
    const c2 = clauses[2] ?? "";
    const claim = c2 && c1.length + c2.length + 1 <= 24 ? `${c1}，${c2}` : c1;
    return shortenClause(claim, 26);
  }

  // 3. Benchmark locative (`在 WMT 2014 英德翻译任务上，Transformer 取得 28.4 BLEU`)
  const benchLoc = c0.match(/^在\s*(.+?)(?:数学竞赛基准|翻译任务|竞赛评测|基准|任务|评测)?(?:上|中)$/);
  if (benchLoc && c1) {
    const action = c1.replace(/^(?:Transformer|DeepSeek-R1|单模型|本模型|模型)\s*/, "").trim();
    const merged = `${benchLoc[1].trim()} ${action}`.replace(/\s+/g, " ");
    return shortenClause(merged, 28);
  }

  // 4. Short leading clause (`< 10` chars like time/action phrase) or two short quantitative clauses
  if (c1 && ((c0.length < 10 && c0.length + c1.length + 1 <= 26) || (c0.length + c1.length + 1 <= 26 && (/\d/.test(c0) || /\d/.test(c1))))) {
    return `${c0}，${c1}`;
  }

  // 5. Long setup clause + punchy takeaway clause (`...人工标注长思维链，标注成本高且泛化受限`)
  if (c0.length > 24 && c1.length >= 6 && c1.length <= 16) {
    if (!isWeakTopicTitle(cleanHeading, layout) && cleanHeading.length <= 10) {
      return `${cleanHeading}：${c1}`;
    }
    const shortTopic = shortenClause(c0.replace(/^.+?(?:依赖|采用|基于|面临)/, ""), 10);
    if (shortTopic.length >= 3 && !shortTopic.endsWith("…")) {
      return `${shortTopic}：${c1}`;
    }
  }

  // 6. Clean single assertion clause (excluding dangling `在...上` fragments)
  if (c0.length >= 9 && c0.length <= 27 && !/^在.+[上中]$/.test(c0)) {
    return c0;
  }

  // 7. Data-backed headline fallback
  if (data[0] && cleanHeading.length <= 10) {
    const metricClaim = `${cleanHeading}：${data[0].label} ${data[0].value}`;
    if (metricClaim.length <= 27) return metricClaim;
  }

  return shortenClause(c1 && c0.length < 9 ? `${c0}，${c1}` : c0, 26);
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

function visualFor(
  layout: PackLayout,
  sec: SourceSection | null,
  data: PackDatum[],
  d: DesignDirection,
  topic: string
): string {
  const raw = sec?.raw ?? "";
  const labels = data
    .map((x) => x.label)
    .slice(0, 5)
    .join(" / ");

  switch (layout) {
    case "cover":
      return `大标题 + 一句话副标题，留白 ≥45%；视觉锚点：${d.imagery.split("；")[0]}`;
    case "agenda":
      return "编号目录 01–0N，大号数字编号 + 章节核心问题";
    case "section":
      return "章节编号满版主色块，一句话结论过渡";
    case "big-number":
      return data[0]
        ? `将核心指标「${data[0].value}（${data[0].label}）」放大为 64–88pt 视觉焦点，下方配一句因果解读${
            data.length > 1 ? `；其余 ${data.length - 1} 项指标做右侧辅助小卡` : ""
          }`
        : "关键数字 72pt 放大展示，配一句数据归因";
    case "chart": {
      if (/占比|贡献|份额|渗透率|分布|结构/.test(raw)) {
        return `占比环形图或水平构成条形图（${labels}）：主色高亮首项核心占比，其余项用浅灰退后，直接标百分比`;
      }
      if (/成正比|成反比|随.*增长|依次为|拉力|加速度|曲线/.test(raw)) {
        return `定量关系折线/散点拟合图（${labels}）：横轴自变量、纵轴实测值，标出关键实验数据点与定量公式`;
      }
      if (/同比|环比|增至|降至|延长至|趋势|Q[1-4]/.test(raw)) {
        return `带增减幅胶囊批注的柱状/折线图（${labels}）：主色标当前期，直接显示数值与变化幅度`;
      }
      if (/高出|优于|相比|基线|baseline|BLEU|AIME|MATH|Codeforces|Pass@/i.test(raw)) {
        return `基准评测横向对比条形图（${labels}）：本方案用主色填充，对照基线用次要浅灰，柱端直接标得分`;
      }
      return `精简柱状图（${labels}）：去除多余网格线，最大值用强调色突出，柱顶直接标数值`;
    }
    case "comparison":
      return "左右双栏对照矩阵（或原生对比表格）：左侧现状/基线用浅灰底，右侧本方案用主色描边高亮核心差异";
    case "timeline":
      return "横向里程碑时间轴：主色连线串联各阶段时间节点，每节点列出阶段交付物与目标指标";
    case "process":
      return "3–4 步递进式带编号卡片流（01 → 0N）：每步突出动作关键词 + 一句输入输出说明";
    case "quote":
      return "居中大号核心论断 + 顶部主色引号装饰 + 底部资料出处，保持极简留白";
    case "summary":
      return "3 张核心结论行动卡并列排布 + 底部问答交流引导";
    default:
      return `左图右文（5:7 栅格）：左侧绘制「${sec?.heading ?? topic}」结构示意图，右侧分卡片陈列核心论据`;
  }
}

function pointsFor(layout: PackLayout, sents: string[], density: PackDensity): string[] {
  if (density === "speaker") {
    const maxItems = layout === "big-number" || layout === "quote" ? 2 : 3;
    return sents.slice(0, maxItems).map((s) => shortenClause(s, 38));
  }
  const maxItems = layout === "big-number" || layout === "quote" ? 3 : 5;
  return sents.slice(0, maxItems).map((s) => shortenClause(s, 68));
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
  const density: PackDensity = input.density === "reading" ? "reading" : "speaker";
  const { title, sections } = parseSections(text);
  const topic = (
    input.topic ||
    title ||
    sections[0]?.heading ||
    input.fileName.replace(/\.[^.]+$/, "") ||
    "我的演示"
  ).slice(0, 60);
  const analysis = analyzeMaterial(text, input.fileName, topic);
  const anchor = input.anchorStyle;
  const direction = anchor
    ? getDesignDirection(anchor.directionId)
    : input.directionId && input.directionId !== "auto"
      ? getDesignDirection(input.directionId)
      : pickDesignDirection(analysis.detectedScenario, text);
  const autoPicked = !anchor && (!input.directionId || input.directionId === "auto");
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
  const closingIdx =
    [lastIdx, lastIdx - 1].find((i) => i > 0 && CLOSING_RE.test(sections[i]?.heading ?? "")) ?? -1;
  const closingSec = closingIdx >= 0 ? sections[closingIdx] : null;
  const body = sections.filter((s) => s !== closingSec);
  const useAgenda = body.length >= 3 && target >= 7;
  const allSourceFacts = body.flatMap((s) => s.facts);
  const useFactsPage = allSourceFacts.length >= 3 && target >= 9;
  let budget = target - 2 - (useAgenda ? 1 : 0) - (useFactsPage ? 1 : 0);

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
  const minSplitSents = density === "reading" ? 4 : 3;
  while (units.length < budget && guard < 40) {
    guard += 1;
    const idx = units.reduce(
      (best, u, i) => (u.sents.length > (units[best]?.sents.length ?? 0) ? i : best),
      0
    );
    const u = units[idx];
    if (!u || u.sents.length < minSplitSents) break;
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
    title: shortenClause(topic, 38),
    points: [shortenClause(firstSentence || `${scenario} · ${audience}`, density === "speaker" ? 42 : 64)],
    data: [],
    visual: visualFor("cover", null, [], direction, topic),
    note: `开场：点明主题「${topic}」与核心问题，面向${audience}对齐本次汇报目标。`,
    source: input.fileName || "资料",
  });

  if (useAgenda) {
    const heads = body.slice(0, 6).map((s) => s.heading);
    slides.push({
      id: newPackSlideId(),
      layout: "agenda",
      title: "汇报脉络与核心议题",
      points: heads,
      data: [],
      visual: visualFor("agenda", null, [], direction, topic),
      note: `本次共分 ${heads.length} 个模块展开：${heads.join(" → ")}。`,
      source: "资料章节结构",
    });
  }

  if (useFactsPage) {
    const top = allSourceFacts.slice(0, 4);
    const headlinePair = top
      .slice(0, 2)
      .map((f) => `${f.label} ${f.value}`)
      .join(" · ");
    const factsTitle =
      headlinePair.length <= 22 ? `关键指标：${headlinePair}` : `关键实证：${top[0].label} ${top[0].value}`;
    slides.push({
      id: newPackSlideId(),
      layout: "big-number",
      title: shortenClause(factsTitle, 28),
      points: top.map((f) => `${f.label}：${f.value}`),
      data: top,
      visual: visualFor("big-number", null, top, direction, topic),
      note: `先用资料中的 ${top.length} 组核心量化指标建立全局锚点，随后逐页展开推导与证据。`,
      source: "资料中的数字事实",
    });
  }

  let prev: PackLayout | null = useFactsPage ? "big-number" : null;
  for (const u of units) {
    const unitRaw = u.sents.join("。");
    const unitFacts = u.parts > 1 ? extractFacts(unitRaw) : u.sec.facts;
    const effectiveFacts = unitFacts.length ? unitFacts : u.part === 1 ? u.sec.facts : [];
    const subSec: SourceSection = {
      heading: u.sec.heading,
      sentences: u.sents,
      facts: effectiveFacts,
      raw: unitRaw || u.sec.raw,
    };
    const layout: PackLayout = chooseLayout(subSec, prev);
    const data =
      layout === "chart"
        ? dominantUnitFacts(effectiveFacts).slice(0, 6)
        : layout === "big-number"
          ? effectiveFacts.slice(0, 3)
          : effectiveFacts.slice(0, 2);

    const assertionTitle = buildAssertionTitle(u.sec.heading, u.sents, data, layout);
    slides.push({
      id: newPackSlideId(),
      layout,
      title: shortenClause(assertionTitle, 28),
      points: pointsFor(layout, u.sents, density),
      data,
      visual: visualFor(layout, subSec, data, direction, topic),
      note: shortenClause(u.sents.slice(0, 4).join(" "), 240),
      source: `资料 · ${u.sec.heading}`,
    });
    prev = layout;
  }

  const rawTakeaways = closingSec?.sentences.length
    ? closingSec.sentences
    : body.map((s) => s.sentences[0]).filter(Boolean);
  const takeaways = rawTakeaways
    .slice(0, density === "speaker" ? 3 : 4)
    .map((s) => shortenClause(s, density === "speaker" ? 42 : 64));
  const summaryTitle = closingSec?.sentences[0]
    ? buildAssertionTitle("核心结论", closingSec.sentences, closingSec.facts, "summary")
    : takeaways[0] && takeaways[0].length <= 26
      ? takeaways[0]
      : "核心结论与下一步行动";

  slides.push({
    id: newPackSlideId(),
    layout: "summary",
    title: shortenClause(summaryTitle, 28),
    points: takeaways.length ? takeaways : ["回顾核心论据", "明确下一步计划与答疑"],
    data: closingSec?.facts.slice(0, 2) ?? [],
    visual: visualFor("summary", closingSec, [], direction, topic),
    note: closingSec ? shortenClause(closingSec.sentences.join(" "), 220) : "回顾核心结论并邀请现场提问。",
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
    talkMinutes: Math.max(3, Math.round(slides.length * (density === "speaker" ? 1.5 : 1.2))),
    tone: TONE_LABEL[analysis.suggestedTone] ?? analysis.suggestedTone,
    density,
    keyFacts: allFacts.map((f) => `${f.label} ${f.value}`),
    sections: body.map((s) => s.heading).slice(0, 8),
    fileName: input.fileName,
    charCount: text.length,
  };
  const rationale = `资料识别为「${scenario}」，面向${audience}；${direction.name}强调${direction.keywords
    .slice(0, 2)
    .join("与")}，${allFacts.length ? `能让资料中的 ${allFacts.length} 组关键数据更醒目` : "能让论点层次更清晰"}。`;

  const resolvedStyle: PackStyle = anchor
    ? {
        ...anchor,
        rationale:
          anchor.rationale ||
          `以参考风格「${anchor.name}」为视觉锚点，面向${audience}，内容全部取自你的资料。`,
      }
    : directionToStyle(direction, rationale);

  return {
    analysis,
    pack: {
      version: 1,
      engine: "smart",
      insight,
      style: resolvedStyle,
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

export function buildPackInstructions(
  slideCount: number,
  language: PackLanguage,
  density: PackDensity = "speaker"
): string {
  const layouts = PACK_LAYOUTS.map((l) => `${l.id}（${l.label}：${l.hint}）`).join("；");
  const directions = DESIGN_DIRECTIONS.map((d) => `${d.id}=${d.name}`).join("；");
  const densitySpec =
    density === "reading"
      ? "当前为【书面汇报密度】：每页 points 写 3–5 条自解释完整论据（每条 ≤56 字），适合无讲解人异步传阅。"
      : "当前为【现场演讲密度】：每页 points 精简为 2–3 条上屏短句（每条 ≤30 字），把完整推导与口播衔接放进 note（演讲备注）。";

  return `你是一位顶级演示文稿策划与视觉设计总监。任务：阅读用户资料，产出一份可直接交给 ChatGPT/Gamma/Kimi/Claude 生成高质量 PPT 的「提示词包」。只输出一个合法 JSON 对象，不要任何解释。

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
    {"layout":"版式 id","title":"一句话结论标题（≤24字，严禁写“背景”“实验结果”等空洞目录词，严禁带 (1/2)）","points":["来自资料的要点"],"data":[{"label":"完整指标名","value":"数值+单位（必须是资料原文数字）"}],"visual":"按数据关系指定具体图表/版式实现方式（≤60字）","note":"口头讲解脉络与细节补充（≤160字）","source":"资料出处（章节名）"}
  ]
}

铁律要求：
1. 恰好 ${slideCount} 页；第 1 页 cover，最后 1 页 summary；版式从以下交替选择，严禁连续 2 页使用相同正文版式，一页只放一种主证据形态：${layouts}。
2. 【幽灵测试 Ghost Deck Test】只按顺序连读第 1..${slideCount} 页的 title，就必须能读通完整的论证逻辑与核心定量结论！除 cover/agenda 外，title 必须是包含动作或判断的完整结论句。
3. ${densitySpec}
4. 有数字的内容优先用 big-number / chart，并把原文数字准确放入 data（保留完整指标名如 Pass@1、MATH-500 准确率）；没有数字绝不用这两个版式，严禁编造任何数据。
5. 色板需满足正文与背景对比度 ≥ 7:1，主色与背景 ≥ 4.5:1；配色必须贴合资料专业气质。
6. ${LANG_HINT[language]}。`;
}

export function buildPackUserInput(input: PackRequestInput, rule: PromptPack, slideCount: number): string {
  const i = rule.insight;
  const anchorLine = input.anchorStyle
    ? `用户从风格参考库指定了参考锚点「${input.anchorStyle.name}」（主色 ${input.anchorStyle.colors
        .map((c) => `${c.role} ${c.hex}`)
        .join(" / ")}；字体 ${input.anchorStyle.headingFont}），请保留其视觉气质并针对资料微调`
    : input.directionId && input.directionId !== "auto"
      ? `用户指定风格基底：${getDesignDirection(input.directionId).name}（请在此基础上为资料定制）`
      : "";
  return [
    `主题：${i.topic}`,
    `受众：${i.audience}`,
    `场景（规则识别，可修正）：${i.scenario}`,
    `用途密度：${input.density === "reading" ? "书面汇报（详实自解释）" : "现场演讲（字少大字）"}`,
    `目标页数：${slideCount}`,
    i.sections.length ? `资料章节：${i.sections.join(" / ")}` : "",
    i.keyFacts.length ? `资料中的数字事实：${i.keyFacts.join("；")}` : "资料中没有可用的数字事实",
    anchorLine,
    `资料原文：\n${input.text.slice(0, 12000)}`,
  ]
    .filter(Boolean)
    .join("\n");
}
