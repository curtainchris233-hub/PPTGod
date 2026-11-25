export type SlideType =
  | "cover"
  | "agenda"
  | "process"
  | "image-split"
  | "data"
  | "funnel-donut"
  | "comparison"
  | "swot"
  | "timeline"
  | "team-grid"
  | "quote"
  | "closing";

export type TargetTool =
  | "claude-html"
  | "gamma-kimi"
  | "notebooklm"
  | "ai-image"
  | "slidev-marp"
  | "python-pptx";

export type ColorFamily = "light" | "dark" | "warm" | "vivid" | "earth";

export type LayoutArchetype =
  | "swiss-grid"
  | "consulting-mbb"
  | "keynote-center"
  | "editorial-asymmetric"
  | "neo-chinese"
  | "retro-bauhaus"
  | "academic-paper"
  | "warm-humanist"
  | "tech-blueprint"
  | "brutalist-poster"
  | "luxury-minimal"
  | "executive-emerald"
  | "soft-bento"
  | "financial-terminal"
  | "clinical-clean"
  | "chalkboard-class"
  | "scientific-figure"
  | "civic-redgold"
  | "pmo-rag-grid"
  | "polaroid-zine";

export type TypographyMood =
  | "swiss"
  | "editorial"
  | "consulting"
  | "chinese"
  | "tech"
  | "academic"
  | "brutalist"
  | "humanist";

export type DecorativeMotif =
  | "hairline-rule"
  | "swiss-cross"
  | "spotlight-orb"
  | "editorial-drop"
  | "ink-wash"
  | "bauhaus-geo"
  | "corner-brackets"
  | "hard-offset"
  | "ribbon-accent"
  | "bento-dots"
  | "chalk-frame"
  | "citation-axis"
  | "redgold-ribbon"
  | "status-dots"
  | "film-sprocket"
  | "none";

export type AnatomyDimension =
  | "style"
  | "palette"
  | "typography"
  | "layout"
  | "content";

export interface VisualPalette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  border: string;
  chartColors: [string, string, string, string];
}

export interface VisualTypography {
  mood: TypographyMood;
  headingFontLabel: string;
  bodyFontLabel: string;
  titleWeight: number;
  titleTracking: string;
}

export interface VisualLayout {
  archetype: LayoutArchetype;
  density: "airy" | "balanced" | "dense";
  cornerRadius: number;
  showPageNumber: boolean;
  decorativeMotif: DecorativeMotif;
  /** Optional custom institution/course/company footer text synced across Canvas, PPTX & HTML */
  brandFooter?: string;
}

export interface VisualSpec {
  palette: VisualPalette;
  typography: VisualTypography;
  layout: VisualLayout;
}

export interface PromptAnatomy {
  style: string;
  palette: string;
  typography: string;
  layout: string;
  content: string;
}

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarColor: string;
  createdAt: string;
}

export interface UserStats {
  published: number;
  likes: number;
  favorites: number;
  decks: number;
}

export interface RemixOrigin {
  id: string;
  slug: string;
  title: string;
  authorUsername?: string;
  authorDisplayName?: string;
}

export interface PromptItem {
  id: string;
  slug: string;
  title: string;
  englishTitle: string;
  summary: string;
  scenario: string;
  styleCategory: string;
  colorFamily: ColorFamily;
  recommendedTools: TargetTool[];
  tags: string[];
  visualSpec: VisualSpec;
  promptAnatomy: PromptAnatomy;
  customNotes: string;
  sampleTopic: string;
  sampleSubtitle: string;
  authorId: string;
  author: UserPublic;
  isOfficial: boolean;
  isPublic: boolean;
  remixedFrom?: RemixOrigin | null;
  likesCount: number;
  savesCount: number;
  copiesCount: number;
  commentsCount: number;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptComment {
  id: string;
  promptId: string;
  content: string;
  testedTool: TargetTool;
  rating: number;
  author: UserPublic;
  createdAt: string;
}

export interface SourceDocumentSection {
  heading: string;
  summary: string;
}

export interface SourceDocumentDigest {
  fileName?: string;
  detectedScenario?: string;
  keyMetrics?: string[];
  keySections?: SourceDocumentSection[];
  excerpt?: string;
}

export interface RecommendedStyleMatch {
  id: string;
  slug: string;
  title: string;
  englishTitle: string;
  scenario: string;
  styleCategory: string;
  score: number;
  reasons: string[];
}

export interface DocumentAnalysisResult {
  detectedScenario: string;
  detectedDomainId: DomainTabId;
  detectedDomainLabel: string;
  confidence: number;
  suggestedAudience: string;
  suggestedSlideCount: number;
  suggestedTone: "executive" | "storytelling" | "analytical" | "inspiring";
  keyMetrics: string[];
  keySections: SourceDocumentSection[];
  recommendedStyles: RecommendedStyleMatch[];
}

export interface CustomizerParams {
  topic: string;
  subtitle: string;
  audience: string;
  slideCount: number;
  language: "zh" | "en" | "bilingual";
  tone: "executive" | "storytelling" | "analytical" | "inspiring";
  targetTool: TargetTool;
  aiImageBatchMode?: boolean;
  aiImageBatchCount?: 6 | 12;
  /** Optional parsed document digest injected into compiled prompts across all 6 AI tools */
  sourceDigest?: SourceDocumentDigest;
}

/* ====== Structured Slide Deck Types (v3: 12 Commercial Slide Types + Visual Slots) ====== */

export interface DeckSlideKpi {
  label: string;
  value: string;
  note: string;
}

export interface DeckSlideBar {
  label: string;
  v1: number;
  v2: number;
}

export interface DeckSlideStep {
  code: string;
  title: string;
  desc: string;
}

export interface DeckSlideSwot {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface DeckSlideFunnelStage {
  label: string;
  value: number;
  unit?: string;
  note?: string;
}

export interface DeckSlideTeamMember {
  name: string;
  role: string;
  bio: string;
  badge?: string;
}

export interface DeckSlideImageSlot {
  kind: "svg-preset" | "data-url";
  presetId?: string;
  dataUrl?: string;
  caption?: string;
  layout?: "left" | "right";
  promptHint?: string;
}

export interface DeckSlideItem {
  id: string;
  slideType: SlideType;
  sectionTag: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftTitle?: string;
  leftPoints?: string[];
  rightTitle?: string;
  rightPoints?: string[];
  kpis?: DeckSlideKpi[];
  bars?: DeckSlideBar[];
  steps?: DeckSlideStep[];
  swot?: DeckSlideSwot;
  chartMode?: "funnel" | "donut";
  funnelStages?: DeckSlideFunnelStage[];
  teamMembers?: DeckSlideTeamMember[];
  imageSlot?: DeckSlideImageSlot;
  quoteText?: string;
  quoteAuthor?: string;
  speakerNotes?: string;
}

export interface OutlineDraftItem {
  id: string;
  slideType: SlideType;
  sectionTag: string;
  title: string;
  summary: string;
}

export interface SavedDeck {
  id: string;
  title: string;
  subtitle: string;
  audience: string;
  promptId: string;
  promptSlug: string;
  promptTitle: string;
  visualSpec: VisualSpec;
  slides: DeckSlideItem[];
  isPublic: boolean;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SCENARIO_OPTIONS = [
  "全部场景",
  "产品发布",
  "商业路演",
  "咨询汇报",
  "年度总结",
  "品牌提案",
  "课堂教学",
  "教育培训",
  "学术答辩",
  "科研基金",
  "项目汇报",
  "政务党建",
  "个人述职",
  "技术分享",
  "文化创意",
  "生活纪实",
] as const;

export type DomainTabId =
  | "all"
  | "business-tech"
  | "teaching"
  | "research"
  | "workplace"
  | "lifestyle";

export const DOMAIN_TABS: {
  id: DomainTabId;
  label: string;
  desc: string;
  scenarios: readonly string[];
}[] = [
  {
    id: "all",
    label: "全部领域",
    desc: "工作与生活全场景视觉母版",
    scenarios: [],
  },
  {
    id: "business-tech",
    label: "商业与科技",
    desc: "产品发布、商业路演、品牌提案与技术分享",
    scenarios: ["产品发布", "商业路演", "品牌提案", "技术分享"],
  },
  {
    id: "teaching",
    label: "教师与课堂",
    desc: "黑板板书、公开课说课、K12 班会与 STEAM 培训",
    scenarios: ["课堂教学", "教育培训"],
  },
  {
    id: "research",
    label: "科研与学术",
    desc: "国自然基金答辩、Nature 证据流、组会精读与硕博答辩",
    scenarios: ["科研基金", "学术答辩"],
  },
  {
    id: "workplace",
    label: "项目与职场",
    desc: "PMO 里程碑、咨询汇报、政务党建、年终述职与年度总结",
    scenarios: ["项目汇报", "政务党建", "个人述职", "咨询汇报", "年度总结"],
  },
  {
    id: "lifestyle",
    label: "生活与个人",
    desc: "旅行胶片手账、婚礼纪念、读书会、文创与兴趣社团",
    scenarios: ["生活纪实", "文化创意", "个人述职"],
  },
];

export function getDefaultAudienceForScenario(scenario: string): string {
  switch (scenario) {
    case "课堂教学":
      return "课堂学生与教研评审组";
    case "教育培训":
      return "参训学员与教学督导组";
    case "科研基金":
      return "基金委与同行评审专家委员会";
    case "学术答辩":
      return "答辩委员会专家与实验室同侪";
    case "项目汇报":
      return "项目指导委员会与跨部门干系人";
    case "政务党建":
      return "机关领导与专项工作评审组";
    case "个人述职":
      return "晋升评审委员会与业务负责人";
    case "生活纪实":
      return "亲友、兴趣同好与分享会听众";
    case "文化创意":
      return "策展团队与文化受众";
    case "品牌提案":
      return "品牌主理人与市场营销委员会";
    case "技术分享":
      return "研发架构师与工程技术团队";
    default:
      return "核心管理层与业务伙伴";
  }
}

export const STYLE_CATEGORY_OPTIONS = [
  "全部风格",
  "极简主义",
  "商务咨询",
  "科技未来",
  "现代Bento",
  "编辑部杂志",
  "新中式美学",
  "包豪斯几何",
  "暖调人文",
  "野兽派海报",
  "学术期刊",
  "课堂板书",
  "政务红金",
  "胶片手账",
] as const;

export const COLOR_FAMILY_LABELS: Record<ColorFamily | "all", string> = {
  all: "全部色系",
  light: "明亮纸感",
  dark: "深邃暗调",
  warm: "暖调人文",
  vivid: "高饱和撞色",
  earth: "大地沉稳",
};

export const TOOL_METADATA: Record<
  TargetTool,
  {
    id: TargetTool;
    name: string;
    shortName: string;
    badge: string;
    description: string;
    launchLinks: { label: string; url: string }[];
  }
> = {
  "claude-html": {
    id: "claude-html",
    name: "Claude / ChatGPT HTML 幻灯片",
    shortName: "HTML 交互 PPT",
    badge: "代码直出",
    description:
      "包含完整 CSS 变量、16:9 画布锁定与原生 SVG 图表规范，直接粘贴给 Claude Artifacts、ChatGPT Canvas 或 DeepSeek 输出可交互幻灯片。",
    launchLinks: [
      { label: "打开 Claude", url: "https://claude.ai/new" },
      { label: "打开 ChatGPT", url: "https://chatgpt.com/" },
      { label: "打开 DeepSeek", url: "https://chat.deepseek.com/" },
    ],
  },
  "gamma-kimi": {
    id: "gamma-kimi",
    name: "Gamma / Kimi / 讯飞智文",
    shortName: "Gamma & Kimi",
    badge: "大纲生成",
    description:
      "结构化页面大纲 + 母版视觉基调指令 + 每页配图与图表建议，适配 Kimi PPT 助手、Gamma、WPS AI 等一键成稿工具。",
    launchLinks: [
      { label: "打开 Kimi PPT", url: "https://kimi.moonshot.cn/" },
      { label: "打开 Gamma", url: "https://gamma.app/" },
    ],
  },
  notebooklm: {
    id: "notebooklm",
    name: "NotebookLM 演示文稿流",
    shortName: "NotebookLM",
    badge: "文档提炼",
    description:
      "针对 Google NotebookLM 幻灯片与多源文档摘要优化的视觉风格指令、叙事推进逻辑与事实引用约束。",
    launchLinks: [
      { label: "打开 NotebookLM", url: "https://notebooklm.google.com/" },
    ],
  },
  "ai-image": {
    id: "ai-image",
    name: "即梦 / Midjourney / Nano Banana",
    shortName: "AI 整页生图",
    badge: "视觉直出",
    description:
      "大师级平面美术指导提示词，支持「单页精修」与「全套连贯分页生图词包」，精确控制 16:9 扁平视口、配色与留白排版区。",
    launchLinks: [
      { label: "打开即梦 AI", url: "https://jimeng.jianying.com/" },
      { label: "打开 Midjourney", url: "https://www.midjourney.com/" },
    ],
  },
  "slidev-marp": {
    id: "slidev-marp",
    name: "Slidev / Marp Markdown 幻灯片",
    shortName: "Slidev & Marp",
    badge: "极客文档",
    description:
      "生成带完整 YAML Frontmatter 主题样式、自定义内联 CSS Token 与分页分隔符的 Slidev / Marp 演示文稿源码。",
    launchLinks: [
      { label: "打开 Claude 生成", url: "https://claude.ai/new" },
      { label: "Marp 官方文档", url: "https://marp.app/" },
    ],
  },
  "python-pptx": {
    id: "python-pptx",
    name: "Python-PPTX 脚本直出",
    shortName: "Python 生成 PPTX",
    badge: "原生文件",
    description:
      "指示 ChatGPT 数据分析 / Claude 编写并执行完整 python-pptx 代码，精确复刻 RGB 色值、边距与图表，直接下载 .pptx 原文件。",
    launchLinks: [
      { label: "在 ChatGPT 运行生成", url: "https://chatgpt.com/" },
      { label: "在 Claude 生成脚本", url: "https://claude.ai/new" },
    ],
  },
};

export const ALL_SLIDE_TYPES: SlideType[] = [
  "cover",
  "agenda",
  "process",
  "image-split",
  "data",
  "funnel-donut",
  "comparison",
  "swot",
  "timeline",
  "team-grid",
  "quote",
  "closing",
];

export const CARD_SLIDE_TYPES: SlideType[] = [
  "cover",
  "agenda",
  "process",
  "data",
  "comparison",
];

export const SLIDE_TYPE_LABELS: Record<
  SlideType,
  { id: SlideType; label: string; en: string; desc: string }
> = {
  cover: {
    id: "cover",
    label: "封面页",
    en: "01 Cover",
    desc: "奠定视觉基调、主标题层级与品牌气质",
  },
  agenda: {
    id: "agenda",
    label: "目录页",
    en: "02 Agenda",
    desc: "展示叙事推进节奏与章节编号规范",
  },
  process: {
    id: "process",
    label: "架构页",
    en: "03 Architecture",
    desc: "拆解核心方法论、三步闭环或技术分层架构",
  },
  "image-split": {
    id: "image-split",
    label: "图文页",
    en: "04 Visual Split",
    desc: "沉浸式配图槽位搭配右侧结构化卖点与数据徽章",
  },
  data: {
    id: "data",
    label: "数据页",
    en: "05 Data Insight",
    desc: "检验柱状趋势图配色、KPI 指标卡片与结论标题",
  },
  "funnel-donut": {
    id: "funnel-donut",
    label: "漏斗占比",
    en: "06 Funnel & Donut",
    desc: "支持转化漏斗图与环形占比饼图一键切换的数据洞察页",
  },
  comparison: {
    id: "comparison",
    label: "对比页",
    en: "07 Matrix",
    desc: "呈现双栏逻辑对比、卡片留白与视觉权重",
  },
  swot: {
    id: "swot",
    label: "SWOT 矩阵",
    en: "08 SWOT Matrix",
    desc: "经典 2×2 战略象限，清晰拆解优势、劣势、机会与威胁",
  },
  timeline: {
    id: "timeline",
    label: "路线图",
    en: "09 Roadmap",
    desc: "规划阶段里程碑节点、时间排期与关键交付物",
  },
  "team-grid": {
    id: "team-grid",
    label: "核心团队",
    en: "10 Team Grid",
    desc: "3–4 位核心高管、创始人或科研成员头像与履历展示",
  },
  quote: {
    id: "quote",
    label: "金句页",
    en: "11 Spotlight",
    desc: "以高张力大字号呈现核心洞察、愿景或客户证言",
  },
  closing: {
    id: "closing",
    label: "结尾页",
    en: "12 Closing",
    desc: "收束核心行动号召与首尾呼应的版式收口",
  },
};

export const ANATOMY_META: Record<
  AnatomyDimension,
  {
    id: AnatomyDimension;
    label: string;
    en: string;
    color: string;
    visualHint: string;
  }
> = {
  style: {
    id: "style",
    label: "美学风格与氛围",
    en: "Style & Atmosphere",
    color: "#1D4ED8",
    visualHint: "控制表面材质、装饰元素与整体视觉情绪",
  },
  palette: {
    id: "palette",
    label: "色彩系统规范",
    en: "Color System",
    color: "#0F766E",
    visualHint: "定义画布背景、卡片表面、主文字与强调色比例",
  },
  typography: {
    id: "typography",
    label: "字体与层级尺度",
    en: "Typography Scale",
    color: "#9D174D",
    visualHint: "决定标题字重、字距、衬线/无衬线气质与信息对比",
  },
  layout: {
    id: "layout",
    label: "版式网格与留白",
    en: "Grid & Whitespace",
    color: "#B45309",
    visualHint: "约束 16:9 安全边距、分栏比例、圆角与内容密度",
  },
  content: {
    id: "content",
    label: "叙事与图表约束",
    en: "Narrative & Data",
    color: "#3F6212",
    visualHint: "规范单页信息量、结论先行标题与数据可视化风格",
  },
};
