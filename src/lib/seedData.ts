import type { ColorFamily, PromptAnatomy, TargetTool, VisualSpec } from "@/types/prompt";

export interface SeedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordPlain: string;
  bio: string;
  avatarColor: string;
}

export interface SeedPrompt {
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
  isOfficial: boolean;
  likesCount: number;
  savesCount: number;
  copiesCount: number;
}

export const SEED_USERS: SeedUser[] = [
  {
    id: "user_studio_official",
    username: "pptgod_lab",
    displayName: "PPTGod 视觉实验室",
    email: "studio@pptgod.studio",
    passwordPlain: "PPTGodOfficial#2026",
    bio: "专注演示文稿设计系统与跨工具提示词工程研究",
    avatarColor: "#C84B31",
  },
  {
    id: "user_demo",
    username: "demo_designer",
    displayName: "林屿 · 演示设计师",
    email: "demo@pptgod.studio",
    passwordPlain: "demo1234",
    bio: "探索结构化叙事与高信息密度幻灯片美学（体验演示账号）",
    avatarColor: "#0F766E",
  },
  {
    id: "user_curator_chen",
    username: "chen_strategy",
    displayName: "陈默 · 战略咨询",
    email: "chen@pptgod.studio",
    passwordPlain: "ChenStrategy#2026",
    bio: "10 年管理咨询与商业计划书视觉架构师",
    avatarColor: "#1D4ED8",
  },
];

export const SEED_PROMPTS: SeedPrompt[] = [
  {
    id: "prompt_swiss_grid",
    slug: "swiss-international-grid",
    title: "瑞士国际主义网格 · 理性秩序",
    englishTitle: "Swiss International Grid",
    summary:
      "源自苏黎世平面设计学派的绝对秩序美学：暖白画布、1px 精确分割线、非对称大字号数字标号与朱红强调色，让产品逻辑一目了然。",
    scenario: "产品发布",
    styleCategory: "极简主义",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image", "notebooklm"],
    tags: ["瑞士风格", "网格系统", "高对比", "理性克制", "无衬线"],
    visualSpec: {
      palette: {
        bg: "#F6F5F0",
        surface: "#FFFFFF",
        text: "#121212",
        muted: "#5C5B57",
        accent: "#D9381E",
        accentSoft: "#FBE9E5",
        border: "#D9D6CE",
        chartColors: ["#D9381E", "#121212", "#6E6D68", "#B5B1A6"],
      },
      typography: {
        mood: "swiss",
        headingFontLabel: "Helvetica Neue / 思源黑体 Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.035em",
      },
      layout: {
        archetype: "swiss-grid",
        density: "balanced",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "swiss-cross",
      },
    },
    promptAnatomy: {
      style:
        "瑞士国际主义平面设计风格（International Typographic Style），极致克制的理性秩序、客观中立、零渐变零阴影、依靠精确比例与 1px 细分割线建立高级感。",
      palette:
        "主底色采用温润浅灰白（#F6F5F0），文字用纯深炭黑（#121212），唯一强调色为瑞士朱红（#D9381E），严格遵循 80% 底色 / 15% 墨黑 / 5% 朱红的配色纪律。",
      typography:
        "标题使用厚重几何无衬线字体（字重 700，紧凑字距 -0.035em），正文与数据注释形成至少 3:1 的字号级差，章节编号使用等宽数字强化工业精确感。",
      layout:
        "严格遵循 12 栏非对称网格（左侧 4 栏置放章节标识与核心论点，右侧 8 栏展开图表或论据），四角保留至少 7% 安全留白，卡片圆角控制在 0-2px 的锐利直角。",
      content:
        "每页只传达一个核心观点，采用「结论标题 + 3 组精炼论据或 1 组高信噪比矢量图表」的黄金结构，杜绝装饰性废话与多余图标堆砌。",
    },
    customNotes:
      "极其适合 AI 产品发布、设计系统复盘与硬核方法论分享；在 Claude HTML 模式下还原度接近 100%。",
    sampleTopic: "下一代多模态工作流引擎架构",
    sampleSubtitle: "以确定性设计系统重构团队协作效率 · 2026 产品战略发布",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 428,
    savesCount: 312,
    copiesCount: 1290,
  },
  {
    id: "prompt_mckinsey_exec",
    slug: "mckinsey-executive-insight",
    title: "麦肯锡高管洞察 · 结论先行",
    englishTitle: "Executive Consulting Deck",
    summary:
      "顶级战略咨询标准演示体系：顶部 Action Title 一句话直给结论，纯白画布搭配深海藏青与理性钴蓝，图表与数据来源脚注一丝不苟。",
    scenario: "咨询汇报",
    styleCategory: "商务咨询",
    colorFamily: "light",
    recommendedTools: ["gamma-kimi", "claude-html", "notebooklm"],
    tags: ["麦肯锡风", "MECE原则", "商业汇报", "数据图表", "高管决策"],
    visualSpec: {
      palette: {
        bg: "#FFFFFF",
        surface: "#F4F7FB",
        text: "#0B1F3A",
        muted: "#4A607A",
        accent: "#1652B8",
        accentSoft: "#E6F0FF",
        border: "#D6E0EE",
        chartColors: ["#0B1F3A", "#1652B8", "#5B92E5", "#A9C4EB"],
      },
      typography: {
        mood: "consulting",
        headingFontLabel: "Georgia / 思源黑体 SemiBold",
        bodyFontLabel: "Arial / 微软雅黑 Regular",
        titleWeight: 600,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "consulting-mbb",
        density: "dense",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "顶级管理咨询公司（MBB）高管汇报美学：客观、严谨、高度结构化，彻底去除娱乐化装饰，所有视觉元素均为辅助管理层在 15 秒内做出商业决策。",
      palette:
        "纯净商业白底（#FFFFFF）搭配深海藏青主墨（#0B1F3A），关键增长指标与重点结论使用理性钴蓝（#1652B8），次级卡片底色为淡雾蓝（#F4F7FB）。",
      typography:
        "每页顶部放置 18-22pt 结论性 Action Title（完整陈述句而非名词短语），正文字号 12-14pt 保持高可读性，页脚固定 9pt 灰色数据来源与保密声明。",
      layout:
        "顶部通栏标题区 + 细蓝分隔线 + 主体双栏或三栏金字塔模块，支持「左图表 + 右核心洞察（Key Takeaways）」经典咨询布局，信息饱满但边界清晰。",
      content:
        "严格遵循金字塔原理与 MECE 分类原则；所有数据图表必须标注具体数值与同比增幅（如 +34.2% YoY），并在底部列出明确下一步行动建议。",
    },
    customNotes:
      "向董事会、客户高层或投资人汇报时的零失误选择，强烈推荐搭配 Gamma / Kimi 或 Claude HTML 使用。",
    sampleTopic: "亚太区 SaaS 商业化增长与毛利重构路径",
    sampleSubtitle: "Q4 经营复盘与 FY27 区域扩张战略建议 · 董事会审议稿",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 512,
    savesCount: 446,
    copiesCount: 1840,
  },
  {
    id: "prompt_keynote_obsidian",
    slug: "keynote-obsidian-stage",
    title: "暗夜星环 · 旗舰发布会舞台",
    englishTitle: "Keynote Obsidian Stage",
    summary:
      "为大屏演讲厅而生的深邃黑曜石美学：钛灰磨砂质感卡片、克制的冰川青光束与超大数字焦点，在大屏幕上展现压倒性的产品掌控力。",
    scenario: "产品发布",
    styleCategory: "科技未来",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi"],
    tags: ["发布会", "暗色高级感", "大屏演讲", "超大数字", "硬件科技"],
    visualSpec: {
      palette: {
        bg: "#090C11",
        surface: "#121822",
        text: "#F5F7FA",
        muted: "#94A3B8",
        accent: "#38BDF8",
        accentSoft: "rgba(56, 189, 248, 0.14)",
        border: "rgba(255, 255, 255, 0.12)",
        chartColors: ["#38BDF8", "#F59E0B", "#94A3B8", "#334155"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "SF Pro Display / 苹方 Semibold",
        bodyFontLabel: "Inter / 思源黑体 Regular",
        titleWeight: 600,
        titleTracking: "-0.03em",
      },
      layout: {
        archetype: "keynote-center",
        density: "airy",
        cornerRadius: 16,
        showPageNumber: true,
        decorativeMotif: "spotlight-orb",
      },
    },
    promptAnatomy: {
      style:
        "旗舰级科技硬件发布会舞台风格（Keynote Stage Aesthetic）：深邃黑曜石空间感，克制的冷白与冰川青顶光晕染，质感细腻如精密阳极氧化铝，杜绝廉价霓虹紫与炫彩噪点。",
      palette:
        "深邃炭黑画布（#090C11）搭配钛金属深灰面板（#121822），纯白高对比主文字（#F5F7FA），核心性能突破指标点缀冰川青（#38BDF8）与琥珀金（#F59E0B）。",
      typography:
        "超大号居中或左对齐展示标题（紧字距 -0.03em），搭配极具呼吸感的细体副标题；关键性能倍率（如 3.8x / 99.98%）使用巨型数字占据视觉中心。",
      layout:
        "高留白剧场式构图（留白占比 >= 45%），以 16px 大圆角精细微边框卡片承载模块化特性，单页不超过 3 个焦点区块，确保后排观众一眼看清。",
      content:
        "强情绪张力与节奏感：以「痛点破题 -> 颠覆性数字 -> 架构拆解 -> 场景落地」推进，文字极度精炼（单条要点不超过 14 字），把表达空间留给演讲者。",
    },
    customNotes:
      "特别适合线下发布会、融资路演大屏投屏及 AI 硬件/开发工具发布。",
    sampleTopic: "AURA Pro · 重新定义端侧推理算力边界",
    sampleSubtitle: "3.8 倍能效跃升 · 全链路零延迟多模态芯片架构发布",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 615,
    savesCount: 520,
    copiesCount: 2150,
  },
  {
    id: "prompt_editorial_magazine",
    slug: "editorial-magazine-print",
    title: "编辑部文艺画报 · 纸本叙事",
    englishTitle: "Editorial Magazine Print",
    summary:
      "汲取 Kinfolk 与 Monocle 纸质杂志的排版灵魂：奶油棉纸底色、优雅衬线大标题、森林墨绿强调与纤细栏线，赋予品牌提案书刊般的收藏质感。",
    scenario: "品牌提案",
    styleCategory: "编辑部杂志",
    colorFamily: "warm",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi", "notebooklm"],
    tags: ["杂志排版", "衬线体", "品牌美学", "高雅留白", "纸本感"],
    visualSpec: {
      palette: {
        bg: "#FAF6EE",
        surface: "#FFFFFF",
        text: "#1F1A17",
        muted: "#6E655D",
        accent: "#1B4D3E",
        accentSoft: "#E7F0EC",
        border: "#DFD7C8",
        chartColors: ["#1B4D3E", "#A65A38", "#6E655D", "#C8BFA8"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Medium",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Light",
        titleWeight: 500,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "editorial-asymmetric",
        density: "airy",
        cornerRadius: 0,
        showPageNumber: true,
        decorativeMotif: "editorial-drop",
      },
    },
    promptAnatomy: {
      style:
        "国际独立杂志编辑部风格（Editorial Print）：柔和纸本质感、考究的画册式呼吸感、纤细分割线与优雅的章节引语，传达深厚品牌品位与文化自信。",
      palette:
        "暖奶油宣纸底色（#FAF6EE），深浓缩咖啡墨色文字（#1F1A17），森林墨绿主点缀（#1B4D3E）与陶土暖棕辅助图表色，呈现沉静耐看的高级印刷调性。",
      typography:
        "标题选用富有人文气息的经典高对比衬线体（宋体/Serif），正文则配搭干净利落的细黑体（Sans-serif），形成古典与现代交织的杂志级字体对话。",
      layout:
        "经典画册非对称跨页版式：上方纤细页眉标注期号与章节名，主体以 5:7 黄金比例分隔叙事引言与视觉图表区，零圆角直边凸显印刷品利落裁切感。",
      content:
        "强调故事性与品牌洞察，以凝练的编辑式金句开篇，数据图表轻盈克制，避免厚重表格压迫画面，适合生活方式、消费品牌与年度文化报告。",
    },
    customNotes:
      "在品牌升级提案、消费品营销复盘与创意总监述职中极易脱颖而出。",
    sampleTopic: "慢生活与在地工艺 · 2026 品牌视觉复兴计划",
    sampleSubtitle: "从零售空间到数字触点的全域美学叙事 · 品牌战略提案",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 389,
    savesCount: 298,
    copiesCount: 970,
  },
  {
    id: "prompt_neo_chinese",
    slug: "neo-chinese-song-aesthetics",
    title: "宋韵雅集 · 新中式东方留白",
    englishTitle: "Song Dynasty Minimalism",
    summary:
      "取法宋代美学「平淡天真」的当代转译：宣纸素底、松烟墨韵、朱砂印章点睛与青瓷远山层次，拒绝俗套大红大金，呈现雅致东方气韵。",
    scenario: "文化创意",
    styleCategory: "新中式美学",
    colorFamily: "earth",
    recommendedTools: ["ai-image", "claude-html", "gamma-kimi"],
    tags: ["宋代美学", "新中式", "宣纸留白", "朱砂印章", "东方意境"],
    visualSpec: {
      palette: {
        bg: "#F4F0E6",
        surface: "#FBF9F3",
        text: "#22201E",
        muted: "#6A655C",
        accent: "#A63429",
        accentSoft: "#F3E4E1",
        border: "#DDD4C3",
        chartColors: ["#A63429", "#526D62", "#8C7A5B", "#C5B9A5"],
      },
      typography: {
        mood: "chinese",
        headingFontLabel: "思源宋体 / 方正清刻本悦宋",
        bodyFontLabel: "思源黑体 / 苹方 Light",
        titleWeight: 600,
        titleTracking: "0.04em",
      },
      layout: {
        archetype: "neo-chinese",
        density: "airy",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "ink-wash",
      },
    },
    promptAnatomy: {
      style:
        "当代新中式宋韵美学（Neo-Chinese Minimalism）：计白当黑的东方构图哲学，以极淡远山墨晕与朱砂印章作为点睛符号，克制、风雅、绝不使用俗气祥云或烫金特效。",
      palette:
        "陈年熟宣米色（#F4F0E6）为纸基，松烟浓墨（#22201E）书写正文，朱砂印泥红（#A63429）仅用于印章与关键数值，辅以天青瓷绿（#526D62）勾勒图表层次。",
      typography:
        "大标题采用典雅宋体并适度拉开字距（+0.04em）营造书卷呼吸感，支持局部竖排小标或朱砂方印点缀，数据与正文保持现代无衬线清晰度。",
      layout:
        "大面积意境留白搭配纤细书框分割，章节编号使用汉字序数（壹、贰、叁、肆）或现代编号呼应，信息卡片轻若蝉翼，画面平衡端庄。",
      content:
        "叙事温润而有筋骨，适合文旅规划、非遗品牌、茶饮国潮、高校人文答辩及高端东方生活方式发布会。",
    },
    customNotes:
      "生成 AI 整页配图（即梦 / Nano Banana）或 Claude HTML 均极为惊艳，记得保持文字精简以保留留白意境。",
    sampleTopic: "江南茶器与当代生活空间策展方案",
    sampleSubtitle: "器以载道 · 东方美学与现代商业体验融合白皮书",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 474,
    savesCount: 392,
    copiesCount: 1410,
  },
  {
    id: "prompt_bauhaus_construct",
    slug: "bauhaus-primary-construct",
    title: "包豪斯几何建构 · 先锋构成",
    englishTitle: "Bauhaus Geometric Construct",
    summary:
      "致敬魏玛包豪斯百年构成主义：红黄蓝三原色在暖灰底板上碰撞出强劲几何张力，圆形与直角线条精准分割信息，让创意提案自带艺术展质感。",
    scenario: "品牌提案",
    styleCategory: "包豪斯几何",
    colorFamily: "vivid",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi"],
    tags: ["包豪斯", "三原色", "几何构成", "创意提案", "视觉张力"],
    visualSpec: {
      palette: {
        bg: "#F4F0E8",
        surface: "#FFFFFF",
        text: "#141414",
        muted: "#4F4D49",
        accent: "#D62828",
        accentSoft: "#FDE8E8",
        border: "#141414",
        chartColors: ["#D62828", "#1D4E89", "#E9B44C", "#141414"],
      },
      typography: {
        mood: "swiss",
        headingFontLabel: "Futura / 思源黑体 Heavy",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 800,
        titleTracking: "-0.03em",
      },
      layout: {
        archetype: "retro-bauhaus",
        density: "balanced",
        cornerRadius: 0,
        showPageNumber: true,
        decorativeMotif: "bauhaus-geo",
      },
    },
    promptAnatomy: {
      style:
        "包豪斯构成主义设计风格（Bauhaus Constructivism）：形式追随功能，运用纯几何基础图形（圆、方、三角与粗分割线）构建视觉锚点与模块化节奏。",
      palette:
        "复古美术纸米白（#F4F0E8）配深黑线条（#141414），精准分配包豪斯三原色——朱红（#D62828）、钴蓝（#1D4E89）与赭黄（#E9B44C）区分不同信息维度。",
      typography:
        "几何感强烈的厚重无衬线主标题（字重 800），配以高可读性标准正文与全大写英文小标，字块像积木一样紧密咬合网格。",
      layout:
        "刚性模块拼贴网格：每个功能区以清晰的 1.5px 墨黑框线界定，善用几何色块承载关键指标，直角 0px 轮廓与正圆图形形成强烈对比。",
      content:
        "观点鲜明直接，非常适合设计工作室作品集、创新产品概念验证、艺术策展与年轻化品牌营销提案。",
    },
    customNotes:
      "视觉辨识度拉满！在多人连续宣讲的比稿现场能瞬间抓住评审注意力。",
    sampleTopic: "模块化设计语言 4.0 · 跨终端体验革新",
    sampleSubtitle: "形式追随智能 · 打造高度一致的品牌互动矩阵",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 342,
    savesCount: 251,
    copiesCount: 845,
  },
  {
    id: "prompt_academic_latex",
    slug: "academic-symposium-latex",
    title: "顶刊学术答辩 · 严谨论文风",
    englishTitle: "Academic Symposium Paper",
    summary:
      "为 NeurIPS / Nature 学术报告与硕博论文答辩量身定制：牛津酒红强调色、定理级结构框、规范图表编号与清晰引用脚注，尽显学术公信力。",
    scenario: "学术答辩",
    styleCategory: "学术期刊",
    colorFamily: "light",
    recommendedTools: ["claude-html", "notebooklm", "gamma-kimi"],
    tags: ["硕博答辩", "顶会演讲", "LaTeX质感", "结构清晰", "文献规范"],
    visualSpec: {
      palette: {
        bg: "#FCFCFA",
        surface: "#F5F4F0",
        text: "#1B2430",
        muted: "#556070",
        accent: "#881337",
        accentSoft: "#FBEBF0",
        border: "#D8D6CF",
        chartColors: ["#881337", "#1E3A5F", "#475569", "#94A3B8"],
      },
      typography: {
        mood: "academic",
        headingFontLabel: "Computer Modern / 思源宋体 Bold",
        bodyFontLabel: "Source Sans 3 / 思源黑体 Regular",
        titleWeight: 700,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "academic-paper",
        density: "dense",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "国际顶刊与 Beamer 学术演示美学：极度克制、逻辑严密、无任何花哨动画或无关插画，用清晰的章节导航条与定理/假设标注箱建立学术可信度。",
      palette:
        "护眼微暖学术白（#FCFCFA），深石板墨色（#1B2430）保证高投影对比度，采用牛津酒红（#881337）高亮核心贡献、关键公式与 SOTA 提升数据。",
      typography:
        "标题采用庄重学术衬线体，正文与图表标签使用清晰无衬线字体，代码、参数与指标采用等宽字体（Monospace），严格区分正文与参考文献字号。",
      layout:
        "顶部极简进度导航（Introduction · Method · Experiments · Conclusion），主体采用论文双栏或左图右论结构，底部固定作者、机构与页码（e.g. 03 / 16）。",
      content:
        "围绕「研究动机 -> 核心方法 -> 消融实验 -> 误差分析与局限」展开，每张实验图表必须附带明确指标单位、基线对比与核心发现结论。",
    },
    customNotes:
      "支持搭配 NotebookLM 直接从 PDF 论文提炼结构化答辩内容，省去大量排版折腾时间。",
    sampleTopic: "基于稀疏注意力机制的长上下文推理加速框架",
    sampleSubtitle: "博士学位论文答辩报告 · 计算机科学与人工智能实验室",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 498,
    savesCount: 465,
    copiesCount: 1620,
  },
  {
    id: "prompt_warm_humanist",
    slug: "warm-earth-humanist",
    title: "暖沙大地 · 温润人文叙事",
    englishTitle: "Warm Earth Humanist",
    summary:
      "柔和暖沙底色搭配陶土橙与鼠尾草绿，大圆角温润卡片与充沛呼吸感，让年度总结、团队复盘与用户研究报告充满温度与亲和力。",
    scenario: "年度总结",
    styleCategory: "暖调人文",
    colorFamily: "warm",
    recommendedTools: ["gamma-kimi", "claude-html", "notebooklm", "ai-image"],
    tags: ["温暖亲和", "年终总结", "团队复盘", "圆角卡片", "自然配色"],
    visualSpec: {
      palette: {
        bg: "#F4EDE3",
        surface: "#FFFDF9",
        text: "#2B221D",
        muted: "#73655B",
        accent: "#B85D3B",
        accentSoft: "#F5E3DA",
        border: "#E4D8C8",
        chartColors: ["#B85D3B", "#5E7B6A", "#C99652", "#8E7B6C"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Medium",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 600,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "warm-humanist",
        density: "airy",
        cornerRadius: 16,
        showPageNumber: true,
        decorativeMotif: "ribbon-accent",
      },
    },
    promptAnatomy: {
      style:
        "当代人文温暖叙事风格（Warm Humanist）：灵感来自有机自然材质与现代北欧家居，温和亲切却不失专业结构，拉近演讲者与听众的心理距离。",
      palette:
        "暖沙亚麻底色（#F4EDE3），奶白卡片表面（#FFFDF9），深棕褐主文字（#2B221D），陶土砖红（#B85D3B）与鼠尾草绿（#5E7B6A）构成和谐大地图表色系。",
      typography:
        "亲和力强的人文无衬线字体，标题温厚圆润（字重 600），宽松舒适的行高（1.65）让长段复盘故事与用户访谈摘录也能轻松阅读。",
      layout:
        "16px 柔和圆角模块化卡片，配合细腻暖灰边界与宽松内边距；重要里程碑与用户原声引用以柔和浅底框突出，整体视觉节奏松弛有度。",
      content:
        "兼顾「理性数据成果」与「感性成长故事」，适合年度述职、组织文化宣讲、教育培训、医疗健康与公益项目汇报。",
    },
    customNotes:
      "特别适合年底全员大会、个人年终述职与设计团队复盘，观感舒适不刺眼。",
    sampleTopic: "2026 年度用户增长与社区共生报告",
    sampleSubtitle: "与 120 万创作者同行的一年 · 团队年度复盘与来年展望",
    authorId: "user_demo",
    isOfficial: false,
    likesCount: 287,
    savesCount: 234,
    copiesCount: 790,
  },
  {
    id: "prompt_tech_blueprint",
    slug: "engineering-blueprint-mono",
    title: "极客终端蓝图 · 架构师手稿",
    englishTitle: "Engineering Blueprint Mono",
    summary:
      "面向研发架构师与技术布道师的深色工程蓝图：精密四角取景框、等宽指标读数与信号翡翠绿状态标识，让系统架构与性能基准极具极客魅力。",
    scenario: "技术分享",
    styleCategory: "科技未来",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image"],
    tags: ["技术架构", "极客风", "等宽字体", "性能基准", "暗色调"],
    visualSpec: {
      palette: {
        bg: "#0F141A",
        surface: "#161E27",
        text: "#E6EDF3",
        muted: "#8B98A8",
        accent: "#10B981",
        accentSoft: "rgba(16, 185, 129, 0.14)",
        border: "#263342",
        chartColors: ["#10B981", "#F59E0B", "#38BDF8", "#64748B"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "JetBrains Mono / 思源黑体 Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.025em",
      },
      layout: {
        archetype: "tech-blueprint",
        density: "balanced",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "corner-brackets",
      },
    },
    promptAnatomy: {
      style:
        "精密工程蓝图与现代开发者工具美学（Linear / Vercel 工程质感）：冷静精准、模块边界利落、以四角准星（Corner Brackets）和等宽标签传递硬核工程可靠性。",
      palette:
        "深石墨蓝黑画布（#0F141A）与代码面板灰蓝（#161E27），高可读冷白文字（#E6EDF3），用信号翡翠绿（#10B981）标示 SLA 达标与性能提升，琥珀黄（#F59E0B）标示瓶颈警告。",
      typography:
        "标签、页码、吞吐量与延迟数据（如 P99 14.2ms）全面采用等宽编程字体（JetBrains Mono），中英文主标题干练紧致，极具技术可读性。",
      layout:
        "结构化工程模块网格，支持架构拓扑流、压测柱状图与前后延迟对比双栏，细边框 + 6px 精准小圆角，保持工具软件般的专业克制。",
      content:
        "用真实量化指标说话：明确区分「现状瓶颈 / 架构演进 / 压测收益 / 容灾方案」，代码或配置片段控制在 6 行核心逻辑以内。",
    },
    customNotes:
      "在技术沙龙、QCon 演讲、研发晋升答辩及开发者产品 Demo Day 表现极佳。",
    sampleTopic: "亿级消息队列低延迟内核重构实践",
    sampleSubtitle: "P99 尾延迟降低 74% 的存储引擎演进与多活容灾架构",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 419,
    savesCount: 368,
    copiesCount: 1340,
  },
  {
    id: "prompt_neo_brutalist",
    slug: "neo-brutalist-pitch-poster",
    title: "酸性野兽派 · 高冲击力路演",
    englishTitle: "Neo-Brutalist Pitch Poster",
    summary:
      "打破沉闷商务模板的新锐野兽派：粗黑实线描边、硬朗位移投影与高能量荧光酸绿/活力橘撞色，在创业路演与黑客松舞台上制造过目不忘的视觉炸点。",
    scenario: "商业路演",
    styleCategory: "野兽派海报",
    colorFamily: "vivid",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi"],
    tags: ["新野兽派", "创业路演", "高冲击力", "粗描边", "年轻潮流"],
    visualSpec: {
      palette: {
        bg: "#FFFDF4",
        surface: "#FFFFFF",
        text: "#0D0D0D",
        muted: "#444444",
        accent: "#FF5A1F",
        accentSoft: "#D9F954",
        border: "#0D0D0D",
        chartColors: ["#FF5A1F", "#0D0D0D", "#C8F031", "#2563EB"],
      },
      typography: {
        mood: "brutalist",
        headingFontLabel: "Space Grotesk / 思源黑体 Heavy",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Medium",
        titleWeight: 800,
        titleTracking: "-0.04em",
      },
      layout: {
        archetype: "brutalist-poster",
        density: "balanced",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "hard-offset",
      },
    },
    promptAnatomy: {
      style:
        "当代新野兽派海报美学（Neo-Brutalism）：大胆坦率、反精致平庸，通过 2px 纯黑实线边框与 4px 纯黑硬位移阴影创造强烈的印刷贴纸立体层次。",
      palette:
        "明亮象牙白底（#FFFDF4）配纯黑硬墨（#0D0D0D），以炽烈橘红（#FF5A1F）和酸柠黄绿（#D9F954）作为高频能量撞色，视觉识别度极高。",
      typography:
        "极粗黑体大标题（字重 800，超紧凑字距 -0.04em），搭配醒目实底标签贴纸（Badge）突出核心数据，信息冲击力堪比音乐节主视觉。",
      layout:
        "高辨识度卡片拼贴结构，重点数据模块使用荧光酸绿实底强突出，所有容器具备一致的粗描边与硬投影，确保热闹却绝不杂乱。",
      content:
        "节奏明快、口号铿锵，直击年轻人痛点与爆发式增长曲线，非常适合种子轮路演、AI 消费级产品发布与 Hackathon 展示。",
    },
    customNotes:
      "想在 3 分钟 Demo Day 中让投资人立刻记住你的产品？选这套就对了。",
    sampleTopic: "SPARK · 为 Z 世代打造的即时共创播客引擎",
    sampleSubtitle: "上线 90 天突破 48 万月活 · 天使轮融资商业计划书",
    authorId: "user_demo",
    isOfficial: false,
    likesCount: 365,
    savesCount: 289,
    copiesCount: 1120,
  },
  {
    id: "prompt_nordic_luxury",
    slug: "nordic-quiet-luxury",
    title: "北欧静奢画廊 · 建筑级克制",
    englishTitle: "Nordic Quiet Luxury",
    summary:
      "冷雾石灰与暖陶褐的建筑感对话：极致空气感留白、细腻发丝线与克制的字号节奏，仿佛置身哥本哈根现代美术馆，适合高端品牌与资本叙事。",
    scenario: "品牌提案",
    styleCategory: "极简主义",
    colorFamily: "light",
    recommendedTools: ["claude-html", "ai-image", "notebooklm", "gamma-kimi"],
    tags: ["静奢风", "建筑感", "美术馆", "高级灰", "极致留白"],
    visualSpec: {
      palette: {
        bg: "#F1F2F4",
        surface: "#FAFAFB",
        text: "#18181B",
        muted: "#6B6D75",
        accent: "#7C6A5B",
        accentSoft: "#EAE6E1",
        border: "#DCDDE2",
        chartColors: ["#18181B", "#7C6A5B", "#9498A3", "#C7C9D1"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Light",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Light",
        titleWeight: 400,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "luxury-minimal",
        density: "airy",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "北欧静奢与现代建筑画廊风格（Quiet Luxury / Gallery Minimal）：不靠喧哗色彩取胜，而以微妙冷暖灰阶层次、极大呼吸空间和精准比例展现顶级克制感。",
      palette:
        "北欧冷雾浅灰（#F1F2F4）衬托近白画板（#FAFAFB），柔黑墨色（#18181B）搭配低饱和摩卡石褐（#7C6A5B），整体色相克制如清水混凝土与原木。",
      typography:
        "纤细优雅的展示型衬线大标题（字重 400），搭配极小字号、宽字距的全大写英文类别标头（tracking +0.18em），形成建筑展签般的考究气质。",
      layout:
        "四周留白高达 10%，主体居中或左偏黄金分割排布，用极淡 1px 发丝线替代厚重色块，让每个数字与段落都像展品般被郑重呈现。",
      content:
        "语言冷静凝练、杜绝感叹号与夸大营销词，依靠事实、品质细节与长期主义视角打动高端客户与精品基金。",
    },
    customNotes:
      "高定零售、建筑空间设计、汽车设计中心及精品生活方式品牌的首选画风。",
    sampleTopic: "NORDIC FORM · 极简空间声学系统全球首发",
    sampleSubtitle: "少即是多 · 将哥本哈根建筑美学融入日常听觉体验",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 334,
    savesCount: 301,
    copiesCount: 890,
  },
  {
    id: "prompt_executive_emerald",
    slug: "private-equity-emerald",
    title: "深翠投行年报 · 资本庄重感",
    englishTitle: "Private Equity Emerald",
    summary:
      "灵感来自伦敦百年资管与顶级私募基金年报：英国赛车深绿底色配温润香槟金线条，在深色大屏上呈现无可替代的权威、稳健与长期价值感。",
    scenario: "商业路演",
    styleCategory: "商务咨询",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "gamma-kimi", "notebooklm", "ai-image"],
    tags: ["投行年报", "深绿香槟金", "融资路演", "稳健权威", "ESG报告"],
    visualSpec: {
      palette: {
        bg: "#0D241E",
        surface: "#13322A",
        text: "#F6F3EC",
        muted: "#A7BDB5",
        accent: "#DEC497",
        accentSoft: "rgba(222, 196, 151, 0.14)",
        border: "rgba(222, 196, 151, 0.22)",
        chartColors: ["#DEC497", "#4FB286", "#88A99E", "#2C5E4F"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 SemiBold",
        bodyFontLabel: "Plus Jakarta Sans / 思源黑体 Regular",
        titleWeight: 600,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "executive-emerald",
        density: "balanced",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "顶级私募股权与 ESG 年度报告美学（Heritage Private Equity）：沉稳、典雅、具备跨周期信任感，通过深翠底色与纤细香槟金分割线塑造机构级权威气场。",
      palette:
        "英国赛车深绿底色（#0D241E）与松林深绿卡片（#13322A），柔和象牙白正文（#F6F3EC），以低饱和哑光香槟金（#DEC497）突出关键财务指标与边界线。",
      typography:
        "标题选用典雅权威的衬线字体传达历史厚重感，财务数据与表格使用等宽对齐的无衬线数字，确保亿级金额与百分比整齐划一。",
      layout:
        "稳重对称与双栏并置并重，顶部细金线勾勒章节眉题，KPI 指标卡片清晰展示 CAGR、ARR 与毛利率变化，视觉沉静而极具说服力。",
      content:
        "注重财务纪律、护城河与长期复利叙事，极适合 B/C 轮以上机构融资、基金募资路演（LP Deck）、上市公司 ESG 及年度战略发布。",
    },
    customNotes:
      "相比千篇一律的科技蓝或纯黑 PPT，深翠配哑光香槟金在资本路演与 ESG 报告中质感独树一帜。",
    sampleTopic: "绿色能源基础设施基金 · FY2026 LP 年度汇报",
    sampleSubtitle: "穿越周期的稳健现金流 · 资产组合表现与 ESG 价值创造",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 451,
    savesCount: 387,
    copiesCount: 1470,
  },
  {
    id: "prompt_soft_bento",
    slug: "apple-soft-bento-modular",
    title: "柔光圆角 Bento · 现代产品卡片",
    englishTitle: "Soft Bento Modular Grid",
    summary:
      "源自现代旗舰消费电子总结图的 Bento 模块化美学：云雾浅灰画布、纯白微浮雕大圆角卡片与纯净海湾蓝点睛，一图总览多维产品卖点。",
    scenario: "产品发布",
    styleCategory: "现代Bento",
    colorFamily: "light",
    recommendedTools: [
      "claude-html",
      "ai-image",
      "gamma-kimi",
      "slidev-marp",
    ],
    tags: ["Bento网格", "苹果风", "圆角卡片", "产品卖点", "SaaS路演"],
    visualSpec: {
      palette: {
        bg: "#F3F5F8",
        surface: "#FFFFFF",
        text: "#111418",
        muted: "#636B78",
        accent: "#0066CC",
        accentSoft: "#E6F1FC",
        border: "#E3E7EE",
        chartColors: ["#0066CC", "#14B8A6", "#64748B", "#CBD5E1"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "SF Pro Display / 苹方 Semibold",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.025em",
      },
      layout: {
        archetype: "soft-bento",
        density: "balanced",
        cornerRadius: 18,
        showPageNumber: true,
        decorativeMotif: "bento-dots",
      },
    },
    promptAnatomy: {
      style:
        "现代消费科技 Bento 便当盒模块化网格风格：洁净明亮、圆润亲和、零凌乱线条，通过不同尺寸圆角白卡片的组合在一屏内清晰容纳核心指标与功能亮点。",
      palette:
        "云雾冷灰白背景（#F3F5F8）凸显纯白高对比模块卡片（#FFFFFF），标题采用深曜石黑（#111418），关键升级指标点缀纯净科技海湾蓝（#0066CC）。",
      typography:
        "无衬线现代苹果体系字体（字重 700），卡片内采用「左上微型分类标 + 中部超大指标数字 + 底部一行精炼注释」的黄金三级字号对比。",
      layout:
        "不等宽 Bento 网格系统，卡片统一采用 18px 圆润大圆角与 1px 极淡冷灰边框（#E3E7EE），模块间距固定为 16px，严禁超过两层嵌套。",
      content:
        "极适合产品迭代一图流、AI 应用功能矩阵、季度 OKR 亮晒及互联网产品经理述职。",
    },
    customNotes:
      "在 Claude HTML 和即梦整页生图中都是出片率最高的现代明亮风格之一。",
    sampleTopic: "FlowOS 3.0 · 全场景智能工作台重磅升级",
    sampleSubtitle: "12 项核心体验进化 · 让知识流转效率提升 320%",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 562,
    savesCount: 489,
    copiesCount: 1980,
  },
  {
    id: "prompt_financial_terminal",
    slug: "wallstreet-bloomberg-terminal",
    title: "华尔街终端 · 高频金融研报",
    englishTitle: "Bloomberg Financial Terminal",
    summary:
      "面向二级市场投研、量化基金与宏观经济分析的金融终端美学：深炭黑底板配琥珀金行情色与精密等宽数据对齐，信息承载力拉满。",
    scenario: "咨询汇报",
    styleCategory: "商务咨询",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "python-pptx", "notebooklm"],
    tags: ["金融投研", "量化分析", "琥珀终端", "高密度数据", "宏观策略"],
    visualSpec: {
      palette: {
        bg: "#0B0E13",
        surface: "#131820",
        text: "#F3F4F6",
        muted: "#8E98A8",
        accent: "#F59E0B",
        accentSoft: "rgba(245, 158, 11, 0.14)",
        border: "#252E3D",
        chartColors: ["#F59E0B", "#10B981", "#38BDF8", "#475569"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "JetBrains Mono / 思源黑体 Bold",
        bodyFontLabel: "Inter / 微软雅黑 Regular",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "financial-terminal",
        density: "dense",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "华尔街机构级金融数据终端风格（Financial Terminal）：冷静权威、锐利 2px 直角面板、高对比度多维财务指标看板，绝无花哨装饰。",
      palette:
        "深邃炭黑行情底板（#0B0E13）与石墨面板（#131820），主数字冷白（#F3F4F6），焦点信号采用终端琥珀橙（#F59E0B），正向超额收益用行情翠绿（#10B981）。",
      typography:
        "所有估值倍数、BPS 基点、收益率与时间序列轴全面采用等宽数字（Tabular Monospace），标题紧凑有力，脚注清晰交代口径与基准指数。",
      layout:
        "顶部通栏宏观核心观点 + 精密分栏图表与三联 KPI 监控框，保持高信噪比与横向严丝合缝的对齐参考线。",
      content:
        "适合宏观经济展望、行业深度研报、量化策略回测归因、CFO 财务经营分析及并购估值汇报。",
    },
    customNotes:
      "推荐配合 Python-PPTX 或 Claude HTML 导出，数字对齐效果堪比专业投研终端。",
    sampleTopic: "2026 全球算力基础设施资本开支与估值归因",
    sampleSubtitle: "Q4 机构策略研报 · 超额收益拆解与产业链景气度跟踪",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 394,
    savesCount: 340,
    copiesCount: 1180,
  },
  {
    id: "prompt_clinical_biotech",
    slug: "clinical-biotech-clarity",
    title: "生命科学洁净 · 医疗与生物医药",
    englishTitle: "Clinical Biotech Clarity",
    summary:
      "专为医疗器械、创新药管线与临床医学峰会打造：冰川浅青白底色配医学深青蓝与生机薄荷绿，严谨呈现实验数据与作用机制。",
    scenario: "学术答辩",
    styleCategory: "学术期刊",
    colorFamily: "light",
    recommendedTools: ["gamma-kimi", "claude-html", "notebooklm", "python-pptx"],
    tags: ["医疗健康", "生物医药", "临床数据", "清新严谨", "科研汇报"],
    visualSpec: {
      palette: {
        bg: "#F4F9FA",
        surface: "#FFFFFF",
        text: "#0F2936",
        muted: "#54707E",
        accent: "#0E7490",
        accentSoft: "#E0F4F8",
        border: "#CFE2E8",
        chartColors: ["#0E7490", "#10B981", "#475569", "#94A3B8"],
      },
      typography: {
        mood: "consulting",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "clinical-clean",
        density: "balanced",
        cornerRadius: 10,
        showPageNumber: true,
        decorativeMotif: "ribbon-accent",
      },
    },
    promptAnatomy: {
      style:
        "现代临床医学与生命科学洁净风格（Clinical & Biotech Clarity）：纯净、透明、富有人道关怀与科学公信力，视觉舒适无压迫感。",
      palette:
        "无菌冰川微青白底（#F4F9FA）衬托纯白实验数据卡（#FFFFFF），深海青墨文字（#0F2936），医学青蓝（#0E7490）与薄荷生命绿（#10B981）区分对照组与实验组。",
      typography:
        "清晰高辨识度无衬线字体，明确标注样本量（n=...）、显著性水平（p < 0.001）与置信区间，层次井然。",
      layout:
        "10px 温和圆角信息卡片，顶部青绿渐变细装饰条统一母版识别度，左图右结论分栏清晰呈现临床终点指标。",
      content:
        "广泛适用于创新药融资路演、医院科室年度总结、医学学术会议发言、医疗 AI 产品验证报告。",
    },
    customNotes:
      "在投影仪偏色环境下依然能保持极佳的冷暖对比与可读性。",
    sampleTopic: "靶向蛋白降解剂（PROTAC）II 期临床中期分析",
    sampleSubtitle: "客观缓解率提升与安全性随访数据 · 医学科学委员会汇报",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 318,
    savesCount: 279,
    copiesCount: 920,
  },
  {
    id: "prompt_pedagogy_course",
    slug: "structured-pedagogy-course",
    title: "结构化知识图解 · 课程与企业内训",
    englishTitle: "Structured Pedagogy Deck",
    summary:
      "为高校授课、企业内训与知识博主公开课优化：护眼暖米色底板、知识钴蓝主框与暖黄重点高亮贴，让复杂概念拆解得深入浅出。",
    scenario: "教育培训",
    styleCategory: "暖调人文",
    colorFamily: "warm",
    recommendedTools: ["gamma-kimi", "notebooklm", "claude-html", "slidev-marp"],
    tags: ["企业培训", "公开课课件", "知识图解", "护眼配色", "结构化教学"],
    visualSpec: {
      palette: {
        bg: "#FAF8F2",
        surface: "#FFFFFF",
        text: "#1E293B",
        muted: "#5B677A",
        accent: "#2563EB",
        accentSoft: "#FEF3C7",
        border: "#E2DEC9",
        chartColors: ["#2563EB", "#D97706", "#059669", "#94A3B8"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "warm-humanist",
        density: "balanced",
        cornerRadius: 12,
        showPageNumber: true,
        decorativeMotif: "ribbon-accent",
      },
    },
    promptAnatomy: {
      style:
        "认知友好的现代结构化教学课件风格（Instructional Design）：遵循认知负荷理论，用清晰序号、概念对比卡与荧光暖黄「避坑提示框」引导学员注意力。",
      palette:
        "长时间观看不疲劳的护眼暖米纸底（#FAF8F2），深石板蓝黑正文（#1E293B），主知识点用理性钴蓝（#2563EB），核心记忆点用柔和暖黄底（#FEF3C7）高亮。",
      typography:
        "大字号清晰标题搭配宽松行距正文，关键术语加粗突出，确保线下培训教室后排与线上录屏均清晰易读。",
      layout:
        "每章节遵循「学习目标 -> 核心框架拆解 -> 正反案例对比 -> 随堂复盘清单」的闭环结构，12px 亲和圆角卡片分区明确。",
      content:
        "多用类比、步骤拆解（Step 1 / 2 / 3）与正误示范对照，避免整页枯燥定义。",
    },
    customNotes:
      "讲师、HRBP 内训、咨询方法论工作坊与知识付费课程录屏的得力模板。",
    sampleTopic: "结构化思维与高效商业沟通实战工作坊",
    sampleSubtitle: "从零散想法到高说服力表达 · 企业核心骨干内训课件",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 356,
    savesCount: 318,
    copiesCount: 1105,
  },
  {
    id: "prompt_industrial_cyber",
    slug: "industrial-cybernetics-orange",
    title: "机能工业黑橙 · 具身智能与智造",
    englishTitle: "Industrial Cybernetics Spec",
    summary:
      "融合博世/大疆工业美学与现代机能设计：哑光钛黑底板配高辨识度安全工程橙与精密准星刻度，燃爆机器人、智驾与硬科技路演。",
    scenario: "技术分享",
    styleCategory: "科技未来",
    colorFamily: "vivid",
    recommendedTools: ["claude-html", "ai-image", "slidev-marp"],
    tags: ["硬科技", "具身智能", "工业机能", "黑橙撞色", "智能制造"],
    visualSpec: {
      palette: {
        bg: "#111214",
        surface: "#1A1C20",
        text: "#F4F4F5",
        muted: "#9CA3AF",
        accent: "#F97316",
        accentSoft: "rgba(249, 115, 22, 0.15)",
        border: "#2E323B",
        chartColors: ["#F97316", "#EAB308", "#9CA3AF", "#3F3F46"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "Space Grotesk / 思源黑体 Heavy",
        bodyFontLabel: "Inter / 苹方 Medium",
        titleWeight: 700,
        titleTracking: "-0.03em",
      },
      layout: {
        archetype: "tech-blueprint",
        density: "balanced",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "corner-brackets",
      },
    },
    promptAnatomy: {
      style:
        "现代精密工业机能美学（Teenage Engineering / DJI Industrial）：冷峻钛黑机械质感搭配高可见度工程安全橙（Safety Orange），充满力量感与工程精度。",
      palette:
        "碳纤维哑光黑（#111214）与枪灰模块面板（#1A1C20），冷白主文字（#F4F4F5），工程警示橙（#F97316）高亮算力扭矩、良率与核心突破。",
      typography:
        "硬朗利落的现代几何黑体标题，硬件规格参数（如 275 TOPS / ±0.02mm）使用等宽工程字体排布，如工业铭牌般严谨。",
      layout:
        "四角机械定位准星 + 4px 微切角硬朗模块框，擅长展示硬件参数矩阵、控制闭环架构与量产路线图。",
      content:
        "聚焦工程指标、实测可靠性、BOM 成本下降曲线与商业化交付节点，极适合机器人、自动驾驶、航空航天与新能源硬科技。",
    },
    customNotes:
      "硬科技创业公司融资 BP 与新品技术解析会的王牌视觉方案。",
    sampleTopic: "ATLAS-M2 · 工业级灵巧操作具身机器人平台",
    sampleSubtitle: "亚毫米级力控精度与端到端视觉动作大模型量产方案",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 447,
    savesCount: 376,
    copiesCount: 1390,
  },
  {
    id: "prompt_parisian_couture",
    slug: "parisian-couture-lookbook",
    title: "巴黎高定画册 · 时尚美妆与空间",
    englishTitle: "Parisian Couture Lookbook",
    summary:
      "玫瑰藕粉象牙纸底搭配勃艮第深酒红与优雅纤细衬线体，如巴黎高定秀场邀请函般细腻考究，赋能美妆、香氛、时尚零售与美学策展。",
    scenario: "品牌提案",
    styleCategory: "编辑部杂志",
    colorFamily: "warm",
    recommendedTools: ["ai-image", "claude-html", "gamma-kimi"],
    tags: ["高定时尚", "美妆香氛", "秀场画册", "酒红雅致", "零售提案"],
    visualSpec: {
      palette: {
        bg: "#FBF7F6",
        surface: "#FFFFFF",
        text: "#23191B",
        muted: "#7A686C",
        accent: "#7F1D3A",
        accentSoft: "#F9EBEF",
        border: "#EADCE0",
        chartColors: ["#7F1D3A", "#B07D62", "#8E7C81", "#D8C8CC"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Regular",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Light",
        titleWeight: 400,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "luxury-minimal",
        density: "airy",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "editorial-drop",
      },
    },
    promptAnatomy: {
      style:
        "法式高定时尚画册美学（Parisian Couture Lookbook）：轻盈感性、留白考究、线条纤细如丝带，在克制中流露奢华质感与女性审美洞察。",
      palette:
        "暖雾玫瑰象牙白底（#FBF7F6），深紫檀墨色正文（#23191B），勃艮第丝绒酒红（#7F1D3A）与香槟玫瑰金（#B07D62）勾勒重点指标与章节线。",
      typography:
        "高挑纤细的时尚杂志衬线大标题（字重 400），搭配宽字距全大写英文系列标（COLLECTION / INSIGHT），呼吸感十足。",
      layout:
        "画廊级对称或黄金分割跨页构图，2px 微锐边卡片搭配精细发丝边框，留出充沛视觉空间凸显品牌调性。",
      content:
        "适合高端美妆护肤全案、香氛奢品发布、买手店空间策展、婚礼艺术及女性消费品季度企划。",
    },
    customNotes:
      "搭配即梦 / Midjourney 整页生图或 Claude HTML 提案，客户第一眼就能感受到审美水准。",
    sampleTopic: "LUMIÈRE 2026 秋冬东方木质调香氛全案企划",
    sampleSubtitle: "感官叙事与旗舰店沉浸式五感体验空间提案",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 368,
    savesCount: 329,
    copiesCount: 1030,
  },
  /* ==================== v5 新增：教师与课堂教学（4 套） ==================== */
  {
    id: "prompt_chalkboard_lesson",
    slug: "chalkboard-classic-lesson",
    title: "墨绿护眼黑板 · 经典粉笔板书微课",
    englishTitle: "Classic Chalkboard Lesson",
    summary:
      "还原经典护眼墨绿黑板与木质粉笔槽质感：高对比暖白粉笔字搭配柠檬黄重点圈注与虚线板书框，专为中小学与高校板书推导微课设计。",
    scenario: "课堂教学",
    styleCategory: "课堂板书",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image", "slidev-marp"],
    tags: ["教师课件", "黑板粉笔", "板书推导", "护眼暗底", "微课录屏"],
    visualSpec: {
      palette: {
        bg: "#1E352F",
        surface: "#254039",
        text: "#F7F5EB",
        muted: "#C3D4CC",
        accent: "#FACC15",
        accentSoft: "rgba(250, 204, 21, 0.16)",
        border: "#4E6E64",
        chartColors: ["#FACC15", "#7DD3FC", "#FCA5A5", "#A7F3D0"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "思源黑体 / 楷体加粗（粉笔板书感）",
        bodyFontLabel: "苹方 / 思源黑体 Medium",
        titleWeight: 700,
        titleTracking: "0em",
      },
      layout: {
        archetype: "chalkboard-class",
        density: "balanced",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "chalk-frame",
      },
    },
    promptAnatomy: {
      style:
        "沉浸式护眼黑板板书教学美学（Classic Chalkboard Pedagogy）：哑光墨绿底板配合虚线粉笔框与底部木质板槽线，帮助学生聚焦推导逻辑与课堂重点。",
      palette:
        "经典护眼墨绿黑板底（#1E352F）、浅石板绿板书卡（#254039）、暖白粉笔正文（#F7F5EB），柠檬粉笔黄（#FACC15）专用于高亮公式、易错点与随堂提问。",
      typography:
        "主标题 ≥ 36pt、正文 ≥ 22pt 大字号高对比规范，确保教室后排与线上录屏均清晰易读，公式与例题分步呈现。",
      layout:
        "每课严格遵循「情境导入设问 → 核心概念拆解 → 典型例题分步板书 → 随堂小测与知识树小结」四段式闭环。",
      content:
        "每页预留明确的「老师互动提问」与「易错点提醒」标注，避免大段照本宣科。",
    },
    customNotes:
      "数学、物理、化学推导及中小学公开课、慕课录屏高频口碑模板。",
    sampleTopic: "牛顿第二定律与动力学两类核心问题精讲",
    sampleSubtitle: "高一物理必修一 · 探究加速度、合力与质量的定量关系",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 412,
    savesCount: 365,
    copiesCount: 1240,
  },
  {
    id: "prompt_open_class_cyan",
    slug: "open-class-competition-cyan",
    title: "青教赛金奖 · 公开课与说课规范课件",
    englishTitle: "Teaching Competition Standard",
    summary:
      "面向高校青教赛、教学创新大赛与精品说课评审：高对比抗反光冷白纸底，教育青蓝知识骨架配暖橙互动锚点，清晰呈现教学目标与痛点突破。",
    scenario: "课堂教学",
    styleCategory: "暖调人文",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "notebooklm", "python-pptx"],
    tags: ["青教赛", "公开课说课", "教学创新", "抗反光白底", "高校教师"],
    visualSpec: {
      palette: {
        bg: "#F8FAFC",
        surface: "#FFFFFF",
        text: "#0F172A",
        muted: "#475569",
        accent: "#0284C7",
        accentSoft: "#E0F2FE",
        border: "#CBD5E1",
        chartColors: ["#0284C7", "#EA580C", "#0D9488", "#64748B"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "思源黑体 Bold / Plus Jakarta Sans",
        bodyFontLabel: "苹方 / 微软雅黑 Regular",
        titleWeight: 700,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "warm-humanist",
        density: "balanced",
        cornerRadius: 10,
        showPageNumber: true,
        decorativeMotif: "ribbon-accent",
      },
    },
    promptAnatomy: {
      style:
        "全国教学竞赛金奖标准风格（Instructional Excellence）：明亮通透、层次分明、评审友好，在 15–20 分钟说课内一眼呈现教学痛点、创新举措与学情成效。",
      palette:
        "无反光冷白底（#F8FAFC）保障强光礼堂投影清晰度，知识青蓝（#0284C7）构建课程主脉络，活力琥珀橙（#EA580C）标注课程思政融合点与互动环节。",
      typography:
        "清晰的三级教学层级：顶部章节进度条 + 结论式课时小标题 + 精炼关键词卡片，重点概念加粗标色。",
      layout:
        "内置「学情痛点 → 教学目标（知识/能力/素养）→ 混合式教学闭环 → 评价反思与成效数据」标准化说课框架。",
      content:
        "强调以学生为中心（OBE 理念），配合形成性评价数据与课堂互动实景说明，杜绝纯教材目录罗列。",
    },
    customNotes:
      "高校青年教师教学竞赛、中小学优质课评比与教研组说课汇报首选。",
    sampleTopic: "《人工智能导论》混合式翻转课堂教学创新说课",
    sampleSubtitle: "基于问题链驱动与项目式实训的 OBE 教学设计方案",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 389,
    savesCount: 342,
    copiesCount: 1180,
  },
  {
    id: "prompt_k12_storybook",
    slug: "k12-pastel-storybook",
    title: "豆沙护眼绘本 · K12 启蒙与主题班会",
    englishTitle: "K12 Pastel Storybook",
    summary:
      "专为小学初中课堂、主题班会与家长会打造的低饱和护眼豆沙绿绘本风格：大圆角亲和卡片配蜜桃珊瑚暖色徽章，活泼清爽不刺眼。",
    scenario: "课堂教学",
    styleCategory: "现代Bento",
    colorFamily: "warm",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image"],
    tags: ["中小学班会", "家长会", "K12 课件", "护眼浅绿", "亲子互动"],
    visualSpec: {
      palette: {
        bg: "#F4F8F2",
        surface: "#FFFFFF",
        text: "#253029",
        muted: "#5C6E63",
        accent: "#E06D53",
        accentSoft: "#FCECE8",
        border: "#DCE6D9",
        chartColors: ["#E06D53", "#4F8A6E", "#E9B44C", "#6C9BD2"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "圆润黑体 / Plus Jakarta Sans Bold",
        bodyFontLabel: "苹方 / 思源黑体 Regular",
        titleWeight: 700,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "soft-bento",
        density: "airy",
        cornerRadius: 18,
        showPageNumber: true,
        decorativeMotif: "bento-dots",
      },
    },
    promptAnatomy: {
      style:
        "低龄友好护眼绘本 Bento 美学（Warm K12 Storybook）：高留白、大圆角、马卡龙自然暖色系，营造安全轻松的课堂讨论与家校沟通氛围。",
      palette:
        "视力保护豆沙浅绿纸底（#F4F8F2）配纯白圆角卡片，深松叶墨绿文字（#253029）高对比护眼，蜜桃珊瑚橘（#E06D53）引导视觉焦点。",
      typography:
        "大字号圆润友好标题，每页文字严格控制在 35 字以内，多用生活化比喻与图标序号降低阅读压力。",
      layout:
        "18px 亲和圆角模块化卡片 + 右上角三色圆点装饰，便于排布故事导入、小组讨论任务卡与表彰光荣榜。",
      content:
        "契合主题班会、心理健康课、期中家长会与小学语文/科学启蒙课件，注重互动感与正向激励。",
    },
    customNotes:
      "班主任开家长会、安全教育主题班会及儿童素质拓展课极受欢迎。",
    sampleTopic: "做情绪的小主人 · 五年级心理健康主题班会",
    sampleSubtitle: "认识情绪信号 · 学会三个科学冷静小锦囊",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 344,
    savesCount: 310,
    copiesCount: 990,
  },
  {
    id: "prompt_steam_gridbook",
    slug: "steam-inquiry-gridbook",
    title: "方格实验手账 · STEAM 科创与探究课",
    englishTitle: "STEAM Inquiry Gridbook",
    summary:
      "模拟工程实验方格笔记本的清爽亮底探究风：电光靛蓝步骤轴搭配翡翠绿假设验证徽章与精密准星，点燃创客、编程与科学实验课堂。",
    scenario: "教育培训",
    styleCategory: "科技未来",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "slidev-marp", "notebooklm"],
    tags: ["STEAM 科创", "实验探究", "少儿编程", "方格笔记", "工作坊"],
    visualSpec: {
      palette: {
        bg: "#F9F8F3",
        surface: "#FFFFFF",
        text: "#181B2C",
        muted: "#5A6078",
        accent: "#4F46E5",
        accentSoft: "#EEF2FF",
        border: "#D9DCE8",
        chartColors: ["#4F46E5", "#10B981", "#F59E0B", "#64748B"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "Space Grotesk / 思源黑体 Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "tech-blueprint",
        density: "balanced",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "corner-brackets",
      },
    },
    promptAnatomy: {
      style:
        "明亮创客实验笔记风格（Bright STEAM Lab Notebook）：融合科学探究的严谨准星与现代创客的明快色阶，让动手实践流程一目了然。",
      palette:
        "暖米实验纸底（#F9F8F3）、纯白模块卡，主强调色采用电光靛蓝（#4F46E5），实验成功指标与对照组分别用翡翠绿（#10B981）与警示琥珀（#F59E0B）区分。",
      typography:
        "清晰现代无衬线标题搭配等宽参数标签（如 `STEP 01 / V=3.3V / T=25°C`），激发工程好奇心。",
      layout:
        "遵循「观察现象 → 提出假设 → 动手搭建与控制变量 → 数据记录与迭代反思」的 PBL 项目制探究结构。",
      content:
        "适合高校创新创业实训、中学物理/生物实验课、创客工作坊与少儿编程竞赛路演。",
    },
    customNotes:
      "相比深色科技风，浅底实验手账在普通教室投影下辨识度高出一倍。",
    sampleTopic: "太阳能智能滴灌系统 · STEAM 跨学科科创项目",
    sampleSubtitle: "从土壤湿度传感原理到 PID 自动控制原型验证",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 326,
    savesCount: 288,
    copiesCount: 870,
  },

  /* ==================== v5 新增：研究人员与学术全周期（4 套） ==================== */
  {
    id: "prompt_nsfc_grant",
    slug: "nsfc-grant-defense-bluered",
    title: "国自然 NSFC · 基金申报与重点课题答辩",
    englishTitle: "NSFC Grant Defense Spec",
    summary:
      "严格对标国家自然科学基金、杰青/优青与重点研发计划评审规范：纯白学术底板、科学院深蓝骨架配关键创新点朱红高亮，适配 5–7 分钟专家高精度汇报。",
    scenario: "科研基金",
    styleCategory: "学术期刊",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "notebooklm", "python-pptx"],
    tags: ["国自然 NSFC", "基金答辩", "重点课题", "蓝红学术", "高密度汇报"],
    visualSpec: {
      palette: {
        bg: "#FFFFFF",
        surface: "#F5F8FC",
        text: "#111827",
        muted: "#4B5563",
        accent: "#0F3D75",
        accentSoft: "#E6EFFA",
        border: "#CBD5E1",
        chartColors: ["#0F3D75", "#C81E1E", "#0E7490", "#64748B"],
      },
      typography: {
        mood: "consulting",
        headingFontLabel: "思源黑体 Bold / 微软雅黑 Bold",
        bodyFontLabel: "思源黑体 / Arial Regular",
        titleWeight: 700,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "consulting-mbb",
        density: "dense",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "hairline-rule",
      },
    },
    promptAnatomy: {
      style:
        "国家自然科学基金评审专攻风格（High-Precision Grant Defense）：绝对克制零花哨动画，顶部核心科学问题一句话定调，全页模块化块状排版，专为评审专家 5–7 分钟快速抓重点打造。",
      palette:
        "高对比纯白纸底（#FFFFFF）确保会议室投影零偏色，科学院深蓝（#0F3D75）建立研究骨架，核心科学假说与突破性指标严格用学术朱红（#C81E1E）精准点题。",
      typography:
        "每页标题必须采用「动词 + 科学发现/技术突破」结论句式（多用「揭示」「提出」「突破」），正文层级严密，关键量化指标加粗标红。",
      layout:
        "按国自然黄金六步展开：立项依据与关键科学问题 → 研究目标与核心假说 → 技术路线与机理框架 → 前期工作基础（代表作/预实验）→ 创新点对比 → 年度计划与团队保障。",
      content:
        "严禁编造或夸大实验数据，所有前期代表论文与指标需保留期刊年份、样本量与对照基线。",
    },
    customNotes:
      "高校与科研院所申报国自然优青/面上/重点项目、博士后基金及重大科技专项答辩必备。",
    sampleTopic: "面向极端工况的多物理场耦合失效机理与智能调控",
    sampleSubtitle: "国家自然科学基金重点项目申请答辩 · 科学问题与技术路线",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 468,
    savesCount: 432,
    copiesCount: 1560,
  },
  {
    id: "prompt_nature_okabe",
    slug: "nature-okabe-ito-evidence",
    title: "Nature 证据流 · Okabe-Ito 色盲安全科研风",
    englishTitle: "Nature Evidence Okabe-Ito",
    summary:
      "融合 Nature Methods 官方推荐的 Okabe-Ito 色盲安全科研色板与「去 AI 卡片化」极简证据流排版：无冗余阴影框、纯白高可读大字号，让实验图表与显著性结论占据绝对视觉主体。",
    scenario: "科研基金",
    styleCategory: "学术期刊",
    colorFamily: "light",
    recommendedTools: ["claude-html", "notebooklm", "slidev-marp", "python-pptx"],
    tags: ["Nature 科研", "Okabe-Ito", "色盲安全", "去卡片化", "国际会议"],
    visualSpec: {
      palette: {
        bg: "#FCFCFD",
        surface: "#F8FAFC",
        text: "#111827",
        muted: "#4B5563",
        accent: "#0072B2",
        accentSoft: "#E6F2FA",
        border: "#D1D5DB",
        chartColors: ["#0072B2", "#D55E00", "#009E73", "#CC79A7"],
      },
      typography: {
        mood: "academic",
        headingFontLabel: "Instrument Serif / 思源宋体 SemiBold",
        bodyFontLabel: "Inter / 思源黑体 Regular",
        titleWeight: 600,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "scientific-figure",
        density: "balanced",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "citation-axis",
      },
    },
    promptAnatomy: {
      style:
        "顶级国际期刊科研报告美学（Nature / Science Evidence-First）：坚决摒弃廉价 AI 彩色圆角卡片堆砌，以透明留白区块、精密坐标刻度线和 100% 证据驱动排版彰显学者品位。",
      palette:
        "严格内置 Masataka Okabe & Kei Ito 色盲安全标准色板（海蓝 #0072B2、朱橙 #D55E00、翠绿 #009E73、绛紫 #CC79A7），确保色觉异常听众与黑白打印下均可清晰区分实验组别。",
      typography:
        "遵循国际学术会场投影大字号标准（标题 ≥ 36pt，正文 ≥ 22pt，坐标轴标注 ≥ 18pt），底部固定等宽文献引用与 p 值脚注。",
      layout:
        "顶部精密坐标刻度尺眉标 + 左侧 60% 放大实验证据/图表区 + 右侧精炼 2–3 条统计学解释，每页只证明 1 个可证伪的科学论断。",
      content:
        "强制科研诚信护栏：严格忠实于上传论文与原始数据，任何缺失数字标注 `[TK: 待补实验值]`，保留样本量 n、置信区间与来源引文。",
    },
    customNotes:
      "NeurIPS、ICML、Nature/Cell 国际学术会议 Oral Talk 及海外博士组会汇报王牌风格。",
    sampleTopic: "Single-Cell Spatial Atlas Reveals Immune Niche Remodeling",
    sampleSubtitle: "高分辨率空间转录组揭示微环境重塑机制 · 国际学术大会口头报告",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 452,
    savesCount: 418,
    copiesCount: 1490,
  },
  {
    id: "prompt_journal_club",
    slug: "journal-club-paper-reading",
    title: "实验室组会 · Journal Club 文献精读",
    englishTitle: "Lab Journal Club Briefing",
    summary:
      "专为硕博研究生每周组会、文献精读与实验进展同步打造：护眼冷灰纸底、牛津深青章节导航栏与批注赭橙质疑点标记，高效拆解 Motivation / Method / Ablation。",
    scenario: "学术答辩",
    styleCategory: "学术期刊",
    colorFamily: "light",
    recommendedTools: ["notebooklm", "claude-html", "slidev-marp", "gamma-kimi"],
    tags: ["文献精读", "组会汇报", "Journal Club", "消融实验", "研究生"],
    visualSpec: {
      palette: {
        bg: "#F5F7FA",
        surface: "#FFFFFF",
        text: "#18222F",
        muted: "#536274",
        accent: "#0F4C5C",
        accentSoft: "#E6F1F4",
        border: "#D4DDE7",
        chartColors: ["#0F4C5C", "#C2410C", "#2563EB", "#64748B"],
      },
      typography: {
        mood: "academic",
        headingFontLabel: "思源宋体 / Plus Jakarta Sans Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "academic-paper",
        density: "dense",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "citation-axis",
      },
    },
    promptAnatomy: {
      style:
        "高效科研组会文献精读风（Weekly Lab Journal Club）：顶部带 Beamer 式章节进度导航，结构利落不冗余，让导师和同门 10 分钟抓准论文核心贡献与可复现缺陷。",
      palette:
        "护眼冷灰白纸（#F5F7FA）配合纯白实验框，牛津深青（#0F4C5C）标注原论文核心方法，批注赭橙（#C2410C）突出「Critique 局限性」与「对本课题组启发」。",
      typography:
        "清晰展示论文元信息（Venue / Year / Code Link），公式变量与基线指标使用等宽字体对齐，便于横向对比 SOTA。",
      layout:
        "固定文献拆解链路：Paper Card 元信息 → Research Gap → Core Architecture → Main Results & Ablation → Critical Review & Lab Takeaway。",
      content:
        "高度契合搭配 NotebookLM 上传 PDF 论文自动提炼，要求明确区分「作者原话结论」与「汇报人批判性思考」。",
    },
    customNotes:
      "配合 NotebookLM 或直接上传英文论文 PDF 到工坊，5 分钟生成高质量周会精读 PPT。",
    sampleTopic: "文献精读：Test-Time Scaling Laws in Multimodal Reasoning",
    sampleSubtitle: "ICLR 2026 Spotlight 拆解 · 方法架构、消融实验与本组复现建议",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 374,
    savesCount: 348,
    copiesCount: 1210,
  },
  {
    id: "prompt_humanities_archive",
    slug: "humanities-archival-seminar",
    title: "古籍田野笺纸 · 人文社科与历史考据",
    englishTitle: "Humanities Archival Seminar",
    summary:
      "脱胎于线装古籍笺纸与人文期刊的雅致学术风：竹纸米褐底色、焦茶墨宋体引文配藏书印泥红，赋予文史哲、社会学、法学与建筑遗产答辩厚重书卷气。",
    scenario: "学术答辩",
    styleCategory: "新中式美学",
    colorFamily: "earth",
    recommendedTools: ["claude-html", "notebooklm", "gamma-kimi", "ai-image"],
    tags: ["人文社科", "文史哲答辩", "法学研讨", "田野调查", "古籍笺纸"],
    visualSpec: {
      palette: {
        bg: "#F6F1E7",
        surface: "#FCF9F2",
        text: "#2B241E",
        muted: "#6E6155",
        accent: "#9E2A2B",
        accentSoft: "#F5E4E4",
        border: "#DDD3C2",
        chartColors: ["#9E2A2B", "#4A5D5E", "#8C6D46", "#A99B89"],
      },
      typography: {
        mood: "chinese",
        headingFontLabel: "思源宋体 / 华文仿宋 Bold",
        bodyFontLabel: "思源宋体 / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "0.02em",
      },
      layout: {
        archetype: "neo-chinese",
        density: "airy",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "editorial-drop",
      },
    },
    promptAnatomy: {
      style:
        "典雅人文社科考据美学（Archival Humanities Seminar）：如博物馆文献展签与学术专著版式，温润沉静，擅长呈现一手史料引文、田野访谈摘录与年表脉络。",
      palette:
        "竹纸米褐底（#F6F1E7）搭配宣纸暖白卡（#FCF9F2），焦茶墨正文（#2B241E）温润不刺眼，藏书印泥红（#9E2A2B）点缀文献出处与核心论点。",
      typography:
        "全程以宋体/楷宋建立典雅人文层级，原始文献/访谈引文使用大字号竖线引用块，页脚保留规范芝加哥/GB7714 文献注脚。",
      layout:
        "疏朗编辑部留白 + 精细内页框线，特别强化时间年表（Timeline）、双栏文本互证对比（Comparison）与核心金句引证页（Quote）。",
      content:
        "面向历史、文学、哲学、社会学、新闻传播、建筑史与法学专业学位答辩及读书研讨会。",
    },
    customNotes:
      "人文社科研究者终于告别千篇一律的科技蓝模板，用书卷气赢得答辩席好感。",
    sampleTopic: "明清江南市镇水系变迁与商帮治理空间考证",
    sampleSubtitle: "历史地理学硕士学位论文答辩 · 地方志文献与田野口述互证",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 338,
    savesCount: 306,
    copiesCount: 910,
  },

  /* ==================== v5 新增：项目管理与日常职场汇报（5 套） ==================== */
  {
    id: "prompt_pmo_rag",
    slug: "pmo-rag-milestone-board",
    title: "PMO 里程碑看板 · 项目交付与红黄绿管控",
    englishTitle: "PMO RAG Milestone Board",
    summary:
      "专为项目经理、交付总监与跨部门项目复盘打造：精密工程灰底配钴蓝骨架与标准 RAG（红/黄/绿）健康度指示灯，一屏说清进度、依赖、预算与风险对策。",
    scenario: "项目汇报",
    styleCategory: "商务咨询",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "python-pptx", "slidev-marp"],
    tags: ["PMO 汇报", "项目周报", "里程碑", "红黄绿风险", "交付复盘"],
    visualSpec: {
      palette: {
        bg: "#F4F6F9",
        surface: "#FFFFFF",
        text: "#0F172A",
        muted: "#526071",
        accent: "#1D4ED8",
        accentSoft: "#DBEAFE",
        border: "#D5DDE8",
        chartColors: ["#16A34A", "#D97706", "#DC2626", "#2563EB"],
      },
      typography: {
        mood: "consulting",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "pmo-rag-grid",
        density: "dense",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "status-dots",
      },
    },
    promptAnatomy: {
      style:
        "国际 PMP / PMO 项目治理仪表盘美学（Executive PMO Governance）：理性、紧凑、决策直达，右上角固定红黄绿健康状态灯，帮助管理层 30 秒识别项目风险。",
      palette:
        "精密工业浅灰底（#F4F6F9）配纯白状态卡，钴蓝（#1D4ED8）作为主结构色，数据状态色严格绑定语义：正常绿（#16A34A）、预警黄（#D97706）、阻塞红（#DC2626）。",
      typography:
        "结论先行顶部状态条 + 等宽数字工期/燃尽指标，所有任务均带明确 `Owner` 与 `ETA` 时间戳。",
      layout:
        "封面自带四维健康矩阵（进度/质量/依赖/预算），内页强化甘特里程碑路线图、阻塞风险与缓解举措双栏矩阵及跨团队协作清单。",
      content:
        "适用于大型 IT 系统上线、软硬件项目立项/结项评审、客户交付周报与跨部门 PMO 月度例会。",
    },
    customNotes:
      "老板最爱看的汇报结构：先给总体红黄绿灯，再讲阻塞项和需要拍板的资源。",
    sampleTopic: "ERP 核心财务中台一期上线里程碑与风险复盘",
    sampleSubtitle: "PMO 双周 Steering Committee 汇报 · 进度达成 94% / 2 项跨部依赖预警",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 421,
    savesCount: 389,
    copiesCount: 1350,
  },
  {
    id: "prompt_civic_redgold",
    slug: "civic-party-red-gold",
    title: "丹宸鎏金 · 政务党建与国央企庄重汇报",
    englishTitle: "Civic Red & Gold Formal",
    summary:
      "摆脱陈旧俗艳的现代庄重政务美学：温润暖象牙底板搭配端庄中国红与克制鎏金双饰带，中轴对称章法严谨，适配党政机关、国央企与高校党委专题汇报。",
    scenario: "政务党建",
    styleCategory: "政务红金",
    colorFamily: "warm",
    recommendedTools: ["claude-html", "gamma-kimi", "python-pptx", "ai-image"],
    tags: ["政务汇报", "党建专题", "国央企", "红金庄重", "年度述职"],
    visualSpec: {
      palette: {
        bg: "#FCF9F5",
        surface: "#FFFFFF",
        text: "#1F1917",
        muted: "#655853",
        accent: "#B91C1C",
        accentSoft: "#FEF2F2",
        border: "#E7D9CE",
        chartColors: ["#B91C1C", "#B45309", "#1E3A5F", "#78716C"],
      },
      typography: {
        mood: "chinese",
        headingFontLabel: "思源宋体 / 方正小标宋 Bold",
        bodyFontLabel: "思源黑体 / 仿宋 Regular",
        titleWeight: 700,
        titleTracking: "0.01em",
      },
      layout: {
        archetype: "civic-redgold",
        density: "balanced",
        cornerRadius: 4,
        showPageNumber: true,
        decorativeMotif: "redgold-ribbon",
      },
    },
    promptAnatomy: {
      style:
        "现代新派庄重政务党建美学（Modern Dignified Civic）：以暖象牙纸感取代刺眼大红铺满，保留红头双线与鎏金腰带的权威仪式感，同时大幅提升长文阅读舒适度。",
      palette:
        "暖象牙纸底（#FCF9F5）配纯白公文卡，正统中国红（#B91C1C）确立政治与纲领重心，克制鎏金棕（#B45309）与深政蓝（#1E3A5F）辅助分层图表。",
      typography:
        "中轴对称大字号宋体主标，正文清晰工整，善用四字/八字对仗提纲（如「党建引领 · 实干笃行」）提炼重点。",
      layout:
        "顶部双层红金眉线贯穿全套母版，结构严格遵循「总体成效与量化实绩 → 重点举措与经验做法 → 存在不足与剖析 → 下一步工作部署」。",
      content:
        "用语严谨规范，注重政策落点、群众/业务实效数据对比与重点项目推进节点。",
    },
    customNotes:
      "政府部门工作总结、国央企党委述职、事业单位专题汇报及主题党日活动首选。",
    sampleTopic: "2026 年度党建引领高质量发展与重点工程攻坚汇报",
    sampleSubtitle: "凝心聚力担使命 · 全面完成年度十二项民生与产业实事清单",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 398,
    savesCount: 356,
    copiesCount: 1290,
  },
  {
    id: "prompt_star_promotion",
    slug: "star-career-promotion-pitch",
    title: "STAR 晋升战报 · 年终述职与竞聘答辩",
    englishTitle: "STAR Promotion Review",
    summary:
      "为职场晋升答辩、年终述职与岗位竞聘量身打造：睿智冰白纸底、深海领航蓝骨架配战绩活力青，将个人核心战功、量化增幅与成长思考清晰立体地推到评委眼前。",
    scenario: "个人述职",
    styleCategory: "商务咨询",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "python-pptx"],
    tags: ["晋升答辩", "年终述职", "岗位竞聘", "STAR 法则", "个人战报"],
    visualSpec: {
      palette: {
        bg: "#F8FAFC",
        surface: "#FFFFFF",
        text: "#0F2942",
        muted: "#52657A",
        accent: "#0D9488",
        accentSoft: "#CCFBF1",
        border: "#D6E0EB",
        chartColors: ["#0D9488", "#0F2942", "#2563EB", "#94A3B8"],
      },
      typography: {
        mood: "swiss",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 ExtraBold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 800,
        titleTracking: "-0.025em",
      },
      layout: {
        archetype: "executive-emerald",
        density: "balanced",
        cornerRadius: 8,
        showPageNumber: true,
        decorativeMotif: "swiss-cross",
      },
    },
    promptAnatomy: {
      style:
        "高能职场晋升战报风格（STAR Executive Pitch）：干练、自信、结果导向，把「我做了什么」升维为「我主导解决了什么关键难题并带来了多少可复用价值」。",
      palette:
        "清冽冰白底（#F8FAFC）彰显逻辑清晰度，深海领航蓝（#0F2942）传递专业稳重感，战绩活力青（#0D9488）瞬间点亮核心产出 KPI 与个人主导贡献。",
      typography:
        "大字号量化结果数字（如 `降本 42%` / `GMV +1.8 亿`）配极简情境标签，10 秒抓住晋升评委注意力。",
      layout:
        "围绕「个人定位与年度全景 → 2–3 个标杆项目 STAR 深度拆解 → 方法论沉淀与团队影响力 → 反思与高一职级规划」高效展开。",
      content:
        "严格区分团队成果与个人核心 Action，每一页项目案例均落脚到可验证数据与组织复用资产。",
    },
    customNotes:
      "互联网大厂职级晋升（P7/P8/L5/L6）、试用期转正答辩与中层管理竞聘杀手锏。",
    sampleTopic: "2026 年度工作述职与高级产品专家职级晋升答辩",
    sampleSubtitle: "主导交易中台重构与增长闭环 · 支撑业务转化率跃升 +38%",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 435,
    savesCount: 402,
    copiesCount: 1410,
  },
  {
    id: "prompt_agile_linear",
    slug: "agile-sprint-okr-linear",
    title: "Linear 极简冲刺 · 敏捷研发周报与 OKR 复盘",
    englishTitle: "Linear Agile Sprint & OKR",
    summary:
      "汲取 Linear / Raycast 现代暗色工具美学：深邃曜石石墨底配电光紫蓝与敏捷青高亮，极速呈现迭代燃尽、OKR 达成度与跨端研发交付节奏。",
    scenario: "项目汇报",
    styleCategory: "科技未来",
    colorFamily: "dark",
    recommendedTools: ["claude-html", "slidev-marp", "gamma-kimi"],
    tags: ["敏捷迭代", "OKR 复盘", "研发周报", "Linear 风", "暗黑极简"],
    visualSpec: {
      palette: {
        bg: "#0D0E12",
        surface: "#15171E",
        text: "#F3F4F6",
        muted: "#94A3B8",
        accent: "#6366F1",
        accentSoft: "rgba(99, 102, 241, 0.18)",
        border: "#262938",
        chartColors: ["#6366F1", "#22D3EE", "#10B981", "#64748B"],
      },
      typography: {
        mood: "tech",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "Inter / JetBrains Mono",
        titleWeight: 700,
        titleTracking: "-0.03em",
      },
      layout: {
        archetype: "keynote-center",
        density: "balanced",
        cornerRadius: 10,
        showPageNumber: true,
        decorativeMotif: "spotlight-orb",
      },
    },
    promptAnatomy: {
      style:
        "现代 SaaS 研发工具暗夜极简美学（Linear / Vercel Craft）：细腻发丝微边框 + 克制聚光氛围，零杂乱图标，极度契合互联网产研双周 Review 与季度 OKR 复盘。",
      palette:
        "深邃曜石石墨底（#0D0E12）与微亮卡片（#15171E），电光靛紫（#6366F1）与敏捷青（#22D3EE）标识 KR 进度条与关键交付里程碑。",
      typography:
        "紧致负字距现代黑体大标题 + 等宽版本号与进度百分比（如 `KR1 · 88%` / `v2.14 SHIPPED`），读起来如产品 Changelog 般爽快。",
      layout:
        "聚焦「Sprint Shipped 交付亮点 → OKR 量化进度看板 → 线上稳定性与缺陷复盘 → 下周期优先级排期」。",
      content:
        "拒绝流水账式工时罗列，每条迭代事项均关联用户价值指标或系统性能收益。",
    },
    customNotes:
      "技术团队双周 Demo Day、季度 OKR 复盘与独立开发者/SaaS 产品迭代简报最爱。",
    sampleTopic: "Q3 产研敏捷冲刺与核心 OKR 达成复盘（Sprint 18）",
    sampleSubtitle: "14 项核心能力按期上线 · 线上 P0 故障归零与编译提速 2.6×",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 382,
    savesCount: 344,
    copiesCount: 1120,
  },
  {
    id: "prompt_esg_lean",
    slug: "esg-green-lean-quality",
    title: "森呼吸双碳 · ESG 可持续与精益制造质控",
    englishTitle: "ESG & Lean Sustainability",
    summary:
      "面向 ESG 年度可持续发展报告、新能源双碳战略与精益制造品控汇报：生态雾绿白纸底配松石深绿与可再生暖柠，传递可信、绿色与高标准治理形象。",
    scenario: "项目汇报",
    styleCategory: "极简主义",
    colorFamily: "earth",
    recommendedTools: ["claude-html", "gamma-kimi", "python-pptx", "notebooklm"],
    tags: ["ESG 报告", "双碳新能源", "精益制造", "绿色可持续", "品质管理"],
    visualSpec: {
      palette: {
        bg: "#F3F8F5",
        surface: "#FFFFFF",
        text: "#14291E",
        muted: "#4F6B5D",
        accent: "#166534",
        accentSoft: "#DCFCE7",
        border: "#CFE0D6",
        chartColors: ["#166534", "#65A30D", "#0F766E", "#86A896"],
      },
      typography: {
        mood: "swiss",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 700,
        titleTracking: "-0.02em",
      },
      layout: {
        archetype: "clinical-clean",
        density: "balanced",
        cornerRadius: 8,
        showPageNumber: true,
        decorativeMotif: "ribbon-accent",
      },
    },
    promptAnatomy: {
      style:
        "北欧可持续报告与现代精益管理美学（Clean ESG & Lean Operations）：洁净自然、数据透明，将环境减碳、社会责任与供应链治理指标以清爽图表有序展开。",
      palette:
        "生态雾绿浅底（#F3F8F5）配纯白数据卡，松石森林绿（#166534）锚定主视觉，可再生暖柠绿（#65A30D）与深青（#0F766E）区分绿电占比与良率趋势。",
      typography:
        "国际机构年报级干净字体层级，碳排放强度（tCO2e）、良率与能耗同比数据采用大字号等宽指标卡突出呈现。",
      layout:
        "顶部绿色三色渐变细饰带贯穿，擅长展示碳中和路线图（2026–2035）、精益改善前后对比与 E/S/G 三支柱量化看板。",
      content:
        "适合上市公司 ESG 报告、新能源/光伏/锂电产业方案、工厂精益六西格玛改善与环保公益汇报。",
    },
    customNotes:
      "新能源企业、制造业精益改善（QCC/6σ）与上市公司 ESG 披露的优雅替代方案。",
    sampleTopic: "2026 零碳工厂精益跃升与 ESG 可持续发展年报",
    sampleSubtitle: "单位产值碳排放同比下降 31.4% · 绿电使用比例突破 78%",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 315,
    savesCount: 282,
    copiesCount: 840,
  },

  /* ==================== v5 新增：生活与个人表达全场景（5 套） ==================== */
  {
    id: "prompt_kodak_travel",
    slug: "kodak-analog-travelogue",
    title: "柯达胶片手账 · 旅行游记与城市漫步",
    englishTitle: "Kodak Analog Travelogue",
    summary:
      "致敬 35mm 胶片与拍立得旅行手账的温暖纪实风：右侧胶片齿孔装饰、暖阳米纸底配柯达琥珀橘时间戳，让每一段旅途攻略、城市漫步与年度相册都像独立画册。",
    scenario: "生活纪实",
    styleCategory: "胶片手账",
    colorFamily: "warm",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi"],
    tags: ["旅行游记", "胶片手账", "拍立得", "出行攻略", "生活记录"],
    visualSpec: {
      palette: {
        bg: "#FBF6EE",
        surface: "#FFFFFF",
        text: "#2C221E",
        muted: "#7A6A60",
        accent: "#D97706",
        accentSoft: "#FEF3C7",
        border: "#E6DAC8",
        chartColors: ["#D97706", "#B45309", "#2F6F64", "#A89885"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Bold",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Regular",
        titleWeight: 600,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "polaroid-zine",
        density: "airy",
        cornerRadius: 6,
        showPageNumber: true,
        decorativeMotif: "film-sprocket",
      },
    },
    promptAnatomy: {
      style:
        "35mm 胶片摄影画报与拍立得手账美学（Analog Film Zine）：保留暖阳纸张颗粒呼吸感与拍立得留白边框，将风景图文、路线打卡点与旅途心情娓娓道来。",
      palette:
        "暖阳胶片米底（#FBF6EE）配洁白拍立得相纸框，焦糖暗房棕正文（#2C221E）柔和耐看，柯达琥珀橘（#D97706）点亮经纬度、天数与推荐星标。",
      typography:
        "文艺杂志感衬线主标题搭配等宽胶片印记（`ISO 400 · DAY 03 · 64°N`），图文主次分明，克制短句更具电影感。",
      layout:
        "右侧胶片齿孔饰边 + 拍立得大比例图文分栏 + 每日行程时间轴（Timeline）+ 预算/装备极简清单，零职场生硬感。",
      content:
        "极适合旅行分享会、蜜月/毕业旅行纪念册、Citywalk 美食攻略、留学生活记录与摄影作品集。",
    },
    customNotes:
      "在工坊上传旅途实拍照片到「图文分栏页」，一键导出离线 HTML 发给朋友像翻看电子画册！",
    sampleTopic: "冰岛环岛 10 日 · 追逐极光与黑沙滩的 35mm 手账",
    sampleSubtitle: "1 号公路自驾 2,400 公里 · 每日路线、胶片机位与实用开销全记录",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 406,
    savesCount: 378,
    copiesCount: 1160,
  },
  {
    id: "prompt_sage_wedding",
    slug: "champagne-sage-wedding",
    title: "香槟鼠尾草 · 婚礼誓言与家庭纪念庆典",
    englishTitle: "Champagne Sage Celebration",
    summary:
      "如高端庄园婚礼请柬般温柔典雅：丝绸奶油白底板融合低饱和鼠尾草绿与香槟暖金，配纤细画册外框与诗意衬线体，定格婚礼、纪念日与家庭重要时刻。",
    scenario: "生活纪实",
    styleCategory: "编辑部杂志",
    colorFamily: "warm",
    recommendedTools: ["claude-html", "ai-image", "gamma-kimi"],
    tags: ["婚礼暖场", "恋爱纪念", "家庭相册", "鼠尾草绿", "仪式感"],
    visualSpec: {
      palette: {
        bg: "#FDFAF6",
        surface: "#FFFFFF",
        text: "#2B302A",
        muted: "#727A70",
        accent: "#5F7A61",
        accentSoft: "#ECF2EC",
        border: "#E5DFD3",
        chartColors: ["#5F7A61", "#C59B6D", "#A3B18A", "#D8CFC2"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Regular",
        bodyFontLabel: "Plus Jakarta Sans / 苹方 Light",
        titleWeight: 400,
        titleTracking: "0.02em",
      },
      layout: {
        archetype: "luxury-minimal",
        density: "airy",
        cornerRadius: 4,
        showPageNumber: false,
        decorativeMotif: "editorial-drop",
      },
    },
    promptAnatomy: {
      style:
        "森系庄园婚礼与高端纪念册美学（Botanical Champagne Celebration）：拒绝土味红金大字，以温柔丝绸白、鼠尾草绿与香槟暖金谱写浪漫松弛的纪念影像。",
      palette:
        "丝绸奶油白底（#FDFAF6），橄榄深炭正文（#2B302A），低饱和鼠尾草绿（#5F7A61）与香槟暖金（#C59B6D）勾勒细框线与纪念年份。",
      typography:
        "极富呼吸感的纤细衬线主标题（字重 400）+ 宽字距英文寄语（OUR STORY / FOREVER），每页仅留 1–2 句走心短句。",
      layout:
        "宽阔画廊留白 + 精细外框装饰，隐藏冰冷页码，强化恋爱/成长时间轴、图文合影页与深情致谢金句页。",
      content:
        "适用于婚礼现场暖场循环播放、结婚周年纪念、宝宝周岁成长礼、父母金婚庆典与挚友生日祝福。",
    },
    customNotes:
      "婚礼大屏循环播放或导出离线 HTML 永久珍藏，完全无外部依赖不会断网裂图。",
    sampleTopic: "林深见鹿 · 我们的第 1,825 天与婚礼故事",
    sampleSubtitle: "2021.05 — 2026.05 · 从初遇校园到携手步入新旅程",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 362,
    savesCount: 340,
    copiesCount: 980,
  },
  {
    id: "prompt_indie_bookstore",
    slug: "indie-bookstore-literary",
    title: "独立书店沙龙 · 读书拆书与观影播客",
    englishTitle: "Indie Bookstore Literary Salon",
    summary:
      "复刻先锋书店与文艺播客刊物的纸本气质：再生书页米底、钢笔墨绿大标题配藏书票赭红点缀，把读书笔记、拆书框架与观影拉片讲出人文深度。",
    scenario: "文化创意",
    styleCategory: "编辑部杂志",
    colorFamily: "earth",
    recommendedTools: ["claude-html", "notebooklm", "gamma-kimi", "ai-image"],
    tags: ["读书分享", "拆书笔记", "观影沙龙", "播客讲稿", "书店纸感"],
    visualSpec: {
      palette: {
        bg: "#F3EFE6",
        surface: "#FAF8F2",
        text: "#1B3B36",
        muted: "#5F6F6A",
        accent: "#B54834",
        accentSoft: "#F6E7E3",
        border: "#D8D0C0",
        chartColors: ["#B54834", "#1B3B36", "#8C704C", "#A39B8B"],
      },
      typography: {
        mood: "editorial",
        headingFontLabel: "Instrument Serif / 思源宋体 Bold",
        bodyFontLabel: "思源黑体 / 苹方 Regular",
        titleWeight: 600,
        titleTracking: "-0.01em",
      },
      layout: {
        archetype: "editorial-asymmetric",
        density: "airy",
        cornerRadius: 3,
        showPageNumber: true,
        decorativeMotif: "ink-wash",
      },
    },
    promptAnatomy: {
      style:
        "独立书店与文化沙龙纸本刊物美学（Independent Literary Zine）：不对称杂志排版配合淡淡东方远山肌理，如一本可翻页的精装书评季刊。",
      palette:
        "再生书页暖米底（#F3EFE6），古典钢笔墨绿主文字（#1B3B36），藏书票赭红（#B54834）用于高亮金句摘录、书名号与思辨批注。",
      typography:
        "大号衬线体标题与克制正文形成强烈纸媒层次感，原著摘录以大引号金句页居中呈现，沉浸感拉满。",
      layout:
        "天然适配「作者与时代背景 → 全书三层逻辑拆解 → 精彩原文摘录与思辨对照 → 延伸书单与沙龙开放讨论题」结构。",
      content:
        "面向读书会领读、视频号/B站深度拆书科普、电影拉片沙龙、播客线下分享与个人年度阅读书单。",
    },
    customNotes:
      "配合 NotebookLM 导入整本电子书或长篇影评，快速产出极具格调的领读课件。",
    sampleTopic: "《置身事内》深度拆书 · 理解中国经济发展的微观机制",
    sampleSubtitle: "周末独立书店共读沙龙 · 财政逻辑、产业转型与普通人的时代坐标",
    authorId: "user_studio_official",
    isOfficial: true,
    likesCount: 351,
    savesCount: 319,
    copiesCount: 940,
  },
  {
    id: "prompt_morandi_portfolio",
    slug: "morandi-creator-portfolio",
    title: "莫兰迪作品集 · 求职面试与保研个人展映",
    englishTitle: "Creator Portfolio Showcase",
    summary:
      "专为设计师、产品经理、保研学子与创意人打造的个人介绍与作品集母版：画廊石灰白底、炭黑硬朗网格配克莱因电蓝，3 分钟让面试官记住你的代表作与思考力。",
    scenario: "个人述职",
    styleCategory: "极简主义",
    colorFamily: "light",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image"],
    tags: ["求职作品集", "自我介绍", "保研面试", "克莱因蓝", "个人品牌"],
    visualSpec: {
      palette: {
        bg: "#F2F1ED",
        surface: "#FFFFFF",
        text: "#18181B",
        muted: "#62626A",
        accent: "#1D4ED8",
        accentSoft: "#DBEAFE",
        border: "#27272A",
        chartColors: ["#1D4ED8", "#18181B", "#EA580C", "#71717A"],
      },
      typography: {
        mood: "swiss",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 ExtraBold",
        bodyFontLabel: "Inter / 苹方 Regular",
        titleWeight: 800,
        titleTracking: "-0.03em",
      },
      layout: {
        archetype: "swiss-grid",
        density: "airy",
        cornerRadius: 2,
        showPageNumber: true,
        decorativeMotif: "hard-offset",
      },
    },
    promptAnatomy: {
      style:
        "当代画廊策展式个人作品集美学（Curated Creator Portfolio）：干净石灰白底衬托高反差炭黑网格与克莱因电蓝点缀，作品大图为主角、文字极度克制有力。",
      palette:
        "画廊灰白底（#F2F1ED）、纯白展示框、锐利炭黑（#18181B）硬边框，唯一饱和亮色克莱因电蓝（#1D4ED8）标记个人标签与核心项目成果。",
      typography:
        "巨型瑞士编号（`01` / `02` / `03`）串联代表项目，自我介绍用 3 个高辨识度关键词锚定个人定位，绝不照念 Word 简历。",
      layout:
        "经典面试黄金结构：个人名片与核心标签 → 3 个代表项目「背景-思路-最终作品-数据影响」图文分栏 → 技能矩阵 → 致谢与联系方式。",
      content:
        "适用于求职面试自我介绍、设计师/PM 作品集、高校保研夏令营个人陈述与自由职业者接单名片。",
    },
    customNotes:
      "上传你的界面截图或科研成果图到图文分栏页，立刻变身媲美一线设计工作室的作品集。",
    sampleTopic: "个人作品集与求职陈述 · 用系统设计驱动增长",
    sampleSubtitle: "3 年全链路产品设计实战 · 覆盖 AI 工具、设计系统与 B 端效率平台",
    authorId: "user_curator_chen",
    isOfficial: true,
    likesCount: 394,
    savesCount: 368,
    copiesCount: 1190,
  },
  {
    id: "prompt_avocado_lifestyle",
    slug: "avocado-organic-lifestyle",
    title: "牛油果森系生活 · 社团招新 / 美食 / 健康打卡",
    englishTitle: "Organic Avocado Lifestyle",
    summary:
      "充满生命力的清爽日常表达母版：晨露奶油底板搭配牛油果自然绿与暖杏阳光橘，大圆角轻盈模块化卡片，让大学社团招新、露营活动、美食探店与运动复盘焕发松弛活力。",
    scenario: "生活纪实",
    styleCategory: "现代Bento",
    colorFamily: "earth",
    recommendedTools: ["claude-html", "gamma-kimi", "ai-image"],
    tags: ["社团招新", "户外露营", "美食健康", "牛油果绿", "日常分享"],
    visualSpec: {
      palette: {
        bg: "#F7F9F3",
        surface: "#FFFFFF",
        text: "#1E2A1A",
        muted: "#5C6D56",
        accent: "#4D7C0F",
        accentSoft: "#ECFCCB",
        border: "#DAE4CE",
        chartColors: ["#4D7C0F", "#EA580C", "#0D9488", "#A3B18A"],
      },
      typography: {
        mood: "humanist",
        headingFontLabel: "Plus Jakarta Sans / 思源黑体 Bold",
        bodyFontLabel: "苹方 / 思源黑体 Regular",
        titleWeight: 700,
        titleTracking: "-0.015em",
      },
      layout: {
        archetype: "soft-bento",
        density: "balanced",
        cornerRadius: 16,
        showPageNumber: true,
        decorativeMotif: "bento-dots",
      },
    },
    promptAnatomy: {
      style:
        "清新自然生活方式 Bento 美学（Organic Lifestyle Bento）：灵感来自精品咖啡馆菜单与户外生活志，圆润舒展、元气满满，零商务压迫感。",
      palette:
        "晨露奶油绿底（#F7F9F3）配纯白圆角卡，牛油果自然绿（#4D7C0F）为主基调，暖杏阳光橘（#EA580C）点亮活动亮点与报名号召。",
      typography:
        "轻快易读的现代圆润黑体标题搭配趣味短标签与 Emoji 节奏，适合线上社群共创和校园大屏展示。",
      layout:
        "16px 柔和圆角卡片网格，轻松驾驭活动日程排期、成员介绍墙（Team Grid）、食谱/装备对比与年度运动习惯打卡总结。",
      content:
        "覆盖高校社团百团大战招新、周末徒步露营策划、咖啡美食探店分享、健身饮食年度复盘及兴趣社群沙龙。",
    },
    customNotes:
      "生活不止 KPI！用这套清爽元气模板做社团招新、露营路书或年度健康总结，氛围瞬间拉满。",
    sampleTopic: "山野计划 2026 · 城市轻户外徒步社团秋季招新",
    sampleSubtitle: "12 条精选周末秘境路线 · 零基础装备清单与安全领队体系",
    authorId: "user_demo",
    isOfficial: true,
    likesCount: 332,
    savesCount: 298,
    copiesCount: 890,
  },
];

export interface SeedComment {
  id: string;
  promptId: string;
  authorId: string;
  testedTool: TargetTool;
  rating: number;
  content: string;
}

export const SEED_COMMENTS: SeedComment[] = [
  {
    id: "cmt_seed_1",
    promptId: "prompt_swiss_grid",
    authorId: "user_curator_chen",
    testedTool: "claude-html",
    rating: 5,
    content:
      "直接复制 HTML 交互提示词丢给 Claude，一次直出 12 页带键盘翻页的瑞士网格幻灯片，朱红强调色和左侧大数字章节号还原度太稳了！",
  },
  {
    id: "cmt_seed_2",
    promptId: "prompt_swiss_grid",
    authorId: "user_demo",
    testedTool: "ai-image",
    rating: 5,
    content:
      "用即梦跑整页生图模式，加上了负面提示词去掉电脑边框，出来的扁平排版图质感像瑞士设计展海报一样干净。",
  },
  {
    id: "cmt_seed_3",
    promptId: "prompt_mckinsey_exec",
    authorId: "user_studio_official",
    testedTool: "gamma-kimi",
    rating: 5,
    content:
      "向业务副总裁做季度经营复盘用了这套 Action Title 提示词，生成的每页顶部都有明确结论句，省了至少半天改逻辑的时间。",
  },
  {
    id: "cmt_seed_4",
    promptId: "prompt_keynote_obsidian",
    authorId: "user_demo",
    testedTool: "claude-html",
    rating: 5,
    content:
      "线下 300 人沙龙投 LED 大屏实测非常震撼，黑曜石底色配冰川青超大数字完全没有廉价渐变感。",
  },
  {
    id: "cmt_seed_5",
    promptId: "prompt_soft_bento",
    authorId: "user_curator_chen",
    testedTool: "claude-html",
    rating: 5,
    content:
      "产品月度迭代一图流和晋升述职神器，18px 圆角白卡片把零散功能点收拢得清清楚楚。",
  },
];

