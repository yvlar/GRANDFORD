import { parseGroceryItemRows, parseGroceryListRows } from "@/lib/epicerie/db-rows";
import { describe, expect, it } from "vitest";

// Frontière BD → métier (Zod). On vérifie le mapping snake_case → camelCase et le rejet
// des lignes mal formées (entrée externe : Realtime, jamais de confiance aveugle).

const LIGNE_LISTE = {
  id: "d0000000-0000-4000-8000-000000000001",
  author_id: "11111111-1111-4111-8111-111111111111",
  title: "Épicerie de la semaine",
  created_at: "2026-06-28T12:00:00Z",
};

const LIGNE_ITEM = {
  id: "e0000000-0000-4000-8000-000000000001",
  list_id: "d0000000-0000-4000-8000-000000000001",
  author_id: "11111111-1111-4111-8111-111111111111",
  label: "Lait",
  is_checked: false,
  checked_by: null,
  checked_at: null,
  created_at: "2026-06-28T12:00:00Z",
};

describe("parseGroceryListRows — frontière BD de la liste", () => {
  it("mappe author_id → authorId, created_at → createdAt", () => {
    const [liste] = parseGroceryListRows([LIGNE_LISTE]);
    expect(liste?.authorId).toBe("11111111-1111-4111-8111-111111111111");
    expect(liste?.title).toBe("Épicerie de la semaine");
    expect(liste?.createdAt).toBe("2026-06-28T12:00:00Z");
  });

  it("rejette une ligne sans title (colonne requise)", () => {
    const { title: _omis, ...sansTitle } = LIGNE_LISTE;
    expect(() => parseGroceryListRows([sansTitle])).toThrow();
  });
});

describe("parseGroceryItemRows — frontière BD de l'élément", () => {
  it("mappe is_checked → isChecked, list_id → listId, checked_* nuls par défaut", () => {
    const [item] = parseGroceryItemRows([LIGNE_ITEM]);
    expect(item?.listId).toBe("d0000000-0000-4000-8000-000000000001");
    expect(item?.label).toBe("Lait");
    expect(item?.isChecked).toBe(false);
    expect(item?.checkedBy).toBeNull();
    expect(item?.checkedAt).toBeNull();
  });

  it("mappe un élément coché (is_checked true + checked_by/checked_at)", () => {
    const [item] = parseGroceryItemRows([
      {
        ...LIGNE_ITEM,
        is_checked: true,
        checked_by: "22222222-2222-4222-8222-222222222222",
        checked_at: "2026-06-28T13:00:00Z",
      },
    ]);
    expect(item?.isChecked).toBe(true);
    expect(item?.checkedBy).toBe("22222222-2222-4222-8222-222222222222");
    expect(item?.checkedAt).toBe("2026-06-28T13:00:00Z");
  });

  it("rejette une ligne sans is_checked (colonne requise)", () => {
    const { is_checked: _omis, ...sansChecked } = LIGNE_ITEM;
    expect(() => parseGroceryItemRows([sansChecked])).toThrow();
  });

  it("ignore les colonnes superflues d'un payload Realtime (household_id, etc.)", () => {
    const [item] = parseGroceryItemRows([
      { ...LIGNE_ITEM, household_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);
    expect(item?.label).toBe("Lait");
  });
});
