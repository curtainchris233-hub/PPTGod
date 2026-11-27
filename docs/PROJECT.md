# Project: PPTGod · Glacier UI 2.0 全站视觉重构

> **Single Source of Truth** for PPTGod Glacier UI 2.0 architecture, complete feature inventory (`F1–F41`), honest mockup-vs-backend boundaries (`B1–B16`), milestone decomposition, interface contracts, exclusive file ownership, and verification gates.
>
> **Authoritative Upstream Documents**:
> - Verbatim User Request: `/home/antigravity/curtainchris233-hub/PPTGod/.agents/teamwork/ORIGINAL_REQUEST.md`
> - Primary Development Spec: `/home/antigravity/curtainchris233-hub/PPTGod/docs/PPTGod_Glacier_UI_2.0_Development_Spec.md`
> - Complementary Design Spec: `/home/antigravity/curtainchris233-hub/PPTGod/docs/PPTGod_UI_Design_Spec.md`
> - Phase 0 Survey Reports:
>   - Spec & 5-PNG Visual Inventory: `.agents/teamwork/spec_miner_survey_1/spec_inventory.md` & `handoff.md`
>   - Frontend, Routes & CSS Audit: `.agents/teamwork/explorer_survey_2/handoff.md`
>   - Backend APIs, SQLite WAL & E2E Audit: `.agents/teamwork/explorer_survey_3/handoff.md`
> - **5 UI Reference Screenshots (MUST inspect directly via `view_file`)**:
>   1. `/home/antigravity/E3354A27-4F04-4F81-B95A-89DEE68D2E1C.png` — Dashboard (`/`, primary visual baseline)
>   2. `/home/antigravity/60D7FB7A-4C99-4108-9CE3-AA397AF04BD9.png` — Style Gallery (`/gallery`)
>   3. `/home/antigravity/2BFDA63D-63B3-40F3-A762-341CFDBCA0E9.png` — Creation Workshop (`/generate` wizard)
>   4. `/home/antigravity/3FA2BA18-157F-473A-A3FE-3A2635E88FF1.png` — Presentation Editor (`/generate` editor)
>   5. `/home/antigravity/6E0BCE7C-EAB4-4066-A19C-C6CDD83E661D.png` — My Projects (`/collections`)

---

## Architecture

- **Git Branch Mandate**: Strictly develop and commit cleanly per milestone on `feat/glacier-ui-2.0` (branched from `main` `66d0087`). **NEVER modify `main`**. Use scoped `git add <owned-paths>` per milestone.
- **Tech Stack (Strict)**: Next.js `16.4.6` (App Router), React `19.3.0`, TypeScript `5.9.3` (`strict: true`), **100% Pure Vanilla CSS (ZERO TailwindCSS, ZERO PostCSS, ZERO second UI framework)**, `lucide-react` (`^1.79.0`, stroke 1.75–2px, zero functional emojis), SQLite WAL (`better-sqlite3`, `data/pptgod.db`), `pptxgenjs`, `mammoth`, `unpdf`.
- **Visual System — Glacier UI 2.0 (70% Utility / 20% Glacier Glass / 10% AI Tech Accent)**:
  - Canonical tokens in `src/styles/glacier-tokens.css` (`--gl-*` namespace + safe legacy bridge in `src/app/globals.css`):
    - `--gl-bg: #F0F6FC`, `--gl-bg-subtle: #E7F1FB`, `--gl-surface: #FFFFFF`, `--gl-glass: rgba(255, 255, 255, 0.78)`, `--gl-surface-hover: #F5F9FE`
    - `--gl-primary: #2563EB`, `--gl-primary-hover: #1D4ED8`, `--gl-primary-light: #E2EDFF`, `--gl-cyan: #38BDF8`
    - `--gl-primary-gradient: linear-gradient(135deg, #409BFF 0%, #2563EB 65%, #1749D8 100%)`
    - `--gl-page-gradient: linear-gradient(145deg, #F8FBFF, #EAF3FC)`
    - `--gl-text: #14243C`, `--gl-text-secondary: #52657B`, `--gl-muted: #64748B`, `--gl-border: #D9E5F1`, `--gl-border-interactive: #71828D`, `--gl-border-glass: rgba(255, 255, 255, 0.9)`
    - `--gl-success: #15803D`, `--gl-warning: #B45309`, `--gl-danger: #B91C1C`, `--gl-focus: #2563EB`
    - `--gl-radius-sm: 8px`, `--gl-radius-md: 12px`, `--gl-radius-lg: 16px`, `--gl-radius-xl: 20px`
    - `--gl-shadow-sm: 0 2px 8px rgba(36, 72, 120, 0.06)`, `--gl-shadow-md: 0 8px 24px rgba(36, 72, 120, 0.09)`, `--gl-shadow-primary: 0 5px 16px rgba(37, 99, 235, 0.20)`
    - `--gl-topbar-h: 64px`, `--gl-sidebar-w: 220px`, `--gl-sidebar-collapsed-w: 64px`, `--ease-apple: cubic-bezier(0.22, 1, 0.36, 1)`
  - **CSS Isolation**: Do NOT overwrite legacy `--radius-sm/md/lg` or `--shadow-sm/md` destructively while unmigrated pages rely on them; build all new Glacier layout/UI/page modules strictly with `--gl-*` / `.gl-*`, bridge legacy color/border/nav vars in `globals.css`, fix undefined `var(--border-subtle)`, add global `:focus-visible`, and preserve `prefers-reduced-motion` + `content-visibility: auto` on gallery cards + compositor-only `pg*` keyframes.
  - **Fonts**: Keep all 5 `next/font/google` variables on `<html>` (`--font-sans`, `--font-serif`, `--font-mono`, `--font-cjk-sans`, `--font-cjk-serif`) because `SlideCanvas` depends on them. Glacier App UI uses Sans (`Plus Jakarta Sans` + `Noto Sans SC`) and Mono (`JetBrains Mono`); Serif is restricted strictly to slide templates inside `SlideCanvas`.
  - **Glass Blur Budget**: `@supports (backdrop-filter: blur(12px))` ONLY on `Topbar`, floating modals/drawers/popovers, and hero primary panels — NEVER on 36-card gallery lists or dense project grids.
  - **Glacier Visual Assets (`public/brand/`)**: Low-contrast abstract snow-peak SVG (`public/brand/glacier-hero-peaks.svg`) and brand mark (`public/brand/pptgod-logo.svg`) confined strictly to top-right hero bands (`/`, `/gallery`, `/collections`, `/generate` creation), `pointer-events: none`, `aria-hidden="true"`, never covering text or acting as full-screen wallpaper.
- **Route Architecture Shift**:
  - `/` (`src/app/page.tsx`) → **Glacier Bento Dashboard** (PNG-1: 8:4 AI Creation + Upload, 9:3 Same-Content 3-Style `SlideCanvas` + 2×3 Recommended Styles, 4:8 Real Recent Projects + 4 Quick Tools). Backward compatibility: if `/` receives legacy filter query params (`q`, `domain`, `scenario`, `style`, `color`, `tool`, `sort`), server-redirect to `/gallery?...`.
  - `/gallery` *(NEW `src/app/gallery/page.tsx`)* → **Style Gallery** (PNG-2: 36+ real `VisualSpec` templates, live-count domain capsules, URL-synced multi-facet filters, 4-col grid, 2px blue selected border, favorites, Detail Drawer, Compare dock, `StyleMatcherModal`, `DocIntakeWorkbench`).
  - `/generate` → **Dual-Mode Creation Workshop & Presentation Editor** (`?mode=create|editor`, `?panel=audit`, preserving `?style=`, `?topic=`, `?deck=`, `?handoff=1`, `?intake=1`):
    - Creation Stage (PNG-3): 4-step left stepper, 60:40 brief + 10MB/5-ext upload & parsed files list vs live 16:9 `示例预览` preview, bottom style rail, fixed params bar, editable `OutlineDraftPanel`, honest stage progress/retry.
    - Editor Stage (PNG-4): Full-bleed viewport, auto-collapsible global sidebar, dedicated editor topbar, left `大纲 | 幻灯片` tree, center 16:9 stage + honest real-capability toolbar + zoom/pager + speaker notes w/ real `AI 讲稿生成`, right `本页编辑` & `页面与主题` + real `/api/polish` `AI 助手` (preview + confirm apply), 100-pt `DeckAuditDrawer`.
  - `/collections` → **My Projects & Personal Space** (PNG-5: honest filter rail, real computed KPIs, search/visibility/sort/Grid-List view, 4-col `ProjectCard` w/ 16:9 cover + Open/Present/Rename(`PUT`)/Duplicate(`POST`)/Visibility(`PATCH`)/Export PPTX/Delete-confirm(`DELETE`), honest empty states, preserved Favorites/Published/Liked/Profile Edit tabs).
  - Secondary & Auxiliary Routes (all upgraded to Glacier UI 2.0): `/compare`, `/studio` (redirect to top style) & `/studio/[slug]`, `/deck/[id]` (with `?rehearsal=1`), `/create`, `/tools` (with `?tab=pacing|pptx-inspect|palette-wcag|visual-director` + saved-deck rehearsal launcher), `/creator/[username]`, plus unified Glacier `AuthModal`, `SettingsModal`, and `HelpModal`.
- **Zero-Regression Backend & Data Core (STRICTLY PRESERVED)**:
  - All 22 API route handlers (`src/app/api/**`), all 17 domain modules (`src/lib/**`), `src/types/prompt.ts`, SQLite WAL `data/pptgod.db` (7 tables, 36 styles, 3 users, 5 comments), all 22 security/privacy invariants (`S1–S22`), `SlideCanvas.tsx` + `src/components/slide-canvas/**`, and `src/app/studio/[slug]/opengraph-image.tsx` are **FROZEN / READ-ONLY**.

---

## Feature Inventory

Every feature from Phase 0 Survey (`spec_miner_survey_1`, `explorer_survey_2`, `explorer_survey_3`) is assigned to a milestone (zero unassigned features):

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Glacier Design Tokens (`src/styles/glacier-tokens.css`) | All 17 Glacier colors, 2 gradients, 3 shadows, 5 radii, 4px grid, `:focus-visible`, `prefers-reduced-motion`, `--border-subtle` fix, `--ease-apple` preservation (100% Vanilla CSS, zero Tailwind) | M1 | survey_1, survey_2, survey_3 |
| F2 | Typography & Lucide Icon System | Plus Jakarta Sans + Noto Sans SC + JetBrains Mono on UI; preserve all 5 `next/font` vars on `<html>` for `SlideCanvas`; serif templates-only; Lucide 1.75–2px icons, zero functional emojis | M1 | survey_1, survey_2 |
| F3 | `public/brand/` Glacier SVG Assets | Lightweight low-contrast `glacier-hero-peaks.svg` (top-right hero bands only, `pointer-events: none`, never covering text) & `pptgod-logo.svg` ice-blue `P` mark | M1 | survey_1, survey_2 |
| F4 | Scoped `backdrop-filter` Performance Policy | `@supports (backdrop-filter: blur(12px))` strictly on Topbar, modals/drawers/popovers & hero panels; solid `#FFFFFF` + `content-visibility: auto` on dense card grids | M1 | survey_1, survey_2, survey_3 |
| F5 | `AppShell` + `Topbar` (`64px`) + `LayoutContext` | Sticky 64px frosted topbar with brand, synced nav active pill, global search → `/gallery?q=`, user/login (`#pg-nav-login-btn`/`#pg-nav-logout-btn`), NO fake notification bell; contrast verified over light & dark slides | M1 | survey_1, survey_2, survey_3 |
| F6 | Collapsible `Sidebar` (`220px ↔ 64px`) + `MobileNavDrawer` | Desktop collapsible rail w/ tooltips, auto-collapsible in Editor, `<1024px`/`<768px` drawer w/ focus trap & Esc close; NO fake Pro card or feedback form; all nav links route to real workflows | M1 | survey_1, survey_2 |
| F7 | `GlacierPanel` & Button Suite | `GlacierPanel` (`default`/`solid`/`floating`), `Button` (`primary` gradient / `secondary` / `ghost` / `danger`), `IconButton` (mandatory `aria-label` + tooltip); full 8-state coverage | M1 | survey_1, survey_2 |
| F8 | Glacier Form Controls & Navigation Primitives | `TextInput`, `Textarea`, `Select`, `Tabs` (`role="tablist"` + arrow nav), `FilterChip` (`aria-pressed`), explicit `<label>` & `aria-invalid`/`aria-describedby` | M1 | survey_1, survey_2 |
| F9 | `UploadDropzone` (Real 10MB / 5-Format Validation) | Drag/drop + click enforcing real `.pdf/.docx/.pptx/.md/.txt` & `≤10MB`, per-file parse status/remove/error without losing typed draft, shared anti-double-submit lock | M1 | survey_1, survey_2, survey_3 |
| F10 | Overlay, Feedback & Progress Primitives + Glacier `AuthModal`/`CompareDock`/`not-found` | `Dialog`, `Drawer` (focus trap + Esc + focus restore), `Toast` (`aria-live`), `EmptyState`, `Skeleton` (CLS-safe), `Stepper`, `Progress` (no fake `%`), restyled `AuthModal` (keeping `#pg-demo-login-btn`) & `CompareDock` | M1 | survey_1, survey_2, survey_3 |
| F11 | `SlidePreviewFrame` (`SlideCanvas` Isolation) | Fixed 16:9 wrapper around unchanged `SlideCanvas`, external selection/chrome borders, optional honest `示例预览` badge, loading/error fallback | M1 | survey_1, survey_2 |
| F12 | `/` Dashboard Hero Band | H1 `"你好，开始用 AI 创作你的演示文稿吧"` (ONLY `AI 创作` in `#2563EB`), subtitle, top-right glacier SVG, backward-compat server redirect to `/gallery?...` when legacy filter params present | M1 | survey_1, survey_2 |
| F13 | `/` Dashboard Row 1 (`8:4`): AI Creation 3-Tab + Upload Panel | `AI 生成`/`资料转 PPT`/`从模板新建` tabs, topic textarea, slideCount (5–20), audience, language (scoped honestly), advanced settings, single primary gradient CTA; right `UploadDropzone` wired to `/api/parse-document` sharing submit lock | M1 | survey_1, survey_2, survey_3 |
| F14 | `/` Dashboard Row 2 (`9:3`): Same-Content 3-Style Live Compare + `2×3` Recommended Styles | 3 real 16:9 `SlideCanvas` cards (`01 商务专业`/`02 清新学术`/`03 创意科技`) synced to identical topic w/ radio select & `更多对比 →` (`/compare`); 2×3 mini real templates & `更多风格 →` (`/gallery`) | M1 | survey_1, survey_2 |
| F15 | `/` Dashboard Row 3 (`4:8`): Real Recent Projects + 4 Quick Tools | Up to 3 real `/api/decks` items (+ local unsaved draft fallback) or honest empty CTA when 0/guest; 4 working Quick Tool cards (`进入创作工坊`, `设计体检`, `演讲排练` labeled honestly as `演播提词与倒计时排练`, `提示词工作室`) | M1 | survey_1, survey_2, survey_3 |
| F16 | `/gallery` Dedicated Route & Glacier Hero + SEO | New `src/app/gallery/page.tsx` loading 36+ DB styles server-side, Glacier hero + mountain SVG; add `/gallery` & `/tools` to `robots.ts` & `sitemap.ts` | M2 | survey_1, survey_2 |
| F17 | `/gallery` Dynamic Category Capsules, Multi-Facet Filters & URL Sync | Live-computed domain counts (`#pg-domain-tabs`, `#pg-domain-tab-*`), Scenario/Style/Color/Tool selects, search (`#pg-gallery-search`), sort (`popular`/`newest`/`copies`), bidirectional URL query sync, zero-result `清除筛选`, `StyleMatcherModal` (`#pg-open-matcher-btn`) & `DocIntakeWorkbench` | M2 | survey_1, survey_2, survey_3 |
| F18 | `/gallery` 4-Col `StyleCard` Grid + Selection + Favorites + Quick Actions | 4/3/2/1 responsive grid (`content-visibility: auto`, no blur on cards), 16:9 `SlideCanvas` (`article[data-prompt-slug]`), `2px solid #2563EB` selected border + check badge, DB/guest favorites, `预览`/`使用风格`/`复制提示词`/`加入对比` | M2 | survey_1, survey_2, survey_3 |
| F19 | `/gallery` Style Detail `Drawer` | Multi-slide-type 16:9 `SlideCanvas` switcher (all 12 types), palette hex swatches, typography/archetype metadata, `使用此风格`, `加入对比`, `提示词工作室`, `复制提示词` | M2 | survey_1, survey_2 |
| F20 | `/generate` Creation Workshop: 4-Step Vertical `Stepper` & `useDeckWorkshop` Hook | Extract `/generate` state/undo/draft/handoff/API logic into `src/hooks/useDeckWorkshop.ts`; 4-step left rail (`内容与资料` → `选择风格` → `AI 生成` → `预览与优化`); preserve `?style=`, `?topic=`, `?deck=`, `?handoff=1`, `?intake=1`, `?mode=create\|editor`, `?panel=audit` | M2 | survey_1, survey_2, survey_3 |
| F21 | `/generate` Workshop: `60:40` Input/Upload + Live `示例预览` | Topic textarea + char count + quick sample chips + 10MB/5-ext `UploadDropzone` + per-file parsed status cards (sequential `/api/parse-document`, 6-type triage); right 16:9 `SlideCanvas` w/ mandatory `示例预览` badge + 4–5 page thumbnails + fullscreen preview | M2 | survey_1, survey_2, survey_3 |
| F22 | `/generate` Workshop: Bottom Style Strip & Fixed Params Bar | Domain-filtered real style cards w/ 2px blue selected border; fixed params bar (`页数 5–20`, honest locked `16:9`, scoped language, `高级设置` for Smart vs BYOK / audience / evidenceDensity / `beautify-1to1`, `先看大纲` & `开始生成`) | M2 | survey_1, survey_2, survey_3 |
| F23 | `/generate` Workshop: Editable Outline Confirmation & Honest Progress / Retry | Glacier-restyled `OutlineDraftPanel` (titles, summaries, 12 slide types, reorder, add/delete, sourceStatus badges); real stage progress without fake `%`; failure retry preserves all inputs | M2 | survey_1, survey_2, survey_3 |
| F24 | `/collections` My Projects Hero, Honest Filter Rail & Real Stat Cards | Glacier hero + mountain SVG; integrated honest left filter rail (`全部项目`, `最近编辑`, `我收藏的风格`, `公开分享`, `我发布的风格`, `我点赞的` — ZERO fake shared/trash/Pro/custom folders); real computed KPI cards + `+ 新建演示文稿` | M2 | survey_1, survey_2, survey_3 |
| F25 | `/collections` Search, Filter, Sort, Grid/List View & 4-Col `ProjectCard` CRUD | Search, visibility filter, sort, Grid/List toggle; 16:9 `SlideCanvas` cover, 2-line title, honest `公开`/`私有` badge, overflow actions: Open (`/generate?deck=`), Present (`/deck/[id]`), Rename (`PUT /api/decks/[id]`), Duplicate (`POST /api/decks` w/o `id`), Visibility (`PATCH`), Export PPTX, Delete w/ confirm `Dialog` (`DELETE`) | M2 | survey_1, survey_2, survey_3 |
| F26 | `/collections` Honest Empty States & Preserved Community Space | Distinct guest vs 0-deck vs 0-match empty states; preserves Favorites, Published Styles (All/Public/Private + Edit/Delete), Liked Styles, and Profile Edit modal (`PATCH /api/auth/profile`) | M2 | survey_1, survey_2, survey_3 |
| F27 | `/generate` Editor: Full-Bleed Mode & Dedicated Editor Topbar | Auto-collapsible global sidebar (`LayoutContext.editorFullBleed`); editor topbar w/ back arrow, editable title, honest Save Status (`保存中`/`已保存`/`未保存草稿`/`失败`), Undo/Redo (`#pg-gen-undo-btn`/`#pg-gen-redo-btn`), Save, Present, primary `导出 PPTX`, overflow menu (HTML/Marp/Checklist/Audit/Share) | M3 | survey_1, survey_2, survey_3 |
| F28 | `/generate` Editor: Left Slide Tree (`210–240px`) + `大纲`/`幻灯片` Toggle | Toggle between compact text outline and numbered 16:9 thumbnails; 2px blue active ring; drag/button reorder, duplicate, delete (min-1 guard + undoable); sticky `+ 新建幻灯片` | M3 | survey_1, survey_2, survey_3 |
| F29 | `/generate` Editor: Center 16:9 Stage + Honest Real-Capability Toolbar + Pager/Zoom | `#E7F1FB` backdrop, white-framed 16:9 `SlideCanvas`, real-capability toolbar (`16:9`, `换版式不动字`, `配图管理`, `数据与内容`, `品牌主题`, `设计体检 [XX分]` — ZERO fake 形状/表格/动画/切换); bottom pager, fullscreen, CSS scale zoom (`50%–150%`/Fit) | M3 | survey_1, survey_2, survey_3 |
| F30 | `/generate` Editor: Bottom Collapsible Speaker Notes + Real `AI 讲稿生成` | Live char count, undoable textarea, `AI 讲稿生成` button wired to `POST /api/polish` (`action: "notes"`) | M3 | survey_1, survey_2, survey_3 |
| F31 | `/generate` Editor: Right Properties Panel (`300–340px`, 2 Real Tabs) | `本页编辑` (`SlidePropertyInspector`: 12-layout `仅换版式不动字`, structured fields, `ImageSlotManager`, source status) + `页面与主题` (`DeckSpecTweaker`: theme swap, palette, WCAG contrast badge + autofix, radius, `brandFooter`); drawerized `<1024px`; NO fake `动画`/`切换` tabs | M3 | survey_1, survey_2, survey_3 |
| F32 | `/generate` Editor: Right `AI 助手` Wired to `/api/polish` | 3 real actions (`高管精炼 executive`, `补充量化标尺 metrics`, `优化演讲稿 notes`) + before/after preview card w/ explicit `确认应用` (commits to Undo stack) & `放弃`; honest Smart vs BYOK guidance (NO fake freeform chat) | M3 | survey_1, survey_2, survey_3 |
| F33 | Design Audit (`设计体检`) Glacier UI & Real Entry Points | Sidebar `设计体检` & Dashboard Quick Tool open real `/generate?panel=audit` (`DeckAuditDrawer` w/ `deckLinter.ts` 100-pt score, 4 real categories, jump-to-slide, contrast/notes autofix) and `/tools?tab=pptx-inspect` | M3 | survey_1, survey_2, survey_3 |
| F34 | Rehearsal Cockpit (`/deck/[id]`) Glacier Restyle & Honest Entry | Glacier-harmonized theater & split Rehearsal Cockpit (`?rehearsal=1` auto-open), current + next slide, teleprompter A+/A-, 5 timer presets + overtime alert, keyboard/touch nav; ZERO fake voice/WPM/pause analysis; sidebar/dashboard `演讲排练` routes to real deck rehearsal or `/tools?tab=pacing` launcher | M3 | survey_1, survey_2, survey_3 |
| F35 | Style Comparator (`/compare`) Glacier Restyle | Top-aligned 2–3 col same-content `SlideCanvas` comparison synced across 12 slide types, palette/font specs, add/replace/remove, mobile single-canvas switcher, honest `示例` label, preserved `#pg-compare-*` IDs | M3 | survey_1, survey_2, survey_3 |
| F36 | Prompt Studio (`/studio` + `/studio/[slug]`) Glacier Restyle | Add `/studio/page.tsx` redirect to top style; Glacier 2-col workbench with 12-slide filmstrip, 5-dim anatomy, live tweaker, 6-tool `promptCompiler.ts` + 6/12-slide batch, copy/sample exports/remix/edit/comments, preserved `#pg-*` IDs | M3 | survey_1, survey_2, survey_3 |
| F37 | Secondary Pages (`/create`, `/tools`, `/creator/[username]`) Glacier Restyle | Full Glacier upgrade preserving Image-to-Style palette extractor + WCAG autofix + `.pptgod.json` + visibility radio (`/create`), 4-tab toolbox w/ `?tab=` & saved-deck rehearsal launcher (`/tools`), public creator portfolio & impact cards (`/creator/[username]`) | M3 | survey_1, survey_2, survey_3 |
| F38 | Glacier `SettingsModal` & `HelpModal` | Wired from Sidebar footer: Settings = real profile edit (`PATCH /api/auth/profile`) + browser-local BYOK defaults (never written to SQLite, S22 preserved); Help = searchable FAQ (10MB/5-ext, Smart vs BYOK, exports, keyboard shortcuts) | M3 | survey_1, survey_2, survey_3 |
| F39 | 5-Breakpoint Responsive Verification (`390/768/1024/1440/1920px`) | Zero unintended horizontal scroll, dedicated responsive grids, drawerized editor inspector `<1024px`, full-width mobile CTAs, ≥44px touch targets across all routes | M4, E2E | survey_1, survey_3 |
| F40 | WCAG 2.2 AA & Full Keyboard Operability | ≥4.5:1 text / ≥3:1 non-text contrast (incl. frosted Topbar over light & dark templates), visible `:focus-visible`, logical Tab order, modal/drawer focus trap + Esc + focus restore, non-color-only state cues | M4, E2E | survey_1, survey_3 |
| F41 | Core Web Vitals, Zero Console Errors, Clean SQLite WAL & Full E2E Regression + Tier-5 Hardening | Production-measured LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, 0 console/page errors; 100% pass on migrated 109+ legacy E2E suite (`tests/e2e/run_e2e.py`) + new Glacier UI 2.0 4-Tier E2E suite (`TEST_READY.md`) + Tier-5 adversarial hardening on port `3010` (`--backup-db`, 0 residual `[E2E%` rows) | M4, E2E | survey_1, survey_3 |

---

## Honest Boundary Rules (`B1–B16`, ZERO-TOLERANCE)

All agents MUST strictly enforce these verified boundaries (see `.agents/teamwork/spec_miner_survey_1/spec_inventory.md §4` and `.agents/teamwork/explorer_survey_3/handoff.md §1.4`):
- **OMIT COMPLETELY**: `PPTGod Pro` billing/upgrade card (`B1`), topbar notification bell & unread dot (`B2`), fake `意见反馈` submission form (`B3`), `与我共享`/`协作项目`/`协作中` badges (`B4`), `回收站` trash bin (`B5`), custom `项目分组 +` folder creation (`B6`), fake `%` generation progress (`B10`), unimplemented freeform Editor `形状`/`表格`/`动画`/`切换` tools & tabs (`B12`), fake mic/voice/WPM analysis (`B14`), image OCR claims in document dropzone (`B8`).
- **WIRE HONESTLY TO REAL DATA/APIS**: Replace `与我共享` with real `公开分享` (`isPublic`) (`B4`), compute all counts/KPIs/recent projects live from DB with honest empty states (`B7`, `B16`), enforce real `10 MB` & 5 extensions (`.pdf/.docx/.pptx/.md/.txt`) (`B8`), show mandatory `示例预览` badge before generation (`B9`), lock aspect display honestly to `16:9 (宽屏)` (`B11`), wire Editor `AI 助手` to real `POST /api/polish` (`executive`/`metrics`/`notes`) with preview + confirm (`B13`), relabel Quick Tool #3 to `演播提词与倒计时排练` (`B14`), wire Projects Rename via `PUT /api/decks/[id]` and Duplicate via `POST /api/decks` omitting `id`, and scope `language` honestly to Prompt Studio / BYOK LLM (`B15`).

---

## Milestones

| # | Name | Track | Scope | Dependencies | Status | Sub-Orch Conv ID |
|---|------|-------|-------|--------------|--------|------------------|
| E2E | Glacier UI 2.0 E2E Testing Track | E2E Testing | Update `TEST_INFRA.md`, build standalone Python Playwright Glacier UI 2.0 68-case suite (`tests/e2e/glacier_v2/**`), fix `verify_html` typo & headless Chromium stability | none | DONE (68/68 PASS) | c143ae9bd04c33660354fd457590aeba |
| M1 | Phase 1: Glacier Design System, Brand Assets, Global AppShell, UI Kit & `/` Dashboard | Implementation | Features `F1–F15`; M1a (Tokens/Brand/Shell/UI Kit/Auth/CompareDock, `2c0fcb8`) → M1b (`/` Dashboard, `d6ff232`) | none | DONE | 5ce5ae67b41f26bb5109ee4adf21d52e |
| M2 | Phase 2: `/gallery` Style Gallery, `/generate` Creation Workshop & `/collections` My Projects | Implementation | Features `F16–F26`; M2a (`/gallery`, `13d71c4`) → M2c (`/collections`, `ddef671`) → M2b (`/generate` Workshop, `0abfeb0`) | M1 | DONE | — |
| M3 | Phase 3: `/generate` Presentation Editor & All Secondary Pages | Implementation | Features `F27–F38`; M3a (`/generate` Editor + `AI 助手` + `设计体检`, `0abfeb0`) → M3b/M3c (`/compare`, `/studio`, `/deck/[id]`, `/create`, `/tools`, `/creator/[username]`, Settings/Help, `93ffb29`) | M1, M2 | DONE | — |
| M4 | Phase 4 (Final Milestone): 5-Breakpoint Responsive/A11y/Perf & 68/68 Glacier E2E Verification | Implementation | Features `F39–F41`; 5-breakpoint verification (`0px` overflow, LCP `420–1080ms`, CLS `≤0.0003`), `tsc`/`lint`/`build` 0 errors, Glacier E2E **68/68 PASS** + `[DB HYGIENE PASS]` (`sessions_delta=0`), README updated | M1–M3, E2E | DONE | — |
| M5 | Post-Glacier 2.0 Polish, Hardening & 79-Test 4-Tier Consolidation | Maintenance & QA | Client URL/query bidirectional sync (`/generate`, `/gallery`, `/tools`, `/collections`), browser-local BYOK store (`byokLocalStore.ts`, `sessionStorage`-only API key, S22), Workshop `evidenceDensity` + `.pptx` `routeMode` forwarding, secondary-page Glacier parity (sans-serif headings, `CreatorProfileClient` → `StyleCard`, deleted legacy `PromptCard.tsx`, `-2,090` dead CSS lines), mobile `390px` Editor filmstrip/inspector UX, `useDeckWorkshop` extraction, retired obsolete v8 `tests/e2e/tier1..10.py`, expanded `tests/e2e/glacier_v2/` to **79/79 PASS** (Tiers 1–4) | M4 | DONE | — |
| M6 | 资料 → 提示词包 (Prompt Pack) Workbench | Feature | New `/pack` route (`PromptPackWorkbench` + `PackResultPanels`): paste/upload/sample input, 11 design directions with keyword-scored auto-pick, editable per-slide outline (11 layouts), 3-slide SlideCanvas style preview, tool-specific master prompts for ChatGPT / Gamma / Kimi / Claude / 通用 Markdown (copy, `.md` download, launch link, hand-off to `/generate`). `POST /api/prompt-pack`: BYOK → site provider → rule engine fallback with honest `fallbackReason`, LLM numbers grounded to source text. Sidebar entry + homepage CTA strip + `CreatePanel` 「生成提示词包」. E2E `G3_PACK_01..04`, `/pack` added to RWD routes → **83/83** | M5 | DONE | — |
| M7 | Prompt Pack Pro, BYOK Presets/Test & Style Reference Integration | Feature | Phase 1: 7 BYOK provider presets (OpenAI/DeepSeek/Kimi/Qwen/SiliconFlow/Gemini/OpenRouter), `POST /api/byok/test` SSRF-safe connectivity ping, reasoning-model `<think>` & `response_format` compatibility in `presentationAgent.ts`. Phase 2: `/pack` local image palette extraction (`paletteExtractor.ts`), inline WCAG style editor, editable slide `data` & `note`, active slide preview pin, BYOK single-slide refine (`POST /api/prompt-pack/refine`), Gamma two-part copy + ChatGPT one-shot/two-step copy + partial style/outline copy, local 10-item history + `.json` export/import, 6 samples. Phase 3: Topbar `/pack` nav, 「风格画廊」→「风格参考库」 with `/pack?style=<slug>` anchor links from `StyleDetailDrawer`/`StudioClient`, `DocIntakeWorkbench` → `/pack` handoff. Phase 4: >16k long-doc section picker (auto-unchecks references/appendix), English paper fact extraction, E2E `G3_PACK_05..08` → **87/87 PASS** | M6 | DONE | — |

---

## Interface Contracts

### 1. Frozen Backend & Core Engine Contracts (DO NOT MODIFY)
- `src/app/api/**` (22 route handlers + `_validation.ts`), `src/lib/**` (17 modules), `src/types/prompt.ts`, `src/components/SlideCanvas.tsx`, `src/components/slide-canvas/**`, `src/app/studio/[slug]/opengraph-image.tsx`.
- Critical API idioms for frontend consumers:
  - **Rename Deck**: `PUT /api/decks/[id]` sending full deck with updated `title` (`PATCH /api/decks/[id]` ONLY accepts `{ isPublic: boolean }`).
  - **Duplicate Deck**: `POST /api/decks` omitting `id` (`isPublic: false`).
  - **AI Polish**: `POST /api/polish` strictly accepts `action ∈ {"executive", "metrics", "notes"}`.
  - **Document Parse**: `POST /api/parse-document` accepts 1 file/POST (`file` field), `.pdf/.docx/.pptx/.md/.txt`, `≤ 10 MB`.
  - **Privacy / Security (`S1–S22`)**: Private prompts/decks strictly isolated; BYOK `apiKey` never persisted in SQLite or echoed in responses.

### 2. Shared Frontend Context Contracts (`M1 ↔ M2/M3`)
- **`AppContext` (`src/context/AppContext.tsx`)**: Freeze ALL existing exported properties (`user`, `stats`, `authLoading`, `syncVersion`, `refreshAuth`, `setAuthData`, `logout`, `authModalOpen`, `authModalTab`, `openAuthModal`, `closeAuthModal`, `compareIds`, `toggleCompare`, `replaceCompareIds`, `removeCompare`, `clearCompare`, `localFavoriteIds`, `toggleLocalFavorite`, `globalTopic`, `setGlobalTopic`, `toast`, `showToast`).
- **`LayoutContext` (`src/context/LayoutContext.tsx`, NEW in M1)**:
  ```ts
  export interface LayoutContextValue {
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    toggleSidebar: () => void;
    mobileDrawerOpen: boolean;
    setMobileDrawerOpen: (open: boolean) => void;
    editorFullBleed: boolean;
    setEditorFullBleed: (enabled: boolean) => void;
    settingsModalOpen: boolean;
    openSettingsModal: () => void;
    closeSettingsModal: () => void;
    helpModalOpen: boolean;
    openHelpModal: () => void;
    closeHelpModal: () => void;
  }
  ```
- **Stylesheet Import Order in `src/app/layout.tsx`**:
  1. `import "@/styles/glacier-tokens.css";`
  2. `import "@/styles/glacier-layout.css";`
  3. `import "@/styles/glacier-ui.css";`
  4. `import "./globals.css";`
- **Z-Index Ladder**: `0` decorative peaks → `20` share topbar → `30` Sidebar → `40` Topbar → `50` CompareDock → `55` MobileDrawerBackdrop → `60` MobileNavDrawer → `80` Dialog/Drawer/AuthModal → `90` FullscreenPresenter → `100` Toast.
- **Stable DOM Hooks to Preserve (E2E Compatibility)**:
  - Auth/Nav: `#pg-nav-login-btn`, `#pg-nav-logout-btn`, `#pg-nav-create-btn`, `#pg-demo-login-btn`.
  - Gallery (`/gallery`): `#pg-domain-tabs`, `#pg-domain-tab-*`, `#pg-gallery-search`, `#pg-global-topic-input`, `#pg-reset-filters-btn`, `#pg-open-matcher-btn`, `#pg-style-matcher-modal`, `#pg-toggle-adv-filters`, `#pg-adv-filter-drawer`, `#pg-hero-doc-input`, `#pg-open-doc-intake-btn`, `#pg-doc-intake-modal`, `article[data-prompt-slug]`, `.pg-card`.
  - Workshop & Editor (`/generate`): `#pg-doc-upload-input`, `#pg-doc-upload-badge`, `#pg-gen-topic`, `#pg-gen-style-select`, `#pg-gen-outline-btn`, `#pg-gen-run-btn`, `#pg-outline-editor`, `.pg-outline-row`, `#pg-outline-add-btn`, `#pg-outline-confirm-btn`, `#pg-gen-undo-btn`, `#pg-gen-redo-btn`, `#pg-slide-type-select`, `[data-layout-chip="..."]`, `#pg-edit-slide-title`, `#pg-edit-source-status`, `#pg-edit-source-note`, `#pg-polish-executive-btn`, `#pg-deck-tweaker-toggle`, `#pg-deck-tweaker-panel`, `#pg-deck-bg-input`, `#pg-deck-footer-input`, `#pg-deck-audit-toggle`, `#pg-deck-audit-panel`, `#pg-deck-audit-score`, `#pg-audit-autofix-contrast-btn`, `#pg-audit-autofix-notes-btn`, `#pg-gen-export-html-btn`, `#pg-gen-export-md-btn`, `#pg-export-prompt-modal`, `#pg-export-tab-*`, `#pg-draft-restore-banner`, `#pg-draft-restore-btn`, `#pg-handoff-badge`, `.pg-slide-outer`, `.pg-slide-stage`.
  - Studio/Compare/Create/Deck/Tools: `#pg-compiled-prompt-output`, `#pg-tool-tab-*`, `#pg-studio-*`, `#pg-param-topic`, `#pg-param-audience`, `#pg-compare-*`, `#create-*`, `#pg-extract-image-input`, `#pg-wcag-*`, `#pg-deck-share-stage`, `#pg-share-*`, `#pg-rehearsal-*`, `#pg-teleprompter-font-inc`, `#pg-pace-*`, `#pg-tools-*`.

---

## Code Layout & Exclusive File Ownership

- **E2E Testing Track (`sub_orch_e2e_track`)**:
  - `TEST_INFRA.md`, `TEST_READY.md`, `tests/e2e/glacier_v2/**` (DOES NOT touch `tests/e2e/tier1..tier10.py`, `helpers.py`, `config.py`, `run_e2e.py`, or `src/**` during M1–M3).
- **M1 (`sub_orch_m1_phase1`)**:
  - `public/brand/**`
  - `src/styles/glacier-tokens.css`, `src/styles/glacier-layout.css`, `src/styles/glacier-ui.css`, `src/styles/dashboard.css`, `src/app/globals.css` (token bridge + body wash + `:focus-visible` + dark pill fix)
  - `src/context/LayoutContext.tsx`
  - `src/components/layout/{AppShell,Topbar,Sidebar,MobileNavDrawer,PageHeader}.tsx`
  - `src/components/ui/**`
  - `src/components/presentation/SlidePreviewFrame.tsx`
  - `src/components/dashboard/**`
  - `src/components/AuthModal.tsx`, `src/components/CompareDock.tsx`
  - `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/not-found.tsx`
- **M2 (`sub_orch_m2_phase2`)**:
  - `src/app/gallery/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`
  - `src/components/GalleryClient.tsx`, `src/components/PromptCard.tsx`, `src/components/StyleMatcherModal.tsx`, `src/components/DocIntakeWorkbench.tsx`, `src/components/presentation/{StyleCard,StyleDetailDrawer}.tsx`
  - `src/styles/gallery.css`, `src/styles/matcher.css`, `src/styles/doc-intake.css`
  - `src/hooks/useDeckWorkshop.ts`, `src/app/generate/page.tsx`, `src/components/GenerateClient.tsx`, `src/components/generate/{WorkshopWizard,OutlineDraftPanel}.tsx`, `src/styles/generate.css` (wizard sections)
  - `src/app/collections/page.tsx`, `src/components/CollectionsClient.tsx`, `src/components/projects/**`, `src/styles/projects.css`
- **M3 (`sub_orch_m3_phase3`)**:
  - `src/components/generate/{DeckEditorWorkspace,EditorAiAssistant,SlideTreeSidebar,SlidePropertyInspector,ImageSlotManager,DeckSpecTweaker,DeckAuditDrawer,ExportPromptModal}.tsx`, `src/styles/generate.css` (editor sections), `src/components/GenerateClient.tsx` (editor mode integration)
  - `src/app/compare/page.tsx`, `src/components/CompareClient.tsx`, `src/styles/compare.css`
  - `src/app/studio/page.tsx`, `src/app/studio/[slug]/page.tsx`, `src/components/StudioClient.tsx`, `src/styles/studio-v2.css`
  - `src/app/deck/[id]/page.tsx`, `src/components/DeckShareClient.tsx`, `src/styles/deck-share.css`
  - `src/app/create/page.tsx`, `src/components/CreateClient.tsx`
  - `src/app/tools/page.tsx`, `src/components/ToolsClient.tsx`, `src/styles/tools.css`
  - `src/app/creator/[username]/page.tsx`, `src/components/CreatorProfileClient.tsx`, `src/styles/community.css`
  - `src/components/layout/{SettingsModal,HelpModal}.tsx`, `src/components/layout/AppShell.tsx` (mount Settings/Help modals)
- **M4 (`sub_orch_m4_final`)**:
  - Migrates legacy `tests/e2e/{config,helpers,run_e2e,tier1..tier10}.py`, adds Tier-5 adversarial tests, applies cross-cutting responsive/a11y/perf fixes across frontend files, and captures final screenshots.

---

## Build, Port, SQLite WAL & Screenshot Environment Rules

1. **Port Isolation (HARD CONSTRAINT)**: Port `3000` is occupied by the main session's production preview daemon — **NEVER stop, probe-kill, bind, or run tests against port `3000`**. All temporary verification servers MUST use port `3010` (`./node_modules/.bin/next start --port 3010 --hostname 127.0.0.1`) and be cleanly terminated after verification!
2. **Playwright Runtime**: Use preinstalled **Python Playwright (`1.65.2`)** at `/opt/pyenv/shims/python3` with `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright`. **DO NOT `npm install playwright`**.
3. **Build & Verification Commands**:
   - Typecheck: `npx tsc --noEmit --incremental false`
   - Lint: `npm run lint`
   - Build: `npm run build` (Implementation Track ONLY; E2E Track NEVER runs `npm run build` concurrently)
   - E2E Execution: `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright /opt/pyenv/shims/python3 <runner> --base-url http://127.0.0.1:3010 --backup-db`
4. **SQLite WAL Cleanliness**: `data/pptgod.db` is shared with port `3000` in WAL mode. Any backup MUST use `/opt/android-sdk/platform-tools/sqlite3 data/pptgod.db ".backup '<tmp>'"`. All mutating tests MUST clean up via LIFO `CleanupRegistry` leaving `0` residual `[E2E%` rows (`users: 3`, `prompts: 36`, `prompt_comments: 5`, `saved_decks: 0`).
5. **Screenshot Archive Path**: Save all phase and final acceptance screenshots in `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/screenshots/glacier_v2/`.
6. **Clean Scoped Git Commits**: Always verify `git branch --show-current` is `feat/glacier-ui-2.0`. Stage ONLY milestone-owned files (`git add <paths>`) — NEVER `git add -A` when another track has in-progress files!
7. **No Scratch Files in `.agents/teamwork/`**: `.agents/teamwork/` holds ONLY agent metadata `.md` files. Temporary verifier scripts/probes MUST use `mktemp -d -- "${TMPDIR:-/tmp}/teamwork_probe.XXXXXX"` (`chmod 700`) and remove it before reporting.
