// Types du moteur Pitman 2-2-3. Spécification : docs/analyse/03-architecture/architecture.md:98-106.

/** Les quatre équipes de l'usine. A,B = jour ; C,D = nuit (identités fixes, aucune bascule). */
export type Team = "A" | "B" | "C" | "D";

/** Quart de travail. Un quart de nuit appartient à sa date de DÉBUT (date civile locale). */
export type Shift = "jour" | "nuit";

/** Super-quart : regroupement complémentaire des équipes. A+C ensemble, B+D ensemble. */
export type SuperCrew = "AC" | "BD";

/** Heures d'un quart (information d'affichage ; le quart de nuit chevauche minuit). */
export interface ShiftHours {
  readonly start: string; // 'HH:MM'
  readonly end: string; // 'HH:MM'
}

/**
 * Gabarit de cycle, paramétrable PAR USINE (voie multi-usines, FR-17).
 * L'ancre, le pattern et les heures ne sont JAMAIS codés en dur dans la logique.
 */
export interface CycleTemplate {
  /** Date civile 'YYYY-MM-DD' correspondant à pattern[0]. */
  readonly anchorDate: string;
  /** 14 booléens : true = le super-quart A/C travaille ce jour-là. */
  readonly pattern: readonly boolean[];
  /** Heures du quart de jour (ex. 07:00 → 19:00). */
  readonly dayHours: ShiftHours;
  /** Heures du quart de nuit (ex. 19:00 → 07:00). */
  readonly nightHours: ShiftHours;
}

/** Résultat du moteur pour une équipe à une date donnée. */
export interface ShiftResult {
  /** L'équipe travaille-t-elle ce jour-là ? */
  readonly working: boolean;
  /** Quart si elle travaille, sinon null. */
  readonly shift: Shift | null;
  /** Super-quart d'appartenance de l'équipe (identité fixe). */
  readonly superCrew: SuperCrew;
}

/** Une journée du calendrier généré à la volée (aucune date n'est jamais stockée). */
export interface DaySchedule extends ShiftResult {
  readonly date: string; // 'YYYY-MM-DD'
}

/**
 * Vue « qui travaille » à une date donnée, indépendante d'une équipe.
 * Sert l'accueil « coup d'œil » (Sprint 4) : équipe de jour, de nuit, super-quart au repos.
 */
export interface ActiveCrews {
  /** Super-quart actif (au travail) ce jour-là. */
  readonly activeCrew: SuperCrew;
  /** Super-quart au repos ce jour-là. */
  readonly restCrew: SuperCrew;
  /** Équipe au quart de jour. */
  readonly dayTeam: Team;
  /** Équipe au quart de nuit. */
  readonly nightTeam: Team;
}
