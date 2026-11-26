"""Zero-I/O specification constants, Glacier 2.0 tokens, pure payload factories,
and stdlib binary document fixture builders for the PPTGod Glacier UI 2.0 E2E suite.

All constants are derived strictly from authoritative contracts (PROJECT.md,
docs/PPTGod_Glacier_UI_2.0_Development_Spec.md, frozen API/DB baselines).
Importing this module performs zero filesystem or network I/O.
"""

from __future__ import annotations

import base64
import copy
import io
import struct
import uuid
import zipfile
import zlib
from dataclasses import dataclass
from typing import Any, Sequence
from xml.sax.saxutils import escape as xml_escape

from tests.e2e.config import SESSION_COOKIE_NAMES

# ---------------------------------------------------------------------------
# Runtime Defaults, Port Safety & Browser Storage Keys
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "http://127.0.0.1:3010"
FORBIDDEN_PORTS: tuple[int, ...] = (3000,)
DEFAULT_TIMEOUT_MS = 15000
PLAYWRIGHT_BROWSERS_DEFAULT = "/opt/ms-playwright"
SQLITE3_FALLBACK_BIN = "/opt/android-sdk/platform-tools/sqlite3"
DEFAULT_SCREENSHOTS_ARCHIVE = (
    "/home/antigravity/.gemini/jetski/brain/v1/default/"
    "jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/"
    "screenshots/glacier_v2"
)

COMPARE_STORAGE_KEY = "pptgod_compare_ids_v1"
GUEST_FAVS_STORAGE_KEY = "pptgod_guest_favs_v1"
UNSAVED_DRAFT_STORAGE_KEY = "pptgod_unsaved_draft_v4"
STUDIO_HANDOFF_STORAGE_KEY = "pptgod_studio_handoff_v4"
DOC_INTAKE_STORAGE_KEY = "pptgod_doc_intake_v1"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10,485,760 bytes
ALLOWED_UPLOAD_EXTENSIONS: tuple[str, ...] = ("pdf", "docx", "pptx", "md", "txt")

PPTX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
)

# ---------------------------------------------------------------------------
# 5 Responsive Breakpoints (Spec §9 & PROJECT.md F39)
# ---------------------------------------------------------------------------

MOBILE_390: tuple[int, int] = (390, 844)
TABLET_768: tuple[int, int] = (768, 1024)
LAPTOP_1024: tuple[int, int] = (1024, 768)
DESKTOP_1440: tuple[int, int] = (1440, 900)
WIDE_1920: tuple[int, int] = (1920, 1080)

DESKTOP_VIEWPORT: tuple[int, int] = DESKTOP_1440
MOBILE_VIEWPORT: tuple[int, int] = MOBILE_390

RWD_BREAKPOINTS: dict[str, tuple[int, int]] = {
    "mobile_390": MOBILE_390,
    "tablet_768": TABLET_768,
    "laptop_1024": LAPTOP_1024,
    "desktop_1440": DESKTOP_1440,
    "wide_1920": WIDE_1920,
}

# ---------------------------------------------------------------------------
# Glacier UI 2.0 Canonical Tokens, Performance & WCAG Thresholds
# ---------------------------------------------------------------------------

GLACIER_TOKENS: dict[str, Any] = {
    "bg_hex": "#F0F6FC",
    "bg_rgb": (240, 246, 252),
    "bg_subtle_hex": "#E7F1FB",
    "bg_subtle_rgb": (231, 241, 251),
    "surface_hex": "#FFFFFF",
    "surface_rgb": (255, 255, 255),
    "glass_rgba": "rgba(255, 255, 255, 0.78)",
    "surface_hover_hex": "#F5F9FE",
    "primary_hex": "#2563EB",
    "primary_rgb": (37, 99, 235),
    "primary_hover_hex": "#1D4ED8",
    "primary_light_hex": "#E2EDFF",
    "cyan_hex": "#38BDF8",
    "text_hex": "#14243C",
    "text_rgb": (20, 36, 60),
    "text_secondary_hex": "#52657B",
    "muted_hex": "#64748B",
    "border_hex": "#D9E5F1",
    "border_interactive_hex": "#71828D",
    "success_hex": "#15803D",
    "warning_hex": "#B45309",
    "danger_hex": "#B91C1C",
    "focus_hex": "#2563EB",
    "ease_apple": "cubic-bezier(0.22, 1, 0.36, 1)",
    "topbar_height_px": 64,
    "sidebar_width_px": 220,
    "sidebar_collapsed_px": 64,
    "max_content_width_px": 1600,
}

LEGACY_WARM_PAPER_RGB: tuple[int, int, int] = (245, 242, 235)

WEB_VITALS_THRESHOLDS: dict[str, float] = {
    "lcp_ms": 2500.0,
    "inp_ms": 200.0,
    "cls": 0.1,
}

WCAG_NORMAL_TEXT_RATIO = 4.5
WCAG_LARGE_TEXT_RATIO = 3.0
WCAG_NON_TEXT_RATIO = 3.0

# ---------------------------------------------------------------------------
# Seeded Read-Only Accounts (Exact Restore Values — NEVER Delete)
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
# 36 Official Seeded Public Styles & Exact Baseline Counts
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
    # Full-Domain Expansion: Teaching (4), Research (4), Workplace/Civic (5), Lifestyle (5)
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
TOP_POPULAR_STYLE_SLUG = "keynote-obsidian-stage"

# Exact domain counts ("个人述职" intentionally overlaps workplace & lifestyle -> sum 38)
DOMAIN_EXPECTED_COUNTS: dict[str, int] = {
    "all": 36,
    "business-tech": 11,
    "teaching": 5,
    "research": 6,
    "workplace": 9,
    "lifestyle": 7,
}

DOMAIN_TAB_LABELS: dict[str, str] = {
    "all": "全部领域",
    "business-tech": "商业与科技",
    "teaching": "教师与课堂",
    "research": "科研与学术",
    "workplace": "项目与职场",
    "lifestyle": "生活与个人",
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

BASELINE_TOOL_COUNTS: dict[str, int] = {
    "claude-html": 36,
    "gamma-kimi": 33,
    "ai-image": 22,
    "notebooklm": 18,
    "slidev-marp": 9,
    "python-pptx": 9,
}

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

DB_BASELINE_COUNTS: dict[str, int] = {
    "users": 3,
    "prompts": 36,
    "prompt_comments": 5,
    "saved_decks": 0,
    "prompt_likes": 0,
    "prompt_favorites": 0,
}

# ---------------------------------------------------------------------------
# Complete Domain Enums (Aligned with src/types/prompt.ts)
# ---------------------------------------------------------------------------

SLIDE_TYPES: tuple[str, ...] = (
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
)

SLIDE_TYPE_LABELS: dict[str, dict[str, str]] = {
    "cover": {"zh": "封面页", "en": "Cover", "pattern": r"封面|Cover"},
    "agenda": {"zh": "目录页", "en": "Agenda", "pattern": r"目录|Agenda"},
    "process": {"zh": "架构页", "en": "Architecture", "pattern": r"架构|方法|流程|Architecture|Process"},
    "image-split": {"zh": "图文页", "en": "Visual Split", "pattern": r"图文|分栏|配图|Image|Split"},
    "data": {"zh": "数据页", "en": "Insight", "pattern": r"数据|图表|Insight|Data"},
    "funnel-donut": {"zh": "漏斗环形", "en": "Funnel & Donut", "pattern": r"漏斗|环形|占比|Funnel|Donut"},
    "comparison": {"zh": "对比页", "en": "Matrix", "pattern": r"对比|Matrix|Comparison"},
    "swot": {"zh": "SWOT 矩阵", "en": "SWOT Matrix", "pattern": r"SWOT|四象限"},
    "timeline": {"zh": "路线图", "en": "Roadmap", "pattern": r"路线图|时间轴|Roadmap|Timeline"},
    "team-grid": {"zh": "团队页", "en": "Team Grid", "pattern": r"团队|成员|Team"},
    "quote": {"zh": "金句页", "en": "Spotlight", "pattern": r"金句|观点|引言|Spotlight|Quote"},
    "closing": {"zh": "结尾页", "en": "Closing", "pattern": r"结尾|总结|致谢|Closing"},
}

CARD_SLIDE_TYPES: tuple[str, ...] = (
    "cover",
    "agenda",
    "process",
    "data",
    "comparison",
)

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

TYPOGRAPHY_MOODS: tuple[str, ...] = (
    "swiss",
    "editorial",
    "consulting",
    "chinese",
    "tech",
    "academic",
    "brutalist",
    "humanist",
)

COLOR_FAMILIES: tuple[str, ...] = ("light", "dark", "warm", "vivid", "earth")

SCENARIOS: tuple[str, ...] = (
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
)

STYLE_CATEGORIES: tuple[str, ...] = (
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

MATERIAL_KINDS: tuple[str, ...] = (
    "topic-only",
    "rough-outline",
    "full-document",
    "scattered-notes",
    "existing-pptx",
    "data-table",
)

SOURCE_STATUSES: tuple[str, ...] = (
    "source-material",
    "derived-calc",
    "placeholder",
    "needs-verify",
)

EVIDENCE_DENSITIES: tuple[str, ...] = ("light", "balanced", "high-evidence")
GENERATION_ROUTE_MODES: tuple[str, ...] = ("restructure", "beautify-1to1")
POLISH_ACTIONS: tuple[str, ...] = ("executive", "metrics", "notes")
ANATOMY_DIMENSIONS: tuple[str, ...] = (
    "style",
    "palette",
    "typography",
    "layout",
    "content",
)

# ---------------------------------------------------------------------------
# Glacier UI 2.0 Routes
# ---------------------------------------------------------------------------

GLACIER_ROUTES: dict[str, str] = {
    "dashboard": "/",
    "gallery": "/gallery",
    "generate": "/generate",
    "collections": "/collections",
    "compare": "/compare",
    "studio_index": "/studio",
    "studio_bento": "/studio/apple-soft-bento-modular",
    "create": "/create",
    "tools": "/tools",
    "creator_official": "/creator/pptgod_lab",
}

CORE_RWD_ROUTES: tuple[str, ...] = (
    "/",
    "/gallery",
    "/generate",
    "/collections",
    "/compare",
    "/studio/apple-soft-bento-modular",
    "/tools",
)

ALL_STATIC_ROUTES: tuple[str, ...] = (
    "/",
    "/gallery",
    "/generate",
    "/collections",
    "/compare",
    "/studio/apple-soft-bento-modular",
    "/create",
    "/tools",
    "/creator/pptgod_lab",
)

# ---------------------------------------------------------------------------
# Honest Boundaries Anti-Fake Matrix (B1–B16, ZERO-TOLERANCE)
# ---------------------------------------------------------------------------

HONEST_BOUNDARY_FORBIDDEN_PATTERNS: dict[str, dict[str, Any]] = {
    "B1": {
        "name": "No fake PPTGod Pro billing/upsell card",
        "routes": ("/", "/gallery", "/collections", "/generate"),
        "forbidden_regexes": (
            r"PPTGod\s*Pro",
            r"立即升级",
            r"升级\s*Pro",
            r"解锁高级风格与更多额度",
            r"解锁更强大的\s*AI\s*创作能力",
        ),
    },
    "B2": {
        "name": "No fake topbar notification bell or unread dot",
        "routes": ("/", "/gallery", "/generate", "/collections"),
        "forbidden_selectors": (
            'header [aria-label*="通知" i]',
            'header [aria-label*="消息" i]',
            'header [aria-label*="notification" i]',
            'header [title*="通知" i]',
            'header [title*="消息" i]',
            'header [title*="notification" i]',
            "header .lucide-bell",
            'header [class*="lucide-bell"]',
            'header svg[data-lucide*="bell" i]',
        ),
    },
    "B3": {
        "name": "No fake sidebar feedback submission form",
        "routes": ("/", "/collections"),
        "forbidden_regexes": (r"意见反馈", r"提交反馈"),
    },
    "B4": {
        "name": "No fake collaboration / shared-with-me tabs or badges",
        "routes": ("/collections",),
        "forbidden_regexes": (r"与我共享", r"协作项目", r"协作中"),
    },
    "B5": {
        "name": "No fake trash bin (回收站)",
        "routes": ("/collections",),
        "forbidden_regexes": (r"回收站",),
    },
    "B6": {
        "name": "No fake custom project folder creation (项目分组 + / 全部分组)",
        "routes": ("/collections",),
        "forbidden_regexes": (r"项目分组", r"新建分组", r"添加分组", r"全部分组"),
    },
    "B7": {
        "name": "No hardcoded mockup stats (42/8/18/6) or fake recent projects",
        "routes": ("/", "/collections"),
        "forbidden_recent_titles": (
            "年度工作总结与规划",
            "产品发布会演示文稿",
            "AI赋能办公：工作效率升级",
        ),
        "forbidden_stat_regexes": (
            r"42\s*全部(?:项目|演示文稿)",
            r"全部(?:项目|演示文稿)[\s:：(（]*42\b",
            r"总项目数[\s:：(（]*42\b",
            r"我创建的[\s:：(（]*42\b",
            r"42\s*[\n\r]+\s*全部(?:项目|演示文稿)",
            r"全部(?:项目|演示文稿)\s*[\n\r]+\s*42\b",
        ),
    },
    "B8": {
        "name": "No image OCR claims or >10MB false promises in doc upload",
        "routes": ("/", "/generate"),
        "forbidden_regexes": (
            r"Markdown、图片等",
            r"支持[^。\n]{0,30}图片等",
            r"图片\s*OCR",
            r"12\.4\s*MB",
            r"18\.7\s*MB",
        ),
        "forbidden_dropzone_regexes": (
            r"图片",
            r"\bJPG\b",
            r"\bJPEG\b",
            r"\bPNG\b",
            r"\bOCR\b",
        ),
        "required_format_regexes": (
            r"10\s*MB",
            r"PDF",
            r"DOCX|Word",
            r"PPTX|PPT",
            r"Markdown|MD",
            r"TXT",
        ),
    },
    "B9": {
        "name": "Mandatory 示例预览 disclosure before generation",
        "routes": ("/generate", "/compare"),
        "workshop_required_regex": r"示例预览|示例文稿",
        "compare_required_regex": r"示例预览|示例文稿|示例",
        "required_regex": r"示例预览|示例文稿",
    },
    "B10": {
        "name": "No fabricated percentage progress during generation",
        "routes": ("/generate",),
        # NEVER put \b after non-word '%'
        "forbidden_progress_regex": r"(?<!\d)(?:100|[1-9]\d?)%",
    },
    "B11": {
        "name": "Honest 16:9 aspect ratio (no fake 4:3 or 9:16 options)",
        "routes": ("/generate",),
        "forbidden_options": ("4:3", "9:16", "竖屏"),
    },
    "B12": {
        "name": "No unimplemented Editor 形状/表格/动画/切换 tools or tabs",
        "routes": ("/generate",),
        "forbidden_control_labels": ("形状", "表格", "动画", "切换"),
        "forbidden_compound_regexes": (
            r"^(?:插入)?形状$",
            r"^(?:插入)?表格$",
            r"^动画(?:效果)?$",
            r"^(?:页面|幻灯片)?切换$",
        ),
    },
    "B13": {
        "name": "Editor AI Assistant wired to /api/polish with preview + confirm",
        "routes": ("/generate",),
        "required_actions": ("executive", "metrics", "notes"),
    },
    "B14": {
        "name": "No fake AI voice/WPM/pause rehearsal analysis",
        "routes": ("/", "/tools"),
        "forbidden_regexes": (
            r"AI\s*语音演练",
            r"语音评分",
            r"停顿分析",
            r"麦克风录音评分",
            r"语速与停顿",
        ),
    },
    "B15": {
        "name": "Honest language scoping across Studio vs Smart Generate",
        "routes": ("/", "/generate", "/studio/apple-soft-bento-modular"),
    },
    "B16": {
        "name": "Live 36-style SlideCanvas catalog & DB domain counts (not PNG-2 static counts)",
        "routes": ("/", "/gallery"),
        "forbidden_mockup_badges": (
            r"学术科研\s*8",
            r"商务汇报\s*6",
            r"科技创新\s*6",
            r"文创简约\s*4",
            r"创意设计\s*3",
        ),
    },
}

# ---------------------------------------------------------------------------
# 22-Shot Glacier UI 2.0 Screenshot Manifest (spec_miner_e2e_glacier §4.4.F)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ScreenshotSpec:
    index: int
    filename: str
    route: str
    viewport: tuple[int, int]
    requires_auth: bool
    state_note: str
    baseline: str


SCREENSHOT_MANIFEST: tuple[ScreenshotSpec, ...] = (
    ScreenshotSpec(1, "01_dashboard_1440.png", "/", DESKTOP_1440, False, "clean loaded Dashboard", "PNG-1"),
    ScreenshotSpec(2, "02_gallery_1440.png", "/gallery", DESKTOP_1440, False, "1st card selected w/ 2px blue border", "PNG-2"),
    ScreenshotSpec(3, "03_gallery_drawer_1440.png", "/gallery", DESKTOP_1440, False, "Style Detail Drawer open", "Gallery Drawer"),
    ScreenshotSpec(4, "04_workshop_create_1440.png", "/generate", DESKTOP_1440, False, "Workshop wizard w/ sample topic & 示例预览", "PNG-3"),
    ScreenshotSpec(5, "05_editor_workspace_1440.png", "/generate", DESKTOP_1440, False, "Editor stage w/ generated deck + notes + inspector", "PNG-4"),
    ScreenshotSpec(6, "06_editor_audit_1440.png", "/generate?panel=audit", DESKTOP_1440, False, "100-pt DeckAuditDrawer open", "Audit"),
    ScreenshotSpec(7, "07_projects_1440.png", "/collections", DESKTOP_1440, True, "logged-in w/ temporary E2E decks before cleanup", "PNG-5"),
    ScreenshotSpec(8, "08_projects_empty_1440.png", "/collections", DESKTOP_1440, True, "honest 0-deck EmptyState", "Honest EmptyState"),
    ScreenshotSpec(9, "09_compare_1440.png", "/compare", DESKTOP_1440, False, "3-col same-content synced comparison", "Compare"),
    ScreenshotSpec(10, "10_studio_1440.png", "/studio/apple-soft-bento-modular", DESKTOP_1440, False, "Prompt Studio 12-slide & 6-tool compiler", "Studio"),
    ScreenshotSpec(11, "11_rehearsal_1440.png", "/deck/{tempId}?rehearsal=1", DESKTOP_1440, True, "Rehearsal Cockpit (teleprompter + timer)", "Rehearsal"),
    ScreenshotSpec(12, "12_create_1440.png", "/create?fork=swiss-international-grid", DESKTOP_1440, True, "Style Creator / Remix", "Create"),
    ScreenshotSpec(13, "13_tools_1440.png", "/tools?tab=pacing", DESKTOP_1440, False, "Local Toolbox pacing tab", "Tools"),
    ScreenshotSpec(14, "14_creator_1440.png", "/creator/pptgod_lab", DESKTOP_1440, False, "Public Creator Profile", "Creator"),
    ScreenshotSpec(15, "15_rwd_dashboard_390.png", "/", MOBILE_390, False, "Mobile Dashboard", "RWD 390"),
    ScreenshotSpec(16, "16_rwd_dashboard_768.png", "/", TABLET_768, False, "Tablet Portrait Dashboard", "RWD 768"),
    ScreenshotSpec(17, "17_rwd_dashboard_1024.png", "/", LAPTOP_1024, False, "Small Laptop Dashboard", "RWD 1024"),
    ScreenshotSpec(18, "18_rwd_dashboard_1920.png", "/", WIDE_1920, False, "Wide Desktop Dashboard (max-width 1600px)", "RWD 1920"),
    ScreenshotSpec(19, "19_rwd_gallery_390.png", "/gallery", MOBILE_390, False, "Mobile 1-col Gallery", "RWD 390"),
    ScreenshotSpec(20, "20_rwd_gallery_1024.png", "/gallery", LAPTOP_1024, False, "3-col Gallery", "RWD 1024"),
    ScreenshotSpec(21, "21_rwd_editor_768.png", "/generate", TABLET_768, False, "Tablet Editor w/ drawerized inspector", "RWD 768"),
    ScreenshotSpec(22, "22_rwd_projects_390.png", "/collections", MOBILE_390, True, "Mobile My Projects", "RWD 390"),
)

# ---------------------------------------------------------------------------
# Industry Source Material Presets
# ---------------------------------------------------------------------------

SOURCE_MATERIAL_PRESETS: tuple[dict[str, str], ...] = (
    {
        "id": "preset_ai_product",
        "label": "AI 企业知识库产品发布",
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
        "topic": "钙钛矿太阳能电池界面结晶调控与稳定性机理研究",
        "subtitle": "通过双功能配体钝化实现 26.1% 认证效率与 1500h 湿热稳定",
        "audience": "答辩委员会专家教授与实验室同侪",
        "scenario": "学术答辩",
        "rawText": (
            "研究动机：宽带隙钙钛矿薄膜在退火结晶过程中易在晶界处形成高密度碘空位缺陷，"
            "导致非辐射复合损失加剧与湿热老化稳定性不足（T80 寿命低于 420 小时）。\n"
            "本文方法：提出双功能路易斯碱配体界面调控策略，同步锚定未配位 Pb2+ 与抑制卤素离子迁移，"
            "将薄膜平均晶粒尺寸由 380nm 提升至 1.25um，缺陷态密度降低一个数量级（p < 0.001）。\n"
            "「结晶动力学的精准控制决定了器件效率与长期服役稳定性的上限。」\n"
            "实验结果：冠军器件光电转换效率由 23.4% 跃升至 26.1%，开路电压达到 1.19V，"
            "85C/85%RH 双 85 加速老化 1500 小时后保持初始效率 94.2%。\n"
            "后续展望：将拓展至大面积狭缝涂布组件（100cm2）与钙钛矿/硅叠层器件验证。"
        ),
    },
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
        "accent": "#2563EB",
        "accentSoft": "#E2EDFF",
        "border": "#D9E5F1",
        "chartColors": ["#2563EB", "#14243C", "#38BDF8", "#64748B"],
    },
    "typography": {
        "mood": "swiss",
        "headingFontLabel": "Plus Jakarta Sans / 思源黑体 Bold",
        "bodyFontLabel": "Noto Sans SC / 苹方 Regular",
        "titleWeight": 700,
        "titleTracking": "-0.03em",
    },
    "layout": {
        "archetype": "soft-bento",
        "density": "balanced",
        "cornerRadius": 12,
        "showPageNumber": True,
        "decorativeMotif": "bento-dots",
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

# Minimal valid 1x1 red PNG (68 bytes)
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGA"
    "hKmMIQAAAABJRU5ErkJggg=="
)
TINY_PNG_DATA_URL = f"data:image/png;base64,{TINY_PNG_B64}"


def unique_token(prefix: str = "E2E") -> str:
    """Return a short unique identifier safe for titles, notes, and canaries."""
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def make_valid_visual_spec(
    *,
    dark: bool = False,
    brand_footer: str | None = None,
) -> dict[str, Any]:
    """Return a deep copy of a schema-valid VisualSpec."""
    spec = copy.deepcopy(_DARK_OBSIDIAN_VISUAL_SPEC if dark else _LIGHT_VISUAL_SPEC)
    if brand_footer is not None:
        spec["layout"]["brandFooter"] = brand_footer
    return spec


def make_valid_prompt_payload(
    *,
    title: str | None = None,
    title_prefix: str = "[E2E]",
    is_public: bool | None = True,
    remixed_from_id: str | None = None,
    dark: bool = False,
) -> dict[str, Any]:
    """Build a schema-valid POST /api/prompts payload with an isolated unique title."""
    tok = unique_token("G")
    payload: dict[str, Any] = {
        "title": title or f"{title_prefix} 冰川视觉体系 {tok}",
        "englishTitle": f"Glacier Visual Grid {tok}",
        "summary": f"用于 Glacier UI 2.0 端到端自动化验证的视觉风格模板（编号 {tok}），具备完整五维提示词规范。",
        "scenario": "产品发布",
        "styleCategory": "现代Bento",
        "colorFamily": "dark" if dark else "light",
        "recommendedTools": ["claude-html", "slidev-marp"],
        "tags": ["E2E测试", "冰川网格", tok],
        "visualSpec": make_valid_visual_spec(dark=dark),
        "promptAnatomy": {
            "style": "清透专业的冰川白玻璃与模块网格演示美学，清晰秩序与精确层次。",
            "palette": "高对比冰川白底色与深海墨主字，克制使用品牌蓝主强调色。",
            "typography": "现代无衬线大标题搭配清晰正文与等宽数字编号。",
            "layout": "12 栏模块结构网格，克制留白与明确信息层级。",
            "content": "结论先行标题配 3 组结构化要点或 1 组原生矢量数据图表。",
        },
        "customNotes": f"Glacier E2E synthetic record ({tok}) — removed automatically.",
        "sampleTopic": f"Glacier E2E 自动化验证主题 {tok}",
        "sampleSubtitle": "副标题测试数据",
        "remixedFromId": remixed_from_id,
    }
    if is_public is not None:
        payload["isPublic"] = is_public
    return payload


def make_12_slide_deck(
    *,
    custom_title: str | None = None,
    custom_kpi: str | None = None,
    custom_notes: str | None = None,
    include_image_data_url: bool = False,
    chart_mode: str = "donut",
    empty_bars: bool = False,
) -> list[dict[str, Any]]:
    """Build a complete 12-slide deck covering ALL 12 commercial SlideTypes."""
    cover_title = custom_title or "[E2E] 冰川架构全商业版式验证文稿"
    kpi_val = custom_kpi or "+146%"
    note_prefix = custom_notes or "这是 Glacier 2.0 端到端自动化演讲者备注内容。"
    image_slot: dict[str, Any] = (
        {
            "kind": "data-url",
            "dataUrl": TINY_PNG_DATA_URL,
            "caption": "实测系统架构示意配图",
        }
        if include_image_data_url
        else {
            "kind": "svg-preset",
            "presetId": "arch-blueprint",
            "caption": "系统分层矢量蓝图",
        }
    )

    return [
        {
            "id": "gl_s01",
            "slideType": "cover",
            "sectionTag": "01 / COVER",
            "title": cover_title,
            "subtitle": "结构化视觉叙事与原生可编辑导出基线",
            "sourceStatus": "source-material",
            "sourceNote": "项目立项书 p.1",
            "audienceQuestion": "本方案的核心商业与技术价值是什么？",
            "speakerNotes": f"{note_prefix}（封面页开场白）",
        },
        {
            "id": "gl_s02",
            "slideType": "agenda",
            "sectionTag": "02 / AGENDA",
            "title": "核心议程与汇报结构",
            "bullets": [
                "现状诊断与核心业务痛点拆解",
                "新一代冰川架构与关键能力升级",
                "实测性能指标与转化漏斗收益",
                "下阶段里程碑与核心执行团队",
            ],
            "sourceStatus": "source-material",
            "sourceNote": "总体规划目录",
            "speakerNotes": "目录页概览四大章节汇报节奏。",
        },
        {
            "id": "gl_s03",
            "slideType": "process",
            "sectionTag": "03 / PROCESS",
            "title": "三层协同演进技术架构",
            "steps": [
                {"code": "01", "title": "多模态解析", "desc": "支持 5 类标准文档自动分型与结构化提取"},
                {"code": "02", "title": "双核引擎推理", "desc": "内置智能算法与 BYOK 大模型双路径编排"},
                {"code": "03", "title": "原生矢量导出", "desc": "输出 SlideMaster、原生图表表格与演讲备注"},
            ],
            "sourceStatus": "source-material",
            "sourceNote": "架构设计评审 v2.0",
            "speakerNotes": "架构页阐述三层系统模块分工与边界。",
        },
        {
            "id": "gl_s04",
            "slideType": "image-split",
            "sectionTag": "04 / VISUAL SPLIT",
            "title": "冰川工作台与实时画布协同",
            "bullets": [
                "同一内容三风格并排实时预览，消除盲选返工",
                "支持单页仅换版式不动字，保留原文与来源状态",
                "内置 100 分制智能体检与演讲排练驾驶舱",
            ],
            "imageSlot": image_slot,
            "sourceStatus": "source-material",
            "sourceNote": "产品体验实测报告",
            "speakerNotes": "图文分栏页说明核心工作流协同优势。",
        },
        {
            "id": "gl_s05",
            "slideType": "data",
            "sectionTag": "05 / DATA INSIGHT",
            "title": f"核心性能指标跃升 {kpi_val}",
            "kpis": [
                {"label": "方案编写效率", "value": kpi_val, "note": "90 天客户实测"},
                {"label": "P99 响应延迟", "value": "18ms", "note": "亿级片段检索"},
                {"label": "引用可信准确率", "value": "99.4%", "note": "合规基准验证"},
            ],
            "bars": []
            if empty_bars
            else [
                {"label": "Q1", "v1": 42, "v2": 64},
                {"label": "Q2", "v1": 51, "v2": 82},
                {"label": "Q3", "v1": 60, "v2": 102},
                {"label": "Q4", "v1": 68, "v2": 124},
            ],
            "sourceStatus": "derived-calc",
            "sourceNote": "Q4 生产埋点统计",
            "speakerNotes": f"数据页重点解读 {kpi_val} 指标跃升及季度对比。",
        },
        {
            "id": "gl_s06",
            "slideType": "funnel-donut",
            "sectionTag": "06 / FUNNEL",
            "title": "客户采用转化漏斗与留存占比",
            "chartMode": chart_mode,
            "funnelStages": [
                {"label": "文档导入", "value": 100, "unit": "%", "note": "上传 PDF/DOCX/PPTX 资料"},
                {"label": "大纲确认", "value": 86, "unit": "%", "note": "调整章节与页型结构"},
                {"label": "编辑优化", "value": 74, "unit": "%", "note": "应用 AI 润色与体检修复"},
                {"label": "导出交付", "value": 68, "unit": "%", "note": "导出原生 PPTX 汇报交付"},
            ],
            "sourceStatus": "derived-calc",
            "sourceNote": "漏斗埋点报表",
            "speakerNotes": "漏斗环形页展示从资料导入到 PPTX 交付的全链路转化。",
        },
        {
            "id": "gl_s07",
            "slideType": "comparison",
            "sectionTag": "07 / COMPARISON",
            "title": "传统人工排版与冰川引擎对比",
            "leftTitle": "传统分散流程",
            "leftPoints": [
                "手动拼贴模板与图表，平均耗时 4.5 小时",
                "换风格需重做版式，文字易丢失错位",
                "缺少统一对比度与信息密度核验",
            ],
            "rightTitle": "PPTGod Glacier 2.0",
            "rightPoints": [
                "资料解析直出可编辑大纲，效率提升 +146%",
                "单页仅换版式不动字，保留来源标注",
                "原生 PPTX 图表表格与 100 分制智能体检",
            ],
            "sourceStatus": "source-material",
            "sourceNote": "效率对比基准测试",
            "speakerNotes": "对比页以原生表格结构呈现升级前后差异。",
        },
        {
            "id": "gl_s08",
            "slideType": "swot",
            "sectionTag": "08 / SWOT",
            "title": "商业化演进 SWOT 战略评估",
            "swot": {
                "strengths": ["36 套真实模板代码渲染", "零依赖原生 PPTX 导出"],
                "weaknesses": ["离线环境依赖本地字体回退", "高阶模型需用户 BYOK"],
                "opportunities": ["企业私有化知识汇报刚需", "科研与教学标准化答辩"],
                "threats": ["通用办公套件内置插件竞争", "客户合规隔离门槛提升"],
            },
            "sourceStatus": "needs-verify",
            "sourceNote": "战略评审初稿",
            "speakerNotes": "SWOT 四象限页梳理内外部优势与风险。",
        },
        {
            "id": "gl_s09",
            "slideType": "timeline",
            "sectionTag": "09 / TIMELINE",
            "title": "四季度规模化落地路线图",
            "steps": [
                {"code": "Q1", "title": "架构定型", "desc": "完成 Glacier 2.0 设计系统与核心画布升级"},
                {"code": "Q2", "title": "试点交付", "desc": "完成 3 家头部金融与高校客户上线验收"},
                {"code": "Q3", "title": "生态开放", "desc": "开放风格包标准与跨工具提示词编译"},
                {"code": "Q4", "title": "规模增长", "desc": "覆盖 200+ 行业标杆团队常态化使用"},
            ],
            "sourceStatus": "source-material",
            "sourceNote": "年度里程碑计划",
            "speakerNotes": "路线图明确四个季度的关键交付物。",
        },
        {
            "id": "gl_s10",
            "slideType": "team-grid",
            "sectionTag": "10 / TEAM",
            "title": "核心研发与设计交付团队",
            "teamMembers": [
                {"name": "林屿", "role": "设计系统负责人", "bio": "主导 Glacier 2.0 视觉规范与 36 套模板渲染引擎"},
                {"name": "陈默", "role": "战略咨询顾问", "bio": "10 年管理咨询与高管汇报结构化叙事经验"},
                {"name": "周明", "role": "导出引擎架构师", "bio": "专注 OOXML 原生图表、表格与排版保真工程"},
            ],
            "sourceStatus": "source-material",
            "sourceNote": "核心团队档案",
            "speakerNotes": "团队页介绍三位核心负责人的专业履历。",
        },
        {
            "id": "gl_s11",
            "slideType": "quote",
            "sectionTag": "11 / QUOTE",
            "title": "核心战略洞察",
            "quoteText": "真正决定企业演示效率的，不是堆砌炫目特效，而是资料到结构化叙事与原生交付的可信闭环。",
            "quoteAuthor": "首席产品架构师 · 2026 战略评审会",
            "sourceStatus": "source-material",
            "sourceNote": "架构师内部访谈纪要",
            "speakerNotes": "金句页强调真实能力与可信闭环的产品哲学。",
        },
        {
            "id": "gl_s12",
            "slideType": "closing",
            "sectionTag": "12 / CLOSING",
            "title": "下一步行动建议与致谢",
            "steps": [
                {"code": "01", "title": "启动试点", "desc": "两周内完成重点部门模板接入与验收"},
                {"code": "02", "title": "沉淀资产", "desc": "建立统一企业品牌配色与页脚规范"},
                {"code": "03", "title": "持续度量", "desc": "双周追踪制作效率与体检评分提升"},
            ],
            "sourceStatus": "source-material",
            "sourceNote": "结语行动清单",
            "speakerNotes": "感谢各位专家与领导聆听，欢迎交流质询。",
        },
    ]


def make_valid_slides(
    count: int = 6,
    *,
    custom_title: str | None = None,
    custom_kpi: str | None = None,
    custom_notes: str | None = None,
    empty_bars: bool = False,
) -> list[dict[str, Any]]:
    """Build a multi-slide list of length 2..12 preserving cover, data, and closing."""
    full = make_12_slide_deck(
        custom_title=custom_title,
        custom_kpi=custom_kpi,
        custom_notes=custom_notes,
        empty_bars=empty_bars,
    )
    clamped = max(2, min(len(full), count))
    if clamped == len(full):
        return full
    if clamped == 2:
        return [full[0], full[4]]  # cover + data
    # Keep cover (0), closing (-1), and prioritize data (4), comparison (6), process (2), agenda (1), ...
    priority_middle = [full[4], full[6], full[2], full[1], full[3], full[5], full[7], full[8], full[9], full[10]]
    chosen = priority_middle[: clamped - 2]
    order = {s["id"]: idx for idx, s in enumerate(full)}
    chosen.sort(key=lambda s: order[s["id"]])
    return [full[0], *chosen, full[-1]]


def make_valid_deck_payload(
    *,
    title: str | None = None,
    slides: list[dict[str, Any]] | None = None,
    is_public: bool | None = None,
    deck_id: str | None = None,
    dark: bool = False,
    brand_footer: str | None = None,
    prompt_id: str = "prompt_soft_bento",
    prompt_slug: str = "apple-soft-bento-modular",
    prompt_title: str = "柔光圆角 Bento · 现代产品卡片",
) -> dict[str, Any]:
    """Build a schema-valid POST /api/decks payload.

    Omits ``isPublic`` when ``is_public is None`` so callers can verify S15
    private-by-default semantics.
    """
    tok = unique_token("D")
    deck_title = title or f"[E2E-DECK] 冰川演示文稿 {tok}"
    payload: dict[str, Any] = {
        "title": deck_title,
        "subtitle": f"自动化端到端测试文稿副标题 ({tok})",
        "audience": "研发与产品评审团队",
        "promptId": prompt_id,
        "promptSlug": prompt_slug,
        "promptTitle": prompt_title,
        "visualSpec": make_valid_visual_spec(dark=dark, brand_footer=brand_footer),
        "slides": copy.deepcopy(slides) if slides is not None else make_valid_slides(6, custom_title=deck_title),
    }
    if deck_id is not None:
        payload["id"] = deck_id
    if is_public is not None:
        payload["isPublic"] = is_public
    return payload


def make_valid_outline_items(count: int = 8) -> list[dict[str, Any]]:
    """Build valid OutlineDraftItem records matching /api/outline schema."""
    base_types = (
        "cover",
        "agenda",
        "process",
        "data",
        "comparison",
        "timeline",
        "quote",
        "closing",
        "image-split",
        "funnel-donut",
        "swot",
        "team-grid",
    )
    items: list[dict[str, Any]] = []
    clamped = max(5, min(20, count))
    for i in range(clamped):
        stype = base_types[i] if i < len(base_types) else "process"
        if i == clamped - 1:
            stype = "closing"
        items.append(
            {
                "id": f"outline_e2e_{i + 1}",
                "slideType": stype,
                "sectionTag": f"{i + 1:02d} / SECTION",
                "title": f"[E2E] 第 {i + 1} 页核心结论标题",
                "summary": f"要点一：业务价值量化提升 +42% · 要点二：架构响应低于 18ms · 要点三：第 {i + 1} 页行动落地",
                "sourceStatus": "source-material" if i % 2 == 0 else "derived-calc",
            }
        )
    return items


def make_pptgod_style_pack_json(
    *,
    title: str | None = None,
    name: str | None = None,
    dark: bool = False,
) -> str:
    """Return a valid .pptgod.json PortableStylePack matching src/lib/paletteExtractor.ts."""
    import datetime
    import json

    tok = unique_token("PACK")
    pack_title = title or name or f"[E2E] 冰川导入风格包 {tok}"
    pack = {
        "schema": "pptgod.style.v1",
        "exportedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "title": pack_title,
        "englishTitle": f"Glacier Pack {tok}",
        "summary": f"通过 .pptgod.json 风格包导入验证的 Glacier 视觉规范（{tok}）。",
        "scenario": "产品发布",
        "styleCategory": "现代Bento",
        "colorFamily": "dark" if dark else "light",
        "recommendedTools": ["claude-html", "slidev-marp"],
        "tags": ["E2E导入", "冰川风格包", tok],
        "sampleTopic": f"冰川风格包导入验证主题 {tok}",
        "sampleSubtitle": "自动填充副标题与五维提示词规范",
        "customNotes": f"Imported via .pptgod.json ({tok})",
        "visualSpec": make_valid_visual_spec(dark=dark),
        "promptAnatomy": {
            "style": "清透克制的冰川白玻璃网格与高精度视觉层次。",
            "palette": "高对比冰川底色搭配深海墨主字与品牌主蓝强调色。",
            "typography": "现代无衬线标题搭配清晰正文与等宽数字编号。",
            "layout": "12 栏模块结构网格与充裕呼吸留白。",
            "content": "结论先行标题配合结构化数据卡片与原生矢量图表。",
        },
    }
    return json.dumps(pack, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# 8 Pure-Stdlib Binary Document Fixture Builders (Zero External Blobs)
# ---------------------------------------------------------------------------


def build_valid_docx_bytes(paragraphs: Sequence[str] | None = None) -> bytes:
    """Build a valid OOXML .docx ZIP archive parseable by mammoth.

    Escapes every paragraph with ``xml.sax.saxutils.escape`` so ``<``, ``>``,
    and ``&`` (e.g. ``p < 0.001``) never produce malformed XML.
    """
    paras = list(paragraphs) if paragraphs is not None else [
        "2026 企业级 AI 知识库平台架构升级方案",
        "核心效能指标：检索准确率提升至 98.7%，P99 响应延迟压降至 18ms，显著优于基线 (p < 0.001 & n = 420)。",
        "第一阶段：多模态文档解析引擎支持 PDF、DOCX、PPTX、Markdown 与 TXT 标准格式。",
        "第二阶段：混合向量检索与图谱校验协同，合规幻觉率下降至 0.8%，方案产出效率提升 +146%。",
        "第三阶段：面向 200 家行业灯塔客户推广私有化交付与细粒度权限治理体系。",
    ]

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )
    body_xml = "".join(
        f"<w:p><w:r><w:t xml:space=\"preserve\">{xml_escape(str(p))}</w:t></w:r></w:p>"
        for p in paras
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body_xml}</w:body>"
        "</w:document>"
    )

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types.encode("utf-8"))
        zf.writestr("_rels/.rels", rels.encode("utf-8"))
        zf.writestr("word/document.xml", document_xml.encode("utf-8"))
    return buf.getvalue()


def build_valid_pptx_bytes(
    slides: Sequence[tuple[str, Sequence[str], str]] | None = None,
) -> bytes:
    """Build a valid OOXML .pptx ZIP archive parseable by src/lib/pptxParser.ts.

    Each slide tuple is ``(title, bullets, speaker_note)``. Uses ``sz="2800"``
    for the title run and ``sz="1600"`` for body runs so ``pptxParser.ts``
    deterministically identifies headlines and body bullets, plus optional
    ``ppt/notesSlides/notesSlideN.xml``.
    """
    slide_specs = list(slides) if slides is not None else [
        (
            "钙钛矿太阳能电池研究进展汇报",
            ["双功能界面钝化策略", "效率提升至 26.1% & 稳定性验证 (p < 0.001)"],
            "封面开场：汇报核心研究动机与关键成果。",
        ),
        (
            "界面缺陷表征与结晶调控机理",
            ["晶粒尺寸由 380nm 提升至 1.25um", "非辐射复合损失下降 64%"],
            "机理页说明配体锚定未配位铅离子的过程。",
        ),
        (
            "器件效率与湿热老化实测对比",
            ["对照组 PCE 23.4% vs 实验组 26.1%", "双 85 老化 1500h 保持率 94.2%"],
            "数据页强调权威第三方认证与长期老化曲线。",
        ),
        (
            "结论与大面积组件产业化展望",
            ["完成 100cm2 狭缝涂布组件工艺验证", "下一阶段推进钙钛矿/硅叠层研究"],
            "致谢答辩委员会专家并进入提问环节。",
        ),
    ]

    overrides = [
        '<Override PartName="/ppt/presentation.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
    ]
    pres_rels = []
    sld_id_list = []

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for idx, (title, bullets, note) in enumerate(slide_specs, start=1):
            overrides.append(
                f'<Override PartName="/ppt/slides/slide{idx}.xml" '
                'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
            )
            pres_rels.append(
                f'<Relationship Id="rId{idx}" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" '
                f'Target="slides/slide{idx}.xml"/>'
            )
            sld_id_list.append(f'<p:sldId id="{255 + idx}" r:id="rId{idx}"/>')

            bullet_paras = "".join(
                f'<a:p><a:r><a:rPr lang="zh-CN" sz="1600"/>'
                f"<a:t>{xml_escape(str(b))}</a:t></a:r></a:p>"
                for b in bullets
            )
            slide_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
                'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
                "<p:cSld><p:spTree>"
                '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
                "<p:grpSpPr/>"
                "<p:sp>"
                '<p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
                "<p:spPr/>"
                "<p:txBody><a:bodyPr/><a:lstStyle/>"
                f'<a:p><a:r><a:rPr lang="zh-CN" sz="2800" b="1"/>'
                f"<a:t>{xml_escape(str(title))}</a:t></a:r></a:p>"
                "</p:txBody></p:sp>"
                "<p:sp>"
                '<p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
                "<p:spPr/>"
                "<p:txBody><a:bodyPr/><a:lstStyle/>"
                f"{bullet_paras}"
                "</p:txBody></p:sp>"
                "</p:spTree></p:cSld></p:sld>"
            )
            zf.writestr(f"ppt/slides/slide{idx}.xml", slide_xml.encode("utf-8"))

            if note:
                overrides.append(
                    f'<Override PartName="/ppt/notesSlides/notesSlide{idx}.xml" '
                    'ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>'
                )
                notes_xml = (
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                    '<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
                    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
                    "<p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:lstStyle/>"
                    f"<a:p><a:r><a:t>{xml_escape(str(note))}</a:t></a:r></a:p>"
                    "</p:txBody></p:sp></p:spTree></p:cSld></p:notes>"
                )
                zf.writestr(f"ppt/notesSlides/notesSlide{idx}.xml", notes_xml.encode("utf-8"))

        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            + "".join(overrides)
            + "</Types>"
        )
        root_rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="ppt/presentation.xml"/>'
            "</Relationships>"
        )
        pres_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<p:presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
            'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            f"<p:sldIdLst>{''.join(sld_id_list)}</p:sldIdLst>"
            '<p:sldSz cx="9144000" cy="5143500"/>'
            "</p:presentation>"
        )
        pres_rels_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + "".join(pres_rels)
            + "</Relationships>"
        )

        zf.writestr("[Content_Types].xml", content_types.encode("utf-8"))
        zf.writestr("_rels/.rels", root_rels.encode("utf-8"))
        zf.writestr("ppt/presentation.xml", pres_xml.encode("utf-8"))
        zf.writestr("ppt/_rels/presentation.xml.rels", pres_rels_xml.encode("utf-8"))
    return buf.getvalue()


def _escape_pdf_ascii(text: str) -> str:
    safe = text.encode("ascii", errors="replace").decode("ascii")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _assemble_pdf(objects: Sequence[bytes]) -> bytes:
    """Assemble a spec-compliant PDF 1.4 byte stream with exact xref offsets."""
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    parts = [header]
    offsets: list[int] = [0]
    pos = len(header)
    for idx, obj_body in enumerate(objects, start=1):
        offsets.append(pos)
        chunk = f"{idx} 0 obj\n".encode("ascii") + obj_body + b"\nendobj\n"
        parts.append(chunk)
        pos += len(chunk)

    xref_pos = pos
    xref_lines = [f"xref\n0 {len(objects) + 1}\n", "0000000000 65535 f \n"]
    for off in offsets[1:]:
        xref_lines.append(f"{off:010d} 00000 n \n")
    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n"
    )
    parts.append("".join(xref_lines).encode("ascii"))
    parts.append(trailer.encode("ascii"))
    return b"".join(parts)


def build_valid_pdf_bytes(lines: Sequence[str] | str | None = None) -> bytes:
    """Build a valid PDF 1.4 document containing extractable text (>= 30 chars)."""
    if lines is None:
        text_lines = [
            "PPTGod Glacier 2.0 Enterprise Architecture Executive Brief",
            "Revenue growth reached +82% YoY with P99 retrieval latency at 18ms.",
            "Key deliverables: Q1 platform architecture, Q2 enterprise rollout, Q3 SDK.",
            "Accuracy verified at 99.4% across 200 lighthouse customers.",
        ]
    elif isinstance(lines, str):
        text_lines = [ln for ln in lines.splitlines() if ln.strip()] or [lines]
    else:
        text_lines = [str(ln) for ln in lines]

    stream_ops = ["BT", "/F1 14 Tf", "18 TL", "50 740 Td"]
    for idx, line in enumerate(text_lines):
        esc = _escape_pdf_ascii(line)
        if idx == 0:
            stream_ops.append(f"({esc}) Tj")
        else:
            stream_ops.append(f"T* ({esc}) Tj")
    stream_ops.append("ET")
    stream_bytes = "\n".join(stream_ops).encode("ascii")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        (
            f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii")
            + stream_bytes
            + b"\nendstream"
        ),
    ]
    return _assemble_pdf(objects)


def build_scanned_pdf_bytes() -> bytes:
    """Build a valid PDF 1.4 with a 1x1 raster image XObject and ZERO text glyphs.

    ``unpdf`` parses this cleanly with 0 extracted characters, triggering
    ``isScannedPdf: true`` and warning copy in ``POST /api/parse-document``.
    """
    # 1x1 RGB raw pixel (3 bytes: Glacier blue #2563EB)
    img_data = b"\x25\x63\xeb"
    draw_stream = b"q 200 0 0 200 100 400 cm /Im0 Do Q"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>"
        ),
        (
            f"<< /Type /XObject /Subtype /Image /Width 1 /Height 1 "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Length {len(img_data)} >>\n"
            f"stream\n".encode("ascii")
            + img_data
            + b"\nendstream"
        ),
        (
            f"<< /Length {len(draw_stream)} >>\nstream\n".encode("ascii")
            + draw_stream
            + b"\nendstream"
        ),
    ]
    return _assemble_pdf(objects)


def build_oversized_bytes(size_bytes: int = MAX_UPLOAD_BYTES + 512 * 1024) -> bytes:
    """Build deterministic in-memory bytes exceeding the 10 MB upload limit."""
    if size_bytes <= MAX_UPLOAD_BYTES:
        raise ValueError(f"size_bytes must exceed {MAX_UPLOAD_BYTES}, got {size_bytes}")
    unit = b"PPTGod Glacier E2E oversized payload verification line 0123456789.\n"
    repeats = (size_bytes // len(unit)) + 1
    return (unit * repeats)[:size_bytes]


def build_legacy_doc_bytes() -> bytes:
    """Build authentic 512-byte OLE2 Compound File magic bytes for legacy .doc tests."""
    return b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1" + (b"\x00" * 504)


def _png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def build_png_bytes(
    width: int = 40,
    height: int = 40,
    *,
    palette_mode: bool = True,
) -> bytes:
    """Build a valid pure-Python RGBA PNG image.

    When ``palette_mode=True`` (default), renders a dark navy (#0E1628) border
    with vivid coral (#E6442A) and teal (#12A894) center panels so Canvas
    Image-to-Style extraction on ``/create`` extracts distinct swatches while
    ``/api/parse-document`` rejects it with HTTP 400 (B8).
    """
    if not palette_mode and width == 1 and height == 1:
        return base64.b64decode(TINY_PNG_B64)

    raw_rows = bytearray()
    for y in range(height):
        raw_rows.append(0)  # filter type 0 (None)
        for x in range(width):
            if palette_mode:
                if x < width // 4 or x >= (3 * width) // 4 or y < height // 4 or y >= (3 * height) // 4:
                    r, g, b, a = 14, 22, 40, 255      # #0E1628 dark navy
                elif x < width // 2:
                    r, g, b, a = 230, 68, 42, 255     # #E6442A coral
                else:
                    r, g, b, a = 18, 168, 148, 255    # #12A894 teal
            else:
                r, g, b, a = 37, 99, 235, 255         # #2563EB glacier primary
            raw_rows.extend((r, g, b, a))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw_rows), level=6)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", ihdr)
        + _png_chunk(b"IDAT", idat)
        + _png_chunk(b"IEND", b"")
    )


def build_empty_bytes() -> bytes:
    """Return 0-byte empty payload for empty-file rejection boundary tests."""
    return b""


CORRUPT_PPTX_BYTES = b"NOT_A_VALID_ZIP_ARCHIVE_FOR_PPTX_PARSE_CHECK"
MALWARE_EXE_BYTES = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff"

# Convenient short aliases matching blueprint documentation
make_minimal_docx = build_valid_docx_bytes
make_minimal_pptx = build_valid_pptx_bytes
make_minimal_pdf = build_valid_pdf_bytes
make_scanned_pdf = build_scanned_pdf_bytes
make_oversized_file = build_oversized_bytes
make_legacy_doc_bytes = build_legacy_doc_bytes
make_tiny_png = lambda: build_png_bytes(1, 1, palette_mode=False)
make_synthetic_palette_png = build_png_bytes
make_empty_file = build_empty_bytes
