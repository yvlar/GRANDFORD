import { civilToDays, daysToCivil, formatCivilDate, parseCivilDate } from "@/lib/engine";
import type { ReminderLead } from "@/lib/notifications/payload";

// Calcul PUR des échéances de rappel (FR-10) : quelles lignes `reminders` une
// capture d'écart doit matérialiser. La vérité d'exécution vit dans la RPC
// `create_exception_with_motif` (migration sprint07) — ce module en est le MIROIR
// testable, et la parité SQL ↔ TS est vérifiée par supabase/tests/reminders.test.ts.
//
// WHY des offsets fixes en JOURS (30/7/1) et jamais `interval '1 month'` : un mois
// civil est ambigu (28-31 j) et TS et SQL pourraient diverger silencieusement.
// Des jours fixes donnent une seule arithmétique, identique des deux côtés.
//
// L'heure d'envoi (09:00 America/Toronto) est un détail de planification qui vit
// dans la RPC seulement : ici on raisonne en dates civiles, comme le moteur.

/** Les 3 échéances, de la plus lointaine à la plus proche de l'écart. */
export const REMINDER_LEADS: readonly { lead: ReminderLead; offsetDays: number }[] = [
  { lead: "month", offsetDays: 30 },
  { lead: "week", offsetDays: 7 },
  { lead: "day", offsetDays: 1 },
];

/** Une échéance à matérialiser : son horizon et sa date civile d'envoi. */
export interface ReminderDue {
  readonly lead: ReminderLead;
  readonly date: string;
}

/**
 * Échéances à créer pour un écart au jour `onDate`, saisi le jour `today`
 * (dates civiles America/Toronto). Règle de la carte de sprint : une échéance
 * n'existe que si elle est antérieure à l'écart (par construction des offsets)
 * ET strictement future au moment de la saisie — un rappel le jour même de la
 * capture ne rappelle rien (on vient de la saisir).
 */
export function reminderSchedule(onDate: string, today: string): readonly ReminderDue[] {
  const onDays = civilToDays(parseCivilDate(onDate));
  const todayDays = civilToDays(parseCivilDate(today));
  return REMINDER_LEADS.filter(({ offsetDays }) => onDays - offsetDays > todayDays).map(
    ({ lead, offsetDays }) => ({ lead, date: formatCivilDate(daysToCivil(onDays - offsetDays)) }),
  );
}
