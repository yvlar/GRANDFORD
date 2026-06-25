import { type OwnException, TUILES } from "@/lib/schedule/capture";
import type { Note, Requete, StatusRequete } from "@/lib/schedule/coplanification";
import { type ReglagePaye, frequencePayeSchema } from "@/lib/schedule/payday";
import type { ScheduleException, SleepAdjustment, SleepWindow } from "@/lib/schedule/types";
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

// Jour de paye (Sprint 17) : config worker-private. Parsée dans la SEULE branche
// travailleur — la conjointe ne reçoit jamais cette ligne (RLS owner-only + câblage, R7).
const paydayRowSchema = z.object({ anchor_date: z.string(), frequence: frequencePayeSchema });

/** Ligne `payday_settings` → réglage de paye, ou null si le travailleur n'en a pas. */
export function parsePaydayRow(row: unknown): ReglagePaye | null {
  if (row === null || row === undefined) {
    return null;
  }
  const parsed = paydayRowSchema.parse(row);
  return { anchorDate: parsed.anchor_date, frequence: parsed.frequence };
}

const sleepAdjustmentRowSchema = sleepRowSchema.extend({ on_date: z.string() });

/** Lignes `sleep_adjustments` → ajustements par date (FR-6, Sprint 6). */
export function parseSleepAdjustmentRows(rows: readonly unknown[]): SleepAdjustment[] {
  return rows.map((row) => {
    const parsed = sleepAdjustmentRowSchema.parse(row);
    return {
      onDate: parsed.on_date,
      window: { start: parsed.start_time, end: parsed.end_time },
    };
  });
}

// ── Co-planification (FR-8 notes, FR-9 requêtes, Sprint 9) ──────────────────

const noteRowSchema = z.object({
  id: z.uuid(),
  on_date: z.string(),
  body: z.string(),
  author_id: z.uuid(),
});

/** Lignes `notes` → notes consommables par la vue (partagées dans le foyer). */
export function parseNoteRows(rows: readonly unknown[]): Note[] {
  return rows.map((row) => {
    const parsed = noteRowSchema.parse(row);
    return { id: parsed.id, onDate: parsed.on_date, body: parsed.body, authorId: parsed.author_id };
  });
}

const requeteRowSchema = z.object({
  id: z.uuid(),
  on_date: z.string(),
  body: z.string(),
  status: z.enum(["pending", "approved", "declined"]),
  requester_id: z.uuid(),
  target_profile_id: z.uuid(),
});

/** Lignes `requests` → requêtes consommables par la vue. */
export function parseRequeteRows(rows: readonly unknown[]): Requete[] {
  return rows.map((row) => {
    const parsed = requeteRowSchema.parse(row);
    return {
      id: parsed.id,
      onDate: parsed.on_date,
      body: parsed.body,
      status: parsed.status as StatusRequete,
      requesterId: parsed.requester_id,
      targetProfileId: parsed.target_profile_id,
    };
  });
}

// ── Journal des changements (FR-13, Sprint 12) ───────────────────────────────

// metadata : seul on_date est affiché ; effect/shift stockés pour traçabilité
// interne (R7 — jamais retournés vers le client dans ce type).
const auditRowSchema = z.object({
  id: z.number(),
  action: z.string(),
  metadata: z.object({ on_date: z.string().optional() }).passthrough(),
});

export type AuditEntry = { id: number; action: string; onDate: string | null };

/**
 * Lignes `audit_log` → entrées consommables par la vue historique du foyer.
 * safeParse : une ligne malformée est ignorée (affichage non-critique, R7).
 */
export function parseAuditRows(rows: readonly unknown[]): AuditEntry[] {
  return rows.flatMap((row) => {
    const parsed = auditRowSchema.safeParse(row);
    if (!parsed.success) return [];
    return [
      {
        id: parsed.data.id,
        action: parsed.data.action,
        onDate: parsed.data.metadata.on_date ?? null,
      },
    ];
  });
}
