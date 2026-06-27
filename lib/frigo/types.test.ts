import { type FrigoNote, estEditee, estNouvellePourMoi, statutLecture } from "@/lib/frigo/types";
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
