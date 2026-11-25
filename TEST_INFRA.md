# PPTGod v2 — E2E Testing Infrastructure (`TEST_INFRA.md`)

> **Authoritative E2E Test Infrastructure Specification** for PPTGod v2.
> Owned exclusively by the E2E Testing Track (`sub_orch_e2e_track`).
> Derived strictly from user requirements & documented contracts (`ORIGINAL_REQUEST.md`, `PROJECT.md`, `implementation_plan.md`, `product_design.md`, and `spec_miner_survey_3/handoff.md`) — opaque-box and independent of implementation internals.

---

## 1. Runtime Environment & Non-Negotiable Constraints

| Component | Exact Runtime / Path | Notes |
|---|---|---|
| **Python 3** | `/opt/pyenv/shims/python3` (`3.12.16`) | Standard library (`urllib.request`, `http.cookiejar`, `zipfile`, `xml.etree.ElementTree`, `http.server`, `sqlite3`, `json`, `re`, `pathlib`, `tempfile`) — zero extra pip installs required |
| **Browser Automation** | Python Playwright (`playwright.sync_api`, v`1.65.2`) | Preinstalled in pyenv; **Node Playwright is NOT installed — DO NOT `npm install playwright`** |
| **Browser Binaries** | `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` | Headless Chromium (`chromium-1255`) already cached locally; zero runtime downloads |
| **SQLite CLI** | `/opt/android-sdk/platform-tools/sqlite3` | Used only for optional WAL-safe snapshot (`sqlite3 data/pptgod.db ".backup '<tmp>'"`) — NEVER plain `cp data/pptgod.db` |
| **Target Server** | `http://localhost:3000` (configurable via `--base-url`) | Next.js 16.4.6 App Router (`npm run start` or `npm run dev`) |

### Clean-Database & Zero-Pollution Protocol
1. **Seeded Accounts (read-only credentials, never deleted):**
   - **Author A:** `demo@pptgod.studio` / `demo1234` (username: `demo_designer`, id: `user_demo`)
   - **Author B:** `chen@pptgod.studio` / `ChenStrategy#2026` (username: `chen_strategy`, id: `user_curator_chen`)
   - **Official Studio:** `studio@pptgod.studio` / `PPTGodOfficial#2026` (username: `pptgod_lab`, id: `user_studio_official`)
2. **Deterministic Cleanup (`try/finally`):**
   - Every mutating test registers created resources (prompts, saved decks, comments, like/favorite toggles, profile edits) into a LIFO `CleanupRegistry`.
   - Every test cleans up in `finally:` blocks even when assertions fail, restoring `demo_designer`'s profile (`displayName`, `bio`, `avatarColor`) and removing all `[E2E-...]` synthetic rows so `data/pptgod.db` remains at the clean 18 curated styles & 5 seed comments state.
   - Duplicate registration (`409`) tests submit an already-seeded email (`demo@pptgod.studio`) so zero orphan user rows are inserted into `users`.
3. **Zero `.agents/teamwork/` Pollution:**
   - Tests, runner outputs, temporary downloads, mock servers, and optional DB backups NEVER write inside `.agents/teamwork/`.
   - Ephemeral scratch files use `tempfile.TemporaryDirectory(prefix="pptgod_e2e_")` and are removed on exit.

---

## 2. Test Suite File Layout (`tests/e2e/**`)

```text
tests/e2e/
├── __init__.py                   # Package marker & suite version metadata
├── config.py                     # Seeded accounts, 18 official slugs, 8 slide types, 6 tools, 7 routes, screenshot manifest
├── helpers.py                    # ApiClient (per-role cookie jars), CleanupRegistry, PptxVerifier, HtmlDeckVerifier,
│                                 # PlaywrightSession (console/pageerror/5xx capture), MockOpenAIServer, TestRunner primitives
├── tier1_features.py             # Tier 1: Isolated happy-path feature coverage (API + Browser UI Smoke on all 7 routes)
├── tier2_boundaries.py           # Tier 2: Boundary, validation, error-handling, BYOK mock LLM & corner-case tests
├── tier3_security_journeys.py    # Tier 3: ALL 22 Security/Privacy Invariants (S1–S22) + Cross-Feature E2E Journeys
├── tier4_scenarios_visual.py     # Tier 4: 5+ Real-world personas, Desktop/Mobile responsive checks, Vanilla CSS aesthetic checks & screenshots
└── run_e2e.py                    # Unified CLI runner
```

---

## 3. CLI Runner Interface (`tests/e2e/run_e2e.py`)

```bash
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright /opt/pyenv/shims/python3 tests/e2e/run_e2e.py \
  --base-url http://localhost:3000 \
  --tier all \
  [--screenshots-dir /abs/path/to/screenshots] \
  [--json-report /abs/path/to/report.json] \
  [--backup-db] \
  [--timeout-ms 15000] \
  [--filter <substring>]
```

### CLI Options & Exit Contract
- `--base-url <url>`: Target PPTGod v2 server URL (default: `http://localhost:3000`).
- `--tier <1|2|3|4|all>`: Tier selection; supports single tier (`1`, `2`, `3`, `4`), comma-separated list (`1,3`), or `all` (default: `all`).
- `--screenshots-dir <dir>`: Optional directory where Tier 4 (or standalone screenshot pass) writes crisp desktop (`1440×900`) PNG screenshots of all 8 mandatory views for `walkthrough.md`:
  1. `01_gallery_home.png` — `/` (18 styles gallery)
  2. `02_style_matcher_modal.png` — `/` with 30-second `StyleMatcherModal` open (and showing recommendations)
  3. `03_studio_bento.png` — `/studio/apple-soft-bento-modular` (8-slide filmstrip, 6-tool compiler, reviews)
  4. `04_generate_workshop.png` — `/generate` with a generated multi-slide deck rendered on 16:9 canvas
  5. `05_compare_board.png` — `/compare` (side-by-side multi-style compare across 8 slide types)
  6. `06_create_remix.png` — `/create?fork=swiss-international-grid` (Remix prefill, provenance banner, visibility toggle)
  7. `07_collections_workspace.png` — `/collections` (logged-in 4-tab workspace)
  8. `08_creator_profile.png` — `/creator/pptgod_lab` (creator header, impact stats, public portfolio)
- `--json-report <path>`: Optional path to write structured JSON results (`summary`, `tiers`, `tests[]` with `id`, `tier`, `name`, `status`, `duration_ms`, `error`, `details`).
- `--backup-db`: Optional WAL-safe backup of `data/pptgod.db` into an ephemeral temp dir via `sqlite3 .backup` before execution, plus post-run count check confirming clean state.
- `--timeout-ms <ms>`: Per-request HTTP and Playwright action timeout (default: `15000`).
- `--filter <substring>`: Optional case-insensitive filter matching test ID or name.
- **Strict Exit Policy:** Exits `0` **ONLY** when `executed > 0` AND `failed == 0` AND `errors == 0`. Never silently skips failed assertions or swallows exceptions. Prints a crisp per-test PASS/FAIL table with tier totals and exact failure diagnostics.

---

## 4. Four-Tier Systematic Test Design (35 Features + S1–S22)

### Tier 1 — Feature Coverage (Isolated Happy Paths across All Features & 7 Routes)
- **T1 API Suite:**
  - Public catalog: `GET /api/prompts` returns `200` with `18` curated styles, all `isPublic === true`, matching the 18 expected official slugs; query filters (`q`, `scenario`, `style`, `color`, `tool` for all 6 tools, `sort=popular|newest|copies`) return accurate filtered sets.
  - Auth lifecycle: `POST /api/auth/login` (`demo_designer`), `GET /api/auth/me` (returns `user` + `stats` with `published`, `likes`, `favorites`, `decks`), `POST /api/auth/logout`, invalid login (`401`).
  - Prompt CRUD & Social: `GET /api/prompts/apple-soft-bento-modular` (`200`), `POST /api/prompts/[id]/copy` increments `copiesCount`, `POST /api/prompts/[id]/like` & `favorite` toggle idempotently and restore cleanly.
  - Comments CRUD: `GET /api/prompts/prompt_swiss_grid/comments` returns seeded reviews; logged-in `POST` with `testedTool: "slidev-marp"`, `rating: 5`, valid content returns `201`; `DELETE` own comment returns `200`.
  - Sync favorites & Profile: `POST /api/prompts/sync-favorites` merges valid public IDs (`200 { synced }`); `PATCH /api/auth/profile` updates `displayName`/`bio`/`avatarColor` (`200`) and restores original values in `finally`.
  - Smart Generation Engine: `POST /api/generate` (`mode: "smart"`, `slideCount: 7`, real source text with metrics/quotes) returns `200 { slides, engine: "smart" }` with 7 structured slides, valid `slideType`s, non-empty `speakerNotes`.
  - Native `.pptx` Export: `POST /api/export/pptx` returns `200`, `Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`, magic header `PK\x03\x04`, size `> 30720` bytes, valid ZIP archive (`testzip() is None`), containing `ppt/slides/slide1.xml`..`slideN.xml`, `ppt/notesSlides/notesSlide1.xml`, and genuine slide title text inside the XML!
  - Saved Decks CRUD: `POST /api/decks` creates deck (`isPublic: false` default), `GET /api/decks` lists it, `GET /api/decks/[id]` returns it for author, `PUT`/`PATCH /api/decks/[id]` updates content/visibility, `DELETE /api/decks/[id]` cleans up.
  - Creator Profile API: `GET /api/creators/pptgod_lab` returns `200 { creator, prompts, impact, privateCount: 0 }` with public-only prompts & impact metrics.
- **T1 Browser UI Smoke Suite (Headless Chromium `1440×900`, `console.error == 0`, `pageerror == 0`):**
  - `/` (Gallery): 18 style cards rendered, global live topic input updates card canvases, filter & reset work, 30-second **StyleMatcherModal** opens from Hero CTA, completes 3 steps (audience -> lighting -> density), renders Top 3 recommendations with 16:9 `SlideCanvas` & Studio/Generate links.
  - `/studio/apple-soft-bento-modular`: Cycles all **8 slide types** (`cover`, `agenda`, `process`, `data`, `comparison`, `timeline`, `quote`, `closing`) asserting non-blank 16:9 canvas rendering on each; 5-dimension anatomy highlight interaction; live visual tuning + reset; all **6 target tools** (`claude-html`, `gamma-kimi`, `notebooklm`, `ai-image` single + **6-slide AI-image batch** toggle, `slidev-marp`, `python-pptx`); Quick Launch external links visible; sample `.pptx` & `.html` export buttons functional; per-tool verified reviews section rendered.
  - `/generate`: Preset material load + smart generate produces multi-slide deck; live style switcher re-skins canvas while preserving content; right WYSIWYG title/notes edit updates 16:9 canvas live; fullscreen roadshow modal opens & closes cleanly; `.pptx` and offline `.html` export verified.
  - `/compare`: Multi-style synced compare across all 8 slide types, unified topic input, parameter matrix, and「用此风格生成 PPT」CTA.
  - `/create?fork=swiss-international-grid`: Remix prefill, attribution banner, 8-slide preview tabs, 15 layout archetypes / 11 decorative motifs available, Public/Private visibility toggle visible.
  - `/collections`: Authenticated 4-tab workspace (`已收藏风格`, `我保存的 PPT 文稿`, `我发布的风格`, `我点赞的`) + Edit Profile modal opens & displays fields.
  - `/creator/pptgod_lab`: Avatar, bio, public impact cards, public portfolio grid rendered.

### Tier 2 — Boundary & Corner Cases
- **Validation Boundaries (API):**
  - `POST /api/prompts`: empty title, 1-char title, >60-char title, short summary (<8 chars), missing `promptAnatomy` dimensions -> `400`.
  - `POST /api/prompts/[id]/comments`: 3-char content (`<4`) -> `400`; 501-char content (`>500`) -> `400`; out-of-range rating (`0`, `99`) -> clamped to `[1, 5]` or rejected with `400` cleanly.
  - `POST /api/generate`: empty `topic` -> `400`; `slideCount: 2` clamped to `5`; `slideCount: 99` clamped to `8`; empty `sourceText` succeeds cleanly with fallback copy.
  - BYOK `mode: "llm"` boundaries:
    1. Missing `apiKey` -> `400` with clear guidance.
    2. Invalid/unreachable `apiBase` or upstream HTTP `500` -> `502` structured JSON error (no server crash).
    3. **Genuine local mock OpenAI-compatible HTTP server (`127.0.0.1:<ephemeral>`)**: verifies `POST /api/generate` forwards `Authorization: Bearer <test-key>` to `${apiBase}/chat/completions`, parses valid strict JSON `{"slides": [...]}` from `choices[0].message.content`, and returns `200 { engine: "llm", slides: [...] }`.
    4. Mock LLM returning malformed non-JSON content -> clean `502`/`500` JSON error (never hangs or crashes).
- **Export & Canvas Corner Cases:**
  - `POST /api/export/pptx`:
    1. `bars: []` empty array on a `data` slide -> succeeds (`200`, valid `.pptx` ZIP, zero crash).
    2. Dark theme (`keynote-obsidian-stage`) with `rgba(...)` border/surface colors -> succeeds (`200`, valid `.pptx` ZIP, no invalid hex crash).
    3. Special Chinese + punctuation/slash title (`"2026 Q4/战略复盘：AI「核心」增长 & 100%"`) -> succeeds (`200`, safe RFC 5987 `Content-Disposition`, valid `.pptx` ZIP).
    4. Empty `slides: []` or missing `visualSpec` -> `400`.
  - Browser `/generate` corner cases:
    1. Deleting slides down to 1 remaining slide triggers last-slide guard (cannot delete to 0 slides, zero errors).
    2. Switching a `cover` slide's type to `data`, `timeline`, `quote`, `comparison`, `process` (where subfields may be missing/empty) renders cleanly without `NaN` SVG coordinates or console/page errors.
- **Auth, Routing & Selection Guards:**
  - Nonexistent prompt slug (`/api/prompts/nonexistent-slug-xyz`, `/studio/nonexistent-slug-xyz`) -> `404`.
  - Nonexistent creator username (`/api/creators/nonexistent_user_xyz`, `/creator/nonexistent_user_xyz`) -> `404`.
  - Unauthenticated mutations (`POST /api/prompts`, `PUT /api/prompts/[id]`, `DELETE /api/prompts/[id]`, `POST /api/prompts/[id]/like`, `favorite`, `comments`, `POST /api/prompts/sync-favorites`, `PATCH /api/auth/profile`, `POST /api/decks`, `PATCH/PUT/DELETE /api/decks/[id]`) -> `401`.
  - Duplicate registration email (`POST /api/auth/register` with `demo@pptgod.studio`) -> `409` (non-mutating!).
  - Browser `/compare` or Gallery compare dock: attempting to add a 4th style triggers the >3 compare guard (count stays <= 3).

### Tier 3 — Cross-Feature Combinations & ALL 22 Security/Privacy Invariants (S1–S22)
- **Complete Security & Privacy Invariants Suite (Anonymous + Author A `demo_designer` + User B `chen_strategy`):**
  - **S1:** Private prompt (`isPublic: false`) excluded from `GET /api/prompts` (default, search `q`, filters) for Anonymous & User B.
  - **S2:** Private prompt included in `GET /api/prompts?scope=mine` for Author A with `isPublic === false`.
  - **S3:** User B likes & favorites Author A's public prompt -> Author A flips it to `isPublic: false` -> User B's `GET /api/prompts?scope=favorites` and `scope=liked` EXCLUDE it!
  - **S4:** `GET /api/prompts/[privateId]` and `[privateSlug]` return `404` for Anonymous & User B.
  - **S5:** `GET /api/prompts/[privateId]` returns `200` with `isPublic === false` for Author A.
  - **S6:** SSR `GET /studio/[privateSlug]` returns HTTP `404` for Anonymous & User B AND response HTML/`<title>` does NOT contain the private prompt's title!
  - **S7:** SSR `GET /studio/[privateSlug]` returns HTTP `200` for Author A (renders private badge & Edit link).
  - **S8:** SSR `GET /`, `GET /compare`, `GET /creator/demo_designer` exclude Author A's private prompt for Anonymous & User B (absent from HTML/cards and public impact counts).
  - **S9:** SSR `GET /creator/demo_designer` & `GET /api/creators/demo_designer` for Author A exclude private prompt from public `prompts[]` and public `impact` counters while returning `privateCount >= 1` ONLY to Author A (`privateCount === 0` for Anonymous/User B).
  - **S10:** `GET/POST/DELETE /api/prompts/[privateId]/comments` and `POST /api/prompts/[privateId]/{like,favorite,copy}` return `404` for User B (and `404` or `401` for Anonymous), without leaking comments or incrementing counters.
  - **S11:** Author A gets `200` on `GET /api/prompts/[privateId]/comments` and `POST /api/prompts/[privateId]/copy`.
  - **S12:** User B calling `POST /api/prompts/sync-favorites` with Author A's private prompt ID silently ignores it (`synced: 0`, `savesCount` unchanged).
  - **S13:** `PUT /api/prompts/[id]`, `PATCH /api/prompts/[id]`, `DELETE /api/prompts/[id]`: Anonymous -> `401`; User B -> `403` (or `404` when private); Author A -> `200`.
  - **S14:** Public Prompt B remixed from Prompt A -> Author A sets Prompt A to `isPublic: false` -> Anonymous & User B fetching Prompt B do NOT receive Prompt A's private `remixedFrom` title/slug!
  - **S15:** `POST /api/decks` without `isPublic` saves with `isPublic === false` by default.
  - **S16:** Private deck `GET /api/decks/[id]` returns **`403`** for Anonymous & User B.
  - **S17:** Private deck `GET /api/decks/[id]` returns `200` (`isPublic: false`) for Author A.
  - **S18:** Author A flips deck to `isPublic: true` -> `GET /api/decks/[id]` returns `200` (`isPublic: true`) for Anonymous & User B; User B calling `POST /api/decks` with Author A's public deck `id` creates a **non-destructive clone** owned by User B (new ID, Author A's original deck untouched).
  - **S19:** `PATCH /api/decks/[id]`, `PUT /api/decks/[id]`, `DELETE /api/decks/[id]`: Anonymous -> `401`; User B -> `403`; Author A -> `200`.
  - **S20:** `GET /api/decks`: Anonymous -> `{ decks: [] }`; Author A -> only Author A's decks; User B -> never sees Author A's decks.
  - **S21:** `DELETE /api/prompts/[id]/comments?commentId=...`: Anonymous -> `401`; User B (non-comment-author) -> `403`; Comment author -> `200`.
  - **S22:** BYOK `apiKey` sent to `POST /api/generate` (`mode: "llm"` with local mock server): API key is forwarded ONLY to `${apiBase}/chat/completions`, NEVER returned in `/api/generate` response body/headers, and NEVER persisted anywhere in `data/pptgod.db` (verified via read-only scan of JSON response and optional DB check).
- **End-to-End Cross-Feature User Journeys (Playwright + API):**
  - **Journey A (Guest Local Favorites -> Login Auto-Sync -> `/collections`):** Unauthenticated visitor favorites a style (stored in `localStorage`), logs in via demo login, verifies `POST /api/prompts/sync-favorites` fires automatically, `localStorage` key clears, and the style appears in `/collections` -> 「已收藏风格」.
  - **Journey B (Matcher -> Studio -> Remix -> Author Edit -> Visibility Flip -> Creator Profile):** Complete 30s StyleMatcherModal -> enter recommended Studio -> click Remix (`/create?fork=...`) -> publish public remix -> verify `remixedFrom` provenance -> click Edit (`/create?edit=...`) -> update title & flip to Private -> confirm hidden from `/creator/demo_designer` public gallery & visible in `/collections` 「我发布的风格」 -> cleanup delete.
  - **Journey C (Studio -> `/generate?style=...` -> Re-skin -> Edit -> Save Deck -> `/collections` -> Reopen `/generate?deck=...` -> Export `.pptx` & `.html`):** Full dual-core creation, editing, cloud save (private default), reload from `/collections`, toggle public share, verify native `.pptx` and offline `.html` exports, cleanup delete.

### Tier 4 — Real-World Application Scenarios, Visual/Aesthetic Discipline & Screenshots
- **5+ Realistic End-to-End Personas / Workloads:**
  1. **Executive Board Q4 Review Deck:** Q4經營复盘 preset -> McKinsey/Consulting or Financial style -> edit executive KPIs & bars -> save private deck -> export `.pptx` & verify edited KPI appears in `ppt/slides/slide*.xml` -> cleanup.
  2. **AI Product Launch Keynote Deck:** AI企业知识库 preset -> `apple-soft-bento-modular` / `keynote-obsidian-stage` live re-skin -> add `quote` slide -> edit speaker notes -> export `.pptx` & `.html` and verify notes in `ppt/notesSlides/` and `.html` -> cleanup.
  3. **Academic Thesis Defense Deck:** 人工智能学术答辩 preset -> academic style -> 8-slide structure check (`process`, `timeline`, `data`) -> `.pptx` structural validation -> cleanup.
  4. **Brand Style Curator Remix + Per-Tool Review Workflow:** Remix `swiss-international-grid` -> customize palette/anatomy -> publish -> submit per-tool `claude-html` 5-star review -> verify on Studio & Creator Profile -> cleanup.
  5. **Privacy-First Enterprise Confidential Deck Workflow:** Create private prompt + private deck -> verify zero leakage to Anonymous & User B across API + SSR -> toggle deck to Public Share -> User B views & non-destructively clones -> cleanup both decks & prompt.
- **Responsive Viewport Verification (`1440×900` Desktop & `390×844` Mobile):**
  - Visit all 7 routes on both viewports asserting `document.documentElement.scrollWidth <= window.innerWidth + 2`, `console.error == 0`, and `pageerror == 0`.
- **Aesthetic & Stack Discipline Verification:**
  - Static check (read-only): `package.json` contains zero `tailwindcss` dependency; `src/` stylesheets contain zero `@tailwind` directives.
  - Computed-style Browser check across rendered routes: zero elements using gradient text (`-webkit-background-clip: text` / `background-clip: text` with transparent text fill), zero neon multi-glow box-shadows on editorial chrome, and warm archival paper background (`#f5f2eb` / `rgb(245, 242, 235)`) preserved on `body`.
- **Screenshot Capture (`--screenshots-dir`):**
  - Captures all 8 required desktop (`1440×900`) PNG screenshots cleanly for M6's `walkthrough.md`.

---

## 5. Resilient Selector & Contract Strategy (Parallel Development Safety)

Because the E2E Testing Track builds `tests/e2e/**` in parallel with Implementation Milestones M1–M5:
1. **API & Route Tests** assert strictly against the frozen contracts in `PROJECT.md § Interface Contracts` and `implementation_plan.md`.
2. **Playwright UI Locators** prioritize resilient, semantic, accessible selectors:
   - Role + accessible text/name (`page.get_by_role("button", name=re.compile(...))`, `get_by_role("link", ...)`, `get_by_role("tab", ...)`).
   - Route URLs and `href` prefix matching (`a[href*="/generate?style="]`, `a[href*="/create?fork="]`, `a[href*="/create?edit="]`, `a[href*="/creator/"]`).
   - Documented semantic Chinese/English labels from `product_design.md` & `implementation_plan.md` (with flexible regex alternatives where wording could vary slightly, e.g. `r"智能选词|选词顾问|30\s*秒"`).
   - Known stable v1 DOM IDs (`#pg-global-topic-input`, `#pg-demo-login-btn`) used as prioritized fallbacks alongside accessible locators.
3. **Validation Before M6 Integration:**
   - Syntax & bytecode check: `/opt/pyenv/shims/python3 -m py_compile tests/e2e/*.py`
   - Static AST audit (no bare `except: pass`, no hardcoded fake PASS returns, no forbidden writes to `.agents/teamwork/` or `src/`).
   - Self-test harness (staged in `mktemp -d` during verification) exercising `run_e2e.py`, `ApiClient`, `CleanupRegistry`, `PptxVerifier`, `HtmlDeckVerifier`, `MockOpenAIServer`, and Playwright Chromium launch against a local mock HTTP server to prove real PASS *and* real FAIL detection!
