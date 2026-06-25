import { civilToDays, mathMod, parseCivilDate } from "@/lib/engine";
import { z } from "zod";

// Jour de paye — surcouche DÉTERMINISTE, worker-private (visible du seul travailleur).
// Même esprit que le moteur Pitman : ancre + intervalle fixe, calculé à la volée — on ne
// stocke JAMAIS les dates de paye, seulement la config (ancre + fréquence). La visibilité
// « travailleur seul » se joue en BD (RLS owner-only) et au câblage (jamais passée à la
// conjointe) — ce module reste pur et ne sait rien des rôles.

/** Cadence de paye. Intervalles fixes en jours → modèle ancre+mod, comme le cycle Pitman. */
export type FrequencePaye = "hebdomadaire" | "aux_2_semaines";

/** Validation de frontière (formulaire /foyer) — resserre le `text` BD vers le type. */
export const frequencePayeSchema = z.enum(["hebdomadaire", "aux_2_semaines"]);

export interface ReglagePaye {
  /** Date civile 'AAAA-MM-JJ' d'une paye connue : l'ancre du cycle. */
  readonly anchorDate: string;
  readonly frequence: FrequencePaye;
}

const JOURS_PAR_FREQUENCE: Record<FrequencePaye, number> = {
  hebdomadaire: 7,
  aux_2_semaines: 14,
};

/**
 * La date tombe-t-elle un jour de paye ? Vrai quand l'écart en jours avec l'ancre est un
 * multiple exact de l'intervalle. `mathMod` garantit un résultat ≥ 0 même pour une date
 * ANTÉRIEURE à l'ancre (les payes passées sont aussi valides). Pur, sans horloge ni I/O.
 */
export function estJourDePaye(date: string, reglage: ReglagePaye): boolean {
  const delta = civilToDays(parseCivilDate(date)) - civilToDays(parseCivilDate(reglage.anchorDate));
  return mathMod(delta, JOURS_PAR_FREQUENCE[reglage.frequence]) === 0;
}
