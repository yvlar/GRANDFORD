#!/usr/bin/env node
// Génère lib/database.types.ts à partir du schéma Postgres.
//
// WHY ce script plutôt que `supabase gen types typescript` directement :
// la CLI Supabase délègue la génération à un conteneur Docker `postgres-meta`, dont
// l'image est inaccessible dans cet environnement (CDN d'images bloqué par l'egress).
// Ce script appelle EXACTEMENT le même générateur (`@supabase/postgres-meta`, version
// alignée sur celle qu'embarque la CLI) en pur Node — sortie identique, sans Docker.
// Les types ne sont donc jamais écrits à la main (règle conventions-code-base.md).
//
// Usage : node scripts/gen-types.mjs [db_url]
//   db_url défaut : $GRANDFORD_TYPES_DB_URL ou la base locale appliquée par les tests.

// On importe des chemins `dist/` internes (non exposés par "exports") : c'est pourquoi
// @supabase/postgres-meta est épinglé à une version EXACTE dans package.json — un bump
// mineur pourrait déplacer ces fichiers.
import { writeFileSync } from "node:fs";
import { PostgresMeta } from "@supabase/postgres-meta";
import { getGeneratorMetadata } from "@supabase/postgres-meta/dist/lib/generators.js";
import { apply as applyTypescriptTemplate } from "@supabase/postgres-meta/dist/server/templates/typescript.js";

const connectionString =
  process.argv[2] ??
  process.env.GRANDFORD_TYPES_DB_URL ??
  "postgresql://postgres@127.0.0.1:54322/grandford_apply";
const outFile = "lib/database.types.ts";

async function main() {
  const pgMeta = new PostgresMeta({ connectionString, max: 1 });
  try {
    const { data, error } = await getGeneratorMetadata(pgMeta, {
      includedSchemas: ["public"],
      excludedSchemas: [],
    });
    if (error) {
      console.error("Échec de l'introspection :", error.message ?? error);
      process.exitCode = 1;
      return;
    }
    const types = await applyTypescriptTemplate({ ...data, detectOneToOneRelationships: true });
    writeFileSync(outFile, types.endsWith("\n") ? types : `${types}\n`);
    console.log(`Types BD générés → ${outFile}`);
  } finally {
    await pgMeta.end(); // toujours fermer le pool, y compris sur le chemin d'erreur
  }
}

await main();
