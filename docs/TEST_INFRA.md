# PPTGod · Glacier UI 2.0 — E2E Testing Infrastructure (`TEST_INFRA.md`)

> **Authoritative E2E Test Infrastructure Specification** for **PPTGod · Glacier UI 2.0**.
> Owned exclusively by the E2E Testing Track (`sub_orch_e2e_track`).
> Derived strictly from user requirements & frozen contracts (`ORIGINAL_REQUEST.md`, `PROJECT.md`, `docs/PPTGod_Glacier_UI_2.0_Development_Spec.md`, and frozen API/DB baselines) — standalone, opaque-box, and zero imports from legacy `tests/e2e/*.py`.

---

## 1. Runtime Environment & Non-Negotiable Constraints

| Component | Exact Runtime / Path | Notes |
|---|---|---|
| **Python 3** | `/opt/pyenv/shims/python3` (`3.12.16`) | Pure stdlib (`urllib.request`, `http.cookiejar`, `zipfile`, `xml.etree.ElementTree`, `http.server`, `sqlite3`, `struct`, `zlib`, `json`, `re`, `pathlib`, `tempfile`) — zero extra pip installs |
| **Browser Automation** | Python Playwright (`playwright.sync_api`, v`1.65.2`) | Preinstalled in pyenv; **Node Playwright is NOT installed — DO NOT `npm install playwright`** |
| **Browser Binaries** | `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` | Headless Chromium already cached locally; zero runtime downloads |
| **SQLite CLI** | `/opt/android-sdk/platform-tools/sqlite3` | Used strictly for WAL-safe snapshot (`sqlite3 data/pptgod.db ".backup '<tmp>'"`) — **NEVER** plain `cp data/pptgod.db` |
| **Target Server** | **`http://127.0.0.1:3010`** *(default `--base-url`)* | Next.js 16.4.6 App Router started on isolated port `3010`; **port `3000` is strictly refused with exit code `2`** to protect the main session's production preview daemon |
| **Screenshot Archive** | `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/screenshots/glacier_v2/` | 22-shot Glacier UI 2.0 visual parity & RWD archive via `--screenshots-dir` |

### Clean-Database, WAL Safety & Session Hygiene Protocol
1. **Seeded Read-Only Accounts (NEVER deleted; exact profile restore values):**
   - **Official Studio:** `studio@pptgod.studio` / `PPTGodOfficial#2026` (`user_studio_official`, `pptgod_lab`, `"PPTGod 视觉实验室"`, `#C84B31`, 15 styles)
   - **Author A (Demo):** `demo@pptgod.studio` / `demo1234` (`user_demo`, `demo_designer`, `"林屿 · 演示设计师"`, `#0F766E`, 12 styles)
   - **User B (Chen):** `chen@pptgod.studio` / `ChenStrategy#2026` (`user_curator_chen`, `chen_strategy`, `"陈默 · 战略咨询"`, `#1D4ED8`, 9 styles)
2. **Exact Baseline Table Invariants (enforced by `--backup-db`):**
   - `users: 3`, `prompts: 36`, `prompt_comments: 5`, `saved_decks: 0`, `prompt_likes: 0`, `prompt_favorites: 0`
   - `residual_e2e_rows == 0` across **all 3 content tables** (`prompts.title LIKE '[E2E%'`, `saved_decks.title LIKE '[E2E%'`, `prompt_comments.content LIKE '[E2E%'`)
   - **`sessions_delta <= 0`** (`post["sessions"] - pre["sessions"] <= 0`)
3. **Deterministic LIFO Cleanup & Automatic Session Logout:**
   - Every mutating test registers created resources (`prompts`, `saved_decks`, `prompt_comments`, `like`/`favorite` toggles, profile edits) into `CleanupRegistry` (LIFO rollback).
   - If a test fails, cleanup errors are attached via `exc.add_note(...)` (never masking the primary failure); if the test passed but cleanup failed, `CleanupError` fails the test loudly (zero swallowed errors).
   - **Session Hygiene:** `TestContext.teardown_sessions()` logs out every tracked authenticated `ApiClient` via `POST /api/auth/logout` AFTER `spec.fn(ctx)` and `CleanupRegistry` finish; `PlaywrightSession.open_page()` inspects `context.cookies()` for `pptgod_session` before `context.close()` and revokes it via `POST /api/auth/logout`, preventing `sessions` table bloat.
4. **Zero `.agents/teamwork/` Scratch Pollution:**
   - All temporary backups and scratch probes use `tempfile.TemporaryDirectory(prefix="pptgod_glacier_e2e_")` or `mktemp -d -- "${TMPDIR:-/tmp}/teamwork_probe.XXXXXX"` and are removed cleanly on exit.

---

## 2. Authoritative 4-Tier E2E Package Layout (`tests/e2e/glacier_v2/**`)

Obsolete v8 `tests/e2e/{config,helpers,run_e2e,tier1..tier10}.py` have been retired; `tests/e2e/glacier_v2/` is the single authoritative 79-test E2E suite (invocable via `npm run test:e2e` / `npm run test:e2e:list`):

```text
tests/e2e/glacier_v2/
├── __init__.py                   # Package version "glacier-v2.0.0" & default base URL metadata
├── config.py                     # Zero-I/O constants: DEFAULT_BASE_URL=127.0.0.1:3010, FORBIDDEN_PORTS=(3000,),
│                                 # 3 accounts, 36 styles, exact domain/scenario/style/color/tool counts, 12 SlideTypes,
│                                 # 20 archetypes, 16 motifs, 5 RWD breakpoints, Glacier tokens, B1-B16 forbidden patterns,
│                                 # 22-shot Screenshot Manifest, payload factories & 8 pure-stdlib binary fixture builders
├── helpers.py                    # ApiClient (JSON + post_multipart + auto logout), CleanupRegistry (LIFO, strict likedByMe/
│                                 # favoritedByMe restore, non-masking), DbHygieneHelper (WAL-safe sqlite3 .backup + closing),
│                                 # PptxVerifier, HtmlDeckVerifier, MockOpenAIServer (127.0.0.1:0 chat+image+500 scrub),
│                                 # DelayedFetchProbe (non-blocking browser fetch delay + MutationObserver + passive counter),
│                                 # BrowserPageGuard (console/pageerror/5xx/404-assets/requestfailed), PlaywrightSession (auto
│                                 # browser logout), Web Vitals (LCP/CLS/INP w/ takeRecords flush), WCAG 2.2 AA & Frosted Topbar
│                                 # gradient contrast, Glacier CSS/blur/brand-SVG/focus/motion probes, TestContext/SuiteRunner
├── tier1_features.py             # Tier 1 (29 tests): 12 core API happy paths (G1_API_01..12) + 17 Glacier UI route tests
├── tier2_boundaries.py           # Tier 2 (39 tests): 12 API boundaries + 11 UI guards + 16 Honest Boundaries (B1-B16)
├── tier3_interactions.py         # Tier 3 (4 tests): Client-side URL query sync, browser-local BYOK loop (S22), Workshop density/routeMode & cross-route journey
├── tier4_scenarios_rwd_perf.py   # Tier 4 (7 tests): 5 per-breakpoint 9-route zero-overflow gates (1920/1440/1024/768/390px), 390px Editor filmstrip/inspector & Glacier parity
└── run_glacier_e2e.py            # Unified CLI runner (default http://127.0.0.1:3010; refuses port 3000 with exit code 2)
```

---

## 3. CLI Runner Contract (`tests/e2e/glacier_v2/run_glacier_e2e.py`)

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright /opt/pyenv/shims/python3 \
  tests/e2e/glacier_v2/run_glacier_e2e.py \
  --base-url http://127.0.0.1:3010 \
  --tier all \
  [--backup-db] \
  [--screenshots-dir /abs/path/to/screenshots/glacier_v2] \
  [--json-report /abs/path/to/report.json] \
  [--timeout-ms 15000] \
  [--filter <substring>] \
  [--list]
```

### CLI Options & Strict Exit Codes
- `--base-url <url>`: Target server URL (**default: `http://127.0.0.1:3010`**). **Port `3000` is strictly refused with exit code `2`** and a clear stderr error message.
- `--tier <1|2|3|4|all>`: Single tier, comma-separated list (`1,2`), or `all` (default: `all`). Tiers 1 & 2 are imported unconditionally; Tiers 3 & 4 are imported unconditionally as soon as their module files exist (never masking real `ImportError`/`SyntaxError`).
- `--backup-db` (PostgreSQL, when `DATABASE_URL` is set — default since #7): takes read-only row-count snapshots of the `pptgod` schema via `tests/e2e/glacier_v2/pg_snapshot.mjs` (reuses the app's `postgres` driver) before/after the run and asserts zero table drift, `residual_e2e_rows == 0`, and `sessions_delta <= 0` (absolute baselines are skipped because seeds differ per deployment).
- `--backup-db` (legacy SQLite, no `DATABASE_URL`): Creates a WAL-safe `sqlite3 .backup` snapshot in an ephemeral temp dir before execution, then asserts all 6 baseline content tables unchanged, `residual_e2e_rows == 0`, and `sessions_delta <= 0`.
- `--screenshots-dir <dir>`: Output folder for Tier 4's 22-shot Glacier UI 2.0 Screenshot Manifest.
- `--json-report <path>`: Writes structured UTF-8 JSON report (`suite_version`, `started_at`, `finished_at`, `base_url`, `tiers_selected`, `summary`, `tiers`, `db_hygiene`, `tests[]`).
- `--timeout-ms <ms>`: Positive per-request & Playwright action timeout (default `15000`).
- `--filter <substring>`: Case-insensitive substring matching test `id`, `name`, or `tags`.
- `--list`: Prints matching tests grouped by tier with counts and exits `0` without hitting the server or launching Chromium.
- **Strict Exit Policy:**
  - `0`: `--list` succeeded OR (`executed > 0` AND `failed == 0` AND `errors == 0` AND (`not --backup-db` OR `db_hygiene.ok`)).
  - `1`: Any test `FAIL`/`ERROR`, zero matching tests, or `db_hygiene.ok is False`.
  - `2`: Invalid CLI arguments, protected port `3000` refusal, explicitly requested missing tier, or unreachable target server preflight.

---

## 4. Four-Tier Systematic Test Architecture (`F1–F41`, `B1–B16`)

### Tier 1 — Isolated Happy Paths (`tier1_features.py` — 29 Tests)
- **Tier 1A Core APIs (`G1_API_01..12` — 12 tests):**
  - `G1_API_01`: `GET /api/health` (`status == "ok"`, `catalogCount == 36`, `dbMode == "postgresql"`).
  - `G1_API_02`: `GET /api/prompts` (36 official slugs + `color=dark` (6), `tool=slidev-marp` (9), `scenario=科研基金` (2), `style=商务咨询` (5), `q=Bento`, `sort=popular|newest|copies`).
  - `G1_API_03`: `POST /api/auth/login` (`HttpOnly` cookie), `GET /api/auth/me` (`stats.{published,likes,favorites,decks}`), `POST /api/auth/logout`.
  - `G1_API_04`: `POST/GET/PUT/PATCH/DELETE /api/prompts` CRUD (slug preservation + `CleanupRegistry`).
  - `G1_API_05`: Prompt `like`/`favorite`/`copy` & `sync-favorites` with restore.
  - `G1_API_06`: Prompt `comments` seeded read + `slidev-marp` 5-star POST + DELETE.
  - `G1_API_07`: `PATCH /api/auth/profile` (+ restore) & `GET /api/creators/pptgod_lab` (15 public prompts, `privateCount == 0`).
  - `G1_API_08`: `POST /api/parse-document` across pure-stdlib `.md`, `.txt`, `.docx`, `.pptx` (`existing-pptx`, `beautify-1to1`, 4-slide `parsedOutline`), and `.pdf`.
  - `G1_API_09`: `POST /api/outline` (10 slides) & smart `POST /api/generate` honoring edited outline title.
  - `G1_API_10`: `POST /api/polish` across all 3 strict actions (`executive`, `metrics`, `notes`) preserving `id`, `slideType`, `imageSlot`.
  - `G1_API_11`: Saved Decks CRUD (default private, `PUT` rename, `POST` duplicate omitting `id`, `PATCH` visibility) + 12-slide native `.pptx` export (`PptxVerifier`: `PK\x03\x04`, `slideMasters`, `slide1..12.xml`, `notesSlide`, native `<a:tbl>`, `<c:barChart>` & `<c:doughnutChart>`, `ppt/media/`, `brandFooter`).
  - `G1_API_12`: `/robots.txt`, `/sitemap.xml` (incl. `/gallery`, `/tools`), and `/studio/apple-soft-bento-modular/opengraph-image` PNG.
- **Tier 1B Glacier UI 2.0 Routes (`G1_UI_01`, `G1_UI_01B`, `G1_UI_02..15`, `G1_UI_15B` — 17 tests, `1440×900`, `BrowserPageGuard` 0 errors):**
  - `G1_UI_01`: `/` Dashboard Bento (`8:4`, `9:3`, `4:8`), H1 with ONLY `"AI 创作"` in `#2563EB`, 3-Tab switching, live 3-style `SlideCanvas` topic sync, 2×3 recommended styles, 4 Quick Tools.
  - `G1_UI_01B`: `/?q=Bento&domain=business-tech` server-side redirect to `/gallery?q=Bento&domain=business-tech`.
  - `G1_UI_02`: `AppShell` sticky `64px` Topbar, Sidebar `220px ↔ 64px` collapse/expand, Topbar search → `/gallery?q=`, all Sidebar nav links HTTP `200`.
  - `G1_UI_03`: `/gallery` 36 cards, live domain capsules (`科研与学术` → 6 + URL sync), search/reset, `2px solid #2563EB` selection, copy prompt, guest `localStorage` favorite.
  - `G1_UI_04`: `/gallery` Style Detail `Drawer` (16:9 multi-slide switcher, hex swatches, `Esc`), `StyleMatcherModal`, and `DocIntakeWorkbench`.
  - `G1_UI_05`: `/generate` Workshop 4-step `Stepper`, live 16:9 `示例预览`, `.md` upload parsed card, `OutlineDraftPanel` edit/add/confirm → Editor.
  - `G1_UI_06`: `/generate` Editor full-bleed auto-collapsed sidebar, topbar controls, slide tree (`大纲`↔`幻灯片`, `+ 新建幻灯片`), zoom, fullscreen presenter.
  - `G1_UI_07`: `/generate` Editor `仅换版式不动字` (preserves title & `sourceStatus`), Speaker Notes + `AI 讲稿生成`, `AI 助手` (`高管精炼` + Undo), `DeckSpecTweaker` `brandFooter` live update.
  - `G1_UI_08`: Design Audit (`/generate?panel=audit` auto-open, 100-pt score, `jump-slide` issue jump, `#pg-audit-autofix-notes-btn` recovery, deliberate low-contrast `#1A1A1A` → `#pg-audit-autofix-contrast-btn` recovery).
  - `G1_UI_09`: `/collections` honest rail, real KPI (`1`), Grid/List toggle, search/sort, Rename (`PUT` via `role="dialog"`), Visibility (`PATCH`), Export PPTX, Duplicate (`POST`), Delete confirmation `Dialog` (`DELETE` → count `1`), all 3 community tabs (`我收藏的`/`我发布的`/`我点赞的`).
  - `G1_UI_10`: `/compare` 3-column top-aligned same-content sync across 5 slide types, unified topic, remove-1 & add-back.
  - `G1_UI_11`: `/studio` redirect + `/studio/apple-soft-bento-modular` 12-slide filmstrip, 5-dim anatomy pin, live tweaker + reset, all 6 target tools (`TOOL_MARKERS`) + 6/12-slide `ai-image` batch, `.html`/`.pptgod.json` downloads, copy prompt & authenticated comment CRUD.
  - `G1_UI_12`: `/deck/[id]?rehearsal=1` Rehearsal Cockpit timer ticking, `#pg-rehearsal-notes-text` strict A+ (`after_px > before_px`), next-slide preview, slide-2 `ArrowRight` advance, export & clone links.
  - `G1_UI_13`: `/create?fork=swiss-international-grid` Remix banner, hidden `#pg-extract-image-input` 40×40 PNG palette extractor, WCAG autofix, `.pptgod.json` PortableStylePack import, visibility radios, publish + cleanup.
  - `G1_UI_14`: `/tools?tab=pacing|pptx-inspect|palette-wcag|visual-director` strict `aria-selected="true"` + panel verification, saved-deck rehearsal launcher, synthetic `.pptx` inspection.
  - `G1_UI_15`: `AuthModal` Register+Login tabs & demo login, `SettingsModal` (editable profile + local-only BYOK), `HelpModal` searchable FAQ (`10\s*MB`), and Glacier 404 `not-found`.
  - `G1_UI_15B`: `/creator/pptgod_lab` public creator portfolio & exact 15 deduplicated published styles.

### Tier 2 — Boundaries, Guards & Honest Boundaries `B1–B16` (`tier2_boundaries.py` — 39 Tests)
- **Tier 2A API Boundaries (`G2_API_01..12` — 12 tests):** `>10MB` rejection, `.doc`/`.png`/`.exe`/`0-byte`/corrupt `.pptx` `400`, scanned PDF `isScannedPdf: true`, prompt/comment validation, generate/outline clamping (`5..20`), BYOK SSRF blocks across all 4 LLM/image routes, `MockOpenAIServer` (`valid_json`, `fenced_json`, `http_500`, `malformed_text` with canary key scrubbing), `PATCH` vs `PUT` deck contract, strict `/api/polish` enum, dark PPTX RGBA & empty bars & RFC 5987 CJK filename, `401`/`404`/`409` auth guards, `>50` slides / SVG dataUrl / `>650k` image caps.
- **Tier 2B Browser UI Boundaries (`G2_UI_01..11` — 11 tests):** Invalid uploads (diff/alert-scoped error check, never matching static B8 copy) & scanned PDF (`expect_response`) preserving typed draft, empty-topic sample fallback, zero-result search + `清除筛选` on `/gallery` & seeded `/collections`, Guest vs Authenticated `0-deck` empty states, Editor last-slide delete guard (`final_cnt == 1`) + zero-`NaN` SVG across all 12 `SLIDE_TYPES`, 56-char CJK title clamping (viewport + container bounds), non-blocking `DelayedFetchProbe` anti-double-submit lock (`is_locked is True` + `1` backend request), 502 error retry preserving draft, anonymous private deck URL isolation + zero browser errors, Compare Max-3 guard + warning toast.
- **Tier 2C Explicit Honest-Boundary Anti-Fake Suite (`G2_HONEST_01..16` — 16 tests, 1-to-1 for `B1–B16`):**

| Test ID | Boundary | Enforced Anti-Fake / Honest Contract |
|---|---|---|
| `G2_HONEST_01` | **B1** | Zero `PPTGod Pro`, `立即升级`, `升级 Pro`, `解锁高级风格与更多额度`, `解锁更强大的 AI 创作能力` |
| `G2_HONEST_02` | **B2** | Zero Topbar notification bell / unread dot (`[aria-label*="通知"]`, `[title*="通知"]`, `[class*="lucide-bell"]`) across all routes & Editor |
| `G2_HONEST_03` | **B3** | Zero fake `意见反馈` / `提交反馈` controls across `aside, nav, footer` & zero `form[action*="feedback"]` |
| `G2_HONEST_04` | **B4** | Zero `与我共享` / `协作项目` / `协作中`; real `公开分享`/`私有` verified on BOTH private and `PATCH`-flipped public decks |
| `G2_HONEST_05` | **B5** | Zero `回收站`; Delete opens permanent-deletion confirmation `role="dialog"` |
| `G2_HONEST_06` | **B6** | Zero `项目分组` / `新建分组` / `添加分组` / `全部分组` custom folder UI |
| `G2_HONEST_07` | **B7** | Zero hardcoded `42` KPI variants (`全部项目 (42)`, `总项目数 42`, etc.) or fake recent titles; positively asserts KPI `0` & empty CTA at 0-deck baseline |
| `G2_HONEST_08` | **B8** | Dropzone discloses `10MB` + all 5 real formats (`PDF`/`DOCX`/`PPTX`/`MD`/`TXT`) and makes zero dropzone image/OCR claims (`图片`/`JPG`/`PNG`/`OCR`) |
| `G2_HONEST_09` | **B9** | Strict `示例预览\|示例文稿` badge on `/generate` (never matching quick-chip `"试试示例"`) & `示例` badge on `/compare` |
| `G2_HONEST_10` | **B10** | Non-blocking `DelayedFetchProbe` asserts in-flight loading feedback appeared AND contains zero fabricated `%` (`(?<!\d)(?:100\|[1-9]\d?)%`) or numeric `aria-valuenow` across non-slide DOM |
| `G2_HONEST_11` | **B11** | Honest `16:9` ratio with zero fake `4:3` or `9:16` / `竖屏` options/buttons/radios |
| `G2_HONEST_12` | **B12** | Zero unimplemented Editor `形状` / `表格` / `动画` / `切换` controls or tabs; independently requires BOTH `本页编辑` AND `页面与主题` + `设计体检` |
| `G2_HONEST_13` | **B13** | Editor `AI 助手` exposes all 3 real `/api/polish` actions, zero fake freeform chat input, and previews without overwriting until `确认应用` (`放弃` keeps original) |
| `G2_HONEST_14` | **B14** | Zero fake `AI 语音演练` / `语音评分` / `停顿分析` / `麦克风录音评分`; positively verifies honest teleprompter/timer wording |
| `G2_HONEST_15` | **B15** | Unconditional `#pg-param-lang` (`zh`→`en`→`bilingual`) alters compiled Studio prompt; Smart generation on `/generate` succeeds cleanly |
| `G2_HONEST_16` | **B16** | Live 36 DOM `SlideCanvas` cards (zero raster slide mockups) & all 6 `#pg-domain-tab-*` badges match real DB counts (`36/11/5/6/9/7`) |

### Tier 3 — Cross-Feature Interactions, URL Query Sync & Browser-Local BYOK (`tier3_interactions.py` — 4 Tests)
- `G3_FLOW_01`: Client-side URL & query sync regressions (`/generate` ↔ Sidebar `设计体检` `/generate?panel=audit` ↔ `返回工坊` ↔ `?mode=editor`/`?mode=create`; Topbar global search while already on `/gallery`; `/tools` ↔ Sidebar `?tab=pacing`; `/collections` `?tab=` sync).
- `G3_FLOW_02`: Browser-local BYOK closed loop (`SettingsModal` ↔ Full-Bleed Editor reactive state sync, verifying `apiKey` lives strictly in `sessionStorage` and NEVER in `localStorage` or SQLite — `S22`).
- `G3_FLOW_03`: Workshop Advanced Settings end-to-end parameter forwarding (`evidenceDensity: "high-evidence"` + `.pptx` auto-defaulted `routeMode: "beautify-1to1"` verified on `POST /api/generate`).
- `G3_FLOW_04`: Full cross-route creator journey (`/generate` → generate deck → Cloud Save → `/collections` verify saved card → `/deck/[id]?rehearsal=1` Rehearsal Cockpit → LIFO cleanup).

### Tier 4 — 5-Breakpoint RWD Gate, Mobile Editor Ergonomics & Glacier Visual Parity (`tier4_scenarios_rwd_perf.py` — 7 Tests)
- `G4_RWD_01..05`: Isolated per-breakpoint (`1920`, `1440`, `1024`, `768`, `390px`) zero horizontal overflow (`scrollWidth <= innerWidth + 1`) and zero console/page error checks across all 9 routes (`/`, `/gallery`, `/generate`, `/generate?mode=editor`, `/collections`, `/tools`, `/compare`, `/creator/pptgod_lab`, `/studio/apple-soft-bento-modular`).
- `G4_RWD_06`: Mobile `390×844` Presentation Editor horizontal filmstrip anti-truncation check (card width `≥165px`, slide type label visible, inactive action bars hidden) + collapsible right inspector toggle (`aria-expanded` & zero overflow).
- `G4_VISUAL_01`: Glacier UI 2.0 secondary-page visual parity (`/creator/pptgod_lab` & `/studio/apple-soft-bento-modular` sans-serif UI headings, `StyleCard` + `StyleDetailDrawer` on Creator Profile, zero double horizontal padding inside `.gl-main-inner`).

---

## 5. Complete 22-Shot Glacier UI 2.0 Screenshot Manifest (`--screenshots-dir`)

| # | Filename | Route & State | Viewport | Auth | Baseline |
|---|---|---|---|---|---|
| 1 | `01_dashboard_1440.png` | `/` (clean loaded Dashboard) | `1440×900` | Guest | PNG-1 |
| 2 | `02_gallery_1440.png` | `/gallery` (1st card selected w/ 2px blue border) | `1440×900` | Guest | PNG-2 |
| 3 | `03_gallery_drawer_1440.png` | `/gallery` (Style Detail `Drawer` open) | `1440×900` | Guest | Gallery Drawer |
| 4 | `04_workshop_create_1440.png` | `/generate` (Workshop wizard w/ `示例预览`) | `1440×900` | Guest | PNG-3 |
| 5 | `05_editor_workspace_1440.png` | `/generate` (Editor w/ deck + notes + inspector) | `1440×900` | Guest | PNG-4 |
| 6 | `06_editor_audit_1440.png` | `/generate?panel=audit` (`DeckAuditDrawer` open) | `1440×900` | Guest | Audit |
| 7 | `07_projects_1440.png` | `/collections` (logged-in w/ temp E2E decks) | `1440×900` | Demo | PNG-5 |
| 8 | `08_projects_empty_1440.png` | `/collections` (honest 0-deck EmptyState) | `1440×900` | Demo | EmptyState |
| 9 | `09_compare_1440.png` | `/compare` (3-col synced comparison) | `1440×900` | Guest | Compare |
| 10 | `10_studio_1440.png` | `/studio/apple-soft-bento-modular` | `1440×900` | Guest | Studio |
| 11 | `11_rehearsal_1440.png` | `/deck/[tempId]?rehearsal=1` | `1440×900` | Demo | Rehearsal |
| 12 | `12_create_1440.png` | `/create?fork=swiss-international-grid` | `1440×900` | Demo | Create |
| 13 | `13_tools_1440.png` | `/tools?tab=pacing` | `1440×900` | Guest | Tools |
| 14 | `14_creator_1440.png` | `/creator/pptgod_lab` | `1440×900` | Guest | Creator |
| 15 | `15_rwd_dashboard_390.png` | `/` | `390×844` | Guest | RWD 390 |
| 16 | `16_rwd_dashboard_768.png` | `/` | `768×1024` | Guest | RWD 768 |
| 17 | `17_rwd_dashboard_1024.png` | `/` | `1024×768` | Guest | RWD 1024 |
| 18 | `18_rwd_dashboard_1920.png` | `/` | `1920×1080` | Guest | RWD 1920 |
| 19 | `19_rwd_gallery_390.png` | `/gallery` | `390×844` | Guest | RWD 390 |
| 20 | `20_rwd_gallery_1024.png` | `/gallery` | `1024×768` | Guest | RWD 1024 |
| 21 | `21_rwd_editor_768.png` | `/generate` (Editor stage) | `768×1024` | Guest | RWD 768 |
| 22 | `22_rwd_projects_390.png` | `/collections` | `390×844` | Demo | RWD 390 |

---

## 6. Resilient Accessible Locator Strategy (Parallel Track Safety)

Because the E2E suite is authored concurrently with Implementation Milestones M1–M3, all Playwright interactions use prioritized resilient helpers (`locate_first`, `locate_attached`, `click_resilient`, `fill_resilient`, `assert_any_visible`):
1. **Priority 1 — Accessible Roles & Semantic Labels:** `get_by_role("button"|"link"|"tab"|"textbox"|"dialog", name=re.compile(...))`, `get_by_placeholder(...)`, `get_by_label(...)`.
2. **Priority 2 — Structural & `data-*` Contracts:** `href` prefixes (`a[href^="/gallery"]`, `a[href*="/generate?deck="]`), `article[data-prompt-slug]`, `[data-layout-chip]`, `[data-timer-preset]`, `input[type="file"]` (always resolved via `locate_attached` / `require_visible=False`).
3. **Priority 3 — Frozen `#pg-*` / `#create-*` Hooks (`PROJECT.md § Interface Contracts`):** `#pg-nav-login-btn`, `#pg-nav-logout-btn`, `#pg-demo-login-btn`, `#pg-domain-tabs`, `#pg-domain-tab-*`, `#pg-gallery-search`, `#pg-reset-filters-btn`, `#pg-open-matcher-btn`, `#pg-open-doc-intake-btn`, `#pg-doc-upload-input`, `#pg-gen-topic`, `#pg-gen-outline-btn`, `#pg-gen-run-btn`, `#pg-outline-editor`, `#pg-gen-undo-btn`, `#pg-gen-redo-btn`, `#pg-slide-type-select`, `#pg-edit-slide-title`, `#pg-edit-source-status`, `#pg-polish-executive-btn`, `#pg-deck-tweaker-toggle`, `#pg-deck-bg-input`, `#pg-deck-footer-input`, `#pg-deck-audit-toggle`, `#pg-deck-audit-panel`, `#pg-deck-audit-score`, `#pg-audit-autofix-contrast-btn`, `#pg-audit-autofix-notes-btn`, `#pg-compiled-prompt-output`, `#pg-param-lang`, `#pg-tool-tab-*`, `#pg-rehearsal-*`, `#pg-rehearsal-notes-text`, `#pg-extract-image-input`, `#pg-import-style-json-input`, `#pg-extracted-swatches`.
