/**
 * PPTGod · Prompt Pack (资料 → 提示词包)
 *
 * Client-safe core: types, curated design directions, sanitizer, slide preview
 * adapters and per-tool master-prompt renderers. The server-only rule engine
 * and LLM instructions live in `promptPackEngine.ts`.
 */
import {
  autoFixPaletteContrast,
  evaluatePaletteContrast,
  parseColorToRgb,
  rgbToHex,
  type ExtractedImageStyle,
  type PaletteContrastReport,
} from "@/lib/paletteExtractor";
import type {
  ChartVariant,
  DataDisplayMode,
  DecorativeMotif,
  DeckSlideItem,
  LayoutArchetype,
  PromptItem,
  SlideChartSeries,
  SlideTableData,
  SlideType,
  TypographyMood,
  VisualSpec,
} from "@/types/prompt";

/* ==========================================================================
   1. Vocabulary
   ========================================================================== */

export type PackLayout =
  | "cover"
  | "agenda"
  | "section"
  | "big-number"
  | "chart"
  | "table"
  | "comparison"
  | "timeline"
  | "process"
  | "quote"
  | "image-text"
  | "summary";

export const PACK_LAYOUTS: readonly {
  id: PackLayout;
  label: string;
  hint: string;
}[] = [
  { id: "cover", label: "封面", hint: "大标题 + 副标题 + 主视觉，留白充足" },
  { id: "agenda", label: "目录", hint: "3–5 个章节编号，横向或纵向排列" },
  { id: "section", label: "章节页", hint: "大号章节编号 + 一句话主旨，满版色块" },
  { id: "big-number", label: "大数字", hint: "1–3 个关键数字超大英雄卡，不塞冗余柱图" },
  { id: "chart", label: "图表", hint: "原生柱状/横向条形/折线/环形图，突出结论数据" },
  { id: "table", label: "数据表", hint: "原生学术三线表 / 商务评分表，跨量纲对比并高亮最优值" },
  { id: "comparison", label: "对比", hint: "左右两栏对照，差异用强调色标出" },
  { id: "timeline", label: "时间线", hint: "按时间/阶段横向排布的节点" },
  { id: "process", label: "流程", hint: "3–5 步带编号的箭头流程或循环" },
  { id: "quote", label: "金句", hint: "居中大号引言 + 出处，极简" },
  { id: "image-text", label: "图文", hint: "一侧真图或干净虚线配图框，一侧 3–4 条要点" },
  { id: "summary", label: "总结", hint: "3–4 条核心结论 + 行动/致谢" },
];

export const CHART_VARIANT_OPTIONS: readonly {
  id: ChartVariant;
  label: string;
}[] = [
  { id: "col", label: "竖向柱状图" },
  { id: "bar", label: "横向对比条" },
  { id: "line", label: "趋势折线图" },
  { id: "doughnut", label: "占比环形图" },
];

export function chartVariantLabel(variant?: ChartVariant): string {
  return CHART_VARIANT_OPTIONS.find((c) => c.id === variant)?.label ?? "竖向柱状图";
}

export const PACK_LAYOUT_IDS = PACK_LAYOUTS.map((l) => l.id);

export function packLayoutLabel(layout: PackLayout): string {
  return PACK_LAYOUTS.find((l) => l.id === layout)?.label ?? layout;
}

export type PackTool = "chatgpt" | "gamma" | "kimi" | "claude" | "markdown";

export const PACK_TOOLS: readonly {
  id: PackTool;
  label: string;
  hint: string;
  launch?: { label: string; url: string };
}[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    hint: "让 ChatGPT 用 python-pptx 直接生成可下载的 .pptx",
    launch: { label: "打开 ChatGPT", url: "https://chatgpt.com/" },
  },
  {
    id: "gamma",
    label: "Gamma",
    hint: "两段式：风格说明贴进“额外指令”，正文贴进“粘贴文本”",
    launch: { label: "打开 Gamma", url: "https://gamma.app/create/paste" },
  },
  {
    id: "kimi",
    label: "Kimi PPT",
    hint: "Kimi PPT 助手：先生成大纲，再按风格选择模板",
    launch: { label: "打开 Kimi", url: "https://kimi.moonshot.cn/" },
  },
  {
    id: "claude",
    label: "Claude",
    hint: "生成单文件 HTML 幻灯片（键盘翻页，可导出 PDF）",
    launch: { label: "打开 Claude", url: "https://claude.ai/new" },
  },
  {
    id: "markdown",
    label: "通用",
    hint: "完整 Markdown 提示词，适用于豆包、DeepSeek、WPS AI 等",
  },
];

export type PackLanguage = "zh" | "en" | "bilingual";

export type PackDensity = "speaker" | "reading";

export const PACK_DENSITIES: readonly {
  id: PackDensity;
  label: string;
  shortLabel: string;
  hint: string;
}[] = [
  {
    id: "speaker",
    label: "现场演讲 · 字少大字（细节进备注）",
    shortLabel: "现场演讲",
    hint: "每页 2–3 条精炼结论、正文 20–24pt、留白 ≥40%，完整解释自动放入演讲备注",
  },
  {
    id: "reading",
    label: "书面汇报 · 详实自解释（适合传阅）",
    shortLabel: "书面汇报",
    hint: "每页 3–5 条完整论据卡片、正文 15–18pt，脱离讲解人也能独立读懂",
  },
];

/* ==========================================================================
   2. Data model
   ========================================================================== */

export interface PackColor {
  role: string;
  hex: string;
}

export interface PackStyle {
  directionId: string;
  /** Optional slug when anchored from the 36-style reference library (/gallery). */
  referenceSlug?: string;
  name: string;
  reference: string;
  rationale: string;
  keywords: string[];
  /** 6 role colors: 背景 / 浅底 / 正文 / 次要文字 / 主色 / 强调色 */
  colors: PackColor[];
  chartColors: string[];
  headingFont: string;
  bodyFont: string;
  numberFont: string;
  layoutGrammar: string;
  imagery: string;
  chartStyle: string;
  dos: string[];
  donts: string[];
}

export interface PackDatum {
  label: string;
  value: string;
}

export interface PackSlide {
  id: string;
  layout: PackLayout;
  title: string;
  points: string[];
  data: PackDatum[];
  visual: string;
  note: string;
  source: string;
  /** M9: Chart variant for `chart` slides (col | bar | line | doughnut) */
  chartVariant?: ChartVariant;
  /** M9: Multi-series chart categories & series from uploaded spreadsheets */
  chartCategories?: string[];
  chartSeries?: SlideChartSeries[];
  /** M9: Structured multi-column table data for `table` slides */
  tableData?: SlideTableData;
  /** M9: Optional client-compressed real figure image data URL for `image-text` slides */
  imageDataUrl?: string;
}

export interface PackInsight {
  topic: string;
  subtitle: string;
  audience: string;
  scenario: string;
  slideCount: number;
  /** Page count the user asked for (material may support fewer). */
  requestedSlides?: number;
  talkMinutes: number;
  tone: string;
  /** Presentation density: live talk vs async reading deck. */
  density?: PackDensity;
  keyFacts: string[];
  sections: string[];
  fileName: string;
  charCount: number;
}

export interface PromptPack {
  version: 1;
  engine: "llm" | "smart";
  model?: string;
  insight: PackInsight;
  style: PackStyle;
  slides: PackSlide[];
}

/* ==========================================================================
   3. Curated design directions (replace "cheap" catalog fallback)
   ========================================================================== */

export interface DesignDirection {
  id: string;
  name: string;
  reference: string;
  scenarios: string[];
  keywords: string[];
  colors: PackColor[];
  chartColors: string[];
  headingFont: string;
  bodyFont: string;
  numberFont: string;
  layoutGrammar: string;
  imagery: string;
  chartStyle: string;
  dos: string[];
  donts: string[];
  spec: {
    archetype: LayoutArchetype;
    mood: TypographyMood;
    motif: DecorativeMotif;
    radius: number;
    density: "airy" | "balanced" | "dense";
    titleWeight: number;
  };
}

const roles = (
  bg: string,
  surface: string,
  ink: string,
  muted: string,
  primary: string,
  accent: string
): PackColor[] => [
  { role: "背景", hex: bg },
  { role: "浅底/卡片", hex: surface },
  { role: "正文", hex: ink },
  { role: "次要文字", hex: muted },
  { role: "主色", hex: primary },
  { role: "强调色", hex: accent },
];

export const DESIGN_DIRECTIONS: readonly DesignDirection[] = [
  {
    id: "nature-academic",
    name: "Nature 期刊式克制学术风",
    reference: "Nature / Cell 论文图版、学术会议 Keynote",
    scenarios: ["学术答辩", "科研基金"],
    keywords: ["克制", "证据优先", "高信息密度", "可读性"],
    colors: roles("#FFFFFF", "#F4F6F8", "#111827", "#6B7280", "#1F4E79", "#D1495B"),
    chartColors: ["#1F4E79", "#D1495B", "#EDAE49", "#00798C"],
    headingFont: "思源宋体 Source Han Serif SC / Source Serif 4",
    bodyFont: "思源黑体 Source Han Sans SC / Inter",
    numberFont: "Inter Tight（等宽数字 tabular-nums）",
    layoutGrammar: "12 栏网格，左对齐；标题即结论（一句话论点），页脚放引用与页码；四周 ≥ 64px 安全边距",
    imagery: "只用论文原图、示意图或线框图；不用库存照片；图注用小号次要文字",
    chartStyle: "去掉背景网格与 3D；坐标轴细线；误差线/显著性标注保留；最多 4 色且色盲友好",
    dos: ["每页一个结论标题", "数据标注单位与来源", "公式单独居中排版"],
    donts: ["渐变背景与发光效果", "装饰性图标堆砌", "整页大段文字"],
    spec: { archetype: "scientific-figure", mood: "academic", motif: "citation-axis", radius: 2, density: "balanced", titleWeight: 600 },
  },
  {
    id: "textbook-illustrated",
    name: "新课标教材插画风",
    reference: "人教版新教材版式 + 扁平科普插画",
    scenarios: ["课堂教学"],
    keywords: ["亲和", "清晰", "分步讲解", "插画"],
    colors: roles("#FFFDF7", "#FFF3D6", "#24324A", "#6B7280", "#2F7D5B", "#F08A4B"),
    chartColors: ["#2F7D5B", "#F08A4B", "#3D8BD9", "#E2B93B"],
    headingFont: "阿里巴巴普惠体 Bold / Nunito",
    bodyFont: "阿里巴巴普惠体 Regular / Nunito",
    numberFont: "DIN Alternate",
    layoutGrammar: "大圆角卡片承载知识点；每页一个“学习目标/探究/结论”标签；关键词用荧光笔式底色高亮",
    imagery: "扁平矢量插画（实验装置、生活情境），线条 2px，配色取自色板；示意图标注箭头与物理量",
    chartStyle: "实验数据用简洁折线/柱状，坐标轴写清物理量与单位，数据点放大可见",
    dos: ["公式、单位规范书写", "例题分步展示", "每页留一个思考问题"],
    donts: ["卡通字体满屏", "高饱和霓虹色", "无出处的数据"],
    spec: { archetype: "warm-humanist", mood: "humanist", motif: "bento-dots", radius: 18, density: "airy", titleWeight: 700 },
  },
  {
    id: "learning-workshop",
    name: "清爽培训工作坊风",
    reference: "Notion / Duolingo 学习卡片",
    scenarios: ["教育培训"],
    keywords: ["模块化", "互动", "轻松", "可操作"],
    colors: roles("#F7F9FC", "#FFFFFF", "#1F2937", "#64748B", "#4F46E5", "#14B8A6"),
    chartColors: ["#4F46E5", "#14B8A6", "#F59E0B", "#EC4899"],
    headingFont: "HarmonyOS Sans SC Bold / Plus Jakarta Sans",
    bodyFont: "HarmonyOS Sans SC / Inter",
    numberFont: "Plus Jakarta Sans",
    layoutGrammar: "Bento 卡片网格，模块编号 01/02/03；练习页用复选框清单；每节结尾一张小测卡",
    imagery: "线性图标 + 截图/流程示意，统一 1.5px 线宽",
    chartStyle: "简洁环形/进度条，突出百分比",
    dos: ["动作动词开头的要点", "每模块 ≤ 3 个知识点"],
    donts: ["长段落", "过多动画"],
    spec: { archetype: "soft-bento", mood: "swiss", motif: "bento-dots", radius: 16, density: "balanced", titleWeight: 700 },
  },
  {
    id: "mckinsey-consulting",
    name: "麦肯锡式咨询汇报风",
    reference: "McKinsey / BCG 咨询报告",
    scenarios: ["咨询汇报", "项目汇报"],
    keywords: ["结论先行", "金字塔原理", "严谨", "数据驱动"],
    colors: roles("#FFFFFF", "#F2F5F9", "#0B1F3A", "#5B6B80", "#0A4AA6", "#00A3A1"),
    chartColors: ["#0A4AA6", "#00A3A1", "#8FA9C7", "#F2A900"],
    headingFont: "思源黑体 Bold / Arial",
    bodyFont: "思源黑体 Regular / Arial",
    numberFont: "Arial Narrow / Roboto Condensed",
    layoutGrammar: "顶部 action title（完整句结论，≤ 2 行）；正文区左图右文或三栏；底部 source 注释与页码",
    imagery: "几乎不用照片；以图表、矩阵、流程框图为主",
    chartStyle: "瀑布图、堆叠柱、2×2 矩阵；高亮一根关键柱，其余灰色；直接数据标签，不用图例",
    dos: ["标题写成可被验证的结论", "每页注明数据来源", "灰 + 一个强调色"],
    donts: ["彩虹配色", "装饰插画", "标题只写名词"],
    spec: { archetype: "consulting-mbb", mood: "consulting", motif: "hairline-rule", radius: 0, density: "dense", titleWeight: 700 },
  },
  {
    id: "corporate-clarity",
    name: "现代企业简报风",
    reference: "Stripe / 飞书 年度汇报",
    scenarios: ["个人述职", "年度总结", "项目汇报"],
    keywords: ["专业", "清爽", "成果可视化"],
    colors: roles("#FFFFFF", "#F5F7FB", "#101828", "#667085", "#2563EB", "#F97316"),
    chartColors: ["#2563EB", "#F97316", "#10B981", "#A855F7"],
    headingFont: "飞书字体 / 思源黑体 Bold / Inter",
    bodyFont: "思源黑体 / Inter",
    numberFont: "Inter Display",
    layoutGrammar: "左上标题 + 右上页码；KPI 卡片行 + 下方图表；章节页用主色满版",
    imagery: "真实工作场景照片（统一冷色调）或产品截图，圆角 12px",
    chartStyle: "简洁柱/折线，主色为本期、浅灰为对比期，标注同比/环比",
    dos: ["成果用数字说话", "每页 ≤ 4 个要点"],
    donts: ["剪贴画", "超过 3 种字号"],
    spec: { archetype: "swiss-grid", mood: "swiss", motif: "hairline-rule", radius: 12, density: "balanced", titleWeight: 700 },
  },
  {
    id: "civic-redgold",
    name: "庄重政务红金风",
    reference: "政府工作报告 / 党建宣讲版式",
    scenarios: ["政务党建"],
    keywords: ["庄重", "规范", "大气"],
    colors: roles("#FFFBF5", "#F7EDE0", "#2B1B17", "#7A6458", "#B91C1C", "#C9A227"),
    chartColors: ["#B91C1C", "#C9A227", "#7F1D1D", "#D97706"],
    headingFont: "方正小标宋 / 思源宋体 Heavy",
    bodyFont: "仿宋 / 思源黑体",
    numberFont: "思源宋体 Bold",
    layoutGrammar: "居中对称；顶部红色细带 + 金色分隔线；章节使用“一、二、三”编号",
    imagery: "城市建设、民生场景实拍，暖色调；可用祥云/城市剪影浅纹理",
    chartStyle: "柱状/环形，红金双色，数据标签加粗",
    dos: ["用词规范准确", "层级编号统一"],
    donts: ["娱乐化字体", "冷色科技风元素"],
    spec: { archetype: "civic-redgold", mood: "chinese", motif: "redgold-ribbon", radius: 4, density: "balanced", titleWeight: 800 },
  },
  {
    id: "vc-pitch-dark",
    name: "硅谷路演暗色风",
    reference: "Sequoia 融资 Deck / Linear 发布页",
    scenarios: ["商业路演"],
    keywords: ["自信", "高对比", "叙事张力"],
    colors: roles("#0B0D12", "#151924", "#F5F7FA", "#9AA4B2", "#7C5CFF", "#22D3EE"),
    chartColors: ["#7C5CFF", "#22D3EE", "#F472B6", "#FACC15"],
    headingFont: "Inter Display Bold / 思源黑体 Heavy",
    bodyFont: "Inter / 思源黑体",
    numberFont: "Inter Display（超大字号）",
    layoutGrammar: "每页一个大主张；大数字占据 40% 版面；痛点 → 方案 → 市场 → 牵引力 → 团队 → 融资的叙事顺序",
    imagery: "产品 UI 截图置于深色设备框或悬浮卡片，柔和紫青光晕",
    chartStyle: "增长曲线只保留一条亮色线，终点标注数值；市场规模用 TAM/SAM/SOM 同心圆",
    dos: ["标题 ≤ 12 字", "一页一个数字"],
    donts: ["浅色背景混用", "密集表格"],
    spec: { archetype: "keynote-center", mood: "tech", motif: "spotlight-orb", radius: 14, density: "airy", titleWeight: 800 },
  },
  {
    id: "apple-keynote",
    name: "Apple 发布会极简风",
    reference: "Apple Keynote 发布会",
    scenarios: ["产品发布", "品牌提案"],
    keywords: ["极简", "留白", "电影感"],
    colors: roles("#FFFFFF", "#F5F5F7", "#1D1D1F", "#6E6E73", "#0071E3", "#BF4800"),
    chartColors: ["#0071E3", "#BF4800", "#30D158", "#AF52DE"],
    headingFont: "SF Pro Display / 苹方 PingFang SC Semibold",
    bodyFont: "SF Pro Text / 苹方 PingFang SC",
    numberFont: "SF Pro Display Bold",
    layoutGrammar: "大面积留白，居中构图；一页只讲一件事；关键词渐变文字；产品图占满 60% 版面",
    imagery: "高质感产品渲染图/棚拍，纯色背景，柔和投影",
    chartStyle: "极简对比条（新 vs 旧），只显示倍数结论，例如“快 2.3 倍”",
    dos: ["短句标题", "大图 + 一行说明"],
    donts: ["项目符号列表堆叠", "边框与分割线过多"],
    spec: { archetype: "luxury-minimal", mood: "swiss", motif: "none", radius: 20, density: "airy", titleWeight: 700 },
  },
  {
    id: "tech-blueprint",
    name: "工程蓝图技术分享风",
    reference: "Vercel / GitHub Universe 技术演讲",
    scenarios: ["技术分享"],
    keywords: ["工程感", "架构图", "代码"],
    colors: roles("#0A1628", "#11233D", "#E6EDF7", "#8CA3C2", "#3B82F6", "#22C55E"),
    chartColors: ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444"],
    headingFont: "JetBrains Mono Bold / 思源黑体 Bold",
    bodyFont: "Inter / 思源黑体",
    numberFont: "JetBrains Mono",
    layoutGrammar: "细网格蓝图底纹；架构图居中，模块用描边圆角矩形 + 连线；代码块使用暗色主题等宽字体",
    imagery: "系统架构图、时序图、终端截图；不用人物照片",
    chartStyle: "性能对比用水平条形 + 具体 ms/QPS 数值；基准测试注明环境",
    dos: ["代码 ≤ 12 行并高亮关键行", "架构图分层标注"],
    donts: ["整页代码", "浅色花哨背景"],
    spec: { archetype: "tech-blueprint", mood: "tech", motif: "corner-brackets", radius: 8, density: "balanced", titleWeight: 700 },
  },
  {
    id: "editorial-magazine",
    name: "杂志编辑排版风",
    reference: "Kinfolk / Monocle 杂志版式",
    scenarios: ["品牌提案", "生活纪实", "文化创意"],
    keywords: ["叙事", "大图", "高级感"],
    colors: roles("#F6F1EA", "#EDE4D8", "#1E1A16", "#6E645A", "#9C3D2E", "#2F5D50"),
    chartColors: ["#9C3D2E", "#2F5D50", "#C8A97E", "#3F3A35"],
    headingFont: "Playfair Display / 思源宋体 Bold",
    bodyFont: "Source Serif 4 / 思源宋体 Regular",
    numberFont: "Playfair Display Italic",
    layoutGrammar: "不对称网格；大号首字下沉；满版出血大图 + 小栏文字；页码与栏目名做页眉",
    imagery: "胶片质感实拍，暖色低饱和；人物与场景留出呼吸空间",
    chartStyle: "尽量用文字化数据（大号数字 + 小注），必要时细线图表",
    dos: ["每页一个视觉焦点", "图片统一调色"],
    donts: ["图标堆砌", "居中对齐所有内容"],
    spec: { archetype: "editorial-asymmetric", mood: "editorial", motif: "editorial-drop", radius: 0, density: "airy", titleWeight: 600 },
  },
  {
    id: "neo-chinese",
    name: "新中式东方美学风",
    reference: "故宫文创 / 国家地理中文版",
    scenarios: ["文化创意"],
    keywords: ["东方", "留白", "书卷气"],
    colors: roles("#F4EFE6", "#E8DFCF", "#2A2522", "#7B6F63", "#8C2F2B", "#3E6B5C"),
    chartColors: ["#8C2F2B", "#3E6B5C", "#B08D57", "#4B4A6B"],
    headingFont: "方正清刻本悦宋 / 思源宋体 Heavy",
    bodyFont: "思源宋体 / 霞鹜文楷",
    numberFont: "思源宋体 Bold",
    layoutGrammar: "竖排标题 + 横排正文；大面积宣纸留白；印章式小红块点缀；章节用“壹贰叁”",
    imagery: "水墨晕染、工笔纹样、文物特写，低饱和",
    chartStyle: "以文字信息图为主，必要时用细线条与传统色",
    dos: ["留白 ≥ 40%", "传统色命名（朱砂/黛青）"],
    donts: ["科技蓝与霓虹色", "过多西文字体"],
    spec: { archetype: "neo-chinese", mood: "chinese", motif: "ink-wash", radius: 2, density: "airy", titleWeight: 700 },
  },
];

const DIRECTION_FALLBACK_ID = "corporate-clarity";

export function getDesignDirection(id: string | undefined | null): DesignDirection {
  return (
    DESIGN_DIRECTIONS.find((d) => d.id === id) ??
    DESIGN_DIRECTIONS.find((d) => d.id === DIRECTION_FALLBACK_ID)!
  );
}

const KEYWORD_DIRECTIONS: { id: string; re: RegExp }[] = [
  { id: "textbook-illustrated", re: /定律|公式|课堂|教学|例题|学生|课本|教材|知识点|课后|习题|探究|公开课|单元/g },
  {
    id: "nature-academic",
    re: /论文|摘要|abstract|实验结果|数据集|基线|baseline|BLEU|arXiv|参考文献|消融|SOTA|模型架构|开题报告|文献综述|研究内容|实验计划|答辩|methodology|experiments?/gi,
  },
  { id: "vc-pitch-dark", re: /融资|路演|投资人|估值|天使轮|A 轮|B 轮|商业模式|市场规模|TAM/g },
];

export function pickDesignDirection(scenario: string, text = ""): DesignDirection {
  const t = text.slice(0, 4000);
  if (/故宫|非遗|国风|诗词|书法|传统文化|水墨|文言文|古文|岳阳楼记/.test(t)) {
    return getDesignDirection("neo-chinese");
  }
  const scored = KEYWORD_DIRECTIONS.map((k) => ({ id: k.id, n: t.match(k.re)?.length ?? 0 })).sort(
    (a, b) => b.n - a.n
  );
  if (scored[0] && scored[0].n >= 2) return getDesignDirection(scored[0].id);
  const match = DESIGN_DIRECTIONS.find((d) => d.scenarios.includes(scenario));
  return match ?? getDesignDirection(DIRECTION_FALLBACK_ID);
}

/** Sensible default audience when the user leaves it blank. */
export function defaultAudienceFor(directionId: string, fallback: string): string {
  if (directionId === "textbook-illustrated" || directionId === "learning-workshop") return "学生与课堂学员";
  if (directionId === "nature-academic") return "学术同行与评审";
  if (directionId === "vc-pitch-dark") return "投资人";
  return fallback;
}

export function directionToStyle(direction: DesignDirection, rationale: string): PackStyle {
  return {
    directionId: direction.id,
    name: direction.name,
    reference: direction.reference,
    rationale,
    keywords: [...direction.keywords],
    colors: direction.colors.map((c) => ({ ...c })),
    chartColors: [...direction.chartColors],
    headingFont: direction.headingFont,
    bodyFont: direction.bodyFont,
    numberFont: direction.numberFont,
    layoutGrammar: direction.layoutGrammar,
    imagery: direction.imagery,
    chartStyle: direction.chartStyle,
    dos: [...direction.dos],
    donts: [...direction.donts],
  };
}

function normalizeToHex6(color: string, fallback: string): string {
  const clean = (color || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase();
  }
  if (/^rgba?\(/i.test(clean)) {
    return rgbToHex(parseColorToRgb(clean));
  }
  return fallback;
}

/**
 * Convert a 36-style reference library PromptItem into a PackStyle anchor so
 * users can bring any curated gallery style directly into /pack.
 */
export function promptItemToPackStyle(item: PromptItem): PackStyle {
  const direction =
    DESIGN_DIRECTIONS.find((d) => d.spec.archetype === item.visualSpec.layout.archetype) ??
    DESIGN_DIRECTIONS.find((d) => d.scenarios.includes(item.scenario)) ??
    getDesignDirection(DIRECTION_FALLBACK_ID);
  const p = item.visualSpec.palette;
  const bg = normalizeToHex6(p.bg, direction.colors[0].hex);
  const surface = normalizeToHex6(p.surface, direction.colors[1].hex);
  const text = normalizeToHex6(p.text, direction.colors[2].hex);
  const muted = normalizeToHex6(p.muted, direction.colors[3].hex);
  const primary = normalizeToHex6(p.accent, direction.colors[4].hex);
  const chartColors = [0, 1, 2, 3].map((i) =>
    normalizeToHex6(p.chartColors[i] ?? "", direction.chartColors[i] ?? primary)
  );
  const accent2 = chartColors[1] && chartColors[1] !== primary ? chartColors[1] : direction.colors[5].hex;

  return {
    directionId: direction.id,
    referenceSlug: item.slug,
    name: item.title.slice(0, 32),
    reference: `风格参考库 · ${item.englishTitle || item.title}`,
    rationale: `以风格参考库「${item.title}」为视觉锚点（${item.scenario} · ${item.styleCategory}），保留其配色与排版气质，内容全部贴合你的资料。`,
    keywords: (item.tags.length ? item.tags.slice(0, 4) : direction.keywords).map((k) => k.slice(0, 12)),
    colors: roles(bg, surface, text, muted, primary, accent2),
    chartColors,
    headingFont: item.visualSpec.typography.headingFontLabel || direction.headingFont,
    bodyFont: item.visualSpec.typography.bodyFontLabel || direction.bodyFont,
    numberFont: direction.numberFont,
    layoutGrammar: item.promptAnatomy.layout?.trim().slice(0, 200) || direction.layoutGrammar,
    imagery: item.promptAnatomy.style?.trim().slice(0, 160) || direction.imagery,
    chartStyle: direction.chartStyle,
    dos: [...direction.dos],
    donts: [...direction.donts],
  };
}

/** Apply client-side extracted image palette onto an existing PackStyle. */
export function extractedPaletteToPackStyle(
  extracted: ExtractedImageStyle,
  base: PackStyle,
  imageName?: string
): PackStyle {
  const p = extracted.palette;
  const bg = normalizeToHex6(p.bg, base.colors[0]?.hex ?? "#FFFFFF");
  const surface = normalizeToHex6(p.surface, base.colors[1]?.hex ?? "#F4F6F8");
  const text = normalizeToHex6(p.text, base.colors[2]?.hex ?? "#111827");
  const muted = normalizeToHex6(p.muted, base.colors[3]?.hex ?? "#6B7280");
  const primary = normalizeToHex6(p.accent, base.colors[4]?.hex ?? "#2563EB");
  const chartColors = [0, 1, 2, 3].map((i) =>
    normalizeToHex6(p.chartColors[i] ?? "", base.chartColors[i] ?? primary)
  );
  const accent2 = chartColors[1] || primary;
  const label = imageName ? `参考图「${imageName.slice(0, 24)}」` : "参考图";
  return {
    ...base,
    reference: `从${label}本地提取色板（原参考：${base.reference.replace(/^从参考图.*?（原参考：|）$/g, "")}）`,
    rationale: `已从${label}在浏览器本地提取 6 色色板并对齐 WCAG 可读性（${extracted.isDarkCanvas ? "深色画布" : "浅色画布"}），版式与逐页大纲保持不变。`,
    colors: roles(bg, surface, text, muted, primary, accent2),
    chartColors,
  };
}

export function evaluatePackStyleContrast(style: PackStyle): PaletteContrastReport {
  return evaluatePaletteContrast(packStyleToVisualSpec(style).palette);
}

export function autoFixPackStyleContrast(style: PackStyle): PackStyle {
  const fixed = autoFixPaletteContrast(packStyleToVisualSpec(style).palette);
  const bg = normalizeToHex6(fixed.bg, style.colors[0]?.hex ?? "#FFFFFF");
  const surface = normalizeToHex6(fixed.surface, style.colors[1]?.hex ?? "#F4F6F8");
  const text = normalizeToHex6(fixed.text, style.colors[2]?.hex ?? "#111827");
  const muted = normalizeToHex6(fixed.muted, style.colors[3]?.hex ?? "#6B7280");
  const primary = normalizeToHex6(fixed.accent, style.colors[4]?.hex ?? "#2563EB");
  const accent2 = normalizeToHex6(fixed.chartColors[1] ?? "", style.colors[5]?.hex ?? primary);
  return {
    ...style,
    colors: roles(bg, surface, text, muted, primary, accent2),
    chartColors: [0, 1, 2, 3].map((i) =>
      normalizeToHex6(fixed.chartColors[i] ?? "", style.chartColors[i] ?? primary)
    ),
  };
}

/* ==========================================================================
   4. Sanitizer (LLM output → safe PromptPack)
   ========================================================================== */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function str(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;
  const clean = String(value).replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : fallback;
}

function strList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => str(v, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function hex(value: unknown, fallback: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (HEX_RE.test(v)) return v.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toUpperCase();
  }
  return fallback;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

let slideSeq = 0;
export function newPackSlideId(): string {
  slideSeq += 1;
  return `ps_${Date.now().toString(36)}_${slideSeq}`;
}

const SAFE_PACK_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const VALID_CHART_VARIANTS: ChartVariant[] = ["col", "bar", "line", "doughnut"];

export function sanitizePackSlides(raw: unknown, fallback: PackSlide[]): PackSlide[] {
  if (!Array.isArray(raw)) return fallback;
  const slides = raw
    .filter(isObj)
    .slice(0, 30)
    .map((s, i): PackSlide => {
      const layoutRaw = str(s.layout, 24).toLowerCase() as PackLayout;
      const layout: PackLayout = PACK_LAYOUT_IDS.includes(layoutRaw)
        ? layoutRaw
        : i === 0
          ? "cover"
          : "image-text";
      const data = Array.isArray(s.data)
        ? s.data
            .filter(isObj)
            .map((d) => ({ label: str(d.label, 24), value: str(d.value, 24) }))
            .filter((d) => d.label && d.value)
            .slice(0, 6)
        : [];
      const cvRaw = str(s.chartVariant, 16) as ChartVariant;
      const chartVariant = VALID_CHART_VARIANTS.includes(cvRaw) ? cvRaw : undefined;
      const chartCategories = strList(s.chartCategories, 16, 32);
      const chartSeries: SlideChartSeries[] = Array.isArray(s.chartSeries)
        ? s.chartSeries
            .filter(isObj)
            .slice(0, 4)
            .map((ser, sIdx) => ({
              name: str(ser.name, 28, `序列 ${sIdx + 1}`),
              values: Array.isArray(ser.values)
                ? ser.values
                    .slice(0, 16)
                    .map((v) => {
                      const n = Number(v);
                      return Number.isFinite(n) ? n : 0;
                    })
                : [],
              ...(str(ser.unit, 12) ? { unit: str(ser.unit, 12) } : {}),
            }))
            .filter((ser) => ser.values.length > 0)
        : [];

      let tableData: SlideTableData | undefined;
      if (isObj(s.tableData)) {
        const headers = strList(s.tableData.headers, 10, 32);
        const rows = Array.isArray(s.tableData.rows)
          ? s.tableData.rows
              .filter(Array.isArray)
              .slice(0, 30)
              .map((r) => r.slice(0, 10).map((cell) => str(cell, 60)))
          : [];
        if (headers.length > 0 && rows.length > 0) {
          const highlightCoords: [number, number][] = Array.isArray(s.tableData.highlightCoords)
            ? s.tableData.highlightCoords
                .filter(
                  (p): p is [number, number] =>
                    Array.isArray(p) &&
                    p.length === 2 &&
                    typeof p[0] === "number" &&
                    typeof p[1] === "number" &&
                    p[0] >= 0 &&
                    p[0] < rows.length &&
                    p[1] >= 0 &&
                    p[1] < headers.length
                )
                .slice(0, 12)
            : [];
          tableData = {
            headers,
            rows,
            ...(highlightCoords.length > 0 ? { highlightCoords } : {}),
          };
        }
      }

      const rawImg = typeof s.imageDataUrl === "string" ? s.imageDataUrl.trim() : "";
      const imageDataUrl =
        rawImg && rawImg.length <= 580_000 && SAFE_PACK_IMAGE_RE.test(rawImg)
          ? rawImg
          : undefined;

      return {
        id: newPackSlideId(),
        layout,
        title: str(s.title, 60, `第 ${i + 1} 页`),
        points: strList(s.points, 6, 120),
        data,
        visual: str(s.visual, 200),
        note: str(s.note, 400),
        source: str(s.source, 80),
        ...(chartVariant ? { chartVariant } : {}),
        ...(chartCategories.length > 0 ? { chartCategories } : {}),
        ...(chartSeries.length > 0 ? { chartSeries } : {}),
        ...(tableData ? { tableData } : {}),
        ...(imageDataUrl ? { imageDataUrl } : {}),
      };
    })
    .filter((s) => s.title);
  return slides.length >= 3 ? slides : fallback;
}

export function sanitizePackStyle(raw: unknown, fallback: PackStyle): PackStyle {
  if (!isObj(raw)) return fallback;
  const rawColors = Array.isArray(raw.colors) ? raw.colors : [];
  const colors = fallback.colors.map((fb, i) => {
    const c = rawColors[i];
    if (isObj(c)) return { role: str(c.role, 12, fb.role), hex: hex(c.hex, fb.hex) };
    return { role: fb.role, hex: hex(c, fb.hex) };
  });
  const rawCharts = Array.isArray(raw.chartColors) ? raw.chartColors : [];
  const chartColors = fallback.chartColors.map((fb, i) => hex(rawCharts[i], fb));
  const base = getDesignDirection(str(raw.directionId, 40, fallback.directionId));
  const referenceSlug = str(raw.referenceSlug, 80, fallback.referenceSlug ?? "") || undefined;
  return {
    directionId: base.id,
    ...(referenceSlug ? { referenceSlug } : {}),
    name: str(raw.name, 40, fallback.name),
    reference: str(raw.reference, 80, fallback.reference),
    rationale: str(raw.rationale, 240, fallback.rationale),
    keywords: strList(raw.keywords, 6, 12).length ? strList(raw.keywords, 6, 12) : fallback.keywords,
    colors,
    chartColors,
    headingFont: str(raw.headingFont, 80, fallback.headingFont),
    bodyFont: str(raw.bodyFont, 80, fallback.bodyFont),
    numberFont: str(raw.numberFont, 80, fallback.numberFont),
    layoutGrammar: str(raw.layoutGrammar, 300, fallback.layoutGrammar),
    imagery: str(raw.imagery, 240, fallback.imagery),
    chartStyle: str(raw.chartStyle, 240, fallback.chartStyle),
    dos: strList(raw.dos, 5, 60).length ? strList(raw.dos, 5, 60) : fallback.dos,
    donts: strList(raw.donts, 5, 60).length ? strList(raw.donts, 5, 60) : fallback.donts,
  };
}

/** Validate a client-persisted pack (localStorage) before rehydrating it. */
export function isPromptPack(value: unknown): value is PromptPack {
  return (
    isObj(value) &&
    value.version === 1 &&
    isObj(value.insight) &&
    isObj(value.style) &&
    Array.isArray(value.slides) &&
    Array.isArray((value.style as Record<string, unknown>).colors)
  );
}

/* ==========================================================================
   5. Preview adapters (PromptPack → SlideCanvas)
   ========================================================================== */

function colorByRole(style: PackStyle, index: number): string {
  return style.colors[index]?.hex ?? "#000000";
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return a;
  return `#${pa
    .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function packStyleToVisualSpec(style: PackStyle): VisualSpec {
  const direction = getDesignDirection(style.directionId);
  const bg = colorByRole(style, 0);
  const accent = colorByRole(style, 4);
  const charts = [0, 1, 2, 3].map((i) => style.chartColors[i] ?? accent) as [
    string,
    string,
    string,
    string,
  ];
  return {
    palette: {
      bg,
      surface: colorByRole(style, 1),
      text: colorByRole(style, 2),
      muted: colorByRole(style, 3),
      accent,
      accentSoft: mixHex(accent, bg, 0.82),
      border: mixHex(colorByRole(style, 3), bg, 0.7),
      chartColors: charts,
    },
    typography: {
      mood: direction.spec.mood,
      headingFontLabel: style.headingFont.split("/")[0].trim(),
      bodyFontLabel: style.bodyFont.split("/")[0].trim(),
      titleWeight: direction.spec.titleWeight,
      titleTracking: "-0.01em",
    },
    layout: {
      archetype: direction.spec.archetype,
      density: direction.spec.density,
      cornerRadius: direction.spec.radius,
      showPageNumber: true,
      decorativeMotif: direction.spec.motif,
    },
  };
}

const LAYOUT_TO_SLIDE: Record<PackLayout, SlideType> = {
  cover: "cover",
  agenda: "agenda",
  section: "quote",
  "big-number": "data",
  chart: "data",
  table: "data",
  comparison: "comparison",
  timeline: "timeline",
  process: "process",
  quote: "quote",
  "image-text": "image-split",
  summary: "closing",
};

function parseNumeric(value: string): number {
  const m = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export function inferPackChartVariant(slide: PackSlide): ChartVariant {
  if (slide.chartVariant && VALID_CHART_VARIANTS.includes(slide.chartVariant)) {
    return slide.chartVariant;
  }
  const signal = `${slide.visual} ${slide.title}`;
  if (/环形|饼图|占比|构成|份额|分布|doughnut/i.test(signal) && (slide.data.length <= 6 || (slide.chartCategories?.length ?? 0) <= 6)) {
    return "doughnut";
  }
  if (/折线|曲线|趋势|走势|依次为|拉力|加速度|Q[1-4]|月度|历年/i.test(signal)) {
    return "line";
  }
  if (/横向|水平|条形|基准|评测|排行|榜单|BLEU|AIME|MATH|Codeforces|Pass@/i.test(signal)) {
    return "bar";
  }
  return "col";
}

function buildFallbackTableData(slide: PackSlide, fallbackData: PackDatum[]): SlideTableData {
  if (slide.tableData && slide.tableData.headers.length > 0 && slide.tableData.rows.length > 0) {
    return slide.tableData;
  }
  if (slide.chartCategories?.length && slide.chartSeries?.length) {
    const headers = [
      "维度",
      ...slide.chartSeries.map((s) =>
        s.unit && !s.name.includes(s.unit) ? `${s.name} (${s.unit})` : s.name
      ),
    ];
    const rows = slide.chartCategories.map((cat, rIdx) => [
      cat,
      ...slide.chartSeries!.map((s) => {
        const v = s.values[rIdx] ?? 0;
        return s.unit && !String(v).endsWith(s.unit) ? `${v}${s.unit}` : String(v);
      }),
    ]);
    return { headers, rows };
  }
  const rows = fallbackData.map((d) => [d.label, d.value]);
  return {
    headers: ["关键指标", "实证数值"],
    rows: rows.length > 0 ? rows : [["核心要点", slide.points[0] || slide.title]],
  };
}

const WEAK_TOPIC_TITLE_RE =
  /^(?:(?:abstract|introduction|background|related work|method(?:s|ology)?|experiments?|evaluation|results?|discussion|conclusions?|summary)\b|(?:研究|项目|业务|选题|写作)?(?:背景|意义|现状|概述|概览|方法|模型|架构|实验|结果|实验结果|讨论|问题|风险|挑战|总结|小结|结论|展望)(?:与(?:核心问题|研究意义|动机|挑战|风险|启示|展望))?)$/i;

/**
 * Flags bare directory-heading titles on body slides so the outline editor can
 * gently nudge users toward Assertion-Evidence conclusion headlines.
 */
export function isWeakTopicTitle(title: string, layout: PackLayout): boolean {
  if (layout === "cover" || layout === "agenda" || layout === "section") return false;
  const clean = title.replace(/^[\d一二三四五六七八九十.、\s]+/, "").trim();
  if (!clean) return true;
  if (/\([1-9]\/[1-9]\)|（[1-9]\/[1-9]）/.test(clean)) return true;
  if (/\d/.test(clean)) return false;
  return clean.length <= 12 && WEAK_TOPIC_TITLE_RE.test(clean);
}

function inferComparisonHeadings(slide: PackSlide): { leftTitle: string; rightTitle: string } {
  const vsMatch = slide.title.match(/^(.{2,16}?)\s*(?:vs\.?|VS|对比|相比|与)\s*(.{2,16})$/);
  if (vsMatch) {
    return {
      leftTitle: vsMatch[1].trim().slice(0, 14),
      rightTitle: vsMatch[2].trim().slice(0, 14),
    };
  }
  const p0 = slide.points[0] ?? "";
  const p1 = slide.points[Math.ceil(slide.points.length / 2)] ?? "";
  const c0 = p0.match(/^([^：:，,]{2,12})[：:]/)?.[1]?.trim();
  const c1 = p1.match(/^([^：:，,]{2,12})[：:]/)?.[1]?.trim();
  if (c0 && c1 && c0 !== c1) {
    return { leftTitle: c0, rightTitle: c1 };
  }
  return { leftTitle: "对照基准 / 现状", rightTitle: "核心方案 / 结论" };
}

export function packSlideToCanvas(
  slide: PackSlide,
  insight: PackInsight
): { slideType: SlideType; slideData: Partial<DeckSlideItem> } {
  const slideType = LAYOUT_TO_SLIDE[slide.layout];
  const pts = slide.points.length ? slide.points : [slide.visual || slide.title];
  const base: Partial<DeckSlideItem> = {
    slideType,
    title: slide.title,
    sectionTag: packLayoutLabel(slide.layout),
    bullets: pts.slice(0, 5),
    speakerNotes: slide.note,
    sourceStatus: "source-material",
    sourceNote: slide.source,
  };
  switch (slide.layout) {
    case "cover":
      return { slideType, slideData: { ...base, subtitle: pts[0] || insight.subtitle } };
    case "agenda":
    case "timeline":
    case "process":
      return {
        slideType,
        slideData: {
          ...base,
          steps: pts.slice(0, 4).map((p, i) => {
            const [head, ...rest] = p.split(/[：:]/);
            return {
              code: String(i + 1).padStart(2, "0"),
              title: (rest.length ? head : p).slice(0, 18),
              desc: (rest.length ? rest.join("：") : p.length > 18 ? p.slice(18) : "").slice(0, 72),
            };
          }),
        },
      };
    case "big-number":
    case "chart":
    case "table": {
      const data = slide.data.length
        ? slide.data
        : pts.slice(0, 3).map((p, i) => ({ label: p.slice(0, 12), value: String(i + 1) }));
      const hasMultiSeries =
        Boolean(slide.chartCategories?.length) && Boolean(slide.chartSeries?.length);
      const rawVals = data.slice(0, 6).map((d) => Math.abs(parseNumeric(d.value)));
      const nonZero = rawVals.filter((n) => n > 0);
      const max = Math.max(1, ...rawVals);
      const minPos = nonZero.length ? Math.min(...nonZero) : 1;
      const keepRawScale = nonZero.length > 0 && max <= 1000 && max / Math.max(0.01, minPos) <= 25;

      const resolvedDisplay: DataDisplayMode =
        slide.layout === "big-number"
          ? "kpi-only"
          : slide.layout === "table"
            ? "data-matrix"
            : inferPackChartVariant(slide);

      const categories = hasMultiSeries
        ? slide.chartCategories!.slice(0, 16)
        : data.slice(0, 6).map((d) => d.label.slice(0, 16));

      const series: SlideChartSeries[] = hasMultiSeries
        ? slide.chartSeries!.slice(0, 4)
        : [
            {
              name: slide.title.slice(0, 18) || "实证数值",
              values: data.slice(0, 6).map((d) => {
                const raw = Math.abs(parseNumeric(d.value));
                return keepRawScale
                  ? Number(raw.toFixed(raw < 10 && !Number.isInteger(raw) ? 1 : 0))
                  : Math.max(4, Math.round((raw / max) * 100));
              }),
            },
          ];

      const bars = categories.slice(0, 10).map((cat, idx) => ({
        label: cat.slice(0, 14),
        v1: series[0]?.values[idx] ?? 0,
        v2: series[1]?.values[idx] ?? series[0]?.values[idx] ?? 0,
      }));

      const tableData = buildFallbackTableData(slide, data);

      return {
        slideType,
        slideData: {
          ...base,
          dataDisplay: resolvedDisplay,
          singleSeries: series.length <= 1,
          chartCategories: categories,
          chartSeries: series,
          tableData,
          kpis: data.slice(0, 3).map((d, idx) => ({
            label: d.label,
            value: d.value,
            note: idx === 0 && pts[0] ? pts[0].slice(0, 36) : slide.source || "",
          })),
          bars,
        },
      };
    }
    case "image-text":
      return {
        slideType,
        slideData: {
          ...base,
          kpis: slide.data.slice(0, 2).map((d) => ({
            label: d.label,
            value: d.value,
            note: slide.source || "",
          })),
          imageSlot: slide.imageDataUrl
            ? {
                kind: "data-url",
                dataUrl: slide.imageDataUrl,
                layout: "left",
                caption: slide.source || slide.title,
                promptHint: slide.visual,
              }
            : {
                kind: "placeholder",
                layout: "left",
                caption: slide.source || "",
                promptHint:
                  slide.visual ||
                  `建议在此粘贴「${slide.title.slice(0, 18)}」相关架构图、实验截图或业务配图`,
              },
        },
      };
    case "comparison": {
      const half = Math.max(1, Math.ceil(pts.length / 2));
      const { leftTitle, rightTitle } = inferComparisonHeadings(slide);
      return {
        slideType,
        slideData: {
          ...base,
          leftTitle,
          rightTitle,
          leftPoints: pts.slice(0, half),
          rightPoints: pts.slice(half).length ? pts.slice(half) : [slide.visual || pts[0]],
        },
      };
    }
    case "section":
    case "quote":
      return {
        slideType,
        slideData: {
          ...base,
          quoteText: pts[0] || slide.title,
          quoteAuthor: slide.source || insight.topic,
          kpis: slide.data.slice(0, 3).map((d) => ({ label: d.label, value: d.value, note: "" })),
        },
      };
    case "summary":
      return {
        slideType,
        slideData: {
          ...base,
          steps: pts.slice(0, 3).map((p, i) => {
            const [head, ...rest] = p.split(/[：:，,]/);
            const useSplit = rest.length > 0 && head.length >= 4 && head.length <= 18;
            return {
              code: String(i + 1).padStart(2, "0"),
              title: (useSplit ? head : p.slice(0, 16)).trim(),
              desc: (useSplit ? rest.join("，") : p.slice(16, 72)).trim(),
            };
          }),
        },
      };
    default:
      return { slideType, slideData: base };
  }
}

/** Convert an entire PromptPack into ready-to-render/export DeckSlideItem slides. */
export function packToDeckSlides(pack: PromptPack): DeckSlideItem[] {
  return pack.slides.map((slide, i) => {
    const { slideType, slideData } = packSlideToCanvas(slide, pack.insight);
    return {
      id: slide.id || `pack_slide_${i + 1}`,
      slideType,
      sectionTag: slideData.sectionTag || packLayoutLabel(slide.layout),
      title: slide.title,
      ...slideData,
    };
  });
}

/** Choose up to 3 visually distinct slides for the live style proof (optionally pinning an active slide). */
export function pickPreviewSlides(slides: PackSlide[], activeSlideId?: string | null): PackSlide[] {
  const picked: PackSlide[] = [];
  const want: PackLayout[][] = [
    ["cover"],
    ["table", "chart", "big-number"],
    ["comparison", "process", "timeline", "image-text", "summary"],
  ];
  for (const group of want) {
    const s = slides.find((x) => group.includes(x.layout) && !picked.includes(x));
    if (s) picked.push(s);
  }
  for (const s of slides) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  const result = picked.slice(0, 3);
  if (activeSlideId) {
    const focused = slides.find((x) => x.id === activeSlideId);
    if (focused && !result.includes(focused)) {
      if (result.length >= 3) result[2] = focused;
      else result.push(focused);
    }
  }
  return result;
}

/* ==========================================================================
   6. Master prompt renderers
   ========================================================================== */

export type ChatgptExportMode = "oneshot" | "twostep";

const LANG_LINE: Record<PackLanguage, string> = {
  zh: "全部使用简体中文。",
  en: "Write all slide text in English (translate the source faithfully).",
  bilingual: "标题使用中文 + 小号英文副标题，正文使用中文。",
};

const DENSITY_RULE: Record<PackDensity, string> = {
  speaker:
    "用途密度【现场演讲 · 字少大字】：画面留白 ≥ 40%，正文 18–22pt，单页 ≤ 3 条短句（每条 ≤ 28 字）；所有长句推导与背景补充只放进演讲备注（Notes），严禁把整段文字堆上屏幕。",
  reading:
    "用途密度【书面汇报 · 详实自解释】：正文 14–17pt，用结构化 Bento 卡片或双栏矩阵承载 3–5 条完整论据与数据口径，确保读者在没有讲解人的情况下异步阅读也能独立读懂。",
};

function resolveDensity(pack: PromptPack, override?: PackDensity): PackDensity {
  return override ?? (pack.insight.density === "reading" ? "reading" : "speaker");
}

function styleBlock(style: PackStyle): string {
  const colorLines = style.colors.map((c) => `  - ${c.role}：${c.hex}`).join("\n");
  return [
    `- 设计方向：${style.name}（参考：${style.reference}）`,
    `- 风格关键词：${style.keywords.join("、")}`,
    `- 色板（严格只用这些颜色）：\n${colorLines}\n  - 图表色序列：${style.chartColors.join(" → ")}`,
    `- 字体：标题 ${style.headingFont}；正文 ${style.bodyFont}；数字 ${style.numberFont}（缺字体时回退到 微软雅黑 / Arial）`,
    `- 版式语法：${style.layoutGrammar}`,
    `- 图片：${style.imagery}`,
    `- 图表：${style.chartStyle}`,
    `- 必须：${style.dos.join("；")}`,
    `- 禁止：${style.donts.join("；")}`,
  ].join("\n");
}

function slideBlock(slide: PackSlide, index: number, total: number, withNotes = true): string {
  const layoutBadge =
    slide.layout === "chart"
      ? `${packLayoutLabel(slide.layout)} · ${chartVariantLabel(inferPackChartVariant(slide))}`
      : packLayoutLabel(slide.layout);
  const lines = [`### 第 ${index + 1}/${total} 页 · 【${layoutBadge}】${slide.title}`];
  if (slide.points.length) lines.push(slide.points.map((p) => `- ${p}`).join("\n"));
  if (slide.layout === "table" && slide.tableData) {
    const head = `| ${slide.tableData.headers.join(" | ")} |`;
    const sep = `| ${slide.tableData.headers.map(() => "---").join(" | ")} |`;
    const body = slide.tableData.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    lines.push(`原生数据表（请用三线表/评分表排版并加粗极值）：\n${head}\n${sep}\n${body}`);
  } else if (slide.chartSeries && slide.chartSeries.length > 1 && slide.chartCategories?.length) {
    const seriesTxt = slide.chartSeries
      .map((ser) => `${ser.name}=[${ser.values.map((v, idx) => `${slide.chartCategories![idx]}:${v}${ser.unit || ""}`).join(", ")}]`)
      .join("；");
    lines.push(`多序列图表数据：${seriesTxt}`);
  } else if (slide.data.length) {
    lines.push(`数据：${slide.data.map((d) => `${d.label} = ${d.value}`).join("；")}`);
  }
  if (slide.visual) lines.push(`视觉：${slide.visual}`);
  if (withNotes && slide.note) lines.push(`演讲备注：${slide.note}`);
  if (slide.source) lines.push(`资料出处：${slide.source}`);
  return lines.join("\n");
}

function slidesBlock(pack: PromptPack, withNotes = true): string {
  return pack.slides.map((s, i) => slideBlock(s, i, pack.slides.length, withNotes)).join("\n\n");
}

function contextBlock(pack: PromptPack, density?: PackDensity): string {
  const i = pack.insight;
  const d = resolveDensity(pack, density);
  const densityLabel = d === "reading" ? "书面汇报（详实自解释）" : "现场演讲（字少大字）";
  return [
    `- 主题：${i.topic}${i.subtitle ? `（${i.subtitle}）` : ""}`,
    `- 受众：${i.audience}；场景：${i.scenario}；用途：${densityLabel}；时长约 ${i.talkMinutes} 分钟；共 ${pack.slides.length} 页`,
    i.keyFacts.length ? `- 资料中的关键事实：${i.keyFacts.join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const LAYOUT_RULE =
  "每页严格按【版式】实现，严禁把所有页面做成雷同的“标题 + 项目符号列表”；每页标题必须是结论句（Assertion Headline），大数字页核心数值字号 64–88pt，图表页使用原生可编辑图表，对比页使用双栏或原生表格。";
const HONESTY_RULE =
  "只使用上面给出的事实与数据；资料中没有的数据写成「[待补充]」，严禁编造数字、引用或人名。";
const PPTX_QA_RULE =
  "【必须执行的代码自检】保存 .pptx 后，在代码解释器中用 python-pptx 重新读取文件并逐页断言：① 总页数一致；② 所有 shape 满足 left >= 0、top >= 0 且 left + width <= Inches(13.333)、top + height <= Inches(7.5)（零越界裁切）；③ 文本框之间无矩形重叠；④ 文本内无残留的 `#`、`*`、`**` 等 Markdown 符号（加粗请用 run.font.bold = True）。若发现越界或重叠，必须在代码里修正坐标后重新导出再给出下载链接。";

export function renderStyleOnlyPrompt(
  pack: PromptPack,
  language: PackLanguage = "zh",
  density?: PackDensity
): string {
  const d = resolveDensity(pack, density);
  return [
    `你是一位顶级演示文稿视觉设计总监。下面是我即将制作的 PPT 的背景与设计规范，请先记住并确认这套视觉系统（暂不生成文件）。`,
    `## 背景\n${contextBlock(pack, d)}`,
    `## 设计规范\n${styleBlock(pack.style)}`,
    `**为什么适合这份资料：**${pack.style.rationale}`,
    `## 规则\n- ${LAYOUT_RULE}\n- ${DENSITY_RULE[d]}\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}\n- 请简要确认你理解的配色层级、版式节奏，回复「风格已就绪，请发送逐页大纲」。`,
  ].join("\n\n");
}

export function renderOutlineOnlyPrompt(
  pack: PromptPack,
  language: PackLanguage = "zh",
  density?: PackDensity
): string {
  const n = pack.slides.length;
  const d = resolveDensity(pack, density);
  return [
    `请严格按照刚才确认的「设计规范」，根据下面的逐页内容（共 ${n} 页），用代码解释器（python-pptx）生成一份 16:9（13.333in × 7.5in）的 .pptx 文件并提供下载链接。`,
    `## 逐页内容（共 ${n} 页）\n${slidesBlock(pack)}`,
    `## 实现要求\n1. 画布坐标铁律：prs.slide_width = Inches(13.333)，prs.slide_height = Inches(7.5)；顶部眉标区 top=0.45in，结论标题区 top=0.82in (h=0.9in, 26–32pt 加粗)，主内容舞台 top=1.9in..6.65in (左右留白 ≥ 0.65in)，页脚出处与页码 top=6.9in。\n2. ${LAYOUT_RULE}\n3. ${DENSITY_RULE[d]}\n4. 图表页用 python-pptx 原生图表（可在 PowerPoint 中双击编辑数据），去除杂乱边框网格线，按图表色序列着色并开启数据标签直接显示数值。\n5. 把每页「演讲备注」写入 slide.notes_slide.notes_text_frame。\n6. ${HONESTY_RULE}\n7. ${LANG_LINE[language]}\n8. ${PPTX_QA_RULE}`,
  ].join("\n\n");
}

export function renderGammaParts(
  pack: PromptPack,
  language: PackLanguage = "zh",
  density?: PackDensity
): { instructions: string; cards: string } {
  const d = resolveDensity(pack, density);
  const instructions = [
    `设计方向：${pack.style.name}（参考 ${pack.style.reference}）。`,
    `配色：${pack.style.colors.map((c) => `${c.role} ${c.hex}`).join("，")}；图表色 ${pack.style.chartColors.join("、")}。`,
    `字体：标题 ${pack.style.headingFont}，正文 ${pack.style.bodyFont}。`,
    `版式：${pack.style.layoutGrammar}。图片：${pack.style.imagery}。`,
    `${DENSITY_RULE[d]}`,
    `每张卡片按标注的【版式】生成差异化视觉模块（大数字卡、图表、双栏对比、步骤流），避免全部是普通列表。${HONESTY_RULE}${LANG_LINE[language]}`,
  ].join("\n");
  const cards = pack.slides
    .map((s) => {
      const body = [
        `# ${s.title}`,
        ...s.points.map((p) => `- ${p}`),
        s.data.length ? s.data.map((dItem) => `**${dItem.value}** ${dItem.label}`).join(" ｜ ") : "",
        s.visual ? `> 视觉与图表：${s.visual}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return `<!-- 版式：${packLayoutLabel(s.layout)} -->\n${body}`;
    })
    .join("\n\n---\n\n");
  return { instructions, cards };
}

export function renderChatgptTwoStep(
  pack: PromptPack,
  language: PackLanguage = "zh",
  density?: PackDensity
): { step1: string; step2: string } {
  return {
    step1: renderStyleOnlyPrompt(pack, language, density),
    step2: renderOutlineOnlyPrompt(pack, language, density),
  };
}

export function renderMasterPrompt(
  pack: PromptPack,
  tool: PackTool,
  language: PackLanguage = "zh",
  options?: { chatgptMode?: ChatgptExportMode; density?: PackDensity }
): string {
  const n = pack.slides.length;
  const d = resolveDensity(pack, options?.density);
  switch (tool) {
    case "chatgpt": {
      if (options?.chatgptMode === "twostep") {
        const { step1, step2 } = renderChatgptTwoStep(pack, language, d);
        return `【第 1 轮 · 发送风格规范（确认视觉基准）】\n\n${step1}\n\n---\n\n【第 2 轮 · 发送逐页大纲（生成 .pptx）】\n\n${step2}`;
      }
      return [
        `你是一位顶级演示文稿设计师兼 python-pptx 工程师。请根据下面的「设计规范」与「逐页内容」，用代码解释器生成一份 16:9（13.333in × 7.5in）的 .pptx 文件并提供下载链接。`,
        `## 背景\n${contextBlock(pack, d)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 逐页内容（共 ${n} 页）\n${slidesBlock(pack)}`,
        `## 实现要求\n1. 画布与安全区：prs.slide_width = Inches(13.333)，prs.slide_height = Inches(7.5)；顶部眉标区 top=0.45in，结论标题区 top=0.82in (26–32pt 加粗，封面主标题 40–48pt)，主内容区 top=1.9in..6.65in (左右边距 ≥ 0.65in)，页脚出处与页码 top=6.9in。\n2. ${LAYOUT_RULE}\n3. ${DENSITY_RULE[d]}\n4. 图表页用 python-pptx 原生图表（可在 PowerPoint 中编辑），去除多余网格线边框，按图表色序列着色并直接显示数据标签。\n5. 把每页「演讲备注」写入 notes；需要配图的位置放置与色板协调的几何视觉模块或清晰占位说明框。\n6. ${HONESTY_RULE}\n7. ${LANG_LINE[language]}\n8. ${PPTX_QA_RULE}`,
      ].join("\n\n");
    }
    case "gamma": {
      const { instructions, cards } = renderGammaParts(pack, language, d);
      return `【① 粘贴到 Gamma「额外指令 / Additional instructions」】\n${instructions}\n\n【② 粘贴到 Gamma「粘贴文本 / Paste in text」，选择“按 --- 分卡”】\n\n${cards}`;
    }
    case "kimi":
      return [
        `请帮我制作一份 ${n} 页的 PPT。先严格按下面的结论式大纲生成，再在模板中选择最接近「${pack.style.name}」的风格，并按设计规范调整配色与字体。`,
        `## 背景\n${contextBlock(pack, d)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 大纲\n${pack.slides
          .map((s, i) => {
            const pts = s.points.map((p) => `  - ${p}`).join("\n");
            const data = s.data.length ? `\n  - 数据：${s.data.map((dItem) => `${dItem.label} ${dItem.value}`).join("；")}` : "";
            return `${i + 1}. 【${packLayoutLabel(s.layout)}】${s.title}\n${pts}${data}`;
          })
          .join("\n")}`,
        `## 要求\n- ${LAYOUT_RULE}\n- ${DENSITY_RULE[d]}\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}`,
      ].join("\n\n");
    case "claude":
      return [
        `请生成一个单文件 HTML 幻灯片（index.html，零外部 CDN 依赖，可完全离线打开演示与打印 PDF）。`,
        `## 舞台与交互架构（必须严格遵守）\n- 固定画布比例：每页 <section class="slide"> 固定为 1920px × 1080px（overflow: hidden; box-sizing: border-box），外层舞台使用 JS 计算 transform: scale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080)) 居中缩放，严禁在窄窗口下流式折行破坏版面。\n- 翻页显隐控制：非当前页用 opacity: 0; visibility: hidden; pointer-events: none; 切换（避免 display: none 与 .slide { display: flex/grid } 优先级冲突）。\n- 演示控制：支持键盘 ← / → / Space 翻页、F 键全屏、N 键呼出底部「演讲备注」浮层（展示每页备注）、顶部细进度条与右下角页码。\n- 矢量导出支持：内置 @media print { @page { size: 1920px 1080px; margin: 0; } } 样式，让浏览器「打印 → 另存为 PDF」一页一张无损分页。\n- 在 :root 中用 CSS 变量定义 6 色色板与字体，所有图表用内联 SVG 绘制并直接标注数值标签。`,
        `## 背景\n${contextBlock(pack, d)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 逐页内容（共 ${n} 页）\n${slidesBlock(pack, true)}`,
        `## 质量要求\n- ${LAYOUT_RULE}\n- ${DENSITY_RULE[d]}\n- 排版精致：8px 间距栅格、大标题与 KPI 数字跃迁对比鲜明、严禁文字溢出 1920×1080 边界。\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}\n- 只输出完整可运行的 HTML 代码。`,
      ].join("\n\n");
    default:
      return renderPackMarkdown(pack, language, d);
  }
}

export function renderPackMarkdown(
  pack: PromptPack,
  language: PackLanguage = "zh",
  density?: PackDensity
): string {
  const d = resolveDensity(pack, density);
  return [
    `# ${pack.insight.topic} · PPT 提示词包`,
    `> 由 PPTGod 生成（${pack.engine === "llm" ? `大模型 ${pack.model ?? ""}`.trim() : "内置规则引擎"}）。可直接粘贴到任意 AI 演示工具。`,
    `## 背景\n${contextBlock(pack, d)}`,
    `## 设计规范\n${styleBlock(pack.style)}\n\n**为什么适合这份资料：**${pack.style.rationale}`,
    `## 逐页内容（共 ${pack.slides.length} 页）\n${slidesBlock(pack)}`,
    `## 生成要求\n- ${LAYOUT_RULE}\n- ${DENSITY_RULE[d]}\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}`,
  ].join("\n\n");
}

/* ==========================================================================
   7. Client handoff, local history (10 items) & JSON import/export
   ========================================================================== */

export const PACK_HANDOFF_KEY = "pptgod_pack_handoff_v1";
export const PACK_DRAFT_KEY = "pptgod_prompt_pack_v1";
export const PACK_HISTORY_KEY = "pptgod_prompt_pack_history_v1";
const MAX_HISTORY_ITEMS = 10;

import type { ParsedDataTable } from "@/lib/spreadsheetParser";

export interface PackHandoff {
  text: string;
  fileName: string;
  topic?: string;
  audience?: string;
  slideCount?: number;
  tables?: ParsedDataTable[];
  savedAt: number;
}

export function savePackHandoff(payload: Omit<PackHandoff, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PACK_HANDOFF_KEY,
      JSON.stringify({ ...payload, text: payload.text.slice(0, 80000), savedAt: Date.now() })
    );
  } catch {
    // storage unavailable — /pack simply opens empty
  }
}

export function consumePackHandoff(): PackHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PACK_HANDOFF_KEY);
    window.sessionStorage.removeItem(PACK_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PackHandoff;
    if (typeof parsed.text !== "string" || Date.now() - Number(parsed.savedAt) > 30 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface PackHistoryEntry {
  id: string;
  savedAt: number;
  topic: string;
  styleName: string;
  slideCount: number;
  tool: PackTool;
  language: PackLanguage;
  pack: PromptPack;
}

export function readPackHistory(): PackHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PACK_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is PackHistoryEntry => {
        return (
          isObj(item) &&
          typeof item.id === "string" &&
          typeof item.savedAt === "number" &&
          isPromptPack(item.pack)
        );
      })
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function upsertPackHistory(entry: {
  id?: string;
  pack: PromptPack;
  tool: PackTool;
  language: PackLanguage;
}): { id: string; items: PackHistoryEntry[] } {
  const id = entry.id || `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const nextItem: PackHistoryEntry = {
    id,
    savedAt: Date.now(),
    topic: entry.pack.insight.topic || "未命名提示词包",
    styleName: entry.pack.style.name || "定制风格",
    slideCount: entry.pack.slides.length,
    tool: entry.tool,
    language: entry.language,
    pack: entry.pack,
  };
  const existing = readPackHistory().filter((item) => item.id !== id);
  const items = [nextItem, ...existing].slice(0, MAX_HISTORY_ITEMS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PACK_HISTORY_KEY, JSON.stringify(items));
    } catch {
      try {
        const slimmed = items.map((it, idx) =>
          idx === 0
            ? it
            : {
                ...it,
                pack: {
                  ...it.pack,
                  slides: it.pack.slides.map(({ imageDataUrl: _drop, ...rest }) => {
                    void _drop;
                    return rest;
                  }),
                },
              }
        );
        window.localStorage.setItem(PACK_HISTORY_KEY, JSON.stringify(slimmed));
      } catch {
        // ignore quota errors
      }
    }
  }
  return { id, items };
}

export function deletePackHistory(id: string): PackHistoryEntry[] {
  const items = readPackHistory().filter((item) => item.id !== id);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PACK_HISTORY_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }
  return items;
}

export function serializePackJson(pack: PromptPack, tool: PackTool, language: PackLanguage): string {
  return JSON.stringify(
    {
      schema: "pptgod.promptpack.v1",
      exportedAt: new Date().toISOString(),
      tool,
      language,
      pack,
    },
    null,
    2
  );
}

export function parsePackJsonImport(
  raw: string
): { ok: true; pack: PromptPack; tool: PackTool; language: PackLanguage } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObj(parsed)) return { ok: false, error: "文件内容不是合法 JSON" };
    const candidate = isPromptPack(parsed.pack) ? parsed.pack : isPromptPack(parsed) ? parsed : null;
    if (!candidate) return { ok: false, error: "未识别到有效的 PPTGod 提示词包结构" };
    const toolRaw = typeof parsed.tool === "string" ? (parsed.tool as PackTool) : "chatgpt";
    const tool: PackTool = PACK_TOOLS.some((t) => t.id === toolRaw) ? toolRaw : "chatgpt";
    const langRaw = parsed.language;
    const language: PackLanguage = langRaw === "en" || langRaw === "bilingual" ? langRaw : "zh";
    return { ok: true, pack: candidate, tool, language };
  } catch {
    return { ok: false, error: "JSON 解析失败，请确认文件完整" };
  }
}

/* ==========================================================================
   8. Client-safe long-document section slicer (> 16,000 chars)
   ========================================================================== */

export interface DocumentSectionSlice {
  id: string;
  heading: string;
  text: string;
  charCount: number;
  isAppendix: boolean;
}

const SLICE_HEADING_RES: RegExp[] = [
  /^#{1,4}\s+(.+)$/,
  /^[一二三四五六七八九十]{1,3}[、.．]\s*(.+)$/,
  /^(第[一二三四五六七八九十\d]{1,3}[章节部分课讲单元].*)$/,
  /^\d{1,2}(?:\.\d{1,2}){0,2}[\s、.．]\s*([^。；;！!？?]{2,42})$/,
  /^((?:(?:abstract|introduction|background|related work|method(?:s|ology)?|architecture|experiments?|evaluation|results?|discussion|limitations?|conclusions?|references?|acknowledg(?:e)?ments?|appendix)\b|摘要|引言|背景|方法|模型|实验|结果|讨论|结论|小结|总结|参考文献|致谢|附录).{0,24})$/i,
];

const APPENDIX_HEADING_RE =
  /^(?:(?:references?|bibliography|acknowledg(?:e)?ments?|appendix|supplementary)\b|参考文献|引用文献|致谢|鸣谢|附录|补充材料)/i;

export function outlineDocumentSections(text: string): DocumentSectionSlice[] {
  const lines = text.split(/\r?\n/);
  const buckets: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      if (current) current.lines.push("");
      return;
    }
    let matchedHeading: string | null = null;
    if (idx > 0 && line.length <= 48 && !/[。；;！!？?]$/.test(line)) {
      for (const re of SLICE_HEADING_RES) {
        const m = line.match(re);
        if (m) {
          matchedHeading = (m[1] ?? line).replace(/[#*]/g, "").trim();
          break;
        }
      }
    }
    if (matchedHeading) {
      current = { heading: matchedHeading.slice(0, 36), lines: [rawLine] };
      buckets.push(current);
      return;
    }
    if (!current) {
      const introTitle =
        idx === 0 && line.length <= 40 ? line.replace(/^#+\s*/, "").slice(0, 32) : "开头 / 摘要";
      current = { heading: introTitle, lines: [rawLine] };
      buckets.push(current);
    } else {
      current.lines.push(rawLine);
    }
  });

  // Fallback for unstructured long docs: split into ~3500-char chunks so user can select parts.
  if (buckets.length <= 1 && text.length > 4000) {
    const chunks: DocumentSectionSlice[] = [];
    const chunkLen = 3500;
    for (let pos = 0, part = 1; pos < text.length; pos += chunkLen, part += 1) {
      const slice = text.slice(pos, pos + chunkLen);
      chunks.push({
        id: `sec_${part}`,
        heading: `第 ${part} 部分（${pos + 1}–${Math.min(text.length, pos + chunkLen)} 字）`,
        text: slice,
        charCount: slice.length,
        isAppendix: false,
      });
    }
    return chunks;
  }

  return buckets
    .map((b, i) => {
      const joined = b.lines.join("\n").trim();
      return {
        id: `sec_${i + 1}`,
        heading: b.heading,
        text: joined,
        charCount: joined.length,
        isAppendix: APPENDIX_HEADING_RE.test(b.heading),
      };
    })
    .filter((s) => s.charCount > 0);
}

/**
 * Default smart selection for >16k long documents:
 * Drop references/acknowledgements/appendix first; keep core sections (preferring
 * intro/abstract, methods, experiments/results, and conclusion) within maxChars.
 */
export function pickDefaultLongDocSectionIds(
  sections: DocumentSectionSlice[],
  maxChars = 16000
): string[] {
  const core = sections.filter((s) => !s.isAppendix);
  const pool = core.length ? core : sections;
  const totalCore = pool.reduce((sum, s) => sum + s.charCount, 0);
  if (totalCore <= maxChars) return pool.map((s) => s.id);

  // Prioritize first section (abstract/intro) and last section (conclusion/results), then fill middle.
  const selected = new Set<string>();
  let used = 0;
  const tryAdd = (s: DocumentSectionSlice | undefined) => {
    if (!s || selected.has(s.id)) return;
    if (used + s.charCount <= maxChars || selected.size === 0) {
      selected.add(s.id);
      used += s.charCount;
    }
  };
  const priorityRe = /摘要|abstract|实验|result|结论|conclusion|核心|summary|方法|method/i;
  tryAdd(pool[0]);
  tryAdd(pool[pool.length - 1]);
  for (const s of pool) {
    if (priorityRe.test(s.heading)) tryAdd(s);
  }
  for (const s of pool) {
    tryAdd(s);
  }
  return sections.filter((s) => selected.has(s.id)).map((s) => s.id);
}

