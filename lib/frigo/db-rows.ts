import type { FrigoNote } from "@/lib/frigo/types";
import { z } from "zod";

// Frontière BD → métier pour la note du frigo (Sprint 20). Comme lib/schedule/db-rows.ts :
// les lignes Supabase arrivent typées `string`/`null` ; on les resserre une seule fois,
// ici, avant qu'elles n'entrent dans la logique pure ou la vue.

/** Colonnes d'une note complète, alignées 1:1 sur `fridgeNoteRowSchema` (frontière unique) :
 * un seul endroit à toucher quand une colonne s'ajoute, jamais de SELECT désynchronisé. */
export const FRIGO_NOTE_COLUMNS =
  "id, author_id, body, read_at, read_by, created_at, updated_at, parent_id";

const fridgeNoteRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  read_at: z.string().nullable(),
  read_by: z.uuid().nullable(),
  parent_id: z.uuid().nullable(),
});

/** Lignes `fridge_notes` → notes consommables par la vue (partagées dans le foyer). */
export function parseFrigoRows(rows: readonly unknown[]): FrigoNote[] {
  return rows.map((row) => {
    const parsed = fridgeNoteRowSchema.parse(row);
    return {
      id: parsed.id,
      authorId: parsed.author_id,
      body: parsed.body,
      createdAt: parsed.created_at,
      updatedAt: parsed.updated_at,
      readAt: parsed.read_at,
      readBy: parsed.read_by,
      parentId: parsed.parent_id,
    };
  });
}
