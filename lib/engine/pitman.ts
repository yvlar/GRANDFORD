import { civilToDays, daysToCivil, formatCivilDate, mathMod, parseCivilDate } from "./civil-date";
import type {
  ActiveCrews,
  CycleTemplate,
  DaySchedule,
  Shift,
  ShiftResult,
  SuperCrew,
  Team,
} from "./types";

// Identité fixe de chaque équipe : super-quart d'appartenance + quart. SEULE source de
// vérité de la correspondance équipe ↔ super-quart ↔ quart.
// docs/analyse/01-decouverte/02-cas-utilisation.md:56,64.
const TEAM_IDENTITY: Record<Team, { readonly superCrew: SuperCrew; readonly shift: Shift }> = {
  A: { superCrew: "AC", shift: "jour" },
  B: { superCrew: "BD", shift: "jour" },
  C: { superCrew: "AC", shift: "nuit" },
  D: { superCrew: "BD", shift: "nuit" },
};

const ALL_TEAMS: readonly Team[] = ["A", "B", "C", "D"];

/** L'équipe d'un super-quart à un quart donné (inverse de TEAM_IDENTITY, source unique). */
function teamFor(crew: SuperCrew, shift: Shift): Team {
  const team = ALL_TEAMS.find(
    (t) => TEAM_IDENTITY[t].superCrew === crew && TEAM_IDENTITY[t].shift === shift,
  );
  if (team === undefined) {
    throw new RangeError(`Aucune équipe pour le super-quart ${crew} en ${shift}.`);
  }
  return team;
}

/** Longueur du pattern, en garantissant qu'il n'est pas vide (frontière multi-usines, FR-17). */
function patternLengthOrThrow(template: CycleTemplate): number {
  const length = template.pattern.length;
  if (length === 0) {
    throw new RangeError("cycleTemplate.pattern ne peut pas être vide.");
  }
  return length;
}

/** Super-quart actif pour un index déjà réduit dans [0, pattern.length). */
function activeCrewAtIndex(index: number, template: CycleTemplate): SuperCrew {
  const acWorks = template.pattern[index];
  if (acWorks === undefined) {
    // Invariant interne : index toujours réduit par mathMod sur un pattern non vide.
    throw new RangeError(`cycleTemplate.pattern : index ${index} hors limites.`);
  }
  return acWorks ? "AC" : "BD";
}

/** Horaire d'une équipe à partir du super-quart actif (sans recalcul de date). */
function shiftResultForCrew(team: Team, activeCrew: SuperCrew): ShiftResult {
  const identity = TEAM_IDENTITY[team];
  const working = identity.superCrew === activeCrew;
  return {
    working,
    shift: working ? identity.shift : null,
    superCrew: identity.superCrew,
  };
}

/** Super-quart complémentaire (l'autre des deux). */
export function otherSuperCrew(crew: SuperCrew): SuperCrew {
  return crew === "AC" ? "BD" : "AC";
}

/** Index [0, pattern.length) dans le pattern (mod mathématique depuis l'ancre). */
export function cycleIndex(date: string, template: CycleTemplate): number {
  const length = patternLengthOrThrow(template);
  const delta =
    civilToDays(parseCivilDate(date)) - civilToDays(parseCivilDate(template.anchorDate));
  return mathMod(delta, length);
}

/** Super-quart qui TRAVAILLE à une date donnée (l'autre est au repos). */
export function activeSuperCrew(date: string, template: CycleTemplate): SuperCrew {
  return activeCrewAtIndex(cycleIndex(date, template), template);
}

/**
 * Vue « qui travaille » à une date : équipe de jour, de nuit, super-quart au repos.
 * Source unique de la correspondance super-quart → équipes (via TEAM_IDENTITY).
 */
export function crewsForDate(date: string, template: CycleTemplate): ActiveCrews {
  const activeCrew = activeSuperCrew(date, template);
  return {
    activeCrew,
    restCrew: otherSuperCrew(activeCrew),
    dayTeam: teamFor(activeCrew, "jour"),
    nightTeam: teamFor(activeCrew, "nuit"),
  };
}

/**
 * Horaire d'une équipe à une date donnée. Fonction PURE : la date est un paramètre,
 * aucune I/O, aucune horloge. Spécification : architecture.md:101.
 */
export function shiftForDate(team: Team, date: string, template: CycleTemplate): ShiftResult {
  return shiftResultForCrew(team, activeSuperCrew(date, template));
}

/**
 * Génère l'horaire d'une équipe pour chaque jour de [from, to] inclus.
 * Aucune date n'est stockée : tout est recalculé à la volée (architecture.md:105).
 * L'ancre n'est résolue qu'une fois et l'index vient du numéro de jour (pas d'aller-retour
 * chaîne ↔ date). Si from > to, retourne un tableau vide.
 */
export function scheduleRange(
  team: Team,
  from: string,
  to: string,
  template: CycleTemplate,
): DaySchedule[] {
  const patternLength = patternLengthOrThrow(template);
  const anchorDays = civilToDays(parseCivilDate(template.anchorDate));
  const start = civilToDays(parseCivilDate(from));
  const end = civilToDays(parseCivilDate(to));
  const out: DaySchedule[] = [];
  for (let z = start; z <= end; z += 1) {
    const activeCrew = activeCrewAtIndex(mathMod(z - anchorDays, patternLength), template);
    const date = formatCivilDate(daysToCivil(z));
    out.push({ date, ...shiftResultForCrew(team, activeCrew) });
  }
  return out;
}
