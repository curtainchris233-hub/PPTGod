import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function openDatabase(url: string, max = 4) {
  // Supabase's transaction pooler does not accept prepared statements.
  const client = postgres(url, {
    max,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return { db: drizzle(client, { schema }), client };
}

declare global {
  var __pptgodPg: ReturnType<typeof openDatabase> | undefined;
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  globalThis.__pptgodPg ??= openDatabase(url);
  return globalThis.__pptgodPg.db;
}
