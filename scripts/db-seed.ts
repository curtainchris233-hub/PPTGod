import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { demoAccountEnabled, testAccountsEnabled } from "../src/lib/auth-config";
import { openDatabase } from "../src/lib/db/client";
import { accounts, promptComments, prompts, users } from "../src/lib/db/schema";
import { SEED_COMMENTS, SEED_PROMPTS, SEED_USERS } from "../src/lib/seedData";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL before seeding");

  const { db, client } = openDatabase(url, 1);
  try {
    const now = new Date();
    const demoPassword = demoAccountEnabled() ? await hashPassword("demo1234") : null;
    const curatorPassword = testAccountsEnabled() ? await hashPassword("ChenStrategy#2026") : null;

    await db.transaction(async (tx) => {
      await tx.insert(users).values(SEED_USERS.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.displayName,
        email: user.email,
        emailVerified: true,
        bio: user.bio,
        avatarColor: user.avatarColor,
        createdAt: now,
        updatedAt: now,
      }))).onConflictDoNothing();

      await tx.insert(prompts).values(SEED_PROMPTS.map((prompt, index) => {
        const date = new Date(now.getTime() - index * 14 * 60 * 60 * 1000).toISOString();
        return { ...prompt, createdAt: date, updatedAt: date };
      })).onConflictDoNothing();

      await tx.insert(promptComments).values(SEED_COMMENTS.map((comment, index) => ({
        id: comment.id,
        promptId: comment.promptId,
        userId: comment.authorId,
        testedTool: comment.testedTool,
        rating: comment.rating,
        content: comment.content,
        createdAt: new Date(now.getTime() - index * 45 * 60 * 1000).toISOString(),
      }))).onConflictDoNothing();

      if (demoPassword) {
        await tx.insert(accounts).values({
          id: "credential_user_demo",
          userId: "user_demo",
          accountId: "user_demo",
          providerId: "credential",
          password: demoPassword,
        }).onConflictDoNothing();
      }
      if (curatorPassword) {
        await tx.insert(accounts).values({
          id: "credential_user_curator_chen",
          userId: "user_curator_chen",
          accountId: "user_curator_chen",
          providerId: "credential",
          password: curatorPassword,
        }).onConflictDoNothing();
      }
    });
    console.log(`PPTGod library populated (${SEED_PROMPTS.length} styles).`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("PPTGod library setup failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
