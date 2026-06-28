import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Garde anti-dérive (R7), même classe que fridge-payload-parity.test.ts (Sprint 20).
// `supabase/functions/_shared/grocery-payload.ts` est une COPIE manuelle de
// `lib/notifications/grocery-payload.ts` : la contrainte zéro-import (consommé par
// l'Edge Function Deno hors de l'alias `@/`) interdit de partager le module. La garantie
// « aucun libellé d'article dans la notification » vit donc dans LES DEUX fichiers —
// s'ils divergent en silence, le payload push côté Edge pourrait cesser d'honorer R7
// sans alerte. Ce test fait mordre la divergence : modifier l'un sans l'autre casse la suite.

const SOURCE_DE_VERITE = fileURLToPath(new URL("./grocery-payload.ts", import.meta.url));
const COPIE_EDGE = fileURLToPath(
  new URL("../../supabase/functions/_shared/grocery-payload.ts", import.meta.url),
);

// Le bandeau de commentaires de tête diffère légitimement (chaque fichier explique son
// rôle) ; le CONTENU EXÉCUTABLE — du premier `export` à la fin — doit être identique.
function corpsExecutable(chemin: string): string {
  const lf = readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
  const debut = lf.indexOf("export type GroceryEvent");
  if (debut === -1) {
    throw new Error(`Ancre introuvable dans ${chemin} : le fichier a-t-il été renommé ?`);
  }
  return lf.slice(debut);
}

describe("parité du payload de l'épicerie", () => {
  it("la copie Edge _shared/grocery-payload.ts ne dérive jamais de la source lib/notifications/grocery-payload.ts (garde R7)", () => {
    expect(corpsExecutable(COPIE_EDGE)).toBe(corpsExecutable(SOURCE_DE_VERITE));
  });
});
