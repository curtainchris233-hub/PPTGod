import {
  DOMAIN_TABS,
  MATERIAL_KIND_LABELS,
  getDefaultAudienceForScenario,
  type DocumentAnalysisResult,
  type DomainTabId,
  type EvidenceDensity,
  type GenerationRouteMode,
  type MaterialKind,
  type PromptItem,
  type RecommendedStyleMatch,
  type SlideType,
  type SourceDocumentSection,
} from "@/types/prompt";

interface ScenarioSignalRule {
  scenario: string;
  domainId: DomainTabId;
  tone: "executive" | "storytelling" | "analytical" | "inspiring";
  keywords: [string, number][];
}

const SCENARIO_RULES: ScenarioSignalRule[] = [
  {
    scenario: "科研基金",
    domainId: "research",
    tone: "analytical",
    keywords: [
      ["国自然", 6],
      ["nsfc", 6],
      ["自然科学基金", 6],
      ["立项依据", 5],
      ["科学问题", 5],
      ["技术路线", 4],
      ["前期基础", 4],
      ["基金委", 5],
      ["面上项目", 5],
      ["青年基金", 5],
      ["重点研发", 4],
      ["假说", 3],
      ["grant", 4],
      ["hypothesis", 3],
    ],
  },
  {
    scenario: "学术答辩",
    domainId: "research",
    tone: "analytical",
    keywords: [
      ["论文答辩", 6],
      ["学位论文", 5],
      ["消融实验", 5],
      ["实验结果", 4],
      ["对照组", 4],
      ["显著性", 4],
      ["p <", 4],
      ["p<", 4],
      ["dataset", 3],
      ["ablation", 4],
      ["baseline", 3],
      ["abstract", 3],
      ["nature", 3],
      ["arxiv", 4],
      ["临床", 4],
      ["转录组", 4],
      ["文献综述", 4],
      ["答辩委员会", 5],
      ["研究动机", 4],
      ["准确率", 2],
    ],
  },
  {
    scenario: "课堂教学",
    domainId: "teaching",
    tone: "inspiring",
    keywords: [
      ["教学目标", 6],
      ["学情分析", 6],
      ["公开课", 6],
      ["说课", 6],
      ["教案", 6],
      ["板书", 5],
      ["随堂", 5],
      ["课堂互动", 5],
      ["重难点", 5],
      ["知识点", 4],
      ["教学过程", 5],
      ["情景导入", 4],
      ["情境导入", 4],
      ["课后作业", 4],
      ["牛顿", 3],
      ["必修", 3],
      ["同学", 2],
      ["例题", 4],
      ["教学设计", 5],
      ["课件", 4],
    ],
  },
  {
    scenario: "教育培训",
    domainId: "teaching",
    tone: "inspiring",
    keywords: [
      ["培训大纲", 5],
      ["内训", 5],
      ["课程体系", 5],
      ["实操演练", 4],
      ["steam", 5],
      ["工作坊", 4],
      ["学员", 4],
      ["赋能培训", 4],
      ["bootcamp", 4],
      ["workshop", 3],
    ],
  },
  {
    scenario: "项目汇报",
    domainId: "workplace",
    tone: "executive",
    keywords: [
      ["pmo", 6],
      ["里程碑", 5],
      ["风险与缓解", 5],
      ["项目进度", 5],
      ["on track", 5],
      ["at risk", 5],
      ["甘特", 4],
      ["交付物", 4],
      ["灰度上线", 4],
      ["排期", 3],
      ["阻塞风险", 5],
      ["sprint", 4],
      ["okr", 4],
      ["复盘", 2],
      ["esg", 4],
      ["精益制造", 4],
      ["双周汇报", 5],
    ],
  },
  {
    scenario: "政务党建",
    domainId: "workplace",
    tone: "executive",
    keywords: [
      ["党建", 6],
      ["党委", 6],
      ["党支部", 6],
      ["高质量发展", 5],
      ["民生实事", 5],
      ["主题教育", 5],
      ["党风廉政", 6],
      ["国企", 4],
      ["央企", 4],
      ["专项工作汇报", 5],
      ["贯彻落实", 5],
      ["政务", 5],
      ["乡村振兴", 5],
    ],
  },
  {
    scenario: "个人述职",
    domainId: "workplace",
    tone: "executive",
    keywords: [
      ["述职", 6],
      ["晋升答辩", 6],
      ["star", 4],
      ["个人贡献", 5],
      ["试用期转正", 6],
      ["绩效自评", 6],
      ["个人作品集", 5],
      ["求职面试", 5],
      ["主导项目", 4],
      ["年终总结与规划", 4],
    ],
  },
  {
    scenario: "咨询汇报",
    domainId: "workplace",
    tone: "executive",
    keywords: [
      ["董事会", 5],
      ["经营复盘", 5],
      ["毛利率", 5],
      ["arr", 4],
      ["净留存", 4],
      ["市场格局", 4],
      ["战略建议", 5],
      ["swot", 4],
      ["研报", 4],
      ["财务模型", 4],
      ["竞争壁垒", 4],
      ["麦肯锡", 5],
      ["咨询", 3],
    ],
  },
  {
    scenario: "商业路演",
    domainId: "business-tech",
    tone: "inspiring",
    keywords: [
      ["融资", 6],
      ["bp", 4],
      ["商业计划书", 6],
      ["投资人", 5],
      ["估值", 5],
      ["天使轮", 5],
      ["a轮", 5],
      ["退出路径", 4],
      ["pitch deck", 6],
      ["市场规模", 4],
      ["tam", 4],
      ["商业模式", 4],
    ],
  },
  {
    scenario: "产品发布",
    domainId: "business-tech",
    tone: "inspiring",
    keywords: [
      ["发布会", 5],
      ["新品发布", 6],
      ["核心卖点", 5],
      ["产品升级", 4],
      ["用户体验", 3],
      ["版本迭代", 4],
      ["2.0", 2],
      ["3.0", 2],
      ["工作台", 3],
      ["知识引擎", 3],
      ["keynote", 4],
      ["launch", 3],
    ],
  },
  {
    scenario: "技术分享",
    domainId: "business-tech",
    tone: "analytical",
    keywords: [
      ["系统架构", 5],
      ["微服务", 5],
      ["kubernetes", 5],
      ["高并发", 5],
      ["吞吐量", 4],
      ["p99", 5],
      ["延迟", 3],
      ["开源", 3],
      ["sdk", 4],
      ["api", 3],
      ["分布式", 4],
      ["数据库", 3],
      ["kernel", 4],
      ["llm", 3],
      ["agent", 3],
    ],
  },
  {
    scenario: "品牌提案",
    domainId: "business-tech",
    tone: "storytelling",
    keywords: [
      ["品牌焕新", 6],
      ["品牌提案", 6],
      ["视觉识别", 5],
      ["全案策划", 5],
      ["主理人", 4],
      ["美学空间", 4],
      ["零售体验", 4],
      ["联名", 4],
      ["高定", 4],
      ["lookbook", 5],
      ["消费者洞察", 4],
    ],
  },
  {
    scenario: "生活纪实",
    domainId: "lifestyle",
    tone: "storytelling",
    keywords: [
      ["游记", 6],
      ["旅行", 5],
      ["自驾", 5],
      ["极光", 5],
      ["攻略", 4],
      ["婚礼", 6],
      ["请柬", 6],
      ["胶片", 5],
      ["摄影", 4],
      ["手账", 5],
      ["食谱", 5],
      ["生活方式", 4],
      ["环岛", 5],
      ["打卡", 4],
      ["citywalk", 5],
    ],
  },
  {
    scenario: "文化创意",
    domainId: "lifestyle",
    tone: "storytelling",
    keywords: [
      ["读书会", 6],
      ["书单", 5],
      ["策展", 5],
      ["非遗", 5],
      ["宋韵", 5],
      ["茶饮", 4],
      ["文创", 5],
      ["东方美学", 5],
      ["书店", 5],
      ["展陈", 5],
    ],
  },
  {
    scenario: "年度总结",
    domainId: "workplace",
    tone: "storytelling",
    keywords: [
      ["年度总结", 6],
      ["年终盘点", 6],
      ["年度回顾", 5],
      ["这一年", 4],
      ["感恩", 3],
      ["展望明年", 4],
      ["全年回顾", 5],
    ],
  },
];

function extractKeyMetrics(text: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const metricRe =
    /(?:[¥$€]\s*\d+(?:\.\d+)?\s*(?:亿元|万元|亿|万|K|M|B)?)|(?:[+\-]?\d+(?:\.\d+)?\s*(?:%|pp|倍|x|X|亿元|万元|亿|万|分钟|小时|天|秒|ms|公里|km|组|道|篇|项|家|个|°C|℃|GB))|(?:n\s*=\s*\d+)|(?:p\s*<\s*0\.\d+)/g;

  const clauses = text
    .split(/[\n，,。；;（）()]+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);

  for (const clause of clauses) {
    const matches = clause.match(metricRe);
    if (!matches) continue;

    for (const rawMatch of matches) {
      const token = rawMatch.replace(/\s+/g, " ").trim();
      const dedupeKey = token.toLowerCase();
      if (seen.has(dedupeKey)) continue;

      const cleanedClause = clause
        .replace(/^[\-\*•\d一二三四五六七八九十、.\s]+/, "")
        .replace(/\s+/g, " ")
        .trim();

      // Skip reagent/brand prefix tokens like "10x Visium"
      const idx = cleanedClause.indexOf(rawMatch);
      const afterToken =
        idx >= 0 ? cleanedClause.slice(idx + rawMatch.length).trim() : "";
      if (/^\d+x$/i.test(token) && /^[A-Z][a-z]+/.test(afterToken)) {
        continue;
      }

      let chip = token;
      if (cleanedClause.length <= 16) {
        chip = cleanedClause;
      } else if (idx > 0) {
        // Split preceding text at natural semantic boundaries so we never slice mid-word
        const beforeParts = cleanedClause
          .slice(0, idx)
          .split(/[：:、与和及在将把对并让使中从至]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const lastPart = beforeParts[beforeParts.length - 1] || "";
        const trimmedLabel = lastPart
          .replace(/^(?:实现|达到|提升至|降低至|稳定在|目标|预计|发表|完成|超过|约|共|已|可)/, "")
          .trim();
        if (trimmedLabel.length >= 2 && trimmedLabel.length <= 8) {
          chip = `${trimmedLabel} ${token}`;
        }
      }

      seen.add(dedupeKey);
      candidates.push(chip);
      if (candidates.length >= 6) return candidates;
    }
  }
  return candidates;
}

function extractKeySections(
  text: string,
  suggestedTopic: string
): SourceDocumentSection[] {
  const rawLines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headingRe =
    /^(?:#{1,4}\s+|[一二三四五六七八九十]+[、.．]\s*|\d{1,2}[、.．)]\s*|第[一二三四五六七八九十\d]+[章节部分步]\s*|(?:背景|痛点|目标|动机|方法|架构|方案|实验|结果|数据|对比|风险|里程碑|总结|展望|路线|行程|成效|举措|学情|探究)[：:])/;

  const sections: SourceDocumentSection[] = [];
  let curHeading = "";
  let curBodies: string[] = [];

  const flush = () => {
    if (!curHeading) return;
    const summary = curBodies.join(" ").replace(/\s+/g, " ").trim().slice(0, 110);
    sections.push({
      heading: curHeading.slice(0, 34),
      summary: summary || `围绕「${curHeading.slice(0, 20)}」展开结构化论证与视觉呈现`,
    });
    curHeading = "";
    curBodies = [];
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (i === 0 && line.replace(/^#+\s*/, "").trim() === suggestedTopic.trim()) {
      continue;
    }
    const stripped = line.replace(/^#+\s*/, "").trim();
    const isShortHeading =
      headingRe.test(line) && stripped.length <= 42 && !/[。！？]$/.test(stripped);

    if (isShortHeading) {
      flush();
      curHeading = stripped
        .replace(/^[一二三四五六七八九十]+[、.．]\s*/, "")
        .replace(/^\d{1,2}[、.．)]\s*/, "")
        .replace(/[：:]$/, "")
        .trim();
    } else if (curHeading) {
      if (curBodies.length < 3) curBodies.push(stripped);
    } else if (stripped.length >= 10) {
      // Split colon-prefixed sentences ("研究动机：...") into heading + summary
      const colonIdx = stripped.search(/[：:]/);
      if (colonIdx >= 2 && colonIdx <= 18) {
        flush();
        curHeading = stripped.slice(0, colonIdx).trim();
        const rest = stripped.slice(colonIdx + 1).trim();
        if (rest) curBodies.push(rest);
      } else if (sections.length < 5) {
        sections.push({
          heading: `核心要点 ${sections.length + 1}`,
          summary: stripped.slice(0, 110),
        });
      }
    }
    if (sections.length >= 6) break;
  }
  flush();

  if (sections.length === 0 && rawLines.length > 0) {
    const chunks = rawLines.slice(0, 4);
    chunks.forEach((c, idx) => {
      sections.push({
        heading: `核心段落 ${idx + 1}`,
        summary: c.slice(0, 110),
      });
    });
  }

  return sections.slice(0, 6);
}

/**
 * Automatically classifies raw user input into via-ppt-rescue-maker's 6 material
 * states without asking the user a single extra question.
 */
export function detectMaterialKind(opts: {
  text: string;
  fileName: string;
  fileType?: string;
  keyMetricsCount: number;
  keySectionsCount: number;
}): MaterialKind {
  const ext = (opts.fileType || opts.fileName.split(".").pop() || "").toLowerCase();
  if (ext === "pptx" || ext === "ppt") {
    return "existing-pptx";
  }

  const trimmed = opts.text.trim();
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (trimmed.length < 90 && lines.length <= 3) {
    return "topic-only";
  }

  // Detect Markdown tables, CSV-like rows, or dense KPI reports
  const tableRows = lines.filter(
    (l) => (l.includes("|") && l.split("|").length >= 3) || l.split(/[\t,，]/).length >= 4
  ).length;
  if (
    tableRows >= 3 ||
    (opts.keyMetricsCount >= 5 && trimmed.length < 900)
  ) {
    return "data-table";
  }

  const headingLines = lines.filter((l) =>
    /^(?:#{1,3}\s+|[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[章节部分]|[\d]+[.、]\s*|\-\s+|\*\s+)/.test(
      l
    )
  ).length;
  const avgLineLen =
    lines.reduce((s, l) => s + l.length, 0) / Math.max(1, lines.length);

  if (headingLines >= 3 && avgLineLen < 38) {
    return "rough-outline";
  }
  if (trimmed.length >= 380 && opts.keySectionsCount >= 2) {
    return "full-document";
  }
  return "scattered-notes";
}

function inferRepresentativeSlideType(
  scenario: string,
  hasHeavyData: boolean,
  materialKind: MaterialKind
): SlideType {
  if (materialKind === "data-table" || hasHeavyData) {
    return "data";
  }
  if (scenario === "科研基金" || scenario === "学术答辩" || scenario === "技术分享") {
    return "process";
  }
  if (scenario === "商业路演" || scenario === "咨询汇报" || scenario === "年度总结") {
    return "data";
  }
  if (scenario === "项目汇报" || scenario === "政务党建") {
    return "timeline";
  }
  if (scenario === "课堂教学" || scenario === "教育培训") {
    return "comparison";
  }
  return "image-split";
}

export function analyzeDocumentAndRecommendStyles(input: {
  text: string;
  fileName: string;
  fileType?: string;
  suggestedTopic: string;
  suggestedSubtitle: string;
  styles: PromptItem[];
}): DocumentAnalysisResult {
  const combined = `${input.fileName}\n${input.suggestedTopic}\n${input.suggestedSubtitle}\n${input.text}`.toLowerCase();

  // 1. Score all 15 scenarios deterministically
  const scoredScenarios = SCENARIO_RULES.map((rule) => {
    let score = 0;
    const hits: string[] = [];
    for (const [kw, weight] of rule.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        score += weight;
        hits.push(kw);
      }
    }
    return { rule, score, hits };
  }).sort((a, b) => b.score - a.score);

  const top = scoredScenarios[0];
  const hasStrongHit = top && top.score >= 4;
  const detectedScenario = hasStrongHit ? top.rule.scenario : "咨询汇报";
  const detectedDomainId: DomainTabId = hasStrongHit
    ? top.rule.domainId
    : "workplace";
  const suggestedTone = hasStrongHit ? top.rule.tone : "executive";
  const confidence = hasStrongHit
    ? Math.min(98, Math.round(74 + Math.min(24, top.score * 1.4)))
    : 76;

  const domainMeta =
    DOMAIN_TABS.find((t) => t.id === detectedDomainId) ?? DOMAIN_TABS[0];

  // 2. Extract structured metrics & section digests
  const keyMetrics = extractKeyMetrics(input.text);
  const keySections = extractKeySections(input.text, input.suggestedTopic);

  // 3. Auto-triage 6 material states + evidence density + talk-time estimate
  const materialKind = detectMaterialKind({
    text: input.text,
    fileName: input.fileName,
    fileType: input.fileType,
    keyMetricsCount: keyMetrics.length,
    keySectionsCount: keySections.length,
  });
  const materialStrategy = MATERIAL_KIND_LABELS[materialKind].strategy;

  const isHighEvidenceScenario =
    detectedScenario === "科研基金" ||
    detectedScenario === "学术答辩" ||
    detectedScenario === "咨询汇报" ||
    detectedScenario === "项目汇报" ||
    materialKind === "data-table";
  const isLightScenario =
    detectedScenario === "生活纪实" || detectedScenario === "文化创意";
  const recommendedEvidenceDensity: EvidenceDensity = isHighEvidenceScenario
    ? "high-evidence"
    : isLightScenario
    ? "light"
    : "balanced";
  const recommendedRouteMode: GenerationRouteMode =
    materialKind === "existing-pptx" ? "beautify-1to1" : "restructure";

  // 4. Estimate ideal slide count & speaking minutes from length & extracted chapters
  const charCount = input.text.length;
  const rawSuggested =
    keySections.length >= 5
      ? Math.min(14, keySections.length + 4)
      : charCount > 3500
      ? 12
      : charCount > 1500
      ? 10
      : charCount > 600
      ? 8
      : 7;
  const suggestedSlideCount = Math.max(6, Math.min(16, rawSuggested));
  const estimatedTalkMinutes = Math.max(
    3,
    Math.round(suggestedSlideCount * (recommendedEvidenceDensity === "high-evidence" ? 1.2 : 0.85))
  );
  const suggestedAudience = getDefaultAudienceForScenario(detectedScenario);

  // 5. Score all public styles and pick Top 3
  const hasHeavyData = keyMetrics.length >= 3;
  const representativeSlideType = inferRepresentativeSlideType(
    detectedScenario,
    hasHeavyData,
    materialKind
  );
  const isFormalPrint =
    detectedScenario === "科研基金" ||
    detectedScenario === "学术答辩" ||
    detectedScenario === "政务党建" ||
    detectedScenario === "咨询汇报" ||
    detectedScenario === "项目汇报";

  const publicStyles = input.styles.filter((s) => s.isPublic !== false);
  const styleScores: RecommendedStyleMatch[] = publicStyles.map((st) => {
    let score = 54;
    const reasons: string[] = [];

    if (st.scenario === detectedScenario) {
      score += 28;
      reasons.push(`精准契合「${detectedScenario}」文档场景`);
    } else if (domainMeta.scenarios.includes(st.scenario)) {
      score += 17;
      reasons.push(`同属「${domainMeta.label}」专业视觉体系`);
    }

    // Tag & title semantic overlap with document text
    let tagHits = 0;
    for (const tag of st.tags) {
      if (tag.length >= 2 && combined.includes(tag.toLowerCase())) {
        tagHits += 1;
      }
    }
    if (tagHits > 0) {
      score += Math.min(10, tagHits * 5);
      reasons.push("关键词高度匹配源文档主题");
    }

    if (hasHeavyData && st.visualSpec.layout.density !== "airy") {
      score += 6;
      reasons.push(`适配文档中 ${keyMetrics.length} 组量化数据与图表呈现`);
    } else if (!hasHeavyData && st.visualSpec.layout.density === "airy") {
      score += 5;
      reasons.push("高留白叙事版式增强观感呼吸感");
    }

    if (isFormalPrint && (st.colorFamily === "light" || st.colorFamily === "warm")) {
      score += 4;
      reasons.push("高对比浅底适配评审投影与打印阅读");
    } else if (
      (detectedScenario === "产品发布" || detectedScenario === "技术分享") &&
      st.colorFamily === "dark"
    ) {
      score += 4;
      reasons.push("深色剧场风强化科技与大屏冲击力");
    }

    // Subtle popularity tie-breaker
    score += Math.min(4, Math.floor(st.likesCount / 180));
    const finalScore = Math.min(99, Math.max(68, score));

    if (reasons.length === 0) {
      reasons.push(`${st.styleCategory}高口碑母版，支持 12 种完整页型`);
    }

    return {
      id: st.id,
      slug: st.slug,
      title: st.title,
      englishTitle: st.englishTitle,
      scenario: st.scenario,
      styleCategory: st.styleCategory,
      score: finalScore,
      reasons: reasons.slice(0, 2),
    };
  });

  const recommendedStyles = styleScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    detectedScenario,
    detectedDomainId,
    detectedDomainLabel: domainMeta.label,
    confidence,
    suggestedAudience,
    suggestedSlideCount,
    suggestedTone,
    materialKind,
    materialStrategy,
    recommendedEvidenceDensity,
    recommendedRouteMode,
    estimatedTalkMinutes,
    representativeSlideType,
    keyMetrics,
    keySections,
    recommendedStyles,
  };
}
