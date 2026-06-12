import {
  type CycleTemplate,
  type DaySchedule,
  type Shift,
  type Team,
  scheduleRange,
} from "@/lib/engine";
import { z } from "zod";
import { addDays } from "./calendar";

// Superposition des ÉCARTS et du SOMMEIL sur l'horaire de base (FR-2/FR-3).
// Fonctions pures : le moteur (lib/engine/) est consommé tel quel, jamais modifié ;
// les écarts et la fenêtre de sommeil arrivent en paramètres (la BD reste à la frontière).

/**
 * Effet d'un écart, aligné sur la contrainte CHECK de `exceptions.effect` (Sprint 2).
 * Schéma Zod = source unique ; le type en est dérivé (la frontière BD le réutilise).
 */
export const exceptionEffectSchema = z.enum(["off", "working", "working_extra", "shift_swap"]);
export type ExceptionEffect = z.infer<typeof exceptionEffectSchema>;

/** Écart d'horaire PARTAGEABLE (projection de `public.exceptions` — jamais le motif, R7). */
export interface ScheduleException {
  readonly onDate: string; // 'YYYY-MM-DD'
  readonly effect: ExceptionEffect;
  readonly shift: Shift | null;
}

/** Fenêtre de sommeil affichée ('HH:MM'), venant de `sleep_defaults` ou de l'heuristique. */
export interface SleepWindow {
  readonly start: string;
  readonly end: string;
}

/** Statut d'une journée pour le travailleur : la pastille de l'accueil (FR-2). */
export type WorkerStatus = Shift | "conge" | "sommeil";

/** Statut vu par la conjointe : disponibilité, jamais plus (FR-3, R7). */
export type SpouseStatus = "travaille" | "disponible" | "sommeil";

/** Une journée prête à afficher : moteur + écarts + sommeil déjà combinés. */
export interface DayOverview {
  readonly date: string;
  readonly status: WorkerStatus;
  readonly shift: Shift | null;
  readonly hasException: boolean;
  readonly sleepWindow: SleepWindow | null;
}

/**
 * Heuristique de sommeil tant que FR-6 n'est pas configurable (Sprint 6) : après une
 * nuit 19 h → 7 h, repos par défaut de 8 h à 16 h le lendemain. `sleep_defaults` prime.
 */
export const DEFAULT_SLEEP_WINDOW: SleepWindow = { start: "08:00", end: "16:00" };

// WHY: quand un écart « présent » ne précise pas le quart, on retombe sur le quart
// d'identité de l'équipe (A,B = jour · C,D = nuit — 02-cas-utilisation.md:56). Le moteur
// garde cette identité interne (TEAM_IDENTITY, non exportée) ; on ne la lui fait pas
// porter ici pour ne pas le modifier (règle moteur-pitman.md). Exportée pour l'UI
// (indice jour/nuit du sélecteur d'équipe).
export const IDENTITY_SHIFT: Record<Team, Shift> = { A: "jour", B: "jour", C: "nuit", D: "nuit" };

type EffectiveDay =
  | { readonly working: true; readonly shift: Shift; readonly hasException: boolean }
  | { readonly working: false; readonly shift: null; readonly hasException: boolean };

/** L'écart, s'il existe, remplace le moteur pour la journée. */
function effectiveDay(
  team: Team,
  engineDay: DaySchedule,
  exception: ScheduleException | undefined,
): EffectiveDay {
  if (exception === undefined) {
    return engineDay.working && engineDay.shift !== null
      ? { working: true, shift: engineDay.shift, hasException: false }
      : { working: false, shift: null, hasException: false };
  }
  if (exception.effect === "off") {
    return { working: false, shift: null, hasException: true };
  }
  return {
    working: true,
    shift: exception.shift ?? engineDay.shift ?? IDENTITY_SHIFT[team],
    hasException: true,
  };
}

/**
 * Vue « coup d'œil » d'une équipe pour [from, to] inclus : moteur + écarts + sommeil.
 * Le sommeil suit la règle « lendemain d'une nuit travaillée » : un jour sans travail
 * qui suit une nuit (de base ou par écart) est SOMMEIL, pas CONGÉ. Si from > to,
 * retourne un tableau vide (même contrat que scheduleRange).
 */
export function overviewRange(params: {
  readonly team: Team;
  readonly from: string;
  readonly to: string;
  readonly template: CycleTemplate;
  readonly exceptions: readonly ScheduleException[];
  readonly sleepDefault: SleepWindow | null;
}): DayOverview[] {
  const { team, from, to, template, exceptions, sleepDefault } = params;
  const byDate = new Map(exceptions.map((e) => [e.onDate, e]));

  // Un jour de plus en amont : le statut SOMMEIL d'un jour dépend de la nuit de la veille.
  const engineDays = scheduleRange(team, addDays(from, -1), to, template);
  const out: DayOverview[] = [];
  let previous: EffectiveDay | null = null;
  for (const engineDay of engineDays) {
    const day = effectiveDay(team, engineDay, byDate.get(engineDay.date));
    if (engineDay.date >= from) {
      const sleeps = !day.working && previous?.working === true && previous.shift === "nuit";
      out.push({
        date: engineDay.date,
        status: day.working ? day.shift : sleeps ? "sommeil" : "conge",
        shift: day.shift,
        hasException: day.hasException,
        sleepWindow: sleeps ? (sleepDefault ?? DEFAULT_SLEEP_WINDOW) : null,
      });
    }
    previous = day;
  }
  return out;
}

/** Projection conjointe : travaille / disponible / sommeil — rien d'autre ne transite (R7). */
export function spouseStatus(status: WorkerStatus): SpouseStatus {
  if (status === "conge") {
    return "disponible";
  }
  if (status === "sommeil") {
    return "sommeil";
  }
  return "travaille";
}
