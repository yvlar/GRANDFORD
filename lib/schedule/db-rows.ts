import { type OwnException, TUILES } from "@/lib/schedule/capture";
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

// Lignes du TRAVAILLEUR uniquement (Sprint 5) : id (pour supprimer) + motif privé
// (badge/détail). Jamais parsées dans la branche conjointe — et la RLS lui rendrait
// 0 ligne de exception_private de toute façon (R7, double barrière).
const ownExceptionRowSchema = exceptionRowSchema.extend({ id: z.uuid() });
const motifRowSchema = z.object({ exception_id: z.uuid(), motif: z.enum(TUILES) });

/**
 * Lignes `exceptions` du travailleur + ses lignes `exception_private` → écarts
 * enrichis de leur motif (jointure par exception_id, faite ici plutôt qu'en SQL :
 * deux requêtes simples valent mieux qu'un embed ambigu sur FK composites).
 */
export function parseOwnExceptionRows(
  rows: readonly unknown[],
  motifRows: readonly unknown[],
): OwnException[] {
  const motifById = new Map(
    motifRows.map((row) => {
      const parsed = motifRowSchema.parse(row);
      return [parsed.exception_id, parsed.motif] as const;
    }),
  );
  return rows.map((row) => {
    const parsed = ownExceptionRowSchema.parse(row);
    return {
      id: parsed.id,
      onDate: parsed.on_date,
      effect: parsed.effect,
      shift: parsed.shift,
      motif: motifById.get(parsed.id) ?? null,
    };
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
