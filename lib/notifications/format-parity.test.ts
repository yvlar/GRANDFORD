import { FORMAT_JOUR_LONG, dateUTC } from "@/lib/schedule/format";
import { describe, expect, it } from "vitest";
import { reminderPayload } from "./payload";

// Garde anti-dérive (FR-10). La date civile 'AAAA-MM-JJ' est formatée par DEUX
// `Intl.DateTimeFormat` strictement identiques mais dupliqués :
//   - `FORMAT_JOUR_LONG` (lib/schedule/format.ts) — affichage de l'app ;
//   - `FORMAT_JOUR` (lib/notifications/payload.ts) — texte des notifications.
// La contrainte zéro-import de `payload.ts` (consommé par l'Edge Function Deno, hors
// alias `@/`) interdit de partager le formateur : on le duplique, et chaque fichier
// porte un commentaire « MIROIR ASSUMÉ ». Rien ne gardait jusqu'ici que les deux
// produisent la MÊME chaîne — modifier l'un sans l'autre ferait diverger en silence
// la date affichée dans l'app de celle écrite dans le rappel. Ce test fait mordre la
// divergence (même classe de risque que la parité du corps du payload, Sprint 16).
//
// `FORMAT_JOUR` est privé à `payload.ts` ; sa seule surface observable est le corps
// produit par `reminderPayload`. On le compare à la sortie publique de
// `FORMAT_JOUR_LONG` (et `dateUTC` reproduit l'instant UTC interne du payload).

describe("parité du format de date — app vs notification", () => {
  // Bornes d'année, date avant l'ancre Pitman (2026-06-03), 29 février bissextile,
  // date ordinaire : exerce jour / mois / jour-de-semaine variés (le format dépend des trois).
  const DATES = ["2026-01-01", "2026-12-31", "2026-05-15", "2028-02-29", "2026-07-22"];

  for (const date of DATES) {
    it(`le ${date} se rend identiquement dans le rappel et dans l'affichage de l'app`, () => {
      // Égalité EXACTE (pas `toContain`) : une dérive qui ÉLARGIT le format du payload
      // — p. ex. `FORMAT_JOUR` gagne `year` — laisserait la chaîne plus courte de l'app
      // incluse dans le corps et passerait inaperçue. On reconstruit le corps attendu en
      // n'injectant que la sortie de `FORMAT_JOUR_LONG` : toute divergence, dans un sens
      // comme dans l'autre, casse l'égalité.
      const attendu = FORMAT_JOUR_LONG.format(dateUTC(date));
      expect(reminderPayload(date, "day").body).toBe(`Écart à l'horaire ${attendu} (demain).`);
    });
  }
});
