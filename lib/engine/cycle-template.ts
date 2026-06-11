import type { CycleTemplate } from "./types";

/**
 * Gabarit VALIDÉ de l'usine actuelle (l'utilisateur est sur l'équipe A).
 * Faits intouchables, confirmés sur points réels — docs/analyse/01-decouverte/02-cas-utilisation.md:108-118 :
 *   - ancre mer. 3 juin 2026 = A/C ;
 *   - 11 juin 2026 = équipe A en congé ; 25 déc. 2026 = équipe A travaille de jour.
 * Pattern A/C sur 14 jours (idx 0 = 3 juin) — 02-cas-utilisation.md:61 ; 7 jours ON / 14.
 */
export const GRANDFORD_CYCLE: CycleTemplate = {
  anchorDate: "2026-06-03",
  // biome-ignore format: pattern de 14 bits gardé sur une ligne pour refléter la table validée (02-cas-utilisation.md:61).
  pattern: [true, true, false, false, false, true, true, false, false, true, true, true, false, false],
  dayHours: { start: "07:00", end: "19:00" },
  nightHours: { start: "19:00", end: "07:00" },
};
