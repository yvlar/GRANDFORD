import type { ScheduleException, SleepWindow } from "@/lib/schedule/types";
import { z } from "zod";

// Validation aux frontières (règle conventions-code-base.md) : les lignes Supabase
// arrivent typées `string` (types générés) ; on les resserre en types métier ici,
// une seule fois, avant qu'elles n'entrent dans la logique pure.

// R7 : ce schéma EST la liste blanche de ce qui peut transiter vers le client —
// aucune colonne de motif n'y figure, un champ excédentaire serait simplement ignoré.
const exceptionRowSchema = z.object({
  on_date: z.string(),
  effect: z.enum(["off", "working", "working_extra", "shift_swap"]),
  shift: z.enum(["jour", "nuit"]).nullable(),
});

// Postgres renvoie les `time` en 'HH:MM:SS' — on tronque pour l'affichage 'HH:MM'.
const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/)
  .transform((t) => t.slice(0, 5));

const sleepRowSchema = z.object({
  start_time: timeSchema,
  end_time: timeSchema,
});

/** Lignes `exceptions` (colonnes partageables) → écarts consommables par la vue. */
export function parseExceptionRows(rows: readonly unknown[]): ScheduleException[] {
  return rows.map((row) => {
    const parsed = exceptionRowSchema.parse(row);
    return { onDate: parsed.on_date, effect: parsed.effect, shift: parsed.shift };
  });
}

/** Ligne `sleep_defaults` → fenêtre de sommeil, ou null si non configurée. */
export function parseSleepRow(row: unknown): SleepWindow | null {
  if (row === null || row === undefined) {
    return null;
  }
  const parsed = sleepRowSchema.parse(row);
  return { start: parsed.start_time, end: parsed.end_time };
}
