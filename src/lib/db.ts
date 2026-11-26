import {
  and,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  ilike,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import { promptComments, promptFavorites, promptLikes, prompts, savedDecks, users } from "@/lib/db/schema";
import type {
  ColorFamily,
  PromptAnatomy,
  PromptComment,
  PromptItem,
  TargetTool,
  UserPublic,
  UserStats,
  VisualSpec,
} from "@/types/prompt";

export { getDb };

type PublicUserRow = Pick<typeof users.$inferSelect, "id" | "username" | "name" | "bio" | "avatarColor" | "createdAt">;
const publicUserColumns = {
  id: users.id,
  username: users.username,
  name: users.name,
  bio: users.bio,
  avatarColor: users.avatarColor,
  createdAt: users.createdAt,
};

export function mapPublicUser(row: PublicUserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    displayName: row.name,
    bio: row.bio,
    avatarColor: row.avatarColor,
    createdAt: row.createdAt.toISOString(),
  };
}

const remixOrigin = alias(prompts, "remix_origin");
const remixAuthor = alias(users, "remix_author");

function promptDetails(viewerId: string) {
  return getDb()
    .select({
      ...getTableColumns(prompts),
      author: publicUserColumns,
      remix: {
        id: remixOrigin.id,
        slug: remixOrigin.slug,
        title: remixOrigin.title,
        authorUsername: remixAuthor.username,
        authorDisplayName: remixAuthor.name,
      },
      commentsCount: sql`(select count(*) from ${promptComments} where ${promptComments.promptId} = ${prompts.id})`.mapWith(Number),
      likedByMe: exists(
        getDb().select({ id: promptLikes.promptId }).from(promptLikes)
          .where(and(eq(promptLikes.promptId, prompts.id), eq(promptLikes.userId, viewerId)))
      ).mapWith(Boolean),
      favoritedByMe: exists(
        getDb().select({ id: promptFavorites.promptId }).from(promptFavorites)
          .where(and(eq(promptFavorites.promptId, prompts.id), eq(promptFavorites.userId, viewerId)))
      ).mapWith(Boolean),
    })
    .from(prompts)
    .innerJoin(users, eq(users.id, prompts.authorId))
    .leftJoin(remixOrigin, and(
      eq(remixOrigin.id, prompts.remixedFromId),
      or(eq(remixOrigin.isPublic, true), eq(remixOrigin.authorId, viewerId))
    ))
    .leftJoin(remixAuthor, eq(remixAuthor.id, remixOrigin.authorId));
}

type PromptDetail = Awaited<ReturnType<typeof promptDetails>>[number];

function hydratePrompt(row: PromptDetail): PromptItem {
  const { author, remix, remixedFromId, ...prompt } = row;
  return {
    ...prompt,
    author: mapPublicUser(author),
    remixedFrom: remixedFromId && remix?.id && remix.slug && remix.title
      ? {
          id: remix.id,
          slug: remix.slug,
          title: remix.title,
          authorUsername: remix.authorUsername ?? undefined,
          authorDisplayName: remix.authorDisplayName ?? undefined,
        }
      : null,
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

export async function listPrompts(options: ListPromptsOptions = {}): Promise<PromptItem[]> {
  const viewerId = options.viewerId ?? "";
  const privateOwner = options.includePrivateForAuthorId === viewerId ? viewerId : "";
  const conditions = [];
  if (privateOwner && options.visibility === "private") {
    conditions.push(and(eq(prompts.isPublic, false), eq(prompts.authorId, privateOwner)));
  } else if (privateOwner && options.visibility !== "public") {
    conditions.push(or(eq(prompts.isPublic, true), eq(prompts.authorId, privateOwner)));
  } else {
    conditions.push(eq(prompts.isPublic, true));
  }

  if (options.q?.trim()) {
    const pattern = `%${options.q.trim()}%`;
    conditions.push(or(
      ilike(prompts.title, pattern),
      ilike(prompts.englishTitle, pattern),
      ilike(prompts.summary, pattern),
      ilike(sql`${prompts.tags}::text`, pattern),
      ilike(prompts.scenario, pattern),
      ilike(prompts.styleCategory, pattern),
    ));
  }
  if (options.scenario && options.scenario !== "全部场景") {
    conditions.push(eq(prompts.scenario, options.scenario));
  }
  if (options.style && options.style !== "全部风格") {
    conditions.push(eq(prompts.styleCategory, options.style));
  }
  if (options.color && options.color !== "all") {
    conditions.push(eq(prompts.colorFamily, options.color as ColorFamily));
  }
  if (options.tool && options.tool !== "all") {
    conditions.push(sql`${prompts.recommendedTools} @> ${JSON.stringify([options.tool])}::jsonb`);
  }
  if (options.authorId) {
    conditions.push(eq(prompts.authorId, options.authorId));
  }
  if (options.favoritesOfUserId) {
    conditions.push(exists(
      getDb().select({ id: promptFavorites.promptId }).from(promptFavorites)
        .where(and(eq(promptFavorites.promptId, prompts.id), eq(promptFavorites.userId, options.favoritesOfUserId)))
    ));
  }
  if (options.likedByUserId) {
    conditions.push(exists(
      getDb().select({ id: promptLikes.promptId }).from(promptLikes)
        .where(and(eq(promptLikes.promptId, prompts.id), eq(promptLikes.userId, options.likedByUserId)))
    ));
  }

  const orders = {
    newest: [desc(prompts.createdAt)],
    copies: [desc(prompts.copiesCount), desc(prompts.likesCount)],
    popular: [desc(prompts.likesCount), desc(prompts.copiesCount)],
  };
  const rows = await promptDetails(viewerId)
    .where(and(...conditions))
    .orderBy(...orders[options.sort ?? "popular"], prompts.id);
  return rows.map(hydratePrompt);
}

export async function getPromptBySlugOrId(slugOrId: string, viewerId?: string | null): Promise<PromptItem | null> {
  const viewer = viewerId ?? "";
  const [row] = await promptDetails(viewer).where(and(
    or(eq(prompts.slug, slugOrId), eq(prompts.id, slugOrId)),
    or(eq(prompts.isPublic, true), eq(prompts.authorId, viewer)),
  )).limit(1);
  return row ? hydratePrompt(row) : null;
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

function ownedPrompt(id: string, viewerId: string) {
  return and(
    or(eq(prompts.id, id), eq(prompts.slug, id)),
    eq(prompts.authorId, viewerId)
  );
}

export async function updatePrompt(id: string, data: UpdatePromptInput, viewerId: string): Promise<PromptItem | null> {
  const [updated] = await getDb().update(prompts).set({
    ...data,
    recommendedTools: data.recommendedTools.length ? data.recommendedTools : ["claude-html"],
    updatedAt: new Date().toISOString(),
  }).where(ownedPrompt(id, viewerId)).returning({ id: prompts.id });
  return updated ? getPromptBySlugOrId(updated.id, viewerId) : null;
}

export async function updatePromptVisibility(id: string, isPublic: boolean, viewerId: string): Promise<PromptItem | null> {
  const [updated] = await getDb().update(prompts).set({
    isPublic,
    updatedAt: new Date().toISOString(),
  }).where(ownedPrompt(id, viewerId)).returning({ id: prompts.id });
  return updated ? getPromptBySlugOrId(updated.id, viewerId) : null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [stats] = await getDb().select({
    published: sql`(select count(*) from ${prompts} where ${prompts.authorId} = ${userId})`.mapWith(Number),
    likes: sql`(select count(*) from ${promptLikes} join ${prompts} on ${prompts.id} = ${promptLikes.promptId}
      where ${promptLikes.userId} = ${userId} and (${prompts.isPublic} or ${prompts.authorId} = ${userId}))`.mapWith(Number),
    favorites: sql`(select count(*) from ${promptFavorites} join ${prompts} on ${prompts.id} = ${promptFavorites.promptId}
      where ${promptFavorites.userId} = ${userId} and (${prompts.isPublic} or ${prompts.authorId} = ${userId}))`.mapWith(Number),
    decks: sql`(select count(*) from ${savedDecks} where ${savedDecks.authorId} = ${userId})`.mapWith(Number),
  }).from(users).where(eq(users.id, userId)).limit(1);
  return stats ?? { published: 0, likes: 0, favorites: 0, decks: 0 };
}

export async function getCreatorByUsername(username: string, viewerId?: string | null) {
  const db = getDb();
  const [user] = await db.select(publicUserColumns).from(users)
    .where(or(eq(users.username, username), eq(users.id, username))).limit(1);
  if (!user) return null;

  const creator = mapPublicUser(user);
  const [publicPrompts, privateCounts] = await Promise.all([
    listPrompts({ authorId: creator.id, sort: "popular", viewerId }),
    viewerId === creator.id
      ? db.select({ value: count() }).from(prompts)
          .where(and(eq(prompts.authorId, creator.id), eq(prompts.isPublic, false)))
      : [],
  ]);
  const impact = publicPrompts.reduce(
    (acc, prompt) => {
      acc.publishedCount += 1;
      acc.totalLikes += prompt.likesCount;
      acc.totalSaves += prompt.savesCount;
      acc.totalCopies += prompt.copiesCount;
      return acc;
    },
    { publishedCount: 0, totalLikes: 0, totalSaves: 0, totalCopies: 0 }
  );
  return { creator, prompts: publicPrompts, impact, privateCount: privateCounts[0]?.value ?? 0 };
}

export async function listPromptComments(promptId: string): Promise<PromptComment[]> {
  const rows = await getDb().select({
    id: promptComments.id,
    promptId: promptComments.promptId,
    testedTool: promptComments.testedTool,
    rating: promptComments.rating,
    content: promptComments.content,
    createdAt: promptComments.createdAt,
    author: publicUserColumns,
  }).from(promptComments)
    .innerJoin(users, eq(users.id, promptComments.userId))
    .where(eq(promptComments.promptId, promptId))
    .orderBy(desc(promptComments.createdAt));
  return rows.map((row) => ({ ...row, author: mapPublicUser(row.author) }));
}

export async function getSavedDeckById(id: string) {
  const [row] = await getDb().select().from(savedDecks).where(eq(savedDecks.id, id)).limit(1);
  return row ?? null;
}

export async function listSavedDecksByUser(userId: string) {
  return getDb().select().from(savedDecks).where(eq(savedDecks.authorId, userId))
    .orderBy(desc(savedDecks.updatedAt));
}
