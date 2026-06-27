import { parseFrigoRows } from "@/lib/frigo/db-rows";
import { describe, expect, it } from "vitest";

// Frontière BD → métier (Zod). On vérifie surtout le mapping snake_case → camelCase, en
// particulier updated_at → updatedAt ajouté au Sprint 22 (porte l'indicateur « Édité »).

const LIGNE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  author_id: "11111111-1111-4111-8111-111111111111",
  body: "Acheter du lait",
  created_at: "2026-06-26T12:00:00Z",
  updated_at: "2026-06-26T12:05:00Z",
  read_at: null,
  read_by: null,
  parent_id: null,
};

describe("parseFrigoRows — frontière BD de la note du frigo", () => {
  it("mappe updated_at → updatedAt (Sprint 22)", () => {
    const [note] = parseFrigoRows([LIGNE]);
    expect(note?.updatedAt).toBe("2026-06-26T12:05:00Z");
    expect(note?.createdAt).toBe("2026-06-26T12:00:00Z");
  });

  it("rejette une ligne sans updated_at (colonne désormais requise)", () => {
    const { updated_at: _omis, ...sansUpdatedAt } = LIGNE;
    expect(() => parseFrigoRows([sansUpdatedAt])).toThrow();
  });

  it("mappe parent_id → parentId, null sur une note de tête (Sprint 23)", () => {
    const [note] = parseFrigoRows([LIGNE]);
    expect(note?.parentId).toBeNull();
  });

  it("mappe parent_id → parentId d'une réponse (Sprint 23)", () => {
    const parentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const [note] = parseFrigoRows([{ ...LIGNE, parent_id: parentId }]);
    expect(note?.parentId).toBe(parentId);
  });

  it("rejette une ligne sans parent_id (colonne désormais requise)", () => {
    const { parent_id: _omis, ...sansParentId } = LIGNE;
    expect(() => parseFrigoRows([sansParentId])).toThrow();
  });
});
