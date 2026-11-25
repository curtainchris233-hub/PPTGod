"""Frozen specification constants and pure payload factories for PPTGod v2 E2E tests.

All values in this module are derived strictly from authoritative contracts
(PROJECT.md, TEST_INFRA.md, seedData specification, and domain type enums).
Importing this module performs zero I/O and has zero side effects.
"""

from __future__ import annotations

import copy
import uuid
from dataclasses import dataclass
from typing import Any

# ---------------------------------------------------------------------------
# Runtime Defaults & Storage/Cookie Tokens
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "http://localhost:3000"
DEFAULT_TIMEOUT_MS = 15000
PLAYWRIGHT_BROWSERS_DEFAULT = "/opt/ms-playwright"
SQLITE3_FALLBACK_BIN = "/opt/android-sdk/platform-tools/sqlite3"

SESSION_COOKIE_NAME = "pptgod_session"
COMPARE_STORAGE_KEY = "pptgod_compare_ids_v1"
GUEST_FAVS_STORAGE_KEY = "pptgod_guest_favs_v1"

DESKTOP_VIEWPORT: tuple[int, int] = (1440, 900)
MOBILE_VIEWPORT: tuple[int, int] = (390, 844)

PPTX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)

# ---------------------------------------------------------------------------
# Seeded Accounts (Read-Only Credentials — NEVER Delete)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SeedAccount:
    id: str
    username: str
    email: str
    password: str
    display_name: str
    bio: str
    avatar_color: str
    seeded_prompt_count: int
    baseline_likes: int
    baseline_saves: int
    baseline_copies: int


ACCOUNT_OFFICIAL = SeedAccount(
    id="user_studio_official",
    username="pptgod_lab",
    email="studio@pptgod.studio",
    password="PPTGodOfficial#2026",
    display_name="PPTGod 视觉实验室",
    bio="专注演示文稿设计系统与跨工具提示词工程研究",
    avatar_color="#C84B31",
    seeded_prompt_count=15,
    baseline_likes=6416,
    baseline_saves=5592,
    baseline_copies=19940,
)

ACCOUNT_DEMO = SeedAccount(
    id="user_demo",
    username="demo_designer",
    email="demo@pptgod.studio",
    password="demo1234",
    display_name="林屿 · 演示设计师",
    bio="探索结构化叙事与高信息密度幻灯片美学（体验演示账号）",
    avatar_color="#0F766E",
    seeded_prompt_count=12,
    baseline_likes=4278,
    baseline_saves=3693,
    baseline_copies=11970,
)

ACCOUNT_CHEN = SeedAccount(
    id="user_curator_chen",
    username="chen_strategy",
    email="chen@pptgod.studio",
    password="ChenStrategy#2026",
    display_name="陈默 · 战略咨询",
    bio="10 年管理咨询与商业计划书视觉架构师",
    avatar_color="#1D4ED8",
    seeded_prompt_count=9,
    baseline_likes=3764,
    baseline_saves=3394,
    baseline_copies=12050,
)

SEED_ACCOUNTS: tuple[SeedAccount, ...] = (
    ACCOUNT_OFFICIAL,
    ACCOUNT_DEMO,
    ACCOUNT_CHEN,
)

# ---------------------------------------------------------------------------
# 36 Official Seeded Public Styles & Baseline Filter Counts (PPTGod v5)
# ---------------------------------------------------------------------------

OFFICIAL_STYLES: tuple[tuple[str, str], ...] = (
    # Core Business, Tech, Design & Editorial (18 original)
    ("prompt_swiss_grid", "swiss-international-grid"),
    ("prompt_mckinsey_exec", "mckinsey-executive-insight"),
    ("prompt_keynote_obsidian", "keynote-obsidian-stage"),
    ("prompt_editorial_magazine", "editorial-magazine-print"),
    ("prompt_neo_chinese", "neo-chinese-song-aesthetics"),
    ("prompt_bauhaus_construct", "bauhaus-primary-construct"),
    ("prompt_academic_latex", "academic-symposium-latex"),
    ("prompt_warm_humanist", "warm-earth-humanist"),
    ("prompt_tech_blueprint", "engineering-blueprint-mono"),
    ("prompt_neo_brutalist", "neo-brutalist-pitch-poster"),
    ("prompt_nordic_luxury", "nordic-quiet-luxury"),
    ("prompt_executive_emerald", "private-equity-emerald"),
    ("prompt_soft_bento", "apple-soft-bento-modular"),
    ("prompt_financial_terminal", "wallstreet-bloomberg-terminal"),
    ("prompt_clinical_biotech", "clinical-biotech-clarity"),
    ("prompt_pedagogy_course", "structured-pedagogy-course"),
    ("prompt_industrial_cyber", "industrial-cybernetics-orange"),
    ("prompt_parisian_couture", "parisian-couture-lookbook"),
    # v5 Full-Domain Expansion: Teaching (4), Research (4), Workplace/Civic (5), Lifestyle (5)
    ("prompt_chalkboard_lesson", "chalkboard-classic-lesson"),
    ("prompt_k12_storybook", "k12-pastel-storybook"),
    ("prompt_steam_gridbook", "steam-inquiry-gridbook"),
    ("prompt_open_class_cyan", "open-class-competition-cyan"),
    ("prompt_nsfc_grant", "nsfc-grant-defense-bluered"),
    ("prompt_nature_okabe", "nature-okabe-ito-evidence"),
    ("prompt_journal_club", "journal-club-paper-reading"),
    ("prompt_humanities_archive", "humanities-archival-seminar"),
    ("prompt_pmo_rag", "pmo-rag-milestone-board"),
    ("prompt_civic_redgold", "civic-party-red-gold"),
    ("prompt_agile_linear", "agile-sprint-okr-linear"),
    ("prompt_esg_lean", "esg-green-lean-quality"),
    ("prompt_star_promotion", "star-career-promotion-pitch"),
    ("prompt_kodak_travel", "kodak-analog-travelogue"),
    ("prompt_sage_wedding", "champagne-sage-wedding"),
    ("prompt_indie_bookstore", "indie-bookstore-literary"),
    ("prompt_avocado_lifestyle", "avocado-organic-lifestyle"),
    ("prompt_morandi_portfolio", "morandi-creator-portfolio"),
)

OFFICIAL_STYLE_IDS: tuple[str, ...] = tuple(item[0] for item in OFFICIAL_STYLES)
OFFICIAL_STYLE_SLUGS: tuple[str, ...] = tuple(item[1] for item in OFFICIAL_STYLES)
OFFICIAL_SLUG_BY_ID: dict[str, str] = dict(OFFICIAL_STYLES)
OFFICIAL_ID_BY_SLUG: dict[str, str] = {slug: pid for pid, slug in OFFICIAL_STYLES}

BASELINE_TOOL_COUNTS: dict[str, int] = {
    "claude-html": 36,
    "gamma-kimi": 33,
    "ai-image": 22,
    "notebooklm": 18,
    "slidev-marp": 9,
    "python-pptx": 9,
}

BASELINE_SCENARIO_COUNTS: dict[str, int] = {
    "产品发布": 3,
    "咨询汇报": 2,
    "品牌提案": 4,
    "文化创意": 2,
    "学术答辩": 4,
    "科研基金": 2,
    "年度总结": 1,
    "技术分享": 2,
    "商业路演": 2,
    "教育培训": 2,
    "课堂教学": 3,
    "项目汇报": 3,
    "政务党建": 1,
    "个人述职": 2,
    "生活纪实": 3,
}

BASELINE_STYLE_COUNTS: dict[str, int] = {
    "极简主义": 4,
    "商务咨询": 5,
    "科技未来": 5,
    "编辑部杂志": 4,
    "新中式美学": 2,
    "包豪斯几何": 1,
    "学术期刊": 5,
    "暖调人文": 3,
    "野兽派海报": 1,
    "现代Bento": 3,
    "课堂板书": 1,
    "政务红金": 1,
    "胶片手账": 1,
}

BASELINE_COLOR_COUNTS: dict[str, int] = {
    "light": 14,
    "dark": 6,
    "warm": 8,
    "vivid": 3,
    "earth": 5,
}

# 5 Seeded Comments
SEED_COMMENTS: tuple[dict[str, Any], ...] = (
    {
        "id": "cmt_seed_1",
        "promptId": "prompt_swiss_grid",
        "authorId": "user_curator_chen",
        "testedTool": "claude-html",
        "rating": 5,
    },
    {
        "id": "cmt_seed_2",
        "promptId": "prompt_swiss_grid",
        "authorId": "user_demo",
        "testedTool": "ai-image",
        "rating": 5,
    },
    {
        "id": "cmt_seed_3",
        "promptId": "prompt_mckinsey_exec",
        "authorId": "user_studio_official",
        "testedTool": "gamma-kimi",
        "rating": 5,
    },
    {
        "id": "cmt_seed_4",
        "promptId": "prompt_keynote_obsidian",
        "authorId": "user_demo",
        "testedTool": "claude-html",
        "rating": 5,
    },
    {
        "id": "cmt_seed_5",
        "promptId": "prompt_soft_bento",
        "authorId": "user_curator_chen",
        "testedTool": "claude-html",
        "rating": 5,
    },
)

# ---------------------------------------------------------------------------
# Domain Enums & Tool Metadata Markers
# ---------------------------------------------------------------------------

SLIDE_TYPES: tuple[str, ...] = (
    "cover",
    "agenda",
    "process",
    "data",
    "comparison",
    "timeline",
    "quote",
    "closing",
)

SLIDE_TYPE_LABELS: dict[str, dict[str, str]] = {
    "cover": {"zh": "封面页", "en": "Cover", "pattern": r"封面|Cover"},
    "agenda": {"zh": "目录页", "en": "Agenda", "pattern": r"目录|Agenda"},
    "process": {"zh": "架构页", "en": "Architecture", "pattern": r"架构|方法|Architecture|Process"},
    "data": {"zh": "数据页", "en": "Insight", "pattern": r"数据|Insight|Data"},
    "comparison": {"zh": "对比页", "en": "Matrix", "pattern": r"对比|Matrix|Comparison"},
    "timeline": {"zh": "路线图", "en": "Roadmap", "pattern": r"路线图|时间轴|Roadmap|Timeline"},
    "quote": {"zh": "金句页", "en": "Spotlight", "pattern": r"金句|观点|Spotlight|Quote"},
    "closing": {"zh": "结尾页", "en": "Closing", "pattern": r"结尾|致谢|Closing"},
}

CARD_SLIDE_TYPES: tuple[str, ...] = (
    "cover",
    "agenda",
    "process",
    "data",
    "comparison",
)

TARGET_TOOLS: tuple[str, ...] = (
    "claude-html",
    "gamma-kimi",
    "notebooklm",
    "ai-image",
    "slidev-marp",
    "python-pptx",
)

TOOL_MARKERS: dict[str, dict[str, Any]] = {
    "claude-html": {
        "label_pattern": r"HTML.*PPT|Claude",
        "required_tokens": (":root", "--slide-bg"),
        "launch_domains": ("claude.ai", "chatgpt.com", "deepseek.com"),
    },
    "gamma-kimi": {
        "label_pattern": r"Gamma|Kimi",
        "required_tokens": ("Gamma",),
        "launch_domains": ("kimi", "gamma.app"),
    },
    "notebooklm": {
        "label_pattern": r"NotebookLM",
        "required_tokens": ("NotebookLM",),
        "launch_domains": ("notebooklm.google.com",),
    },
    "ai-image": {
        "label_pattern": r"整页生图|AI\s*生图|Midjourney|即梦",
        "required_tokens": ("Midjourney", "--ar 16:9"),
        "batch_tokens": ("P01", "P06"),
        "launch_domains": ("jimeng.jianying.com", "midjourney.com"),
    },
    "slidev-marp": {
        "label_pattern": r"Slidev|Marp",
        "required_tokens": ("marp: true",),
        "launch_domains": ("claude.ai", "marp.app", "sli.dev"),
    },
    "python-pptx": {
        "label_pattern": r"Python|PPTX",
        "required_tokens": ("from pptx import Presentation", "RGBColor("),
        "launch_domains": ("chatgpt.com", "claude.ai"),
    },
}

LAYOUT_ARCHETYPES: tuple[str, ...] = (
    "swiss-grid",
    "consulting-mbb",
    "keynote-center",
    "editorial-asymmetric",
    "neo-chinese",
    "retro-bauhaus",
    "academic-paper",
    "warm-humanist",
    "tech-blueprint",
    "brutalist-poster",
    "luxury-minimal",
    "executive-emerald",
    "soft-bento",
    "financial-terminal",
    "clinical-clean",
    "chalkboard-class",
    "scientific-figure",
    "civic-redgold",
    "pmo-rag-grid",
    "polaroid-zine",
)

DECORATIVE_MOTIFS: tuple[str, ...] = (
    "hairline-rule",
    "swiss-cross",
    "spotlight-orb",
    "editorial-drop",
    "ink-wash",
    "bauhaus-geo",
    "corner-brackets",
    "hard-offset",
    "ribbon-accent",
    "bento-dots",
    "chalk-frame",
    "citation-axis",
    "redgold-ribbon",
    "status-dots",
    "film-sprocket",
    "none",
)

COLOR_FAMILIES: tuple[str, ...] = ("light", "dark", "warm", "vivid", "earth")

SCENARIOS: tuple[str, ...] = (
    "产品发布",
    "商业路演",
    "咨询汇报",
    "年度总结",
    "品牌提案",
    "学术答辩",
    "科研基金",
    "技术分享",
    "教育培训",
    "课堂教学",
    "文化创意",
    "项目汇报",
    "政务党建",
    "个人述职",
    "生活纪实",
)

ANATOMY_DIMENSIONS: tuple[str, ...] = (
    "style",
    "palette",
    "typography",
    "layout",
    "content",
)

# ---------------------------------------------------------------------------
# 3 Industry Source Material Presets (Matching deckGenerator.ts)
# ---------------------------------------------------------------------------

SOURCE_MATERIAL_PRESETS: tuple[dict[str, str], ...] = (
    {
        "id": "preset_ai_product",
        "label": "AI 企业知识库产品发布",
        "label_pattern": r"AI\s*企业知识库|企业知识库产品发布",
        "topic": "OmniMind 2.0 · 企业级多模态知识引擎",
        "subtitle": "从分散文档到毫秒级可信推理的新一代企业知识底座",
        "audience": "CIO、研发总监与数字化转型负责人",
        "scenario": "产品发布",
        "rawText": (
            "背景痛点：中大型企业平均沉淀超过 400 万份跨部门文档、飞书 Wiki 与 PDF 研报，"
            "传统关键词检索准确率不足 42%，新员工与一线销售平均每天耗费 1.8 小时寻找历史方案。\n"
            "核心产品突破：OmniMind 2.0 引入多模态版面解析、混合向量与图谱检索引擎及细粒度权限隔离，"
            "实现了表格与架构图解析准确率 98.7%、亿级片段检索 P99 延迟低至 18ms。\n"
            "「企业 AI 落地的分水岭，不在于模型参数规模，而在于私有知识被准确召回与权限治理的工程化深度。」—— 首席架构师\n"
            "实测标杆成效：在 3 家头部金融与制造客户上线 90 天后，方案编写效率提升 +146%，"
            "合规引用幻觉率压降至 0.8%，客服工单首次解决率从 64% 跃升至 95.4%。\n"
            "下阶段路线图：Q2 发布私有化国产算力一体机镜像，Q3 开放工作流 Agent SDK，Q4 覆盖 200 家行业灯塔客户。"
        ),
    },
    {
        "id": "preset_q4_strategy",
        "label": "季度经营复盘与增长战略",
        "label_pattern": r"季度经营复盘|增长战略",
        "topic": "2026 Q4 商业化经营复盘与来年生效增长策略",
        "subtitle": "聚焦大客户续费跃升与高毛利产品矩阵的结构性增长",
        "audience": "公司董事会与各事业部负责人",
        "scenario": "咨询汇报",
        "rawText": (
            "核心经营结果：2026 Q4 单季 ARR 达到 2.4 亿元，同比劲增 +82%，毛利率由去年同期的 68% 提升至 76.5%，"
            "现金流首次实现连续三个季度正向净流入。\n"
            "关键问题诊断：中小客群获客成本同比上升 28%，销售平均成交周期拉长至 45 天，"
            "定制化交付占用了 35% 研发产能，亟需以标准化行业模板取代纯人力实施。\n"
            "「增长质量的核心标尺是净留存率与交付杠杆，而非盲目堆叠低效线索。」—— 经营复盘核心共识\n"
            "新一年三大战略抓手：第一，产品化交付将 85% 常规需求封装为可配置模块，实施周期压缩至 7 天；"
            "第二，聚焦 KA 战略客户交叉增购，目标将 NRR 提升至 128%；第三，构建渠道伙伴生态贡献 40% 新增签单。"
        ),
    },
    {
        "id": "preset_academic_defense",
        "label": "人工智能学术答辩汇报",
        "label_pattern": r"人工智能学术答辩|学术答辩汇报",
        "topic": "面向超长上下文的低秩自适应稀疏注意力机制",
        "subtitle": "在不牺牲远距检索精度的前提下实现 128K 序列显存降低 82%",
        "audience": "答辩委员会专家教授与实验室同侪",
        "scenario": "学术答辩",
        "rawText": (
            "研究动机：大语言模型在处理 128K 以上长文档与代码仓库时，标准自注意力机制的二次计算复杂度与 KV-Cache 显存占用成为核心瓶颈。\n"
            "本文方法：提出 Low-Rank Adaptive Sparse Attention（LASA），结合动态语义路由门控与局部滑窗残差，"
            "在每个 Transformer 层自适应保留关键全局锚点 Token，并对其余键值投影执行低秩压缩。\n"
            "「稀疏化的本质不是粗暴丢弃历史信息，而是依据语义信息熵进行动态带宽分配。」\n"
            "实验结果：在 RULER、LongBench 与 Needle-in-a-Haystack 基准上，LASA 将 KV-Cache 显存峰值降低 82%，"
            "端到端推理吞吐量提升 +240%，长文检索准确率保持 99.4%（仅损失不足 0.3% 精度，计算量减少 71%）。\n"
            "后续展望：将进一步验证多模态视频帧长序列与 FP8 量化协同加速。"
        ),
    },
)

# ---------------------------------------------------------------------------
# 7 Application Routes & 8 Mandatory Desktop Screenshots
# ---------------------------------------------------------------------------

ALL_SEVEN_ROUTES: tuple[str, ...] = (
    "/",
    "/studio/apple-soft-bento-modular",
    "/generate",
    "/compare",
    "/create",
    "/collections",
    "/creator/pptgod_lab",
)


@dataclass(frozen=True)
class ScreenshotSpec:
    filename: str
    route: str
    description: str
    requires_auth: bool


REQUIRED_SCREENSHOTS: tuple[ScreenshotSpec, ...] = (
    ScreenshotSpec(
        filename="01_gallery_home.png",
        route="/",
        description="Gallery Home (18 styles editorial layout)",
        requires_auth=False,
    ),
    ScreenshotSpec(
        filename="02_style_matcher_modal.png",
        route="/",
        description="30-Second Smart Style Matcher Modal with Top 3 recommendations",
        requires_auth=False,
    ),
    ScreenshotSpec(
        filename="03_studio_bento.png",
        route="/studio/apple-soft-bento-modular",
        description="Prompt Studio v2 (8-slide filmstrip, 6-tool compiler, reviews)",
        requires_auth=False,
    ),
    ScreenshotSpec(
        filename="04_generate_workshop.png",
        route="/generate?style=apple-soft-bento-modular",
        description="Online PPT Generation Workshop with live 16:9 multi-slide deck",
        requires_auth=False,
    ),
    ScreenshotSpec(
        filename="05_compare_board.png",
        route="/compare",
        description="Multi-Style Side-by-Side Compare Board across 8 slide types",
        requires_auth=False,
    ),
    ScreenshotSpec(
        filename="06_create_remix.png",
        route="/create?fork=swiss-international-grid",
        description="Create / Remix Studio with provenance banner & visibility toggle",
        requires_auth=True,
    ),
    ScreenshotSpec(
        filename="07_collections_workspace.png",
        route="/collections",
        description="Personal Space 4-tab workspace (logged-in demo_designer)",
        requires_auth=True,
    ),
    ScreenshotSpec(
        filename="08_creator_profile.png",
        route="/creator/pptgod_lab",
        description="Public Creator Profile header, impact metrics & 9-style portfolio",
        requires_auth=False,
    ),
)

# ---------------------------------------------------------------------------
# Pure Payload Factory Functions
# ---------------------------------------------------------------------------

_LIGHT_VISUAL_SPEC: dict[str, Any] = {
    "palette": {
        "bg": "#F6F5F0",
        "surface": "#FFFFFF",
        "text": "#121212",
        "muted": "#5C5B57",
        "accent": "#C84B31",
        "accentSoft": "#FBE9E5",
        "border": "#D9D6CE",
        "chartColors": ["#C84B31", "#121212", "#6E6D68", "#B5B1A6"],
    },
    "typography": {
        "mood": "swiss",
        "headingFontLabel": "Helvetica Neue / 思源黑体 Bold",
        "bodyFontLabel": "Inter / 苹方 Regular",
        "titleWeight": 700,
        "titleTracking": "-0.03em",
    },
    "layout": {
        "archetype": "swiss-grid",
        "density": "balanced",
        "cornerRadius": 4,
        "showPageNumber": True,
        "decorativeMotif": "swiss-cross",
    },
}

_DARK_OBSIDIAN_VISUAL_SPEC: dict[str, Any] = {
    "palette": {
        "bg": "#090C11",
        "surface": "#121822",
        "text": "#F5F7FA",
        "muted": "#94A3B8",
        "accent": "#38BDF8",
        "accentSoft": "rgba(56, 189, 248, 0.14)",
        "border": "rgba(255, 255, 255, 0.12)",
        "chartColors": ["#38BDF8", "#F59E0B", "#94A3B8", "#334155"],
    },
    "typography": {
        "mood": "tech",
        "headingFontLabel": "SF Pro Display / 苹方 Semibold",
        "bodyFontLabel": "Inter / 思源黑体 Regular",
        "titleWeight": 600,
        "titleTracking": "-0.03em",
    },
    "layout": {
        "archetype": "keynote-center",
        "density": "airy",
        "cornerRadius": 16,
        "showPageNumber": True,
        "decorativeMotif": "spotlight-orb",
    },
}


def unique_token(prefix: str = "E2E") -> str:
    """Return a short unique identifier safe for titles, notes, and canary strings."""
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def make_valid_visual_spec(*, dark: bool = False) -> dict[str, Any]:
    """Return a deep copy of a valid VisualSpec (light Swiss or dark Obsidian RGBA)."""
    return copy.deepcopy(_DARK_OBSIDIAN_VISUAL_SPEC if dark else _LIGHT_VISUAL_SPEC)


def make_valid_prompt_payload(
    *,
    title: str | None = None,
    title_prefix: str = "[E2E]",
    is_public: bool | None = True,
    remixed_from_id: str | None = None,
    dark: bool = False,
) -> dict[str, Any]:
    """Build a schema-valid POST /api/prompts payload with an isolated unique title."""
    tok = unique_token("P")
    payload: dict[str, Any] = {
        "title": title or f"{title_prefix} 网格视觉体系 {tok}",
        "englishTitle": f"E2E Visual Grid {tok}",
        "summary": f"用于端到端自动化测试的规范视觉风格模板（编号 {tok}），具备完整五维提示词规范。",
        "scenario": "产品发布",
        "styleCategory": "极简主义",
        "colorFamily": "dark" if dark else "light",
        "recommendedTools": ["claude-html", "slidev-marp"],
        "tags": ["E2E测试", "网格系统", tok],
        "visualSpec": make_valid_visual_spec(dark=dark),
        "promptAnatomy": {
            "style": "理性克制的现代极简商业演示美学，清晰秩序与精确网格比例。",
            "palette": "高对比纸白与墨黑主色搭配朱红重点色，严格控制色相克制。",
            "typography": "厚重无衬线大标题搭配清晰正文与等宽数字编号。",
            "layout": "12 栏非对称结构网格，严格留白与锐利卡片层级。",
            "content": "结论先行标题配 3 组结构化要点或 1 组原生矢量数据图表。",
        },
        "customNotes": f"E2E synthetic record ({tok}) — removed automatically.",
        "sampleTopic": f"E2E 自动化验证主题 {tok}",
        "sampleSubtitle": "副标题测试数据",
        "remixedFromId": remixed_from_id,
    }
    if is_public is not None:
        payload["isPublic"] = is_public
    return payload


def make_valid_slides(
    count: int = 6,
    *,
    custom_title: str | None = None,
    custom_kpi: str | None = None,
    custom_notes: str | None = None,
    empty_bars: bool = False,
) -> list[dict[str, Any]]:
    """Build a realistic multi-slide list covering distinct SlideTypes."""
    cover_title = custom_title or "[E2E] 企业级演示文稿主标题"
    kpi_val = custom_kpi or "+146%"
    note_prefix = custom_notes or "这是自动化端到端测试演讲者备注内容。"

    template_slides: list[dict[str, Any]] = [
        {
            "id": "e2e_s1",
            "slideType": "cover",
            "sectionTag": "01 / COVER",
            "title": cover_title,
            "subtitle": "结构化视觉叙事与可验证导出基线",
            "speakerNotes": f"{note_prefix}（封面页开场白）",
        },
        {
            "id": "e2e_s2",
            "slideType": "agenda",
            "sectionTag": "02 / AGENDA",
            "title": "核心议程与汇报结构",
            "bullets": [
                "现状诊断与核心业务痛点拆解",
                "新一代架构方案与关键能力升级",
                "实测性能指标与客户增长收益",
                "下阶段里程碑路线图与行动清单",
            ],
            "speakerNotes": "目录页概览四个核心章节。",
        },
        {
            "id": "e2e_s3",
            "slideType": "process",
            "sectionTag": "03 / ARCHITECTURE",
            "title": "三层协同演进技术架构",
            "steps": [
                {"code": "01", "title": "多模态接入", "desc": "统一解析文档、图表与业务数据流"},
                {"code": "02", "title": "混合检索推理", "desc": "向量与知识图谱双路召回校验"},
                {"code": "03", "title": "权限安全治理", "desc": "文档级与字段级细粒度隔离审计"},
            ],
            "speakerNotes": "架构页说明三层系统分工。",
        },
        {
            "id": "e2e_s4",
            "slideType": "data",
            "sectionTag": "04 / INSIGHT",
            "title": f"核心性能指标跃升 {kpi_val}",
            "kpis": [
                {"label": "核心效能提升", "value": kpi_val, "note": "90 天实测基线"},
                {"label": "P99 响应延迟", "value": "18ms", "note": "亿级片段检索"},
                {"label": "可信准确率", "value": "99.4%", "note": "合规基准验证"},
            ],
            "bars": []
            if empty_bars
            else [
                {"label": "Q1", "v1": 45, "v2": 62},
                {"label": "Q2", "v1": 52, "v2": 78},
                {"label": "Q3", "v1": 60, "v2": 96},
                {"label": "Q4", "v1": 68, "v2": 118},
            ],
            "speakerNotes": f"数据页重点解读 {kpi_val} 的核心跃升。",
        },
        {
            "id": "e2e_s5",
            "slideType": "comparison",
            "sectionTag": "05 / MATRIX",
            "title": "传统方案与新体系核心对比",
            "leftTitle": "传统分散流程",
            "leftItems": [
                "依赖人工跨系统检索，日均耗时 1.8 小时",
                "权限边界粗放，存在敏感信息泄漏隐患",
                "排版风格碎片化，重复制作成本高",
            ],
            "rightTitle": "PPTGod 新体系",
            "rightItems": [
                "语义直出结构化方案，效率提升 +146%",
                "严格公私权限隔离与审计校验",
                "统一视觉设计规范，一键导出 .pptx/.html",
            ],
            "speakerNotes": "对比页呈现升级前后的关键收益差异。",
        },
        {
            "id": "e2e_s6",
            "slideType": "timeline",
            "sectionTag": "06 / ROADMAP",
            "title": "四季度规模化落地路线图",
            "steps": [
                {"code": "Q1", "title": "试点验证", "desc": "完成 3 家灯塔客户生产环境上线"},
                {"code": "Q2", "title": "标准封装", "desc": "推出可配置行业模板与私有镜像"},
                {"code": "Q3", "title": "生态开放", "desc": "发布 Agent SDK 与跨工具连接器"},
                {"code": "Q4", "title": "规模复制", "desc": "覆盖 200+ 企业级客户全面增长"},
            ],
            "speakerNotes": "路线图展示全年四个季度的清晰节点。",
        },
        {
            "id": "e2e_s7",
            "slideType": "quote",
            "sectionTag": "07 / SPOTLIGHT",
            "title": "核心战略洞察",
            "quote": "真正决定组织AI落地深度的，不是参数规模，而是知识治理与表达效率的工程化闭环。",
            "quoteAuthor": "首席架构师 · 战略评审委员会",
            "speakerNotes": "金句页强调战略共识。",
        },
        {
            "id": "e2e_s8",
            "slideType": "closing",
            "sectionTag": "08 / CLOSING",
            "title": "近期三项关键行动建议",
            "steps": [
                {"code": "01", "title": "启动试点", "desc": "两周内完成首轮试点上线与验收"},
                {"code": "02", "title": "沉淀规范", "desc": "建立跨团队复用设计系统手册"},
                {"code": "03", "title": "持续度量", "desc": "双周复盘核心效能与增长指标"},
            ],
            "speakerNotes": "感谢各位聆听，欢迎交流与质询。",
        },
    ]

    clamped = max(2, min(len(template_slides), count))
    if clamped == len(template_slides):
        return copy.deepcopy(template_slides)
    # Always preserve cover (first), data (index 3), and closing (last) when trimming
    if clamped == 2:
        return copy.deepcopy([template_slides[0], template_slides[3]])
    middle_needed = clamped - 2
    middle_pool = [
        template_slides[3],  # data
        template_slides[2],  # process
        template_slides[1],  # agenda
        template_slides[4],  # comparison
        template_slides[5],  # timeline
        template_slides[6],  # quote
    ]
    selected_middle = middle_pool[:middle_needed]
    # Restore natural presentation order
    order_map = {s["id"]: idx for idx, s in enumerate(template_slides)}
    selected_middle.sort(key=lambda s: order_map[s["id"]])
    return copy.deepcopy([template_slides[0], *selected_middle, template_slides[-1]])


def make_valid_deck_payload(
    *,
    title: str | None = None,
    slides: list[dict[str, Any]] | None = None,
    is_public: bool | None = None,
    deck_id: str | None = None,
    dark: bool = False,
    prompt_id: str = "prompt_soft_bento",
    prompt_slug: str = "apple-soft-bento-modular",
    prompt_title: str = "柔光圆角 Bento · 现代产品卡片",
) -> dict[str, Any]:
    """Build a schema-valid POST /api/decks payload.

    When ``is_public`` is ``None`` (the default), the key is omitted so callers
    can verify the server enforces private-by-default (S15).
    """
    tok = unique_token("D")
    deck_title = title or f"[E2E-DECK] 演示文稿 {tok}"
    payload: dict[str, Any] = {
        "title": deck_title,
        "subtitle": f"自动化测试保存文稿副标题 ({tok})",
        "audience": "研发与产品评审团队",
        "promptId": prompt_id,
        "promptSlug": prompt_slug,
        "promptTitle": prompt_title,
        "visualSpec": make_valid_visual_spec(dark=dark),
        "slides": slides if slides is not None else make_valid_slides(5, custom_title=deck_title),
    }
    if is_public is not None:
        payload["isPublic"] = is_public
    if deck_id is not None:
        payload["id"] = deck_id
    return payload
