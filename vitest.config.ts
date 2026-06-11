import { defineConfig } from "vitest/config";

// Le moteur est pur : tests en environnement Node, sans DOM. Pas de mock du moteur
// (règle .claude/rules/tests-vitest.md) — on l'appelle vraiment.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
