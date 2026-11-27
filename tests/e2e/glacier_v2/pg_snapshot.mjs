#!/usr/bin/env node
// Read-only PostgreSQL row-count snapshot for the Glacier E2E DB hygiene audit.
// Prints a single JSON object to stdout. Uses the `postgres` driver already
// shipped as an app dependency, so the Python harness needs no extra packages.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
const TABLES = [
  "users",
  "prompts",
  "prompt_comments",
  "saved_decks",
  "prompt_likes",
  "prompt_favorites",
  "sessions",
];

try {
  const counts = {};
  for (const table of TABLES) {
    const rows = await sql.unsafe(`SELECT COUNT(*)::int AS n FROM pptgod.${table}`);
    counts[table] = rows[0].n;
  }
  const [p] = await sql`SELECT COUNT(*)::int AS n FROM pptgod.prompts WHERE title LIKE '[E2E%'`;
  const [d] = await sql`SELECT COUNT(*)::int AS n FROM pptgod.saved_decks WHERE title LIKE '[E2E%'`;
  const [c] = await sql`SELECT COUNT(*)::int AS n FROM pptgod.prompt_comments WHERE content LIKE '[E2E%'`;
  counts.journal_mode = "postgresql";
  counts.residual_e2e_prompts = p.n;
  counts.residual_e2e_decks = d.n;
  counts.residual_e2e_comments = c.n;
  counts.residual_e2e_rows = p.n + d.n + c.n;
  process.stdout.write(JSON.stringify(counts));
} finally {
  await sql.end({ timeout: 5 });
}
