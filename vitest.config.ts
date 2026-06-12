import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Le moteur est pur : tests en environnement Node, sans DOM. Pas de mock du moteur
// (règle .claude/rules/tests-vitest.md) — on l'appelle vraiment.
// Les tests d'isolation RLS (supabase/tests) tournent contre un vrai Postgres ; le
// globalSetup prépare une base vierge, ou marque les tests à ignorer si la BD est absente.
export default defineConfig({
  // Même alias `@/…` que tsconfig.json : les tests importent comme le code applicatif.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // WHY: tsconfig garde `jsx: preserve` (Next transforme lui-même) ; pour les tests de
  // rendu, esbuild doit appliquer le runtime JSX automatique de React.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "supabase/tests/**/*.test.ts", "components/**/*.test.tsx"],
    globalSetup: ["supabase/tests/global-setup.ts"],
    // WHY: les fichiers de supabase/tests partagent UNE base et des seeds qui
    // tronquent tout — exécutés en parallèle, ils se sabotent (deadlocks, données
    // disparues sous les pieds d'une transaction). La suite reste < 10 s.
    fileParallelism: false,
  },
});
