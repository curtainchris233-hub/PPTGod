/**
 * PPTGod · Prompt Pack (资料 → 提示词包)
 *
 * Client-safe core: types, curated design directions, sanitizer, slide preview
 * adapters and per-tool master-prompt renderers. The server-only rule engine
 * and LLM instructions live in `promptPackEngine.ts`.
 */
import type {
  DecorativeMotif,
  DeckSlideItem,
  LayoutArchetype,
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
  { id: "big-number", label: "大数字", hint: "1–3 个关键数字超大展示，配一句解读" },
  { id: "chart", label: "图表", hint: "原生柱状/折线/环形图，突出结论数据" },
  { id: "comparison", label: "对比", hint: "左右两栏对照，差异用强调色标出" },
  { id: "timeline", label: "时间线", hint: "按时间/阶段横向排布的节点" },
  { id: "process", label: "流程", hint: "3–5 步带编号的箭头流程或循环" },
  { id: "quote", label: "金句", hint: "居中大号引言 + 出处，极简" },
  { id: "image-text", label: "图文", hint: "一侧大图/示意图，一侧 3–4 条要点" },
  { id: "summary", label: "总结", hint: "3–4 条核心结论 + 行动/致谢" },
];

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

/* ==========================================================================
   2. Data model
   ========================================================================== */

export interface PackColor {
  role: string;
  hex: string;
}

export interface PackStyle {
  directionId: string;
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
  { id: "nature-academic", re: /论文|摘要|abstract|实验结果|数据集|基线|baseline|BLEU|arXiv|参考文献|消融|SOTA|模型架构/gi },
  { id: "vc-pitch-dark", re: /融资|路演|投资人|估值|天使轮|A 轮|B 轮|商业模式|市场规模|TAM/g },
];

export function pickDesignDirection(scenario: string, text = ""): DesignDirection {
  const t = text.slice(0, 4000);
  if (/故宫|非遗|国风|诗词|书法|传统文化|水墨/.test(t)) return getDesignDirection("neo-chinese");
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
      return {
        id: newPackSlideId(),
        layout,
        title: str(s.title, 60, `第 ${i + 1} 页`),
        points: strList(s.points, 6, 120),
        data,
        visual: str(s.visual, 200),
        note: str(s.note, 400),
        source: str(s.source, 80),
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
  return {
    directionId: base.id,
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
    bullets: pts.slice(0, 4),
    speakerNotes: slide.note,
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
              title: (rest.length ? head : p).slice(0, 16),
              desc: (rest.length ? rest.join("：") : "").slice(0, 60),
            };
          }),
        },
      };
    case "big-number":
    case "chart": {
      const data = slide.data.length
        ? slide.data
        : pts.slice(0, 3).map((p, i) => ({ label: p.slice(0, 10), value: String(i + 1) }));
      const max = Math.max(1, ...data.map((d) => Math.abs(parseNumeric(d.value))));
      return {
        slideType,
        slideData: {
          ...base,
          kpis: data.slice(0, 3).map((d) => ({ label: d.label, value: d.value, note: "" })),
          bars: data.slice(0, 4).map((d) => {
            const v = Math.round((Math.abs(parseNumeric(d.value)) / max) * 100);
            return { label: d.label.slice(0, 8), v1: v, v2: v };
          }),
        },
      };
    }
    case "comparison": {
      const half = Math.ceil(pts.length / 2);
      return {
        slideType,
        slideData: {
          ...base,
          leftTitle: "A",
          rightTitle: "B",
          leftPoints: pts.slice(0, half),
          rightPoints: pts.slice(half),
        },
      };
    }
    case "section":
    case "quote":
      return {
        slideType,
        slideData: { ...base, quoteText: pts[0] || slide.title, quoteAuthor: slide.source || insight.topic },
      };
    case "summary":
      return {
        slideType,
        slideData: {
          ...base,
          steps: pts.slice(0, 3).map((p, i) => ({ code: String(i + 1).padStart(2, "0"), title: p.slice(0, 16), desc: p.slice(16, 70) })),
        },
      };
    default:
      return { slideType, slideData: base };
  }
}

/** Choose up to 3 visually distinct slides for the live style proof. */
export function pickPreviewSlides(slides: PackSlide[]): PackSlide[] {
  const picked: PackSlide[] = [];
  const want: PackLayout[][] = [
    ["cover"],
    ["big-number", "chart"],
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
  return picked.slice(0, 3);
}

/* ==========================================================================
   6. Master prompt renderers
   ========================================================================== */

const LANG_LINE: Record<PackLanguage, string> = {
  zh: "全部使用简体中文。",
  en: "Write all slide text in English (translate the source faithfully).",
  bilingual: "标题使用中文 + 小号英文副标题，正文使用中文。",
};

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
  const lines = [`### 第 ${index + 1}/${total} 页 · 【${packLayoutLabel(slide.layout)}】${slide.title}`];
  if (slide.points.length) lines.push(slide.points.map((p) => `- ${p}`).join("\n"));
  if (slide.data.length) lines.push(`数据：${slide.data.map((d) => `${d.label} = ${d.value}`).join("；")}`);
  if (slide.visual) lines.push(`视觉：${slide.visual}`);
  if (withNotes && slide.note) lines.push(`演讲备注：${slide.note}`);
  if (slide.source) lines.push(`资料出处：${slide.source}`);
  return lines.join("\n");
}

function slidesBlock(pack: PromptPack, withNotes = true): string {
  return pack.slides.map((s, i) => slideBlock(s, i, pack.slides.length, withNotes)).join("\n\n");
}

function contextBlock(pack: PromptPack): string {
  const i = pack.insight;
  return [
    `- 主题：${i.topic}${i.subtitle ? `（${i.subtitle}）` : ""}`,
    `- 受众：${i.audience}；场景：${i.scenario}；时长约 ${i.talkMinutes} 分钟；共 ${pack.slides.length} 页`,
    i.keyFacts.length ? `- 资料中的关键事实：${i.keyFacts.join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const LAYOUT_RULE =
  "每页严格按【版式】实现，不要把所有页面都做成“标题 + 项目符号”；大数字页数字字号 ≥ 96pt，图表页使用真正的图表，对比页左右分栏。";
const HONESTY_RULE =
  "只使用上面给出的事实与数据；资料中没有的数据写成「[待补充]」，不要编造数字、引用或人名。";

export function renderMasterPrompt(
  pack: PromptPack,
  tool: PackTool,
  language: PackLanguage = "zh"
): string {
  const n = pack.slides.length;
  switch (tool) {
    case "chatgpt":
      return [
        `你是一位顶级演示文稿设计师兼 python-pptx 工程师。请根据下面的「设计规范」与「逐页内容」，用代码解释器生成一份 16:9（13.333in × 7.5in）的 .pptx 文件并提供下载链接。`,
        `## 背景\n${contextBlock(pack)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 逐页内容（共 ${n} 页）\n${slidesBlock(pack)}`,
        `## 实现要求\n1. ${LAYOUT_RULE}\n2. 图表页用 python-pptx 原生图表（可在 PowerPoint 中编辑），按图表色序列着色，直接标注数据标签。\n3. 字号：标题 32–40pt，正文 16–20pt；单页 ≤ 5 条要点，每条 ≤ 30 字；四周留 ≥ 0.6in 边距。\n4. 把「演讲备注」写入每页 notes；页脚放页码。\n5. 需要配图的位置放置与色板协调的占位色块，并在占位框内写明图片内容建议。\n6. ${HONESTY_RULE}\n7. ${LANG_LINE[language]}\n8. 生成后先列出每页的版式与标题供我核对，再给出下载链接。`,
      ].join("\n\n");
    case "gamma": {
      const instructions = [
        `【① 粘贴到 Gamma「额外指令 / Additional instructions」】`,
        `设计方向：${pack.style.name}（参考 ${pack.style.reference}）。`,
        `配色：${pack.style.colors.map((c) => `${c.role} ${c.hex}`).join("，")}；图表色 ${pack.style.chartColors.join("、")}。`,
        `字体：标题 ${pack.style.headingFont}，正文 ${pack.style.bodyFont}。`,
        `版式：${pack.style.layoutGrammar}。图片：${pack.style.imagery}。`,
        `每张卡片按标注的【版式】排版，避免全部是要点列表。${HONESTY_RULE}${LANG_LINE[language]}`,
      ].join("\n");
      const cards = pack.slides
        .map((s) => {
          const body = [
            `# ${s.title}`,
            ...s.points.map((p) => `- ${p}`),
            s.data.length ? s.data.map((d) => `**${d.value}** ${d.label}`).join(" ｜ ") : "",
            s.visual ? `> 视觉：${s.visual}` : "",
          ]
            .filter(Boolean)
            .join("\n");
          return `<!-- 版式：${packLayoutLabel(s.layout)} -->\n${body}`;
        })
        .join("\n\n---\n\n");
      return `${instructions}\n\n【② 粘贴到 Gamma「粘贴文本 / Paste in text」，选择“按 --- 分卡”】\n\n${cards}`;
    }
    case "kimi":
      return [
        `请帮我制作一份 ${n} 页的 PPT。先严格按下面的大纲生成，再在模板中选择最接近「${pack.style.name}」的风格，并按设计规范调整配色与字体。`,
        `## 背景\n${contextBlock(pack)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 大纲\n${pack.slides
          .map((s, i) => {
            const pts = s.points.map((p) => `  - ${p}`).join("\n");
            const data = s.data.length ? `\n  - 数据：${s.data.map((d) => `${d.label} ${d.value}`).join("；")}` : "";
            return `${i + 1}. 【${packLayoutLabel(s.layout)}】${s.title}\n${pts}${data}`;
          })
          .join("\n")}`,
        `## 要求\n- ${LAYOUT_RULE}\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}`,
      ].join("\n\n");
    case "claude":
      return [
        `请生成一个单文件 HTML 幻灯片（index.html，无外部依赖，可离线打开）。`,
        `## 技术要求\n- 每页 1920×1080 的 <section>，按窗口等比缩放居中；← → / 空格翻页，右下角显示页码；支持浏览器打印为 PDF（每页一张）。\n- 在 :root 中用 CSS 变量定义色板与字体，所有颜色只能引用这些变量。\n- 图表用内联 SVG 绘制（不要用图片），数据标签直接写在图形上。`,
        `## 背景\n${contextBlock(pack)}`,
        `## 设计规范\n${styleBlock(pack.style)}`,
        `## 逐页内容（共 ${n} 页）\n${slidesBlock(pack, false)}`,
        `## 质量要求\n- ${LAYOUT_RULE}\n- 排版精致：清晰的层级、统一的间距体系（8px 基准）、标题与正文字重对比明显。\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}\n- 只输出完整 HTML 代码。`,
      ].join("\n\n");
    default:
      return renderPackMarkdown(pack, language);
  }
}

export function renderPackMarkdown(pack: PromptPack, language: PackLanguage = "zh"): string {
  return [
    `# ${pack.insight.topic} · PPT 提示词包`,
    `> 由 PPTGod 生成（${pack.engine === "llm" ? `大模型 ${pack.model ?? ""}`.trim() : "内置规则引擎"}）。可直接粘贴到任意 AI 演示工具。`,
    `## 背景\n${contextBlock(pack)}`,
    `## 设计规范\n${styleBlock(pack.style)}\n\n**为什么适合这份资料：**${pack.style.rationale}`,
    `## 逐页内容（共 ${pack.slides.length} 页）\n${slidesBlock(pack)}`,
    `## 生成要求\n- ${LAYOUT_RULE}\n- ${HONESTY_RULE}\n- ${LANG_LINE[language]}`,
  ].join("\n\n");
}

/* ==========================================================================
   7. Client handoff (homepage → /pack)
   ========================================================================== */

export const PACK_HANDOFF_KEY = "pptgod_pack_handoff_v1";
export const PACK_DRAFT_KEY = "pptgod_prompt_pack_v1";

export interface PackHandoff {
  text: string;
  fileName: string;
  topic?: string;
  audience?: string;
  slideCount?: number;
  savedAt: number;
}

export function savePackHandoff(payload: Omit<PackHandoff, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      PACK_HANDOFF_KEY,
      JSON.stringify({ ...payload, text: payload.text.slice(0, 16000), savedAt: Date.now() })
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
