import {
  type GroceryItem,
  type GroceryList,
  compteRestant,
  grouperListes,
} from "@/lib/epicerie/types";
import { describe, expect, it } from "vitest";

// Helpers PURS de la liste d'épicerie (Sprint 25) : regroupement listes↔éléments et compte
// restant. Un test = un comportement, nommé en français (règle tests-vitest.md).

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

function liste(partiel: Partial<GroceryList>): GroceryList {
  return {
    id: "d0000000-0000-4000-8000-000000000001",
    authorId: MOI,
    title: "Épicerie",
    createdAt: "2026-06-28T12:00:00Z",
    ...partiel,
  };
}

function item(partiel: Partial<GroceryItem>): GroceryItem {
  return {
    id: "e0000000-0000-4000-8000-000000000001",
    listId: "d0000000-0000-4000-8000-000000000001",
    authorId: MOI,
    label: "Lait",
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    createdAt: "2026-06-28T12:00:00Z",
    ...partiel,
  };
}

describe("grouperListes — regroupe listes et éléments", () => {
  it("une liste avec ses éléments forme un groupe", () => {
    const l = liste({ id: "d0000000-0000-4000-8000-000000000010" });
    const i = item({ id: "e0000000-0000-4000-8000-000000000010", listId: l.id });
    const groupes = grouperListes([l], [i]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.liste.id).toBe(l.id);
    expect(groupes[0]?.elements.map((e) => e.id)).toEqual([i.id]);
  });

  it("les listes sortent les plus récentes d'abord", () => {
    const ancienne = liste({
      id: "d0000000-0000-4000-8000-000000000001",
      createdAt: "2026-06-28T08:00:00Z",
    });
    const recente = liste({
      id: "d0000000-0000-4000-8000-000000000002",
      createdAt: "2026-06-28T10:00:00Z",
    });
    const groupes = grouperListes([ancienne, recente], []);
    expect(groupes.map((g) => g.liste.id)).toEqual([recente.id, ancienne.id]);
  });

  it("les éléments d'une liste se lisent dans l'ordre chronologique (plus anciens d'abord)", () => {
    const l = liste({ id: "d0000000-0000-4000-8000-000000000020" });
    const i2 = item({
      id: "e0000000-0000-4000-8000-000000000022",
      listId: l.id,
      createdAt: "2026-06-28T11:00:00Z",
    });
    const i1 = item({
      id: "e0000000-0000-4000-8000-000000000021",
      listId: l.id,
      createdAt: "2026-06-28T10:00:00Z",
    });
    const groupes = grouperListes([l], [i2, i1]);
    expect(groupes[0]?.elements.map((e) => e.id)).toEqual([i1.id, i2.id]);
  });

  it("un élément orphelin (sa liste absente) est écarté", () => {
    const orphelin = item({ listId: "d0000000-0000-4000-8000-999999999999" });
    expect(grouperListes([], [orphelin])).toHaveLength(0);
  });

  it("une liste vide forme un groupe sans élément", () => {
    const groupes = grouperListes([liste({})], []);
    expect(groupes).toHaveLength(1);
    expect(groupes[0]?.elements).toHaveLength(0);
  });
});

describe("compteRestant — éléments restant à acheter (non cochés)", () => {
  it("compte les éléments non cochés", () => {
    const elements = [
      item({ id: "e0000000-0000-4000-8000-000000000001", isChecked: false }),
      item({
        id: "e0000000-0000-4000-8000-000000000002",
        isChecked: true,
        checkedBy: AUTRE,
        checkedAt: "2026-06-28T13:00:00Z",
      }),
      item({ id: "e0000000-0000-4000-8000-000000000003", isChecked: false }),
    ];
    expect(compteRestant(elements)).toBe(2);
  });

  it("une liste toute cochée n'a plus rien à acheter (0)", () => {
    const elements = [
      item({
        id: "e0000000-0000-4000-8000-000000000001",
        isChecked: true,
        checkedBy: MOI,
        checkedAt: "2026-06-28T13:00:00Z",
      }),
    ];
    expect(compteRestant(elements)).toBe(0);
  });

  it("une liste vide n'a rien à acheter (0)", () => {
    expect(compteRestant([])).toBe(0);
  });
});
