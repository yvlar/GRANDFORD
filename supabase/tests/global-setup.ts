import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { GlobalSetupContext } from "vitest/node";

// Prépare une base de test VIERGE et y applique le bootstrap local + toutes les migrations.
// C'est l'équivalent sans Docker de `supabase db reset` : preuve que les migrations
// s'appliquent proprement sur une base neuve, à chaque exécution.

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "migrations");
const bootstrapFile = join(here, "_local_bootstrap.sql");

const ADMIN_URL =
  process.env.GRANDFORD_TEST_ADMIN_URL ?? "postgresql://postgres@127.0.0.1:54322/postgres";
const TEST_DB = process.env.GRANDFORD_TEST_DB ?? "grandford_test";
const TEST_URL =
  process.env.GRANDFORD_TEST_DB_URL ?? `postgresql://postgres@127.0.0.1:54322/${TEST_DB}`;

function sqlFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export default async function setup({ provide }: GlobalSetupContext): Promise<void> {
  // 1) BD joignable ? Recrée la base de test (vierge à chaque run).
  try {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${TEST_DB} with (force)`);
    await admin.query(`create database ${TEST_DB}`);
    await admin.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `\n[isolation RLS] Postgres local injoignable — tests d'isolation IGNORÉS.\n[isolation RLS] Démarrer une BD : bash scripts/local-db.sh\n[isolation RLS] Détail : ${message}\n`,
    );
    provide("rlsAvailable", false);
    provide("rlsDbUrl", TEST_URL);
    return;
  }

  // 2) Bootstrap (auth + rôles) puis migrations, dans l'ordre.
  const client = new pg.Client({ connectionString: TEST_URL });
  await client.connect();
  try {
    await client.query(readFileSync(bootstrapFile, "utf8"));
    for (const file of sqlFiles()) {
      await client.query(readFileSync(join(migrationsDir, file), "utf8"));
    }
  } finally {
    await client.end();
  }

  provide("rlsAvailable", true);
  provide("rlsDbUrl", TEST_URL);
}
