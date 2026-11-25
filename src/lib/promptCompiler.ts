import {
  type CustomizerParams,
  type DeckSlideItem,
  type PromptItem,
  type SlideType,
  SLIDE_TYPE_LABELS,
  type VisualSpec,
} from "@/types/prompt";

const TONE_LABELS: Record<
  CustomizerParams["tone"],
  { zh: string; en: string }
> = {
  executive: { zh: "高管决策·结论先行", en: "Executive & Insight-First" },
  storytelling: { zh: "故事叙事·情绪共鸣", en: "Narrative & Storytelling" },
  analytical: { zh: "理性分析·数据驱动", en: "Analytical & Data-Driven" },
  inspiring: { zh: "发布会感·愿景驱动", en: "Visionary & Keynote-Style" },
};

const LANG_LABELS: Record<CustomizerParams["language"], string> = {
  zh: "全中文（专业术语可保留规范英文缩写）",
  en: "English Only (Native executive copywriting)",
  bilingual: "中英双语（中文主标题 + 精炼英文眉题/副标）",
};

const DENSITY_MAP = {
  airy: {
    zh: "高留白呼吸感（留白 >= 45%，每页 <= 40 字）",
    en: "Airy (>= 45% whitespace, minimal copy)",
  },
  balanced: {
    zh: "均衡结构（留白 30-40%，观点与图表平衡）",
    en: "Balanced (30-40% whitespace, clean hierarchy)",
  },
  dense: {
    zh: "高信息密度（咨询/学术型，严谨分区不拥挤）",
    en: "Information-dense (structured consulting/academic grid)",
  },
};

export interface SlideOutlineItem {
  range: string;
  chapter: string;
  focus: string;
}

function normalizeSlideCount(slideCount: number): number {
  const normalized =
    Number.isFinite(slideCount) && slideCount > 0 ? Math.round(slideCount) : 12;
  return Math.max(5, Math.min(40, normalized));
}

export function buildAdaptiveOutline(
  slideCount: number,
  topic: string
): SlideOutlineItem[] {
  const safeCount = normalizeSlideCount(slideCount);
  const c1End = Math.max(2, Math.round(safeCount * 0.25));
  const c2End = Math.max(c1End + 1, Math.round(safeCount * 0.55));
  const c3End = Math.max(c2End + 1, Math.round(safeCount * 0.85));

  const pad = (n: number) => String(n).padStart(2, "0");

  return [
    {
      range: `P${pad(2)}–${pad(c1End)}`,
      chapter: "背景洞察与核心破题",
      focus: `厘清「${topic}」所处的趋势拐点与关键待解痛点`,
    },
    {
      range: `P${pad(c1End + 1)}–${pad(c2End)}`,
      chapter: "核心方案与架构设计",
      focus: "拆解方法论、关键能力模块与差异化竞争壁垒",
    },
    {
      range: `P${pad(c2End + 1)}–${pad(c3End)}`,
      chapter: "量化验证与数据增长",
      focus: "呈现核心 KPI 对比、基准数据图表与标杆落地案例",
    },
    {
      range: `P${pad(c3End + 1)}–${pad(safeCount)}`,
      chapter: "路线规划与行动呼吁",
      focus: "明确里程碑排期、资源配置与下一步决策清单",
    },
  ];
}

const RGB_COLOR_RE =
  /^rgba?\(\s*(\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(\d+(?:\.\d+)?|\.\d+)\s*[,\s]\s*(\d+(?:\.\d+)?|\.\d+)(?:\s*[,/]\s*(\d+(?:\.\d+)?%?|\.\d+%?))?\s*\)$/i;

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function compositeRgb(
  r: number,
  g: number,
  b: number,
  alpha: number,
  bg: [number, number, number]
): [number, number, number] {
  const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  if (a >= 1) return [clampByte(r), clampByte(g), clampByte(b)];
  return [
    clampByte(r * a + bg[0] * (1 - a)),
    clampByte(g * a + bg[1] * (1 - a)),
    clampByte(b * a + bg[2] * (1 - a)),
  ];
}

function hexToRgbTuple(
  input: string | undefined,
  bg: [number, number, number] = [255, 255, 255]
): [number, number, number] {
  if (typeof input !== "string" || !input.trim()) {
    return [128, 128, 128];
  }
  const trimmed = input.trim();
  if (trimmed.startsWith("#")) {
    const clean = trimmed.slice(1);
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }
    if (/^[0-9a-fA-F]{3}$/.test(clean)) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16),
      ];
    }
    if (/^[0-9a-fA-F]{8}$/.test(clean)) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      const a = parseInt(clean.slice(6, 8), 16) / 255;
      return compositeRgb(r, g, b, a, bg);
    }
    if (/^[0-9a-fA-F]{4}$/.test(clean)) {
      const r = parseInt(clean[0] + clean[0], 16);
      const g = parseInt(clean[1] + clean[1], 16);
      const b = parseInt(clean[2] + clean[2], 16);
      const a = parseInt(clean[3] + clean[3], 16) / 255;
      return compositeRgb(r, g, b, a, bg);
    }
    return [128, 128, 128];
  }

  const rgbMatch = trimmed.match(RGB_COLOR_RE);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    const alphaRaw = rgbMatch[4];
    if (alphaRaw !== undefined) {
      const alpha = alphaRaw.endsWith("%")
        ? parseFloat(alphaRaw.slice(0, -1)) / 100
        : parseFloat(alphaRaw);
      return compositeRgb(r, g, b, alpha, bg);
    }
    return [clampByte(r), clampByte(g), clampByte(b)];
  }

  return [128, 128, 128];
}

const SLIDE_COMPOSITION_GUIDE: Record<SlideType, { zh: string; en: string }> = {
  cover: {
    zh: "PPT 封面页构图：醒目大标题与克制副标题，配以本风格的标志性几何/留白视觉构成与受众元信息",
    en: "Presentation Cover Slide layout featuring bold headline and refined subtitle, generous negative space, signature graphic composition",
  },
  agenda: {
    zh: "PPT 目录页构图：清晰的 01-04 章节编号序列、精致分割线与阅读引导层级，展示四段式演进结构",
    en: "Presentation Agenda Slide layout with clean 01-04 numbered sections, crisp typographic hierarchy, structured table of contents",
  },
  process: {
    zh: "PPT 方法架构页构图：横向递进的三步闭环模块卡片 + 箭头连接逻辑 + 底部统一技术/管理底座横条",
    en: "Presentation 3-Step Architecture & Methodology Slide, clean interconnected modular cards over a unified foundation bar",
  },
  "image-split": {
    zh: "PPT 图文分栏展示页构图：左/右 5:5 视觉主图容器（配极简图注与风格一致插画/产品实拍）搭配对侧结论标题与 3 条结构化价值要点",
    en: "Presentation 50/50 Visual Split Slide pairing a crisp framed hero illustration or product visual on one side with structured takeaway callouts on the opposite side",
  },
  data: {
    zh: "PPT 数据洞察页构图：顶部结论标题 + 左侧极简矢量双柱对比趋势图 + 右侧 3 组大号 KPI 指标卡片",
    en: "Presentation Data Insight Slide featuring top action-title, clean minimalist vector bar & trend chart on left, bold KPI stat callout cards on right",
  },
  "funnel-donut": {
    zh: "PPT 转化漏斗 / 环形占比数据页构图：左侧精致梯形转化漏斗图或环形 Donut 饼图（居中总览数值），右侧四级分层指标说明卡",
    en: "Presentation Funnel & Donut Share Slide featuring a clean stepped conversion funnel or concentric donut ring chart paired with 4 structured breakdown cards",
  },
  comparison: {
    zh: "PPT 双栏对比页构图：左右并置结构卡片，清晰对比现状痛点与推荐升级方案，高亮核心优势指标",
    en: "Presentation Two-Column Comparison Matrix Slide, structured side-by-side cards contrasting baseline vs recommended approach with accent highlights",
  },
  swot: {
    zh: "PPT SWOT 四象限战略矩阵页构图：严谨 2×2 卡片网格，依次排布优势 S、劣势 W、机会 O、威胁 T，顶部字母色块徽章清晰区分内外维",
    en: "Presentation 2x2 SWOT Strategy Matrix Slide with balanced quadrant cards for Strengths, Weaknesses, Opportunities, and Threats with crisp monogram badges",
  },
  timeline: {
    zh: "PPT 路线图时间轴页构图：贯穿画面的水平里程碑轴线与 4 个阶段节点卡片，标明时间节点与核心交付物",
    en: "Presentation Horizontal Roadmap & Milestone Timeline Slide, 4 connected phase nodes with clear deliverables and dates",
  },
  "team-grid": {
    zh: "PPT 核心团队展示页构图：3–4 列人物卡片矩阵，包含几何头像徽标/实拍肖像位、姓名、职衔标签与精炼专业履历",
    en: "Presentation Executive Team Grid Slide showcasing 3-4 leadership cards with geometric monogram avatars, roles, and concise credentials",
  },
  quote: {
    zh: "PPT 核心金句洞察页构图：艺术感大号引号锚点 + 居中或黄金分割排布的震撼洞察结论句 + 底部三项支撑事实",
    en: "Presentation Executive Quote & Key Insight Slide, oversized typographic quote mark, impactful thesis statement, supporting proof metrics",
  },
  closing: {
    zh: "PPT 总结结尾页构图：大气收束主标题、3 条可执行行动支柱卡片与首尾呼应的精致页脚信息条",
    en: "Presentation Closing Slide with strong final takeaway statement, 3 concise action pillars, balanced editorial footer",
  },
};

function buildDomainGuidelines(scenario: string): {
  heading: string;
  rules: string[];
} | null {
  if (scenario === "课堂教学" || scenario === "教育培训") {
    return {
      heading: "课堂教学与认知负荷铁律（Pedagogical Guardrails）",
      rules: [
        "严格遵循「情境导入设问 → 核心概念拆解 → 典型例题/案例演练 → 随堂小测与知识树复盘」四段式教学闭环。",
        "大字号高可读标准：主标题 ≥ 36pt、正文 ≥ 22pt，确保教室后排学生与希沃白板/线上录屏均无障碍阅读。",
        "在关键知识页插入 1 条「课堂互动设问 / 易错点避坑提示」，在讲稿备注中附带时间分配与师生互动引导词。",
      ],
    };
  }
  if (scenario === "科研基金" || scenario === "学术答辩") {
    return {
      heading: "科研诚信与证据优先铁律（Scientific Evidence Guardrails）",
      rules: [
        "零幻觉红线：严禁捏造任何实验数值、p 值、样本量或引用文献；若原始资料缺失数据，必须显式占位为 `[待补实验数据]`。",
        "证据占据版面主体：标题采用「发现/提出/验证」结论句式，减少无意义装饰性彩色卡片，保留样本量 n、对照基线与误差/显著性标注。",
        "严格遵循科学汇报逻辑链：科学问题与动机 → 核心假说/方法架构 → 定量实验与消融对比 → 局限性讨论与未来工作。",
      ],
    };
  }
  if (scenario === "项目汇报") {
    return {
      heading: "PMO 项目管控与风险透明铁律（Delivery Governance）",
      rules: [
        "首屏或概览页明确标出总体健康度（绿 ON TRACK / 黄 WATCH / 红 AT RISK），先给结论与需决策事项再展开细节。",
        "所有里程碑与阻塞风险必须包含明确责任人（Owner）、影响范围、截止日期（ETA）与可执行缓解对策，拒绝流水账。",
      ],
    };
  }
  if (scenario === "政务党建") {
    return {
      heading: "政务与国央企规范表达铁律（Formal Civic Standards）",
      rules: [
        "提纲挈领、用语规范庄重，章节小标题善用凝练对仗短语，避免轻浮网络热词与过度花哨动画。",
        "每一项工作举措均须配量化实绩数据或重点工程落地案例，清晰呈现「总体成效 → 核心举措 → 问题剖析 → 下步部署」。",
      ],
    };
  }
  if (scenario === "个人述职") {
    return {
      heading: "STAR 述职与作品集叙事铁律（STAR & Impact Focus）",
      rules: [
        "每个代表项目均按 STAR 法则展开（背景 Situation → 挑战目标 Task → 个人核心主导行动 Action → 量化业务结果 Result）。",
        "清晰区分团队业绩与个人不可替代贡献，提炼可复用的方法论资产，并在结尾给出面向高一职级/目标岗位的清晰规划。",
      ],
    };
  }
  if (scenario === "生活纪实") {
    return {
      heading: "生活纪实与松弛叙事铁律（Lifestyle & Storytelling）",
      rules: [
        "彻底摒弃冷冰冰的职场公文腔，多用有温度的短句、时间地点标注与留白呼吸感，让照片与情感记忆成为主角。",
        "每页聚焦 1 个画面故事或 3 条精炼实用贴士（如行程节点、装备/开销清单、暖心金句），兼具观赏性与收藏价值。",
      ],
    };
  }
  return null;
}

export function compilePrompt(
  prompt: PromptItem,
  spec: VisualSpec,
  params: CustomizerParams,
  activeSlide: SlideType = "cover"
): string {
  const topic = (params.topic || "").trim() || prompt.sampleTopic;
  const subtitle = (params.subtitle || "").trim() || prompt.sampleSubtitle;
  const audience = (params.audience || "").trim() || "核心决策者与业务团队";
  const slideCount = normalizeSlideCount(params.slideCount);
  const toneInfo = TONE_LABELS[params.tone] ?? TONE_LABELS.executive;
  const langLabel = LANG_LABELS[params.language] ?? LANG_LABELS.zh;
  const densityInfo = DENSITY_MAP[spec.layout.density] ?? DENSITY_MAP.balanced;
  const outline = buildAdaptiveOutline(slideCount, topic);
  const domainGuide = buildDomainGuidelines(
    params.sourceDigest?.detectedScenario || prompt.scenario
  );
  const digest = params.sourceDigest;
  const sourceBlocks: string[] = [];
  if (digest) {
    if (digest.fileName) {
      sourceBlocks.push(`- **源文档文件**：${digest.fileName}`);
    }
    if (digest.routeMode === "beautify-1to1") {
      sourceBlocks.push(
        `- **改版模式（1:1 保词换肤）**：严格保留原 PPT 页数、页序与核心业务措辞，仅重构视觉版式、排版层级与母版配色，不得擅自删改事实结论。`
      );
    }
    if (digest.evidenceDensity) {
      const densHint =
        digest.evidenceDensity === "high-evidence"
          ? "高证据答辩模式：每页结论必须附带源材料数据、实验/业务出处或明确标注 [待核验]，绝不编造数字或 DOI。"
          : digest.evidenceDensity === "light"
          ? "轻巧讲解模式：大幅精简正文词数，突出视觉焦点与口语提词节奏。"
          : "均衡模式：核心观点与关键量化论据并重，保持呼吸感留白。";
      sourceBlocks.push(`- **证据密度与来源责任**：${densHint}`);
    }
    if (digest.keyMetrics && digest.keyMetrics.length > 0) {
      sourceBlocks.push(
        `- **必须保留的关键事实与量化数据**：\n${digest.keyMetrics
          .map((m) => `  - ${m}`)
          .join("\n")}`
      );
    }
    if (digest.keySections && digest.keySections.length > 0) {
      sourceBlocks.push(
        `- **源文档提炼章节大纲**：\n${digest.keySections
          .map((s, idx) => `  ${idx + 1}. **${s.heading}**：${s.summary}`)
          .join("\n")}`
      );
    }
    if (digest.excerpt && digest.excerpt.trim()) {
      sourceBlocks.push(
        `- **原始参考正文节选（供事实核对，请勿编造数字）**：\n> ${digest.excerpt
          .trim()
          .slice(0, 1200)
          .replace(/\n+/g, "\n> ")}`
      );
    }
  }
  const sourceMdSection =
    sourceBlocks.length > 0
      ? `\n\n## 源文档提炼素材（请严格基于以下真实内容整理成 PPT）\n${sourceBlocks.join("\n")}`
      : "";

  const domainMdSection =
    (domainGuide
      ? `\n\n## 领域专属专业铁律：${domainGuide.heading}\n${domainGuide.rules
          .map((r) => `- ${r}`)
          .join("\n")}`
      : "") + sourceMdSection;
  const { palette, typography, layout } = spec;
  const rawChartColors = Array.isArray(palette.chartColors)
    ? palette.chartColors
    : [];
  const chartColors: [string, string, string, string] = [
    rawChartColors[0] || palette.accent,
    rawChartColors[1] || palette.text,
    rawChartColors[2] || palette.muted,
    rawChartColors[3] || palette.border,
  ];

  if (params.targetTool === "claude-html") {
    return `# Role: 顶级演示文稿视觉设计师 & 前端幻灯片工程师

请为我生成一套完整的 **16:9 交互式 HTML 幻灯片（Single-file HTML + CSS + SVG）**，支持键盘左右方向键翻页、页码指示、演讲者备注切换与全屏演示模式。

## 1. 演示核心信息
- **PPT 主题**：${topic}
- **副标题 / 副叙事**：${subtitle}
- **目标受众**：${audience}
- **建议总页数**：${slideCount} 页（涵盖封面、目录、图文分栏页、方法架构页、柱状数据页、转化漏斗/环形占比页、双栏对比页、SWOT 战略矩阵、路线图、核心团队页、金句与行动结尾页）
- **输出语言**：${langLabel}
- **表达基调**：${toneInfo.zh}（${toneInfo.en}）

## 2. 视觉设计系统（必须严格落地为 CSS Variables）
> 风格锚点：**${prompt.title}（${prompt.englishTitle}）**

\`\`\`css
:root {
  --slide-bg: ${palette.bg};
  --slide-surface: ${palette.surface};
  --slide-text: ${palette.text};
  --slide-muted: ${palette.muted};
  --slide-accent: ${palette.accent};
  --slide-accent-soft: ${palette.accentSoft};
  --slide-border: ${palette.border};
  --chart-1: ${chartColors[0]};
  --chart-2: ${chartColors[1]};
  --chart-3: ${chartColors[2]};
  --chart-4: ${chartColors[3]};
  --radius: ${layout.cornerRadius}px;
}
\`\`\`

### 视觉约束拆解
1. **美学氛围**：${prompt.promptAnatomy.style}
2. **色彩纪律**：${prompt.promptAnatomy.palette}
3. **字体层级**：主标题参考 ${typography.headingFontLabel}（字重 ${typography.titleWeight}，字距 ${typography.titleTracking}），正文参考 ${typography.bodyFontLabel}。${prompt.promptAnatomy.typography}
4. **版式网格**：${prompt.promptAnatomy.layout}；信息密度：${densityInfo.zh}；圆角规范：${layout.cornerRadius}px。
5. **数据与图表**：${prompt.promptAnatomy.content}（所有图表请用原生清晰 SVG 绘制，标注数据值与单位）。

## 3. 建议章节节奏（共 ${slideCount} 页）
- **P01 封面页**：主标题「${topic}」、副标题「${subtitle}」、受众与日期元信息
${outline.map((item) => `- **${item.range} ${item.chapter}**：${item.focus}`).join("\n")}

## 4. 工程交付要求
- 严格锁定 16:9 比例画布（如 \`aspect-ratio: 16 / 9\`，自适应居中缩放，绝不溢出裁切）。
- 每一页采用不同的版式变体（图文分栏、三步架构图、KPI + 柱状图、转化漏斗/环形占比图、双栏对比、2×2 SWOT 矩阵、横向路线图、核心团队卡片、总结三支柱），禁止每页重复相同列表模板。
- 不要使用外部无法加载的图片 URL，所有图形装饰和图表使用纯净 SVG 与 CSS 精密绘制，并附带 \`@page { size: 13.333in 7.5in; margin: 0; }\` 与 \`@media print\` 分页打印样式方便一键导出矢量 PDF。${domainMdSection}`;
  }

  if (params.targetTool === "gamma-kimi") {
    return `【AI PPT 生成指令 · 适配 Gamma / Kimi PPT / 讯飞智文 / WPS AI】

一、基础任务设定
- 演示主题：${topic}
- 副标题：${subtitle}
- 面向听众：${audience}
- 规划页数：约 ${slideCount} 页（16:9 宽屏）
- 语言要求：${langLabel}
- 叙事基调：${toneInfo.zh}

二、视觉设计风格规范（请按此统一全套母版与配色）
- 风格名称：${prompt.title}（${prompt.englishTitle}）
- 整体质感：${prompt.promptAnatomy.style}
- 主色调方案：背景色 ${palette.bg} ｜ 卡片色 ${palette.surface} ｜ 主文字 ${palette.text} ｜ 核心强调色 ${palette.accent} ｜ 图表色阶 ${chartColors.join(" / ")}
- 字体风格：标题 ${typography.headingFontLabel}，正文 ${typography.bodyFontLabel}
- 排版与留白：${densityInfo.zh}；卡片圆角 ${layout.cornerRadius}px；${prompt.promptAnatomy.layout}

三、逐段内容结构规划
1. 封面页（P01）
   - 主标题：${topic}
   - 副标题：${subtitle}
   - 视觉建议：保留充足呼吸留白，突出标题层级，避免杂乱背景图。
${outline
  .map(
    (item, idx) =>
      `${idx + 2}. ${item.chapter}（${item.range}）\n   - 表达重点：${item.focus}\n   - 推荐版式：${
        idx === 0
          ? "行业拐点金句卡 + 核心痛点三栏拆解"
          : idx === 1
          ? "三层模块化架构流程图 + 双栏方案对比矩阵"
          : idx === 2
          ? "结论先行标题 + 柱状图/折线图 + 3 项关键 KPI"
          : "4 节点时间轴路线图 + 3 条可执行行动建议"
      }`
  )
  .join("\n")}

四、写作与排版红线
- ${prompt.promptAnatomy.content}
- 每页标题尽量给出明确结论，正文使用精炼短句（单点不超过 20 字），避免大段堆砌纯文本。
- 如工具支持自定义主题色，请直接输入上述 HEX 色值（背景 ${palette.bg}，强调 ${palette.accent}）。${domainMdSection}`;
  }

  if (params.targetTool === "notebooklm") {
    return `【NotebookLM Slide Deck / 演示文稿视觉与叙事指令】

请基于我上传的参考资料，生成一份共 ${slideCount} 页、主题为「${topic}」的演示文稿。

# 视觉与设计方向（Style Direction）
- 美学定位：${prompt.title}（${prompt.englishTitle}）— ${prompt.promptAnatomy.style}
- 色彩体系：以 ${palette.bg} 为主画布，${palette.text} 为主要文字色，${palette.accent} 作为核心结论高亮色，整体保持 ${
      spec.layout.density === "airy"
        ? "极简高留白"
        : spec.layout.density === "dense"
        ? "高信息密度专业图表"
        : "清晰均衡"
    } 视觉秩序。
- 字体与层级：${prompt.promptAnatomy.typography}
- 版面规律：${prompt.promptAnatomy.layout}

# 听众与叙事约束（Narrative Guidelines）
- 目标受众：${audience}
- 输出语言：${langLabel}
- 叙事策略：${toneInfo.zh}
- 副叙事焦点：${subtitle}

# 页面节奏建议（${slideCount} Slides）
- 第 1 页：主题封面，明确抛出核心议题「${topic}」。
${outline
  .map(
    (item) =>
      `- ${item.range}（${item.chapter}）：结合资料中的事实依据，重点阐述「${item.focus}」。`
  )
  .join("\n")}

# 质量控制要求
- ${prompt.promptAnatomy.content}
- 严格基于源文档事实提炼数据与观点，所有关键数字保留来源语境。
- 单页只聚焦 1 个核心论点，用清晰的标题、要点与结构化图表替代长段落摘要。${domainMdSection}`;
  }

  if (params.targetTool === "slidev-marp") {
    return `# Role: Slidev / Marp 开发者演示文稿专家

请为我生成一份可直接运行的 **Marp / Slidev Markdown 幻灯片源码**，严格还原「**${prompt.title}（${prompt.englishTitle}）**」的设计视觉。

## 1. 演示元数据
- **主题**：${topic}
- **副标题**：${subtitle}
- **受众**：${audience}
- **总页数**：${slideCount} 页（使用 \`---\` 分页）
- **语言与语气**：${langLabel} ｜ ${toneInfo.zh}

## 2. 必须内嵌的全局样式块（置顶于第一页 YAML 之后）
请在 Markdown 顶部使用 \`marp: true\` 与 \`size: 16:9\`，并注入以下精确 CSS 主题样式：

\`\`\`yaml
---
marp: true
theme: default
size: 16:9
paginate: true
style: |
  section {
    background-color: ${palette.bg};
    color: ${palette.text};
    font-family: 'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif;
    padding: 52px 64px;
  }
  h1, h2 {
    color: ${palette.text};
    font-weight: ${typography.titleWeight};
    letter-spacing: ${typography.titleTracking};
  }
  strong, .accent {
    color: ${palette.accent};
  }
  .card {
    background: ${palette.surface};
    border: 1px solid ${palette.border};
    border-radius: ${layout.cornerRadius}px;
    padding: 20px 24px;
  }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
---
\`\`\`

## 3. 设计美学与章节编排要求
- **风格纪律**：${prompt.promptAnatomy.style}
- **版式丰富度**：善用 HTML \`.grid-2\`、\`.grid-3\`、\`.card\` 与简洁内联 SVG 柱状图呈现以下章节：
  1. 封面页：「${topic}」与「${subtitle}」
${outline.map((item, idx) => `  ${idx + 2}. ${item.chapter}（${item.range}）：${item.focus}`).join("\n")}
- **讲稿备注**：在每一页底部使用 \`<!-- 演讲者备注：... -->\` 附上 2~3 句自然口语串词。${domainMdSection}`;
  }

  if (params.targetTool === "python-pptx") {
    const bgRgb = hexToRgbTuple(palette.bg);
    const surfRgb = hexToRgbTuple(palette.surface, bgRgb);
    const textRgb = hexToRgbTuple(palette.text, bgRgb);
    const mutedRgb = hexToRgbTuple(palette.muted, bgRgb);
    const accRgb = hexToRgbTuple(palette.accent, bgRgb);
    const borderRgb = hexToRgbTuple(palette.border, bgRgb);

    return `# Role: Python 自动化演示文稿工程师（python-pptx 专家）

请编写并运行一段完整的 **Python (\`python-pptx\`) 脚本**，生成并保存一份名为 \`presentation.pptx\` 的 16:9 高颜值可编辑 PPT 文件。

## 1. 演示信息
- **主题**：${topic}
- **副标题**：${subtitle}
- **目标受众**：${audience}
- **总页数**：${slideCount} 页
- **输出语言**：${langLabel}（${toneInfo.zh}）

## 2. 精确视觉参数（必须在代码中硬编码为 RGBColor 常量）
> 视觉规范：**${prompt.title}（${prompt.englishTitle}）**

\`\`\`python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

COLOR_BG = RGBColor(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]})          # ${palette.bg}
COLOR_SURFACE = RGBColor(${surfRgb[0]}, ${surfRgb[1]}, ${surfRgb[2]})  # ${palette.surface}
COLOR_TEXT = RGBColor(${textRgb[0]}, ${textRgb[1]}, ${textRgb[2]})      # ${palette.text}
COLOR_MUTED = RGBColor(${mutedRgb[0]}, ${mutedRgb[1]}, ${mutedRgb[2]})    # ${palette.muted}
COLOR_ACCENT = RGBColor(${accRgb[0]}, ${accRgb[1]}, ${accRgb[2]})      # ${palette.accent}
COLOR_BORDER = RGBColor(${borderRgb[0]}, ${borderRgb[1]}, ${borderRgb[2]})    # ${palette.border}
\`\`\`

## 3. 版式与绘制铁律
1. **空白母版起手**：每页一律使用 \`prs.slide_layouts[6]\`（纯空白版式），禁止使用丑陋的默认占位符项目符号。
2. **背景填充**：每页显式设置 \`slide.background.fill.solid()\` 为 \`COLOR_BG\`。
3. **模块化卡片与原生图表**：
   - 使用 \`add_shape\` 绘制圆角/直角卡片（填色 \`COLOR_SURFACE\`，细边框），完美还原「${prompt.promptAnatomy.layout}」。
   - 至少包含 1 页使用 \`slide.shapes.add_chart\` 绘制原生柱状图与环形占比图，配色使用 \`COLOR_ACCENT\` 与 \`COLOR_TEXT\`。
   - 推荐覆盖 12 类商业母版：封面页、4 象限目录页、图文分栏展示页、3 步核心架构页、KPI + 原生柱状图页、转化漏斗/环形占比页、左右双栏对比页、2×2 SWOT 战略矩阵、里程碑路线图、核心团队卡片页、金句洞察页与总结结尾页。
4. **防遮挡检查**：严格计算所有文本框坐标 \`(left, top, width, height)\`，设置 \`word_wrap = True\`，确保所有文字留在 \`0.7 in\` 安全边距以内且互不重叠。
5. **演讲者备注**：为每页 \`slide.notes_slide.notes_text_frame.text\` 写入精炼演讲提纲。${domainMdSection}`;
  }

  // ai-image: Single-slide OR Multi-slide sequential batch prompts (6-slide or full 12-slide pack)
  if (params.aiImageBatchMode) {
    const batchCount: 6 | 12 = params.aiImageBatchCount === 12 ? 12 : 6;
    const batchPages: { code: string; st: SlideType; heading: string }[] =
      batchCount === 12
        ? [
            { code: "P01", st: "cover", heading: topic },
            { code: "P02", st: "agenda", heading: "核心目录与演进脉络" },
            { code: "P03", st: "image-split", heading: outline[0]?.chapter || "核心产品全景与价值主张" },
            { code: "P04", st: "process", heading: outline[1]?.chapter || "三步核心架构与执行闭环" },
            { code: "P05", st: "data", heading: outline[2]?.chapter || "关键增长指标与趋势验证" },
            { code: "P06", st: "funnel-donut", heading: "转化漏斗与结构占比洞察" },
            { code: "P07", st: "comparison", heading: "现状痛点 vs 升级方案对比" },
            { code: "P08", st: "swot", heading: "SWOT 四象限战略态势评估" },
            { code: "P09", st: "timeline", heading: "分阶段里程碑路线图" },
            { code: "P10", st: "team-grid", heading: "核心管理与研发团队阵容" },
            { code: "P11", st: "quote", heading: "核心战略洞察与客户证言" },
            { code: "P12", st: "closing", heading: outline[3]?.chapter || "总结与下一步行动呼吁" },
          ]
        : [
            { code: "P01", st: "cover", heading: topic },
            { code: "P02", st: "agenda", heading: "核心目录与演进脉络" },
            { code: "P03", st: "image-split", heading: outline[1]?.chapter || "核心产品全景与价值主张" },
            { code: "P04", st: "data", heading: outline[2]?.chapter || "关键增长指标验证" },
            { code: "P05", st: "swot", heading: "SWOT 战略态势与对比矩阵" },
            { code: "P06", st: "closing", heading: outline[3]?.chapter || "总结与行动路线" },
          ];

    return `【AI 整套连贯 PPT 分页生图词包（${batchCount} 页版）· 视觉导演 v2 · 适配即梦 / Nano Banana / GPT Image】
风格锁定：**${prompt.title}（${prompt.englishTitle}）**
全局统一色卡：底色 ${palette.bg} ｜ 表面 ${palette.surface} ｜ 文字 ${palette.text} ｜ 强调 ${palette.accent} ｜ 图表 ${chartColors.join("、")}
视觉导演原则：由每页核心内容关系驱动主视觉焦点，跨页统一字体气质、留白节奏与页眉/页脚规则；拒绝等宽粗框卡片堆砌、拒绝油亮假 3D 与无关氛围大图，中文字形自然不挤瘦，严禁捏造数据与引用。

${batchPages
  .map((bp) => {
    const c = SLIDE_COMPOSITION_GUIDE[bp.st];
    return `---
### ${bp.code} · ${SLIDE_TYPE_LABELS[bp.st].label}（${bp.heading}）
**中文提示词**：16:9 宽屏扁平 2D 专业汇报 PPT 单页设计稿（纯正面平面视口，非海报非样机），「${prompt.title}」套系风格。${c.zh}，主标题「${bp.heading}」${bp.st === "cover" ? `，副标题「${subtitle}」` : ""}。背景 ${palette.bg}、模块面 ${palette.surface}、主字 ${palette.text}、强调色 ${palette.accent}，圆角 ${layout.cornerRadius}px，${densityInfo.zh}；中文字体比例端正清晰、留白有呼吸感、图形真正解释内容而非装饰。
**English Prompt**: Flat 2D 16:9 executive presentation slide (front orthographic canvas, not a mockup or poster), ${prompt.englishTitle} cohesive system. ${c.en}, headline "${bp.heading}". Strict palette: bg ${palette.bg}, surface ${palette.surface}, text ${palette.text}, accent ${palette.accent}. Radius ${layout.cornerRadius}px, ${densityInfo.en}, crisp editorial typography, zero generic card spam --ar 16:9 --stylize 140`;
  })
  .join("\n\n")}

---
### 全局视觉导演硬边界（Negative Prompt）
3D laptop mockup, angled screen, perspective tilt, multi-slide collage, glossy plastic 3D icons, candy neon glow, compressed distorted Chinese text, uniform repetitive boxes, watermark, fabricated numbers${domainMdSection}`;
  }

  const slideLabel = SLIDE_TYPE_LABELS[activeSlide] ?? SLIDE_TYPE_LABELS.cover;
  const comp = SLIDE_COMPOSITION_GUIDE[activeSlide] ?? SLIDE_COMPOSITION_GUIDE.cover;

  return `【AI 整页 PPT 生图提示词 · 视觉导演 v2 · 适配即梦 / Nano Banana / Midjourney / Ideogram】
当前针对页面：**${slideLabel.label}（${slideLabel.en}）**

---
### 中文出图提示词（推荐：即梦 / Nano Banana / 可灵）
设计一张 16:9 宽屏扁平 2D 专业汇报 PPT 单页设计稿（纯正面平面视口，非海报、非 3D 样机）。
- **页面内容关系与构图**：${comp.zh}。主标题聚焦「${topic}」${activeSlide === "cover" ? `，副标题「${subtitle}」` : ""}。让主视觉图形直接解释本页信息关系，而不是堆砌等宽粗框卡片或无关氛围大图。
- **核心美学风格**：${prompt.title}。${prompt.promptAnatomy.style}
- **精准配色控制**：背景底色 ${palette.bg}，卡片/模块面 ${palette.surface}，主体文字色 ${palette.text}，视觉强调色 ${palette.accent}，图表辅助色 ${chartColors.join("、")}。
- **字体与留白节奏**：标题采用 ${typography.headingFontLabel} 气质，正文端正清晰不挤瘦；${prompt.promptAnatomy.layout}；卡片圆角约 ${layout.cornerRadius}px；留白比例遵循「${densityInfo.zh}」。
- **画质与硬边界**：平面矢量编辑部质感，纯正面 2D 扁平视口（禁止斜拍透视、禁止笔记本边框与演讲台），中文字形自然对齐，无乱码水印，不捏造虚假数字。

---
### English Art-Direction Prompt (Midjourney v6 / Nano Banana / Ideogram)
Flat 2D 16:9 executive presentation slide (front orthographic canvas, zero mockup frame, zero perspective tilt, not a poster), ${prompt.englishTitle} cohesive design system. ${comp.en} for "${topic}". Strict color tokens: background ${palette.bg}, surface ${palette.surface}, primary text ${palette.text}, accent ${palette.accent}, chart accents ${chartColors.join(", ")}. Layout: ${spec.layout.archetype}, ${densityInfo.en}, radius ${layout.cornerRadius}px. Typography inspired by ${typography.headingFontLabel} paired with ${typography.bodyFontLabel}. Visual focal element genuinely clarifies content relationships, generous breathing room, crisp vector precision, zero generic card grid spam --ar 16:9 --stylize 140

---
### 全局视觉导演硬边界（Negative Prompt）
3D laptop mockup, angled perspective, laptop bezel, glossy plastic 3D icons, candy neon glow, uniform repetitive boxes, compressed distorted Chinese text, stock photo collage, watermark, fabricated numbers${domainMdSection}`;
}

/**
 * Generates a single-slide illustration / visual slot art-direction prompt
 * tailored for Jimeng / Midjourney / DALL-E 3 so generated artwork matches the slide's exact VisualSpec.
 */
export function buildSlideImagePrompt(
  styleTitle: string,
  englishTitle: string,
  spec: VisualSpec,
  slide: DeckSlideItem
): string {
  const { palette, layout } = spec;
  const subject =
    slide.imageSlot?.promptHint?.trim() ||
    slide.imageSlot?.caption?.trim() ||
    slide.title ||
    "Executive strategy concept";
  const contextLine =
    slide.subtitle || slide.bullets?.[0] || "Clean business innovation narrative";
  const chartList = (palette.chartColors || []).slice(0, 3).join(", ");

  return `【单页配图视觉导演 v2 · 适配即梦 / Midjourney / OpenAI Image】
画面主题：${subject}
上下文语义：${contextLine}
美学锁定：${styleTitle}（${englishTitle}），与 PPT 母版色卡严格一致（背景 ${palette.bg}，表面 ${palette.surface}，强调色 ${palette.accent}，辅助色 ${chartList}）。

[中文即梦提示词]
一幅高质感扁平编辑部风格商业演示配图，紧扣「${subject}」的内容逻辑，严格延续「${styleTitle}」平面设计美学，底色使用 ${palette.bg} 或 ${palette.surface}，焦点以 ${palette.accent} 克制点缀，极简几何构图与充裕留白；拒绝油亮塑料 3D、拒绝廉价霓虹发光、拒绝多余杂物，纯画面无文字无水印，比例 4:3。

[English Prompt for Midjourney / OpenAI Image]
Editorial presentation hero illustration clarifying "${subject}", ${englishTitle} graphic design system (${layout.archetype}), palette strictly anchored to background ${palette.bg}, surface ${palette.surface}, and restrained focal accent ${palette.accent} (secondary ${chartList}). Clean geometric balance, quiet architectural lighting, museum-grade flat editorial craft, no glossy plastic 3D, no neon glow, zero text, no letters, no watermark --ar 4:3 --stylize 120`;
}

export interface RealDeckCompileOptions {
  title: string;
  subtitle: string;
  audience: string;
  styleName: string;
  spec: VisualSpec;
  slides: DeckSlideItem[];
}

function escapeMdInline(text: string | undefined): string {
  return (text || "").replace(/\r?\n/g, " ").trim();
}

function renderSlideBodyForMarp(slide: DeckSlideItem): string {
  const lines: string[] = [];
  const tag = escapeMdInline(slide.sectionTag || SLIDE_TYPE_LABELS[slide.slideType].en);
  const title = escapeMdInline(slide.title);
  const subtitle = escapeMdInline(slide.subtitle);

  if (slide.slideType === "cover") {
    lines.push(`<!-- _class: lead -->`);
    lines.push(`<p class="eyebrow">${tag}</p>`);
    lines.push("");
    lines.push(`# ${title}`);
    if (subtitle) {
      lines.push("");
      lines.push(`> ${subtitle}`);
    }
    if (slide.bullets && slide.bullets.length > 0) {
      lines.push("");
      lines.push(slide.bullets.map((b) => `\`${escapeMdInline(b)}\``).join(" · "));
    }
    return lines.join("\n");
  }

  lines.push(`<p class="eyebrow">${tag}</p>`);
  lines.push("");
  lines.push(`## ${title}`);
  if (subtitle) {
    lines.push("");
    lines.push(`*${subtitle}*`);
  }
  lines.push("");

  switch (slide.slideType) {
    case "agenda": {
      const items = slide.bullets || [];
      items.forEach((b, i) => {
        lines.push(`${i + 1}. **0${i + 1}** — ${escapeMdInline(b)}`);
      });
      break;
    }
    case "process":
    case "timeline": {
      const steps = slide.steps || [];
      lines.push(`<div class="grid-${Math.min(4, Math.max(2, steps.length || 3))}">`);
      steps.forEach((st) => {
        lines.push(
          `  <div class="card"><div class="badge">${escapeMdInline(st.code)}</div><strong>${escapeMdInline(st.title)}</strong><p>${escapeMdInline(st.desc)}</p></div>`
        );
      });
      lines.push(`</div>`);
      break;
    }
    case "image-split": {
      lines.push(`<div class="grid-2">`);
      lines.push(
        `  <div class="card"><strong>配图构图槽位</strong><p>${escapeMdInline(slide.imageSlot?.caption || slide.imageSlot?.promptHint || "主题视觉配图")}</p></div>`
      );
      lines.push(`  <div class="card">`);
      (slide.bullets || []).forEach((b) => {
        lines.push(`    <p>• ${escapeMdInline(b)}</p>`);
      });
      lines.push(`  </div>`);
      lines.push(`</div>`);
      break;
    }
    case "data": {
      if (slide.kpis && slide.kpis.length > 0) {
        lines.push(`<div class="grid-${Math.min(3, slide.kpis.length)}">`);
        slide.kpis.forEach((k) => {
          lines.push(
            `  <div class="card"><div class="kpi">${escapeMdInline(k.value)}</div><strong>${escapeMdInline(k.label)}</strong><p>${escapeMdInline(k.note)}</p></div>`
          );
        });
        lines.push(`</div>`);
        lines.push("");
      }
      if (slide.bars && slide.bars.length > 0) {
        lines.push(`| 维度 | 核心指标 | 对标基准 |`);
        lines.push(`| --- | ---: | ---: |`);
        slide.bars.forEach((b) => {
          lines.push(`| ${escapeMdInline(b.label)} | **${b.v1}** | ${b.v2} |`);
        });
      }
      break;
    }
    case "funnel-donut": {
      const modeLabel = slide.chartMode === "donut" ? "结构占比" : "转化漏斗";
      lines.push(`| 阶段（${modeLabel}） | 数值 | 说明 |`);
      lines.push(`| --- | ---: | --- |`);
      (slide.funnelStages || []).forEach((st) => {
        lines.push(
          `| ${escapeMdInline(st.label)} | **${st.value}${escapeMdInline(st.unit || "")}** | ${escapeMdInline(st.note)} |`
        );
      });
      break;
    }
    case "comparison": {
      lines.push(`<div class="grid-2">`);
      lines.push(`  <div class="card">`);
      lines.push(`    <strong>${escapeMdInline(slide.leftTitle || "现状挑战")}</strong>`);
      (slide.leftPoints || []).forEach((p) => lines.push(`    <p>• ${escapeMdInline(p)}</p>`));
      lines.push(`  </div>`);
      lines.push(`  <div class="card card-accent">`);
      lines.push(`    <strong>${escapeMdInline(slide.rightTitle || "升级方案")}</strong>`);
      (slide.rightPoints || []).forEach((p) => lines.push(`    <p>• ${escapeMdInline(p)}</p>`));
      lines.push(`  </div>`);
      lines.push(`</div>`);
      break;
    }
    case "swot": {
      const swot = slide.swot || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: [],
      };
      const quads: [string, string[]][] = [
        ["S · 优势 Strengths", swot.strengths],
        ["W · 劣势 Weaknesses", swot.weaknesses],
        ["O · 机会 Opportunities", swot.opportunities],
        ["T · 威胁 Threats", swot.threats],
      ];
      lines.push(`<div class="grid-2">`);
      quads.forEach(([label, pts]) => {
        lines.push(`  <div class="card"><strong>${label}</strong>`);
        (pts || []).forEach((p) => lines.push(`    <p>• ${escapeMdInline(p)}</p>`));
        lines.push(`  </div>`);
      });
      lines.push(`</div>`);
      break;
    }
    case "team-grid": {
      const members = slide.teamMembers || [];
      lines.push(`<div class="grid-${Math.min(4, Math.max(2, members.length || 3))}">`);
      members.forEach((m) => {
        lines.push(
          `  <div class="card"><div class="badge">${escapeMdInline(m.badge || m.role)}</div><strong>${escapeMdInline(m.name)}</strong><p>${escapeMdInline(m.role)} · ${escapeMdInline(m.bio)}</p></div>`
        );
      });
      lines.push(`</div>`);
      break;
    }
    case "quote": {
      lines.push(`> “${escapeMdInline(slide.quoteText || title)}”`);
      if (slide.quoteAuthor) {
        lines.push("");
        lines.push(`—— **${escapeMdInline(slide.quoteAuthor)}**`);
      }
      if (slide.bullets && slide.bullets.length > 0) {
        lines.push("");
        slide.bullets.forEach((b) => lines.push(`- ${escapeMdInline(b)}`));
      }
      break;
    }
    case "closing":
    default: {
      (slide.bullets || []).forEach((b) => lines.push(`- ${escapeMdInline(b)}`));
      break;
    }
  }

  return lines.join("\n");
}

/**
 * Compiles a real, edited slide deck directly into runnable Marp / Slidev Markdown
 * preserving exact VisualSpec palette tokens, typography, layout structure, and speaker notes.
 */
export function compileDeckToMarpMarkdown(opts: RealDeckCompileOptions): string {
  const { title, subtitle, audience, styleName, spec, slides } = opts;
  const { palette, typography, layout } = spec;

  const frontmatter = `---
marp: true
theme: default
size: 16:9
paginate: ${layout.showPageNumber ? "true" : "false"}
header: "${escapeMdInline(title)} · ${escapeMdInline(styleName)}"
footer: "${escapeMdInline(audience || "PPTGod Studio")}"
style: |
  section {
    background-color: ${palette.bg};
    color: ${palette.text};
    font-family: 'Plus Jakarta Sans', 'PingFang SC', 'Noto Sans SC', sans-serif;
    padding: 50px 64px;
    font-size: 20px;
    line-height: 1.5;
  }
  section.lead {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h1 {
    font-size: 52px;
    color: ${palette.text};
    font-weight: ${typography.titleWeight};
    letter-spacing: ${typography.titleTracking};
    margin: 0.2em 0;
  }
  h2 {
    font-size: 32px;
    color: ${palette.text};
    font-weight: ${typography.titleWeight};
    letter-spacing: ${typography.titleTracking};
    margin: 0.15em 0 0.4em;
  }
  .eyebrow {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${palette.accent};
    margin: 0;
  }
  strong, .kpi { color: ${palette.accent}; }
  .kpi { font-size: 32px; font-weight: 800; margin-bottom: 4px; }
  .badge {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    background: ${palette.accentSoft};
    color: ${palette.accent};
    margin-bottom: 6px;
  }
  .card {
    background: ${palette.surface};
    border: 1px solid ${palette.border};
    border-radius: ${layout.cornerRadius}px;
    padding: 18px 20px;
    font-size: 16px;
  }
  .card-accent { border-left: 4px solid ${palette.accent}; }
  .card p { margin: 6px 0 0; color: ${palette.muted}; font-size: 15px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  blockquote {
    border-left: 4px solid ${palette.accent};
    background: ${palette.surface};
    padding: 16px 22px;
    border-radius: ${layout.cornerRadius}px;
    color: ${palette.text};
  }
  table { width: 100%; border-collapse: collapse; font-size: 16px; }
  th, td { border: 1px solid ${palette.border}; padding: 10px 14px; text-align: left; }
  th { background: ${palette.surface}; color: ${palette.accent}; }
---`;

  const slideBlocks = slides.map((slide, idx) => {
    const body = renderSlideBodyForMarp(slide);
    const notes = slide.speakerNotes?.trim()
      ? `\n\n<!--\n演讲者备注（P${String(idx + 1).padStart(2, "0")}）：\n${slide.speakerNotes.trim()}\n-->`
      : "";
    return `${body}${notes}`;
  });

  const subtitleComment = subtitle
    ? `<!-- Generated by PPTGod v4 · ${escapeMdInline(title)} — ${escapeMdInline(subtitle)} -->\n`
    : "";

  return `${frontmatter}\n\n${subtitleComment}${slideBlocks.join("\n\n---\n\n")}\n`;
}

/**
 * Compiles the user's actual edited deck slides + VisualSpec into a precision AI prompt
 * for Claude HTML Artifacts or Gamma / Kimi PPT so every real slide title, KPI, and bullet transfers 1:1.
 */
export function compileRealDeckPrompt(
  opts: RealDeckCompileOptions & { target: "claude-html" | "gamma-kimi" }
): string {
  const { title, subtitle, audience, styleName, spec, slides, target } = opts;
  const { palette, typography, layout } = spec;
  const chartColors = palette.chartColors || [
    palette.accent,
    palette.text,
    palette.muted,
    palette.border,
  ];

  const slideDigest = slides
    .map((s, idx) => {
      const pNo = `P${String(idx + 1).padStart(2, "0")}`;
      const label = SLIDE_TYPE_LABELS[s.slideType]?.label || s.slideType;
      const details: string[] = [];
      if (s.subtitle) details.push(`副标：${escapeMdInline(s.subtitle)}`);
      if (s.bullets && s.bullets.length > 0) {
        details.push(`要点：${s.bullets.map(escapeMdInline).join("；")}`);
      }
      if (s.kpis && s.kpis.length > 0) {
        details.push(
          `KPI：${s.kpis.map((k) => `${k.label}=${k.value}(${k.note})`).join(" | ")}`
        );
      }
      if (s.bars && s.bars.length > 0) {
        details.push(
          `柱状数据：${s.bars.map((b) => `${b.label}:${b.v1}/${b.v2}`).join("，")}`
        );
      }
      if (s.steps && s.steps.length > 0) {
        details.push(
          `步骤：${s.steps.map((st) => `${st.code} ${st.title}(${st.desc})`).join(" -> ")}`
        );
      }
      if (s.funnelStages && s.funnelStages.length > 0) {
        details.push(
          `${s.chartMode === "donut" ? "环形占比" : "转化漏斗"}：${s.funnelStages
            .map((f) => `${f.label}=${f.value}${f.unit || ""}`)
            .join(" / ")}`
        );
      }
      if (s.swot) {
        details.push(
          `SWOT：S(${s.swot.strengths.join("、")}) / W(${s.swot.weaknesses.join("、")}) / O(${s.swot.opportunities.join("、")}) / T(${s.swot.threats.join("、")})`
        );
      }
      if (s.leftPoints || s.rightPoints) {
        details.push(
          `对比：${s.leftTitle || "左栏"}(${(s.leftPoints || []).join("、")}) vs ${s.rightTitle || "右栏"}(${(s.rightPoints || []).join("、")})`
        );
      }
      if (s.teamMembers && s.teamMembers.length > 0) {
        details.push(
          `团队：${s.teamMembers.map((m) => `${m.name}-${m.role}`).join("、")}`
        );
      }
      if (s.quoteText) {
        details.push(`金句：“${escapeMdInline(s.quoteText)}” — ${escapeMdInline(s.quoteAuthor)}`);
      }
      if (s.speakerNotes) {
        details.push(`讲稿提示：${escapeMdInline(s.speakerNotes)}`);
      }
      return `- **${pNo} [${label}] ${escapeMdInline(s.title)}**\n  ${details.join("\n  ")}`;
    })
    .join("\n");

  if (target === "claude-html") {
    return `# Role: 顶级交互式 HTML 幻灯片工程师

请严格基于以下已敲定的 **${slides.length} 页真实文稿内容与视觉设计 Token**，生成一套单文件 16:9 交互式 HTML 演示文稿（支持键盘方向键翻页、演讲者备注面板与 \`@media print\` 导出 PDF）。

## 1. 演示元数据
- **标题**：${title}
- **副标题**：${subtitle}
- **受众**：${audience || "核心管理层"}
- **锁定风格**：${styleName}（版式原型 \`${layout.archetype}\`，装饰纹样 \`${layout.decorativeMotif}\`，圆角 \`${layout.cornerRadius}px\`，密度 \`${layout.density}\`）

## 2. 强制 CSS Design Tokens
\`\`\`css
:root {
  --bg: ${palette.bg};
  --surface: ${palette.surface};
  --text: ${palette.text};
  --muted: ${palette.muted};
  --accent: ${palette.accent};
  --accent-soft: ${palette.accentSoft};
  --border: ${palette.border};
  --chart-1: ${chartColors[0]};
  --chart-2: ${chartColors[1]};
  --chart-3: ${chartColors[2]};
  --chart-4: ${chartColors[3]};
  --radius: ${layout.cornerRadius}px;
  --title-weight: ${typography.titleWeight};
  --title-tracking: ${typography.titleTracking};
}
\`\`\`

## 3. 逐页精确文稿（共 ${slides.length} 页，请 100% 忠实呈现每页标题、数据与结构）
${slideDigest}

## 4. 交付约束
- 保持 16:9 纯净矢量排版与内联 SVG 数据图表，不引入外链 CDN 资源。
- 保留所有 KPI 数值、对比项与讲稿备注，逐页实现差异化商业版式。`;
  }

  return `【真实文稿一键导入指令 · 适配 Gamma / Kimi PPT / 讯飞智文 / WPS AI】

一、母版与视觉规范
- 演示标题：${title}
- 副标题：${subtitle}
- 面向听众：${audience || "核心决策者"}
- 美学风格：${styleName}（背景 ${palette.bg} ｜ 卡片 ${palette.surface} ｜ 主文字 ${palette.text} ｜ 强调色 ${palette.accent} ｜ 圆角 ${layout.cornerRadius}px）
- 字体层级：标题参考 ${typography.headingFontLabel}，正文参考 ${typography.bodyFontLabel}

二、逐页定稿大纲与精确数据（共 ${slides.length} 页，请严格按页生成，不要擅自删改数字与核心结论）
${slideDigest}

三、排版要求
- 严格采用 16:9 宽屏，所有图表（柱状图、漏斗/环形占比图、SWOT 四象限、时间轴）按对应页型可视化呈现，勿退化为纯文字列表。`;
}

