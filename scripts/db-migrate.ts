import { loadEnvConfig } from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { openDatabase } from "../src/lib/db/client";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_MIGRATION_URL or DATABASE_URL before migrating");

  const { db, client } = openDatabase(url, 1);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("PPTGod database migration is current.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error("PPTGod database migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
