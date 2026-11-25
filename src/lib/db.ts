import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { hashPassword } from "@/lib/password";
import { SEED_COMMENTS, SEED_PROMPTS, SEED_USERS } from "@/lib/seedData";
import type {
  ColorFamily,
  DeckSlideItem,
  PromptAnatomy,
  PromptComment,
  PromptItem,
  SavedDeck,
  TargetTool,
  UserPublic,
  UserStats,
  VisualSpec,
} from "@/types/prompt";

declare global {
  var __pptgodDb: Database.Database | undefined;
}

function initSchemaAndMigrate(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '#C84B31',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      english_title TEXT NOT NULL,
      summary TEXT NOT NULL,
      scenario TEXT NOT NULL,
      style_category TEXT NOT NULL,
      color_family TEXT NOT NULL,
      recommended_tools TEXT NOT NULL,
      tags TEXT NOT NULL,
      visual_spec TEXT NOT NULL,
      prompt_anatomy TEXT NOT NULL,
      custom_notes TEXT NOT NULL DEFAULT '',
      sample_topic TEXT NOT NULL,
      sample_subtitle TEXT NOT NULL,
      author_id TEXT NOT NULL,
      is_official INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      remixed_from_id TEXT DEFAULT NULL,
      likes_count INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      copies_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_likes (
      user_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, prompt_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_favorites (
      user_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, prompt_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS prompt_comments (
      id TEXT PRIMARY KEY,
      prompt_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tested_tool TEXT NOT NULL DEFAULT 'claude-html',
      rating INTEGER NOT NULL DEFAULT 5,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_decks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      prompt_id TEXT NOT NULL,
      prompt_slug TEXT NOT NULL,
      prompt_title TEXT NOT NULL,
      visual_spec TEXT NOT NULL,
      slides_json TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      author_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prompts_scenario ON prompts(scenario);
    CREATE INDEX IF NOT EXISTS idx_prompts_style ON prompts(style_category);
    CREATE INDEX IF NOT EXISTS idx_prompts_color ON prompts(color_family);
    CREATE INDEX IF NOT EXISTS idx_prompts_created ON prompts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_prompt ON prompt_comments(prompt_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_decks_author ON saved_decks(author_id, updated_at DESC);
  `);

  // Additive column migrations if database existed from an earlier version
  const promptCols = db.prepare("PRAGMA table_info(prompts)").all() as {
    name: string;
  }[];
  if (!promptCols.some((c) => c.name === "remixed_from_id")) {
    db.exec(`ALTER TABLE prompts ADD COLUMN remixed_from_id TEXT DEFAULT NULL`);
  }
  if (!promptCols.some((c) => c.name === "is_public")) {
    db.exec(
      `ALTER TABLE prompts ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1`
    );
  }

  const deckCols = db.prepare("PRAGMA table_info(saved_decks)").all() as {
    name: string;
  }[];
  if (!deckCols.some((c) => c.name === "is_public")) {
    db.exec(
      `ALTER TABLE saved_decks ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0`
    );
  }

  // Indexes on migrated columns MUST run AFTER ALTER TABLE blocks
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_public ON prompts(is_public);
  `);
}

function seedIdempotently(db: Database.Database) {
  const now = new Date().toISOString();

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, display_name, email, password_hash, bio, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUsersTx = db.transaction(() => {
    for (const u of SEED_USERS) {
      const exists = db
        .prepare("SELECT 1 FROM users WHERE id = ? OR email = ?")
        .get(u.id, u.email.toLowerCase());
      if (!exists) {
        insertUser.run(
          u.id,
          u.username,
          u.displayName,
          u.email.toLowerCase(),
          hashPassword(u.passwordPlain),
          u.bio,
          u.avatarColor,
          now
        );
      }
    }
  });
  insertUsersTx();

  const insertPrompt = db.prepare(`
    INSERT OR IGNORE INTO prompts (
      id, slug, title, english_title, summary, scenario, style_category,
      color_family, recommended_tools, tags, visual_spec, prompt_anatomy,
      custom_notes, sample_topic, sample_subtitle, author_id, is_official,
      is_public, remixed_from_id, likes_count, saves_count, copies_count,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?
    )
  `);
  const baseTime = Date.now();
  const insertPromptsTx = db.transaction(() => {
    SEED_PROMPTS.forEach((p, idx) => {
      const ts = new Date(baseTime - idx * 1000 * 60 * 60 * 14).toISOString();
      insertPrompt.run(
        p.id,
        p.slug,
        p.title,
        p.englishTitle,
        p.summary,
        p.scenario,
        p.styleCategory,
        p.colorFamily,
        JSON.stringify(p.recommendedTools),
        JSON.stringify(p.tags),
        JSON.stringify(p.visualSpec),
        JSON.stringify(p.promptAnatomy),
        p.customNotes,
        p.sampleTopic,
        p.sampleSubtitle,
        p.authorId,
        p.isOfficial ? 1 : 0,
        p.likesCount,
        p.savesCount,
        p.copiesCount,
        ts,
        ts
      );
    });
  });
  insertPromptsTx();

  const insertComment = db.prepare(`
    INSERT OR IGNORE INTO prompt_comments (id, prompt_id, user_id, tested_tool, rating, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCommentsTx = db.transaction(() => {
    SEED_COMMENTS.forEach((c, idx) => {
      const ts = new Date(baseTime - idx * 1000 * 60 * 45).toISOString();
      insertComment.run(
        c.id,
        c.promptId,
        c.authorId,
        c.testedTool,
        c.rating,
        c.content,
        ts
      );
    });
  });
  insertCommentsTx();
}

export function getDb(): Database.Database {
  if (!globalThis.__pptgodDb) {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "pptgod.db");
    const db = new Database(dbPath);
    initSchemaAndMigrate(db);
    seedIdempotently(db);
    globalThis.__pptgodDb = db;
  }
  return globalThis.__pptgodDb;
}

interface RawPromptRow {
  id: string;
  slug: string;
  title: string;
  english_title: string;
  summary: string;
  scenario: string;
  style_category: string;
  color_family: string;
  recommended_tools: string;
  tags: string;
  visual_spec: string;
  prompt_anatomy: string;
  custom_notes: string;
  sample_topic: string;
  sample_subtitle: string;
  author_id: string;
  is_official: number;
  is_public: number;
  remixed_from_id: string | null;
  remix_origin_slug?: string | null;
  remix_origin_title?: string | null;
  remix_origin_author_username?: string | null;
  remix_origin_author_display_name?: string | null;
  likes_count: number;
  saves_count: number;
  copies_count: number;
  comments_count?: number;
  created_at: string;
  updated_at: string;
  author_username: string;
  author_display_name: string;
  author_bio: string;
  author_avatar_color: string;
  author_created_at: string;
  liked_by_me?: number;
  favorited_by_me?: number;
}

function hydratePrompt(row: RawPromptRow): PromptItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    englishTitle: row.english_title,
    summary: row.summary,
    scenario: row.scenario,
    styleCategory: row.style_category,
    colorFamily: row.color_family as ColorFamily,
    recommendedTools: JSON.parse(row.recommended_tools) as TargetTool[],
    tags: JSON.parse(row.tags) as string[],
    visualSpec: JSON.parse(row.visual_spec) as VisualSpec,
    promptAnatomy: JSON.parse(row.prompt_anatomy) as PromptAnatomy,
    customNotes: row.custom_notes,
    sampleTopic: row.sample_topic,
    sampleSubtitle: row.sample_subtitle,
    authorId: row.author_id,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      bio: row.author_bio,
      avatarColor: row.author_avatar_color,
      createdAt: row.author_created_at,
    },
    isOfficial: Boolean(row.is_official),
    isPublic: Boolean(row.is_public),
    remixedFrom:
      row.remixed_from_id && row.remix_origin_slug && row.remix_origin_title
        ? {
            id: row.remixed_from_id,
            slug: row.remix_origin_slug,
            title: row.remix_origin_title,
            authorUsername: row.remix_origin_author_username ?? undefined,
            authorDisplayName:
              row.remix_origin_author_display_name ?? undefined,
          }
        : null,
    likesCount: row.likes_count,
    savesCount: row.saves_count,
    copiesCount: row.copies_count,
    commentsCount: row.comments_count ?? 0,
    likedByMe: Boolean(row.liked_by_me),
    favoritedByMe: Boolean(row.favorited_by_me),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListPromptsOptions {
  q?: string;
  scenario?: string;
  style?: string;
  color?: string;
  tool?: string;
  sort?: "popular" | "newest" | "copies";
  authorId?: string;
  favoritesOfUserId?: string;
  likedByUserId?: string;
  viewerId?: string | null;
  includePrivateForAuthorId?: string;
  visibility?: "all" | "public" | "private";
}

// Positional `?` placeholders in PROMPT_SELECT_FRAGMENT (strictly 3x viewerId):
//   #1 pl.user_id = ?       (liked_by_me)
//   #2 pf.user_id = ?       (favorited_by_me)
//   #3 ro.author_id = ?     (hide private remix origin from non-authors, S14)
const PROMPT_SELECT_FRAGMENT = `
  SELECT
    p.*,
    u.username AS author_username,
    u.display_name AS author_display_name,
    u.bio AS author_bio,
    u.avatar_color AS author_avatar_color,
    u.created_at AS author_created_at,
    ro.slug AS remix_origin_slug,
    ro.title AS remix_origin_title,
    rou.username AS remix_origin_author_username,
    rou.display_name AS remix_origin_author_display_name,
    (SELECT COUNT(*) FROM prompt_comments pc WHERE pc.prompt_id = p.id) AS comments_count,
    EXISTS(SELECT 1 FROM prompt_likes pl WHERE pl.prompt_id = p.id AND pl.user_id = ?) AS liked_by_me,
    EXISTS(SELECT 1 FROM prompt_favorites pf WHERE pf.prompt_id = p.id AND pf.user_id = ?) AS favorited_by_me
  FROM prompts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN prompts ro ON ro.id = p.remixed_from_id AND (ro.is_public = 1 OR ro.author_id = ?)
  LEFT JOIN users rou ON rou.id = ro.author_id
`;

export function listPrompts(options: ListPromptsOptions = {}): PromptItem[] {
  const db = getDb();
  const viewerId = options.viewerId ?? "";
  const conditions: string[] = [];
  const params: unknown[] = [viewerId, viewerId, viewerId];

  if (options.includePrivateForAuthorId) {
    if (options.visibility === "public") {
      conditions.push(`p.is_public = 1`);
    } else if (options.visibility === "private") {
      conditions.push(`(p.is_public = 0 AND p.author_id = ?)`);
      params.push(options.includePrivateForAuthorId);
    } else {
      conditions.push(`(p.is_public = 1 OR p.author_id = ?)`);
      params.push(options.includePrivateForAuthorId);
    }
  } else {
    conditions.push(`p.is_public = 1`);
  }

  if (options.q && options.q.trim()) {
    const like = `%${options.q.trim()}%`;
    conditions.push(
      `(p.title LIKE ? OR p.english_title LIKE ? OR p.summary LIKE ? OR p.tags LIKE ? OR p.scenario LIKE ? OR p.style_category LIKE ?)`
    );
    params.push(like, like, like, like, like, like);
  }

  if (options.scenario && options.scenario !== "全部场景") {
    conditions.push(`p.scenario = ?`);
    params.push(options.scenario);
  }

  if (options.style && options.style !== "全部风格") {
    conditions.push(`p.style_category = ?`);
    params.push(options.style);
  }

  if (options.color && options.color !== "all") {
    conditions.push(`p.color_family = ?`);
    params.push(options.color);
  }

  if (options.tool && options.tool !== "all") {
    conditions.push(`p.recommended_tools LIKE ?`);
    params.push(`%"${options.tool}"%`);
  }

  if (options.authorId) {
    conditions.push(`p.author_id = ?`);
    params.push(options.authorId);
  }

  if (options.favoritesOfUserId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM prompt_favorites pf2 WHERE pf2.prompt_id = p.id AND pf2.user_id = ?)`
    );
    params.push(options.favoritesOfUserId);
  }

  if (options.likedByUserId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM prompt_likes pl2 WHERE pl2.prompt_id = p.id AND pl2.user_id = ?)`
    );
    params.push(options.likedByUserId);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  let orderClause = `ORDER BY p.likes_count DESC, p.copies_count DESC`;
  if (options.sort === "newest") {
    orderClause = `ORDER BY p.created_at DESC`;
  } else if (options.sort === "copies") {
    orderClause = `ORDER BY p.copies_count DESC, p.likes_count DESC`;
  }

  const sql = `
    ${PROMPT_SELECT_FRAGMENT}
    ${whereClause}
    ${orderClause}
  `;

  const rows = db.prepare(sql).all(...params) as RawPromptRow[];
  return rows.map(hydratePrompt);
}

export function getPromptBySlugOrId(
  slugOrId: string,
  viewerId?: string | null
): PromptItem | null {
  const db = getDb();
  const v = viewerId ?? "";
  const row = db
    .prepare(
      `
      ${PROMPT_SELECT_FRAGMENT}
      WHERE p.slug = ? OR p.id = ?
      LIMIT 1
    `
    )
    .get(v, v, v, slugOrId, slugOrId) as RawPromptRow | undefined;

  if (!row) return null;
  if (!row.is_public && row.author_id !== v) {
    return null;
  }

  return hydratePrompt(row);
}

export interface UpdatePromptInput {
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
  isPublic?: boolean;
}

export function updatePrompt(
  id: string,
  data: UpdatePromptInput,
  viewerId: string
): PromptItem | null {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, author_id, is_public FROM prompts WHERE id = ? OR slug = ? LIMIT 1`
    )
    .get(id, id) as
    | { id: string; author_id: string; is_public: number }
    | undefined;

  if (!existing || existing.author_id !== viewerId) {
    return null;
  }

  const nextIsPublic =
    typeof data.isPublic === "boolean"
      ? data.isPublic
        ? 1
        : 0
      : existing.is_public;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE prompts
     SET title = ?,
         english_title = ?,
         summary = ?,
         scenario = ?,
         style_category = ?,
         color_family = ?,
         recommended_tools = ?,
         tags = ?,
         visual_spec = ?,
         prompt_anatomy = ?,
         custom_notes = ?,
         sample_topic = ?,
         sample_subtitle = ?,
         is_public = ?,
         updated_at = ?
     WHERE id = ? AND author_id = ?`
  ).run(
    data.title,
    data.englishTitle,
    data.summary,
    data.scenario,
    data.styleCategory,
    data.colorFamily,
    JSON.stringify(
      data.recommendedTools.length ? data.recommendedTools : ["claude-html"]
    ),
    JSON.stringify(data.tags),
    JSON.stringify(data.visualSpec),
    JSON.stringify(data.promptAnatomy),
    data.customNotes,
    data.sampleTopic,
    data.sampleSubtitle,
    nextIsPublic,
    now,
    existing.id,
    viewerId
  );

  return getPromptBySlugOrId(existing.id, viewerId);
}

export function updatePromptVisibility(
  id: string,
  isPublic: boolean,
  viewerId: string
): PromptItem | null {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id, author_id FROM prompts WHERE id = ? OR slug = ? LIMIT 1`
    )
    .get(id, id) as { id: string; author_id: string } | undefined;

  if (!existing || existing.author_id !== viewerId) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE prompts SET is_public = ?, updated_at = ? WHERE id = ? AND author_id = ?`
  ).run(isPublic ? 1 : 0, now, existing.id, viewerId);

  return getPromptBySlugOrId(existing.id, viewerId);
}

export function getUserStats(userId: string): UserStats {
  const db = getDb();
  const published = (
    db
      .prepare("SELECT COUNT(*) as c FROM prompts WHERE author_id = ?")
      .get(userId) as { c: number }
  ).c;
  const likes = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM prompt_likes pl
         JOIN prompts p ON p.id = pl.prompt_id
         WHERE pl.user_id = ? AND (p.is_public = 1 OR p.author_id = ?)`
      )
      .get(userId, userId) as { c: number }
  ).c;
  const favorites = (
    db
      .prepare(
        `SELECT COUNT(*) as c
         FROM prompt_favorites pf
         JOIN prompts p ON p.id = pf.prompt_id
         WHERE pf.user_id = ? AND (p.is_public = 1 OR p.author_id = ?)`
      )
      .get(userId, userId) as { c: number }
  ).c;
  const decks = (
    db
      .prepare("SELECT COUNT(*) as c FROM saved_decks WHERE author_id = ?")
      .get(userId) as { c: number }
  ).c;
  return { published, likes, favorites, decks };
}

export function mapPublicUser(row: {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_color: string;
  created_at: string;
}): UserPublic {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
  };
}

export function getCreatorByUsername(
  username: string,
  viewerId?: string | null
): {
  creator: UserPublic;
  prompts: PromptItem[];
  impact: {
    publishedCount: number;
    totalLikes: number;
    totalSaves: number;
    totalCopies: number;
  };
  privateCount: number;
} | null {
  const db = getDb();
  const userRow = db
    .prepare(
      `SELECT id, username, display_name, bio, avatar_color, created_at FROM users WHERE username = ? OR id = ? LIMIT 1`
    )
    .get(username, username) as
    | {
        id: string;
        username: string;
        display_name: string;
        bio: string;
        avatar_color: string;
        created_at: string;
      }
    | undefined;

  if (!userRow) return null;

  const creator = mapPublicUser(userRow);
  const prompts = listPrompts({
    authorId: creator.id,
    sort: "popular",
    viewerId,
  });

  const impact = prompts.reduce(
    (acc, p) => {
      acc.publishedCount += 1;
      acc.totalLikes += p.likesCount;
      acc.totalSaves += p.savesCount;
      acc.totalCopies += p.copiesCount;
      return acc;
    },
    { publishedCount: 0, totalLikes: 0, totalSaves: 0, totalCopies: 0 }
  );

  let privateCount = 0;
  if (viewerId && viewerId === creator.id) {
    privateCount = (
      db
        .prepare(
          `SELECT COUNT(*) as c FROM prompts WHERE author_id = ? AND is_public = 0`
        )
        .get(creator.id) as { c: number }
    ).c;
  }

  return { creator, prompts, impact, privateCount };
}

/* ====== Comments Helpers ====== */

export function listPromptComments(promptId: string): PromptComment[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        pc.id,
        pc.prompt_id,
        pc.tested_tool,
        pc.rating,
        pc.content,
        pc.created_at,
        u.id AS author_id,
        u.username AS author_username,
        u.display_name AS author_display_name,
        u.bio AS author_bio,
        u.avatar_color AS author_avatar_color,
        u.created_at AS author_created_at
      FROM prompt_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.prompt_id = ?
      ORDER BY pc.created_at DESC
    `
    )
    .all(promptId) as {
    id: string;
    prompt_id: string;
    tested_tool: string;
    rating: number;
    content: string;
    created_at: string;
    author_id: string;
    author_username: string;
    author_display_name: string;
    author_bio: string;
    author_avatar_color: string;
    author_created_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    promptId: r.prompt_id,
    testedTool: r.tested_tool as TargetTool,
    rating: r.rating,
    content: r.content,
    createdAt: r.created_at,
    author: {
      id: r.author_id,
      username: r.author_username,
      displayName: r.author_display_name,
      bio: r.author_bio,
      avatarColor: r.author_avatar_color,
      createdAt: r.author_created_at,
    },
  }));
}

/* ====== Saved Decks Helpers ====== */

interface RawDeckRow {
  id: string;
  title: string;
  subtitle: string;
  audience: string;
  prompt_id: string;
  prompt_slug: string;
  prompt_title: string;
  visual_spec: string;
  slides_json: string;
  is_public: number;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

function hydrateDeck(row: RawDeckRow): SavedDeck {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    audience: row.audience,
    promptId: row.prompt_id,
    promptSlug: row.prompt_slug,
    promptTitle: row.prompt_title,
    visualSpec: JSON.parse(row.visual_spec) as VisualSpec,
    slides: JSON.parse(row.slides_json) as DeckSlideItem[],
    isPublic: Boolean(row.is_public),
    authorId: row.author_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getSavedDeckById(id: string): SavedDeck | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM saved_decks WHERE id = ? LIMIT 1`)
    .get(id) as RawDeckRow | undefined;
  return row ? hydrateDeck(row) : null;
}

export function listSavedDecksByUser(userId: string): SavedDeck[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM saved_decks WHERE author_id = ? ORDER BY updated_at DESC`
    )
    .all(userId) as RawDeckRow[];
  return rows.map(hydrateDeck);
}
