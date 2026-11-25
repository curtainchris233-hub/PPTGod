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

