import type { Shift } from "@/lib/engine";

// Types de la couche « horaire affichable » (Sprint 4, FR-2/FR-3). Cette couche
// superpose les écarts persistés à l'horaire calculé par le moteur — elle ne
// modifie JAMAIS le moteur (règle moteur-pitman.md) et reste pure (zéro I/O).

/** Effet PARTAGEABLE d'un écart — la disponibilité, jamais le motif (R7). */
export type ExceptionEffect = "off" | "working" | "working_extra" | "shift_swap";

/**
 * Écart tel que la vue le consomme : strictement les colonnes non sensibles de
 * `exceptions`. Le motif (`exception_private`) n'a aucun champ ici PAR CONSTRUCTION :
 * ce type est la frontière que traverse le payload vers le client (R7).
 */
export interface ScheduleException {
  readonly onDate: string; // 'YYYY-MM-DD'
  readonly effect: ExceptionEffect;
  readonly shift: Shift | null;
}

/** Fenêtre horaire 'HH:MM' (affichage ; peut chevaucher minuit). */
export interface SleepWindow {
  readonly start: string;
  readonly end: string;
}

/** État affichable d'une journée pour le travailleur (pastille, semaine, mois). */
export type DayStatusKind = "conge" | "jour" | "nuit" | "sommeil";

export interface DayStatus {
  readonly date: string; // 'YYYY-MM-DD'
  readonly kind: DayStatusKind;
  /** true si un écart persisté a modifié l'horaire calculé ce jour-là. */
  readonly fromException: boolean;
  /** Fenêtre de sommeil quand kind = 'sommeil', sinon null. */
  readonly sleep: SleepWindow | null;
}

/** Sémantique de la vue conjointe (FR-3) : la disponibilité, rien d'autre. */
export type Availability = "travaille" | "disponible" | "sommeil";

/** Grille d'un mois civil, prête à rendre (dimanche en première colonne). */
export interface MonthGrid {
  readonly year: number;
  readonly month: number; // 1-12
  /** Cases vides avant le 1er du mois (alignement sur dimanche = 0). */
  readonly leadingBlanks: number;
  readonly days: readonly DayStatus[];
}
