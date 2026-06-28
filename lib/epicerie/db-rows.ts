import type { GroceryItem, GroceryList } from "@/lib/epicerie/types";
import { z } from "zod";

// Frontière BD → métier pour la liste d'épicerie (Sprint 25). Comme lib/frigo/db-rows.ts :
// les lignes Supabase arrivent typées `string`/`null` ; on les resserre une seule fois,
// ici, avant qu'elles n'entrent dans la logique pure ou la vue. Le débounce de push
// (grocery_lists.last_check_notified_at) n'est JAMAIS sélectionné côté client : interne au RPC.

/** Colonnes d'une liste, alignées 1:1 sur `groceryListRowSchema` (frontière unique) :
 * un seul endroit à toucher quand une colonne s'ajoute, jamais de SELECT désynchronisé. */
export const GROCERY_LIST_COLUMNS = "id, author_id, title, created_at";

/** Colonnes d'un élément, alignées 1:1 sur `groceryItemRowSchema`. */
export const GROCERY_ITEM_COLUMNS =
  "id, list_id, author_id, label, is_checked, checked_by, checked_at, created_at";

const groceryListRowSchema = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  title: z.string(),
  created_at: z.string(),
});

const groceryItemRowSchema = z.object({
  id: z.uuid(),
  list_id: z.uuid(),
  author_id: z.uuid(),
  label: z.string(),
  is_checked: z.boolean(),
  checked_by: z.uuid().nullable(),
  checked_at: z.string().nullable(),
  created_at: z.string(),
});

/** Lignes `grocery_lists` → listes consommables par la vue (partagées dans le foyer). */
export function parseGroceryListRows(rows: readonly unknown[]): GroceryList[] {
  return rows.map((row) => {
    const parsed = groceryListRowSchema.parse(row);
    return {
      id: parsed.id,
      authorId: parsed.author_id,
      title: parsed.title,
      createdAt: parsed.created_at,
    };
  });
}

/** Lignes `grocery_items` → éléments consommables par la vue. */
export function parseGroceryItemRows(rows: readonly unknown[]): GroceryItem[] {
  return rows.map((row) => {
    const parsed = groceryItemRowSchema.parse(row);
    return {
      id: parsed.id,
      listId: parsed.list_id,
      authorId: parsed.author_id,
      label: parsed.label,
      isChecked: parsed.is_checked,
      checkedBy: parsed.checked_by,
      checkedAt: parsed.checked_at,
      createdAt: parsed.created_at,
    };
  });
}
