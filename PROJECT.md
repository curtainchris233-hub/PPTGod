# Project: PPTGod v2

> **Single Source of Truth** for PPTGod v2 architecture, feature inventory, milestone decomposition, interface contracts, security invariants, and exclusive file ownership.
> Authoritative upstream documents:
> - `/home/antigravity/curtainchris233-hub/PPTGod/.agents/teamwork/ORIGINAL_REQUEST.md`
> - `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/implementation_plan.md`
> - `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/product_design.md`

---

## Architecture

- **Tech Stack (Strict)**: Next.js `16.4.6` App Router, React `19.3.0`, TypeScript `^5` (`strict: true`), **100% Pure Vanilla CSS (ZERO TailwindCSS, ZERO PostCSS)**, SQLite via `better-sqlite3` (WAL mode), native `.pptx` export via `pptxgenjs` (`^4.0.1`), icons via `lucide-react`.
- **Aesthetic System**: Warm archival paper editorial design (`--bg-canvas: #f5f2eb`, `--bg-surface: #ffffff`, `--ink-primary: #171615`, `--accent: #c84b31`). **Strict visual prohibitions**: NO TailwindCSS, NO gradient text, NO neon glow borders, NO grid/mesh backgrounds.
- **Dual-Core Product Loop**:
  1. **Visual Prompt Discovery & Cross-Tool Compiler**: `/` (Gallery + 30s Smart Style Matcher) -> `/studio/[slug]` (8-slide filmstrip, 5-dim anatomy, live token tuning, 6-tool compiler + 6-slide AI-image batch + Quick Launch + sample `.pptx`/`.html` export + per-tool reviews) -> `/compare` (8-slide synced compare) -> `/create` (create / `?fork=` Remix / `?edit=` author update + Public/Private visibility).
  2. **Online PPT Generation & Delivery Workshop**: `/generate` (dual engine: zero-config Smart Semantic Engine + BYOK OpenAI/DeepSeek-compatible LLM; 18+ style live re-skinning; left slide tree; center 16:9 `SlideCanvas` + speaker notes; right WYSIWYG editor; `.pptx` / `.html` export + cloud `saved_decks` with Private-by-default / Public share link).
  3. **Community & Personal Space**: `/collections` (4 tabs: Favorites, Saved Decks, Published Styles [public+private], Liked + Edit Profile modal), `/creator/[username]` (public portfolio & impact metrics + owner private-drafts link), automatic guest `localStorage` favorite merge on login.
- **Data Persistence**: SQLite at `data/pptgod.db` (WAL mode; idempotent migration from existing v1 DB preserving 3 users, 1 session, 12 v1 prompts while adding 6 new v2 styles -> 18 total, 5 seed comments, `prompts.remixed_from_id`, `prompts.is_public` [default `1`], `saved_decks.is_public` [default `0`], `prompt_comments`, `saved_decks`).
- **Modular Vanilla CSS Strategy (Zero Parallel Collisions)**:
  - Shared tokens & base layout/component adjustments live in `src/app/globals.css` (owned exclusively by **M2**).
  - Feature-specific v2 Vanilla CSS lives in dedicated stylesheets under `src/styles/` (`matcher.css`, `studio-v2.css`, `generate.css`, `community.css`) imported directly by their owning components, reusing `:root` variables from `globals.css`.

---

## Feature Inventory

Every feature from Step 0 Survey (`explorer_survey_1`, `explorer_survey_2`, `spec_miner_survey_3`) is assigned to a milestone (zero unassigned features):

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Idempotent SQLite v1→v2 Migration | Add `prompts.remixed_from_id`, `prompts.is_public` (default 1), `saved_decks.is_public` (default 0), `prompt_comments`, `saved_decks`, post-ALTER `idx_prompts_public`; preserve existing WAL DB rows | M1 | survey_1, survey_3 |
| 2 | 18-Style Official Seed Library + Seed Comments | 18 cross-industry curated styles (incl. 6 v2 styles) + 3 seed users + 5 initial per-tool reviews via `INSERT OR IGNORE` | M1 | survey_1, survey_3 |
| 3 | Domain Type Definitions v2 | Add `isPublic: boolean` to `PromptItem` & `SavedDeck`, optional author fields on `RemixOrigin`, export `UserStats` with `decks` | M1 | survey_1, survey_2, survey_3 |
| 4 | 8 Standard 16:9 Slide Types Rendering | `SlideCanvas.tsx` renders all 8 `SlideType`s (`cover`, `agenda`, `process`, `data`, `comparison`, `timeline`, `quote`, `closing`) with non-blank visuals & dynamic SVG bar chart scaling | M2 | survey_2, survey_3 |
| 5 | New Layout Archetypes & Decorative Motifs | Render `soft-bento`, `financial-terminal`, `clinical-clean` archetypes and `bento-dots`, `editorial-drop`, `hairline-rule` motifs in `SlideCanvas.tsx` | M2 | survey_2, survey_3 |
| 6 | Custom `slideData` Live Binding | Optional `slideData?: Partial<DeckSlideItem>`, `pageIndex?`, `totalPages?` in `SlideCanvas.tsx` with safe fallbacks & index keys | M2 | survey_2, survey_3 |
| 7 | 5-Dimension Anatomy Visual Highlight Overlay | Preserve interactive 5-dim highlight overlay across all 8 slide types in `SlideCanvas.tsx` | M2 | survey_2, survey_3 |
| 8 | Gallery Hero & Global Live Topic Preview | Live global topic input + preset pills updating all cards + quick `/generate` CTA carrying `globalTopic` | M3 | survey_2, survey_3 |
| 9 | Multi-Dimensional Filter, Search & Sort | Filter by search `q`, scenario, style, color, 6 target tools, sort (`popular`/`newest`/`copies`), reset filters; sync on `syncVersion` | M3 | survey_2, survey_3 |
| 10 | 30-Second Smart Style Matcher (`StyleMatcherModal`) | Hero-triggered 3-step wizard (audience/scenario -> lighting -> density) scoring public styles -> Top 3 with live 16:9 `SlideCanvas` & Studio/Generate CTAs | M3 | survey_2, survey_3 |
| 11 | Upgraded `PromptCard` v2 | `CARD_SLIDE_TYPES` tabs, clickable author link `/creator/[username]`, Remix badge, Private lock badge, optional Edit button, dual CTAs (`定制提示词` & `生成 PPT`) | M2 | survey_2, survey_3 |
| 12 | Studio 8-Slide Filmstrip & Fullscreen Presentation | All 8 `ALL_SLIDE_TYPES` in filmstrip (4x2 grid) and fullscreen presenter + viewer-aware `generateMetadata` | M3 | survey_2, survey_3 |
| 13 | Studio Live Visual Parameter Fine-Tuning | Live accent/bg/density/radius tuning + reset reflected in `SlideCanvas`, compiler, and sample exports | M3 | survey_2, survey_3 |
| 14 | Studio Action Bar & Provenance | Generate PPT CTA, Remix CTA (`/create?fork=[slug]`), author-only Edit CTA (`/create?edit=[slug]`), private lock badge, Remix provenance link, clickable creator card | M3 | survey_2, survey_3 |
| 15 | 6-Tool Prompt Compiler, 6-Slide AI-Image Batch & Quick Launch | All 6 `TOOL_METADATA` tools, `aiImageBatchMode` toggle (single vs 6-slide pack), copy counter, External AI Quick Launch links, `.md` download | M3 | survey_1, survey_2, survey_3 |
| 16 | Studio Sample `.pptx` & Interactive `.html` Export | Direct Studio buttons exporting sample deck via `buildSampleDeckFromPrompt` + `POST /api/export/pptx` and `exportStandaloneHtmlDeck` | M3 | survey_2, survey_3 |
| 17 | Studio Community Per-Tool Verified Reviews | List/submit/delete reviews (`GET/POST/DELETE /api/prompts/[id]/comments`) with tested tool selector, 1–5 star picker, author link | M3 | survey_1, survey_2, survey_3 |
| 18 | Workshop `/generate` Config Panel, 18+ Style Switcher & 3 Presets | Live re-skinning across 18+ styles (preserving slides), topic/subtitle/audience/count (5–8), raw material + 3 `SOURCE_MATERIAL_PRESETS`, `?style=`/`?topic=`/`?deck=` params | M4 | survey_2, survey_3 |
| 19 | Dual-Engine PPT Generation (`smart` + BYOK `llm`) | Zero-config Smart Semantic Engine + BYOK OpenAI/DeepSeek LLM UI & hardened `POST /api/generate` (scheme check, timeout, safe JSON parse) | M1, M4 | survey_1, survey_2, survey_3 |
| 20 | Workshop `/generate` Left Multi-Slide Filmstrip Tree | Thumbnail tree: select, add slide (choose type), delete slide (last-slide guard), move up/down, switch `SlideType` (all 8) | M4 | survey_2, survey_3 |
| 21 | Workshop `/generate` Center 16:9 Stage, Speaker Notes & Fullscreen | Live `<SlideCanvas slideData={activeSlide} />`, synced speaker notes textarea, fullscreen roadshow modal | M4 | survey_2, survey_3 |
| 22 | Workshop `/generate` Right WYSIWYG Slide Property Editor | Live editors for title, subtitle, sectionTag, steps, kpis, bars (sanitized numbers), comparison left/right, quote/author | M4 | survey_2, survey_3 |
| 23 | Workshop Multi-Format Delivery Bar (`.pptx`, `.html`, Cloud Save + Visibility) | Native `.pptx` export (guarded empty bars & alpha-composited dark borders), offline `.html` export (safe >4 bar chart), cloud save (`isPublic: false` default) + share link copy + clone banner for foreign public decks | M1, M4 | survey_1, survey_2, survey_3 |
| 24 | Compare `/compare` 8-Slide Synced Compare & Generate CTA | All 8 `ALL_SLIDE_TYPES` synced, unified topic, parameter matrix, per-column「用此风格生成 PPT」CTA, public-only pool | M5 | survey_2, survey_3 |
| 25 | Create `/create` New Style + 8-Slide Preview + 15 Archetypes/11 Motifs + Visibility | Visual builder with 8 preview tabs, all 15 archetypes & 11 motifs, prominent Public (default) vs Private visibility toggle | M5 | survey_2, survey_3 |
| 26 | Create `/create?fork=[slug]` Remix Mode with Provenance | Prefill visualSpec/anatomy/tags from source style, attribution banner, persist `remixedFromId` via `POST /api/prompts` | M1, M5 | survey_1, survey_2, survey_3 |
| 27 | Create `/create?edit=[slug]` Author Edit Mode | Load author's own style (incl. private), verify ownership, save via `PUT /api/prompts/[id]` | M1, M5 | survey_1, survey_2, survey_3 |
| 28 | Personal Space `/collections` 4-Tab Workspace | 4 tabs (`已收藏风格`, `我保存的 PPT 文稿` [edit/toggle-share/copy-link/pptx/delete], `我发布的风格` [`scope=mine` + All/Public/Private filter + Edit/Delete], `我点赞的`) | M5 | survey_2, survey_3 |
| 29 | Personal Space `/collections` Edit User Profile Modal | Modal updating `displayName`, `bio`, `avatarColor` via `PATCH /api/auth/profile` & refreshing `AppContext` | M5 | survey_2, survey_3 |
| 30 | Guest Local Favorites Auto-Sync to Cloud on Login | `AppContext` auto-syncs `localFavoriteIds` via `POST /api/prompts/sync-favorites` (visibility-guarded), clears `localStorage`, increments `syncVersion`, shows toast; fixes React 19 `toggleLocalFavorite` bug | M1, M2 | survey_1, survey_2, survey_3 |
| 31 | Creator Profile `/creator/[username]` Public Portfolio & Impact Card | Public avatar, bio, 4 public-only impact stats, public portfolio grid, owner-only private drafts link (`privateCount`) | M1, M5 | survey_1, survey_2, survey_3 |
| 32 | Upgraded Navbar, AuthModal & CompareDock | 4 primary nav links (`视觉画廊`, `在线生成 PPT`, `并排对比`, `我的空间`) + `+ 发布风格` + user menu linking to `/collections` & `/creator/[username]` | M2 | survey_2, survey_3 |
| 33 | Complete REST API Surface & 22 Security Invariants (S1–S22) | All 16+ API routes enforcing visibility, ownership (`401`/`403`/`404`), author access on private comments/copy, private remix origin guard, deck `403` & `PATCH`/`PUT` | M1 | survey_1, survey_3 |
| 34 | Pure Vanilla CSS Editorial Design System & Responsive Layout | Zero TailwindCSS, warm archival paper aesthetic, no gradient text / neon borders / grid bg, responsive desktop & mobile | M2, M3, M4, M5, M6 | survey_2, survey_3 |
| 35 | E2E Suite (Tiers 1–4), Tier 5 Hardening, Port 3000 Live Server & `walkthrough.md` | Full `tsc`/`lint`/`build`, API `curl`+`jq`, Python Playwright E2E (0 console/page errors, `.pptx` `PK\x03\x04` >30KB), live `:3000` server, screenshots + `walkthrough.md` | E2E Track, M6 | survey_3 |

---

## Milestones

| # | Name | Track | Scope | Dependencies | Status | Sub-Orch Conv ID |
|---|------|-------|-------|--------------|--------|------------------|
| E2E | E2E Testing Track | E2E Testing | Design `TEST_INFRA.md`, build opaque-box Tiers 1–4 suite (`tests/e2e/**`), publish `TEST_READY.md` | none | IN_PROGRESS | bcaa84233f35b7a861c699195b347e1d |
| M1 | Backend Data Model, Migrations & REST APIs | Implementation | `src/types/prompt.ts`, `src/lib/*`, `src/app/api/**` + all 22 security invariants S1–S22 | none | IN_PROGRESS | 0fb4d1fe96e318ebdf9d05b8d872134b |
| M2 | Visual Engine v2 & Shared App Shell | Implementation | `SlideCanvas.tsx` (8 types + `slideData` + archetypes/motifs), `AppContext`, `Navbar`, `layout`, `PromptCard`, base `globals.css` | M1 | PLANNED | — |
| M3 | Gallery Smart Matcher & Prompt Studio v2 | Implementation | `StyleMatcherModal.tsx`, `GalleryClient.tsx`, `/studio/[slug]`, `StudioClient.tsx`, `src/styles/{matcher,studio-v2}.css` | M1, M2 | PLANNED | — |
| M4 | Online PPT Generation Workshop (`/generate`) | Implementation | `/generate/page.tsx`, `GenerateClient.tsx`, `src/styles/generate.css` | M1, M2 | PLANNED | — |
| M5 | Community Pages (Create/Compare/Collections/Creator) | Implementation | `/create`, `/compare`, `/collections`, `/creator/[username]`, `src/styles/community.css` | M1, M2 | PLANNED | — |
| M6 | Final Milestone (Tiers 1–4 E2E + Tier 5 Hardening + Server + Walkthrough) | Implementation | Phase 1: Tiers 1–4 pass; Phase 2: Tier 5 adversarial hardening; live `:3000` server; `walkthrough.md` with screenshots | M1–M5, E2E (`TEST_READY.md`) | PLANNED | — |

---

## Interface Contracts

### 1. Domain Types (`src/types/prompt.ts`)
```ts
export interface RemixOrigin {
  id: string;
  slug: string;
  title: string;
  authorUsername?: string;
  authorDisplayName?: string;
}

export interface UserStats {
  published: number;
  likes: number;
  favorites: number;
  decks: number;
}

// PromptItem MUST include:
//   isPublic: boolean;
//   remixedFrom?: RemixOrigin | null;
//   commentsCount: number;

// SavedDeck MUST include:
//   isPublic: boolean;
```

### 2. SQLite Schema & Idempotent Migration (`src/lib/db.ts`)
- `prompts` table includes `remixed_from_id TEXT DEFAULT NULL` and `is_public INTEGER NOT NULL DEFAULT 1`.
- `saved_decks` table includes `is_public INTEGER NOT NULL DEFAULT 0`.
- Post-DDL `PRAGMA table_info(...)` additive `ALTER TABLE` migrations MUST run **BEFORE** `CREATE INDEX IF NOT EXISTS idx_prompts_public ON prompts(is_public);` so live v1 `data/pptgod.db` upgrades without error.
- `listPrompts(options)` defaults to `p.is_public = 1`. When `includePrivateForAuthorId` is passed, allows `(p.is_public = 1 OR p.author_id = ?)`; optional `visibility?: "all" | "public" | "private"` filters further.
- `getPromptBySlugOrId(slugOrId, viewerId)` returns `null` if `row.is_public === 0 && row.author_id !== (viewerId ?? "")`.
- `PROMPT_SELECT_FRAGMENT` joins `LEFT JOIN prompts ro ON ro.id = p.remixed_from_id AND (ro.is_public = 1 OR ro.author_id = ?)` and `LEFT JOIN users rou ON rou.id = ro.author_id` so private remix origins never leak to non-authors.
- `updatePrompt(id, data, viewerId)` updates editable fields + `is_public` + `updated_at` (preserving `slug`).
- `getCreatorByUsername(username, viewerId)` returns `{ creator, prompts, impact, privateCount }` where `prompts` & `impact` include ONLY `is_public = 1` prompts and `privateCount` is populated ONLY when `viewerId === creator.id` (else `0`).

### 3. REST API Contracts (`src/app/api/**`)
| Endpoint | Method | Auth | Request / Query | Success | Errors |
|---|---|---|---|---|---|
| `/api/prompts` | `GET` | Optional | `?q=&scenario=&style=&color=&tool=&sort=popular\|newest\|copies&scope=mine\|favorites\|liked` | `200 { prompts }` (`scope=mine` includes own private; `favorites`/`liked` exclude foreign private; default `is_public = 1`) | — |
| `/api/prompts` | `POST` | Required | `{ title, englishTitle?, summary, scenario, styleCategory, colorFamily, recommendedTools, tags, visualSpec, promptAnatomy, customNotes?, sampleTopic?, sampleSubtitle?, remixedFromId?: string \| null, isPublic?: boolean }` (`isPublic` default `true`) | `201 { prompt }` | `400`, `401`, `500` |
| `/api/prompts/[id]` | `GET` | Optional | ID or slug | `200 { prompt }` | `404` |
| `/api/prompts/[id]` | `PUT` | Owner | Full editable fields + `isPublic?: boolean` | `200 { prompt }` | `400`, `401`, `403`, `404`, `500` |
| `/api/prompts/[id]` | `PATCH` | Owner | `{ isPublic: boolean }` | `200 { prompt }` | `400`, `401`, `403`, `404` |
| `/api/prompts/[id]` | `DELETE` | Owner | — | `200 { ok: true }` | `401`, `403`, `404` |
| `/api/prompts/[id]/like` | `POST` | Required | — | `200 { liked, likesCount }` | `401`, `404` |
| `/api/prompts/[id]/favorite` | `POST` | Required | — | `200 { favorited, savesCount }` | `401`, `404` |
| `/api/prompts/[id]/copy` | `POST` | Optional | Viewer-aware lookup | `200 { copiesCount }` | `404` |
| `/api/prompts/[id]/comments` | `GET` | Optional | Viewer-aware lookup | `200 { comments }` | `404` |
| `/api/prompts/[id]/comments` | `POST` | Required | `{ testedTool, rating (1-5), content (4-500) }` | `201 { comments }` | `400`, `401`, `404` |
| `/api/prompts/[id]/comments` | `DELETE` | Owner | `?commentId=...` | `200 { comments }` | `400`, `401`, `403`, `404` |
| `/api/prompts/sync-favorites` | `POST` | Required | `{ promptIds: string[] }` (only `is_public = 1 OR author_id = ?`) | `200 { synced }` | `401`, `500` |
| `/api/decks` | `GET` | Optional | — | `200 { decks }` (`[]` if unauth) | — |
| `/api/decks` | `POST` | Required | `{ id?, title, subtitle?, audience?, promptId, promptSlug, promptTitle, visualSpec, slides, isPublic?: boolean }` (default `false`; clones if foreign `id`) | `201`/`200 { deck }` | `400`, `401`, `500` |
| `/api/decks/[id]` | `GET` | Optional | Enforces `!deck.isPublic && deck.authorId !== viewer?.id => 403` | `200 { deck }` | `403`, `404` |
| `/api/decks/[id]` | `PATCH` | Owner | `{ isPublic: boolean }` | `200 { deck }` | `400`, `401`, `403`, `404` |
| `/api/decks/[id]` | `PUT` | Owner | Full deck update + optional `isPublic` | `200 { deck }` | `400`, `401`, `403`, `404` |
| `/api/decks/[id]` | `DELETE` | Owner | — | `200 { ok: true }` | `401`, `403`, `404` |
| `/api/generate` | `POST` | None | `{ topic, subtitle?, audience?, sourceText?, scenario?, slideCount (5-8), mode: "smart"\|"llm", apiBase?, apiKey?, model? }` | `200 { slides, engine }` | `400`, `502`, `500` |
| `/api/export/pptx` | `POST` | None | `{ title?, subtitle?, audience?, styleName?, visualSpec, slides }` | `200` binary `.pptx` (`PK\x03\x04`) | `400`, `500` |
| `/api/auth/{login,register,logout,me,profile}` | Various | Per route | `PATCH /profile`: `{ displayName?, bio?, avatarColor? }` | `{ user, stats }` | `400`, `401`, `409` |
| `/api/creators/[username]` | `GET` | Optional | Path `username` | `200 { creator, prompts, impact, privateCount }` | `404` |

### 4. Security & Privacy Invariants (S1–S22)
All 22 security invariants defined in `.agents/teamwork/spec_miner_survey_3/handoff.md §4.3.B` are binding across both API and SSR layers:
- Private prompts (`prompts.is_public = 0`): excluded from public list, compare, creator public gallery/impact, foreign favorites/likes, and foreign sync-favorites; `404` on foreign `GET /api/prompts/[id]`, `/studio/[slug]`, comments, copy; `200` for author on `scope=mine`, Studio, comments, copy, edit; `403`/`404` for non-author `PUT`/`PATCH`/`DELETE`; hidden if remix origin turns private.
- Private decks (`saved_decks.is_public = 0`, default on create): **`403`** on foreign/anonymous `GET /api/decks/[id]`, `PATCH`, `PUT`, `DELETE`; `200` for author; `200` for all when `is_public = 1` (foreign save creates a non-destructive clone).
- BYOK LLM `apiKey`: forwarded only to `${apiBase}/chat/completions`, NEVER persisted to DB, NEVER returned in responses, NEVER logged.

### 5. Frontend Shared Component Contracts (`M2 ↔ M3/M4/M5`)
- `SlideCanvas` props:
  ```ts
  export interface SlideCanvasProps {
    spec: VisualSpec;
    slideType: SlideType;
    topic: string;
    subtitle: string;
    audience?: string;
    slideCount?: number;
    englishTitle?: string;
    scenario?: string;
    highlightDimension?: AnatomyDimension | null;
    slideData?: Partial<DeckSlideItem>;
    pageIndex?: number;
    totalPages?: number;
    className?: string;
  }
  ```
- `AppContext` (`useApp()`) exports: existing properties PLUS `stats: UserStats | null` (including `decks: number`) and `syncVersion: number` (incremented after guest `localFavoriteIds` auto-sync completes on login).
- `PromptCard` props: existing properties (`prompt`, `liveTopic?`, `onUpdatePrompt?`, `onDeletePrompt?`, `showDelete?`) PLUS `showEdit?: boolean` (renders Edit link `/create?edit=[slug]` when `true`).

---

## Code Layout & Exclusive File Ownership

No two concurrent milestones may ever write to the same file:

- **M1 (`sub_orch_m1_backend`)**:
  - `src/types/prompt.ts`
  - `src/lib/db.ts`, `src/lib/seedData.ts`, `src/lib/promptCompiler.ts`, `src/lib/deckGenerator.ts`, `src/lib/htmlExporter.ts`, `src/lib/auth.ts`, `src/lib/password.ts`
  - `src/app/api/**`
- **M2 (`sub_orch_m2_canvas_shell`)**:
  - `src/components/SlideCanvas.tsx`
  - `src/context/AppContext.tsx`
  - `src/components/Navbar.tsx`
  - `src/app/layout.tsx`
  - `src/components/PromptCard.tsx`
  - `src/app/globals.css`
- **M3 (`sub_orch_m3_gallery_studio`)**:
  - `src/components/StyleMatcherModal.tsx` *(NEW)*
  - `src/components/GalleryClient.tsx`
  - `src/app/studio/[slug]/page.tsx`
  - `src/components/StudioClient.tsx`
  - `src/styles/matcher.css` *(NEW)*, `src/styles/studio-v2.css` *(NEW)*
- **M4 (`sub_orch_m4_generate`)**:
  - `src/app/generate/page.tsx` *(NEW)*
  - `src/components/GenerateClient.tsx` *(NEW)*
  - `src/styles/generate.css` *(NEW)*
- **M5 (`sub_orch_m5_community`)**:
  - `src/app/create/page.tsx`, `src/components/CreateClient.tsx`
  - `src/app/compare/page.tsx`, `src/components/CompareClient.tsx`
  - `src/app/collections/page.tsx`, `src/components/CollectionsClient.tsx`
  - `src/app/creator/[username]/page.tsx` *(NEW)*, `src/components/CreatorProfileClient.tsx` *(NEW)*
  - `src/styles/community.css` *(NEW)*
- **E2E Testing Track (`sub_orch_e2e_track`)**:
  - `TEST_INFRA.md`, `TEST_READY.md`, `tests/e2e/**`
- **M6 (`sub_orch_m6_final`)**:
  - Runs sequentially after M1–M5 + E2E Track complete; authorized to fix any cross-cutting integration bugs, add Tier 5 adversarial tests under `tests/e2e/`, run production build & live `:3000` server, and write `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/d4652d5e-bd2b-44e6-9b6d-5ebd3aabd750/walkthrough.md`.

---

## Build, Concurrency & Environment Rules

1. **Typecheck / Lint during parallel milestones (M3/M4/M5)**: Always use `npx tsc --noEmit --incremental false` and `npx eslint <files>` / `npm run lint` — **DO NOT run `npm run build` concurrently** across parallel milestones (avoids `.next/` write races). Sequential milestones (M1, M2, M6) run full `npx tsc --noEmit --incremental false && npm run lint && npm run build`.
2. **Playwright Runtime**: Node Playwright is NOT installed. Use preinstalled **Python Playwright (`1.65.2`)** at `/opt/pyenv/shims/python3` with `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright` (headless Chromium already cached — zero downloads, DO NOT `npm install playwright`).
3. **SQLite WAL Backup Hygiene**: `data/pptgod.db` runs in WAL mode. Any backup MUST use `sqlite3 data/pptgod.db ".backup '<path>'"` (NEVER plain `cp data/pptgod.db`). Always clean up synthetic test records (prompts, decks, comments, profile edits) after API/E2E runs so `data/pptgod.db` remains clean with the 18 curated styles and 5 seed comments.
4. **No Scratch Files in `.agents/teamwork/`**: `.agents/teamwork/` holds ONLY agent metadata `.md` files (never source code, scripts, test data, or screenshots). Ad-hoc verifier probes MUST use a per-probe temp dir (`mktemp -d -- "${TMPDIR:-/tmp}/teamwork_probe.XXXXXX"` with `chmod 700`) and delete it before reporting.
