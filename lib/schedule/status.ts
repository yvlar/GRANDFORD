import {
  type CycleTemplate,
  type Shift,
  type Team,
  civilToDays,
  daysToCivil,
  formatCivilDate,
  parseCivilDate,
  scheduleRange,
  weekdayIndex,
} from "@/lib/engine";
import { identityShift } from "@/lib/schedule/capture";
import type {
  Availability,
  DayStatus,
  MonthGrid,
  ScheduleException,
  SleepAdjustment,
  SleepWindow,
} from "@/lib/schedule/types";

// Superposition des écarts sur l'horaire calculé (FR-2/FR-3). Fonctions PURES :
// la date est un paramètre, aucune I/O — testées avant d'être consommées par l'UI
// (règle tests-vitest.md) et exécutables hors-ligne côté client (NFR-4).

/** Date civile décalée de `n` jours (réutilise l'arithmétique du moteur). */
export function addDays(date: string, n: number): string {
  return formatCivilDate(daysToCivil(civilToDays(parseCivilDate(date)) + n));
}

/**
 * Fenêtre de sommeil par défaut, dérivée du gabarit : 8 h de récupération à partir
 * de la FIN du quart de nuit. Heuristique assumée du Sprint 4 — supplantée par la
 * fenêtre configurée (`sleep_defaults`), elle-même supplantée par l'ajustement du
 * jour (`sleep_adjustments`) — FR-6, Sprint 6.
 */
export function defaultSleepWindow(template: CycleTemplate): SleepWindow {
  const start = template.nightHours.end;
  const hours = Number(start.slice(0, 2));
  const end = `${String((hours + 8) % 24).padStart(2, "0")}${start.slice(2)}`;
  return { start, end };
}

/** Quart effectif d'un jour : écart persisté par-dessus le calcul du moteur. */
function resolveShift(
  engineShift: Shift | null,
  exception: ScheduleException | undefined,
  identityFallback: Shift,
): { shift: Shift | null; fromException: boolean } {
  if (exception === undefined) {
    return { shift: engineShift, fromException: false };
  }
  if (exception.effect === "off") {
    return { shift: null, fromException: true };
  }
  // Présence (working / working_extra / shift_swap) : le quart de l'écart prime ;
  // sans quart explicite, on retombe sur le quart calculé, puis sur le quart
  // d'identité de l'équipe. WHY: la sémantique fine (échange, OT) arrive avec la
  // capture (FR-4, Sprint 5) — ici on garantit seulement un affichage cohérent.
  return { shift: exception.shift ?? engineShift ?? identityFallback, fromException: true };
}

/**
 * États affichables de chaque jour de [from, to] : moteur + écarts + sommeil.
 * Règle sommeil (heuristique documentée) : un jour SANS quart qui suit un quart de
 * NUIT est une journée de récupération (« sommeil ») — fenêtre ajustée pour CE jour
 * (FR-6) si elle existe, sinon `sleepDefault` si configurée, sinon celle dérivée
 * du gabarit. Un ajustement sur un jour sans sommeil est ignoré (rien à ajuster).
 *
 * `sleepEnabled` (FR-6, Sprint 19) : interrupteur de la fonction. Désactivé, aucun
 * jour n'est marqué « sommeil » — la récupération redevient un simple congé (et,
 * côté conjointe, « disponible »). Défaut `true` : comportement historique inchangé.
 */
export function dayStatuses(
  team: Team,
  from: string,
  to: string,
  template: CycleTemplate,
  exceptions: readonly ScheduleException[],
  sleepDefault: SleepWindow | null,
  sleepAdjustments: readonly SleepAdjustment[] = [],
  sleepEnabled = true,
): DayStatus[] {
  const byDate = new Map(exceptions.map((e) => [e.onDate, e]));
  const adjustmentByDate = new Map(sleepAdjustments.map((a) => [a.onDate, a.window]));
  // Un jour de plus en amont : le statut « sommeil » dépend du quart de la VEILLE.
  const days = scheduleRange(team, addDays(from, -1), to, template);
  const window = sleepDefault ?? defaultSleepWindow(template);
  // Quart d'identité de l'équipe : nécessaire car le moteur n'expose le quart que
  // les jours travaillés.
  const identityFallback = identityShift(team);

  const out: DayStatus[] = [];
  let previousShift: Shift | null = null;
  let previousAltered = false; // l'écart de la veille a-t-il changé « nuit ou pas » ?
  for (const [i, day] of days.entries()) {
    const exc = byDate.get(day.date);
    const { shift, fromException } = resolveShift(day.shift, exc, identityFallback);
    if (i > 0) {
      const sleeping = sleepEnabled && shift === null && previousShift === "nuit";
      out.push({
        date: day.date,
        kind: shift ?? (sleeping ? "sommeil" : "conge"),
        // Un jour sans quart doit AUSSI porter le marqueur d'écart quand son état
        // (sommeil ↔ congé) découle d'un écart de la veille — sinon la conjointe
        // verrait un changement sans son indicateur (R1 : jamais taire un écart).
        fromException: fromException || (shift === null && previousAltered),
        // Temps supplémentaire : la présence vient d'un écart `working_extra`. Effet
        // partageable, jamais le motif (R7) — dérivé de `effect`, pas d'exception_private.
        overtime: exc?.effect === "working_extra",
        sleep: sleeping ? (adjustmentByDate.get(day.date) ?? window) : null,
      });
    }
    previousAltered = fromException && (shift === "nuit") !== (day.shift === "nuit");
    previousShift = shift;
  }
  return out;
}

/** État d'UN jour (la pastille « Aujourd'hui »). */
export function statusForDate(
  team: Team,
  date: string,
  template: CycleTemplate,
  exceptions: readonly ScheduleException[],
  sleepDefault: SleepWindow | null,
  sleepAdjustments: readonly SleepAdjustment[] = [],
  sleepEnabled = true,
): DayStatus {
  const statuses = dayStatuses(
    team,
    date,
    date,
    template,
    exceptions,
    sleepDefault,
    sleepAdjustments,
    sleepEnabled,
  );
  const status = statuses[0];
  if (status === undefined) {
    // Invariant : dayStatuses(d, d) produit exactement un élément.
    throw new RangeError(`Aucun statut produit pour ${date}.`);
  }
  return status;
}

/**
 * Sémantique de la vue conjointe (FR-3) : on traduit l'état du travailleur en
 * DISPONIBILITÉ. Aucune autre donnée ne passe — le motif n'existe même pas dans
 * les types de cette couche (R7).
 */
export function availabilityFor(status: DayStatus): Availability {
  switch (status.kind) {
    case "jour":
    case "nuit":
      return "travaille";
    case "sommeil":
      return "sommeil";
    case "conge":
      return "disponible";
  }
}

/** Grille du mois civil contenant `date`, alignée sur dimanche (colonne 0). */
export function monthGrid(
  team: Team,
  date: string,
  template: CycleTemplate,
  exceptions: readonly ScheduleException[],
  sleepDefault: SleepWindow | null,
  sleepAdjustments: readonly SleepAdjustment[] = [],
  sleepEnabled = true,
): MonthGrid {
  const { year, month } = parseCivilDate(date);
  const first = formatCivilDate({ year, month, day: 1 });
  const lastOfMonth = addDays(shiftMonth(date, 1), -1);
  return {
    year,
    month,
    leadingBlanks: weekdayIndex(parseCivilDate(first)),
    days: dayStatuses(
      team,
      first,
      lastOfMonth,
      template,
      exceptions,
      sleepDefault,
      sleepAdjustments,
      sleepEnabled,
    ),
  };
}

/** Premier jour du mois suivant/précédent (navigation de la grille, hors-ligne). */
export function shiftMonth(date: string, delta: 1 | -1): string {
  const { year, month } = parseCivilDate(date);
  const next = month + delta;
  if (next === 0) {
    return formatCivilDate({ year: year - 1, month: 12, day: 1 });
  }
  if (next === 13) {
    return formatCivilDate({ year: year + 1, month: 1, day: 1 });
  }
  return formatCivilDate({ year, month: next, day: 1 });
}
