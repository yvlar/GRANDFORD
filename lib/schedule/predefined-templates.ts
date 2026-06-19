import type { CycleTemplate } from "@/lib/engine";
import { z } from "zod";

export interface GabaritPredefini {
  name: string;
  template: CycleTemplate;
}

// Pattern Pitman 2-2-3 validé (docs/analyse/01-decouverte/02-cas-utilisation.md:61).
// true = le super-quart A/C travaille ce jour-là dans le cycle de 14 jours.
const PATTERN_PITMAN: readonly boolean[] = [
  true,
  true,
  false,
  false,
  false,
  true,
  true,
  false,
  false,
  true,
  true,
  true,
  false,
  false,
];

// Deux gabarits prédéfinis pour Sprint 14 : même pattern, ancres distinctes.
// Un seul foyer a un gabarit actif à la fois ; changer l'ancre décale le cycle
// (les équipes A/C travaillent des jours différents selon l'ancre choisie).
export const GABARITS_PREDEFINIS = [
  {
    name: "Pitman 2-2-3",
    template: {
      anchorDate: "2026-06-03",
      pattern: PATTERN_PITMAN,
      dayHours: { start: "07:00", end: "19:00" },
      nightHours: { start: "19:00", end: "07:00" },
    },
  },
  {
    name: "Pitman 2-2-3 (ancre alt.)",
    template: {
      anchorDate: "2026-06-10",
      pattern: PATTERN_PITMAN,
      dayHours: { start: "07:00", end: "19:00" },
      nightHours: { start: "19:00", end: "07:00" },
    },
  },
] as const satisfies readonly GabaritPredefini[];

const NOMS = GABARITS_PREDEFINIS.map((g) => g.name) as [string, ...string[]];

export const gabaritNomSchema = z.enum(NOMS);

export function trouverGabarit(name: string): GabaritPredefini | undefined {
  return GABARITS_PREDEFINIS.find((g) => g.name === name);
}
