import {
  type FrigoNote,
  estEditee,
  estNouvellePourMoi,
  grouperEnFils,
  statutLecture,
} from "@/lib/frigo/types";
import { describe, expect, it } from "vitest";

// Helpers PURS de la note du frigo (Sprint 20) : statut d'accusé et « nouvelle pour moi ».
// Un test = un comportement, nommé en français (règle tests-vitest.md).

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

function note(partiel: Partial<FrigoNote>): FrigoNote {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    authorId: MOI,
    body: "Acheter du lait",
    createdAt: "2026-06-26T12:00:00Z",
    updatedAt: "2026-06-26T12:00:00Z", // défaut : jamais éditée (== createdAt)
    readAt: null,
    readBy: null,
    parentId: null, // défaut : note de tête
    isPinned: false, // défaut : non épinglée
    ...partiel,
  };
}

describe("statutLecture — l'accusé n'a de sens que sur MES notes", () => {
  it("ma note non encore lue par l'autre est « non-lu »", () => {
    expect(statutLecture(note({ authorId: MOI, readAt: null }), MOI)).toBe("non-lu");
  });

  it("ma note lue par l'autre est « lu »", () => {
    expect(
      statutLecture(note({ authorId: MOI, readAt: "2026-06-26T13:00:00Z", readBy: AUTRE }), MOI),
    ).toBe("lu");
  });

  it("la note de l'autre ne me montre aucun accusé (« non-applicable »)", () => {
    expect(statutLecture(note({ authorId: AUTRE }), MOI)).toBe("non-applicable");
  });

  it("une réponse à moi n'a pas d'accusé (D1, Sprint 23) → « non-applicable »", () => {
    expect(statutLecture(note({ authorId: MOI, parentId: "p", readAt: null }), MOI)).toBe(
      "non-applicable",
    );
  });
});

describe("estNouvellePourMoi — note de l'autre que je n'ai pas lue", () => {
  it("la note de l'autre, non lue, est nouvelle pour moi", () => {
    expect(estNouvellePourMoi(note({ authorId: AUTRE, readAt: null }), MOI)).toBe(true);
  });

  it("la note de l'autre déjà lue n'est plus nouvelle", () => {
    expect(
      estNouvellePourMoi(
        note({ authorId: AUTRE, readAt: "2026-06-26T13:00:00Z", readBy: MOI }),
        MOI,
      ),
    ).toBe(false);
  });

  it("ma propre note n'est jamais « nouvelle pour moi »", () => {
    expect(estNouvellePourMoi(note({ authorId: MOI, readAt: null }), MOI)).toBe(false);
  });

  it("une réponse de l'autre n'est jamais « nouvelle » (D1, pas d'auto-accusé sur réponse)", () => {
    expect(estNouvellePourMoi(note({ authorId: AUTRE, parentId: "p", readAt: null }), MOI)).toBe(
      false,
    );
  });
});

describe("estEditee — le corps a-t-il été modifié après création ?", () => {
  it("une note jamais éditée (updatedAt == createdAt) n'est pas éditée", () => {
    expect(
      estEditee(note({ createdAt: "2026-06-26T12:00:00Z", updatedAt: "2026-06-26T12:00:00Z" })),
    ).toBe(false);
  });

  it("une note dont le corps a été modifié (updatedAt > createdAt) est éditée", () => {
    expect(
      estEditee(note({ createdAt: "2026-06-26T12:00:00Z", updatedAt: "2026-06-26T12:05:00Z" })),
    ).toBe(true);
  });

  it("la comparaison se fait en temps (epoch), robuste aux offsets de fuseau équivalents", () => {
    // Même instant exprimé en UTC et en heure de l'Est (−04:00) → PAS une édition.
    expect(
      estEditee(
        note({ createdAt: "2026-06-26T12:00:00Z", updatedAt: "2026-06-26T08:00:00-04:00" }),
      ),
    ).toBe(false);
  });
});

describe("grouperEnFils — regroupe les notes plates en fils (Sprint 23)", () => {
  const tete = (id: string, createdAt: string) =>
    note({ id, createdAt, updatedAt: createdAt, parentId: null });
  const reponse = (id: string, parentId: string, createdAt: string) =>
    note({ id, createdAt, updatedAt: createdAt, parentId });

  it("une note de tête avec ses réponses forme un fil", () => {
    const p = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "2026-06-26T09:00:00Z");
    const r = reponse("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", p.id, "2026-06-26T09:30:00Z");
    const fils = grouperEnFils([p, r]);
    expect(fils).toHaveLength(1);
    expect(fils[0]?.parent.id).toBe(p.id);
    expect(fils[0]?.reponses.map((n) => n.id)).toEqual([r.id]);
  });

  it("les notes de tête sortent les plus récentes d'abord", () => {
    const ancienne = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "2026-06-26T08:00:00Z");
    const recente = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", "2026-06-26T10:00:00Z");
    const fils = grouperEnFils([ancienne, recente]);
    expect(fils.map((f) => f.parent.id)).toEqual([recente.id, ancienne.id]);
  });

  it("les réponses d'un fil se lisent dans l'ordre chronologique (plus anciennes d'abord)", () => {
    const p = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "2026-06-26T09:00:00Z");
    const r2 = reponse("aaaaaaaa-aaaa-4aaa-8aaa-000000000003", p.id, "2026-06-26T11:00:00Z");
    const r1 = reponse("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", p.id, "2026-06-26T10:00:00Z");
    const fils = grouperEnFils([p, r2, r1]);
    expect(fils[0]?.reponses.map((n) => n.id)).toEqual([r1.id, r2.id]);
  });

  it("une réponse orpheline (parent absent) est écartée", () => {
    const orpheline = reponse(
      "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
      "aaaaaaaa-aaaa-4aaa-8aaa-999999999999",
      "2026-06-26T09:30:00Z",
    );
    expect(grouperEnFils([orpheline])).toHaveLength(0);
  });

  it("une note épinglée passe avant une note de tête plus récente non épinglée (Sprint 24)", () => {
    const recente = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "2026-06-26T10:00:00Z");
    const epinglee = {
      ...tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", "2026-06-26T08:00:00Z"),
      isPinned: true,
    };
    const fils = grouperEnFils([recente, epinglee]);
    expect(fils.map((f) => f.parent.id)).toEqual([epinglee.id, recente.id]);
  });

  it("entre notes de même statut d'épingle, le tri reste récent-d'abord (Sprint 24)", () => {
    const ancienne = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000001", "2026-06-26T08:00:00Z");
    const recente = tete("aaaaaaaa-aaaa-4aaa-8aaa-000000000002", "2026-06-26T10:00:00Z");
    const fils = grouperEnFils([ancienne, recente]);
    expect(fils.map((f) => f.parent.id)).toEqual([recente.id, ancienne.id]);
  });
});
