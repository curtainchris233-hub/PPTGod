import { loadEnvConfig } from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/lib/db/client";
import { accounts, promptComments, promptFavorites, promptLikes, prompts, savedDecks, users } from "../src/lib/db/schema";
import { LEGACY_PASSWORD_PREFIX } from "../src/lib/password";
import { SEED_ACCOUNT_ADDRESSES } from "../src/lib/seed-accounts";

type Table = "users" | "prompts" | "prompt_likes" | "prompt_favorites" | "prompt_comments" | "saved_decks";
type LegacyRow = Record<string, unknown>;

function readRows<T extends LegacyRow>(db: DatabaseSync, table: Table): T[] {
  const exists = db.prepare("select 1 from sqlite_master where type = 'table' and name = ?").get(table);
  return exists ? db.prepare(`select * from ${table}`).all() as T[] : [];
}

function string(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid data in legacy database");
  return value;
}

function json<T>(value: unknown): T {
  return JSON.parse(string(value));
}

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL before importing");
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run db:import-sqlite -- /path/to/pptgod.db");
  const source = new DatabaseSync(input, { readOnly: true });
  const { db, client } = openDatabase(url, 1);

  try {
    // Keep a consistent SQLite snapshot if the old application is still running.
    source.exec("begin");
    if (!source.prepare("select 1 from sqlite_master where type = 'table' and name = 'users'").get()) {
      throw new Error("This SQLite file does not contain a PPTGod database");
    }
    const oldUsers = readRows(source, "users");
    const oldPrompts = readRows(source, "prompts");
    const oldLikes = readRows(source, "prompt_likes");
    const oldFavorites = readRows(source, "prompt_favorites");
    const oldComments = readRows(source, "prompt_comments");
    const oldDecks = readRows(source, "saved_decks");
    source.exec("commit");

    await db.transaction(async (tx) => {
      for (const row of oldUsers) {
        const email = string(row.email).trim().toLowerCase();
        const createdAt = new Date(string(row.created_at));
        const id = string(row.id);
        const seeded = SEED_ACCOUNT_ADDRESSES.has(email);
        await tx.insert(users).values({
          id,
          email,
          emailVerified: seeded,
          name: string(row.display_name),
          username: string(row.username),
          bio: string(row.bio),
          avatarColor: string(row.avatar_color),
          createdAt,
          updatedAt: createdAt,
        }).onConflictDoNothing({ target: users.id });

        if (!seeded) {
          await tx.insert(accounts).values({
            id: `legacy_${id}`,
            userId: id,
            accountId: id,
            providerId: "credential",
            password: `${LEGACY_PASSWORD_PREFIX}${string(row.password_hash)}`,
            createdAt,
            updatedAt: createdAt,
          }).onConflictDoNothing();
        }
      }

      for (const row of oldPrompts) {
        await tx.insert(prompts).values({
          id: string(row.id),
          slug: string(row.slug),
          title: string(row.title),
          englishTitle: string(row.english_title),
          summary: string(row.summary),
          scenario: string(row.scenario),
          styleCategory: string(row.style_category),
          colorFamily: string(row.color_family) as typeof prompts.$inferInsert.colorFamily,
          recommendedTools: json(row.recommended_tools),
          tags: json(row.tags),
          visualSpec: json(row.visual_spec),
          promptAnatomy: json(row.prompt_anatomy),
          customNotes: string(row.custom_notes),
          sampleTopic: string(row.sample_topic),
          sampleSubtitle: string(row.sample_subtitle),
          authorId: string(row.author_id),
          isOfficial: Boolean(row.is_official),
          isPublic: row.is_public === undefined || Boolean(row.is_public),
          remixedFromId: typeof row.remixed_from_id === "string" ? row.remixed_from_id : null,
          likesCount: Number(row.likes_count),
          savesCount: Number(row.saves_count),
          copiesCount: Number(row.copies_count),
          createdAt: string(row.created_at),
          updatedAt: string(row.updated_at),
        }).onConflictDoNothing();
      }

      const mapInteraction = (row: LegacyRow) => ({
        userId: string(row.user_id),
        promptId: string(row.prompt_id),
        createdAt: string(row.created_at),
      });
      for (const row of oldLikes) {
        await tx.insert(promptLikes).values(mapInteraction(row)).onConflictDoNothing();
      }
      for (const row of oldFavorites) {
        await tx.insert(promptFavorites).values(mapInteraction(row)).onConflictDoNothing();
      }
      for (const row of oldComments) {
        await tx.insert(promptComments).values({
          ...mapInteraction(row),
          id: string(row.id),
          content: string(row.content),
          testedTool: string(row.tested_tool ?? "claude-html") as typeof promptComments.$inferInsert.testedTool,
          rating: Number(row.rating ?? 5),
        }).onConflictDoNothing();
      }
      for (const row of oldDecks) {
        await tx.insert(savedDecks).values({
          id: string(row.id),
          title: string(row.title),
          subtitle: string(row.subtitle),
          audience: string(row.audience),
          promptId: string(row.prompt_id),
          promptSlug: string(row.prompt_slug),
          promptTitle: string(row.prompt_title),
          visualSpec: json(row.visual_spec),
          slides: json(row.slides_json),
          isPublic: Boolean(row.is_public),
          authorId: typeof row.author_id === "string" ? row.author_id : null,
          createdAt: string(row.created_at),
          updatedAt: string(row.updated_at),
        }).onConflictDoNothing();
      }
    });

    console.log(`PPTGod import scanned ${oldUsers.length} accounts, ${oldPrompts.length} styles, ${oldDecks.length} presentations, ${oldLikes.length} likes, ${oldFavorites.length} favorites, and ${oldComments.length} comments.`);
    console.log("Users must sign in again. Existing user IDs, ownership and share settings were preserved.");
  } finally {
    source.close();
    await client.end();
  }
}

main().catch(() => {
  console.error("PPTGod SQLite import failed. Verify the database file and migration settings. No partial records were committed.");
  process.exitCode = 1;
});
