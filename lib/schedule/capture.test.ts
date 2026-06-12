import { describe, expect, it } from "vitest";
import { TUILES, type Tuile, capturePlan, identityShift } from "./capture";

// Mapping tuile → (effect, shift, motif) — la sémantique tranchée au Sprint 5 :
//   OT       → working_extra sur le quart d'identité (FR-7 : ajout sur jour de repos) ;
//   absences → off, sans quart (contrainte BD : off ⇒ shift null) ;
//   échange  → shift_swap sur le quart OPPOSÉ à l'identité.
// Le motif est toujours la tuile elle-même : il ne voyage que vers exception_private.

describe("identityShift — identité fixe des équipes (A,B = jour · C,D = nuit)", () => {
  it("l'équipe A travaille de jour", () => {
    expect(identityShift("A")).toBe("jour");
  });
  it("l'équipe B travaille de jour", () => {
    expect(identityShift("B")).toBe("jour");
  });
  it("l'équipe C travaille de nuit", () => {
    expect(identityShift("C")).toBe("nuit");
  });
  it("l'équipe D travaille de nuit", () => {
    expect(identityShift("D")).toBe("nuit");
  });
});

describe("capturePlan — tuile OT (FR-7)", () => {
  it("l'OT est un working_extra sur le quart d'identité (équipe de jour)", () => {
    expect(capturePlan("ot", "A")).toEqual({
      effect: "working_extra",
      shift: "jour",
      motif: "ot",
    });
  });
  it("l'OT est un working_extra sur le quart d'identité (équipe de nuit)", () => {
    expect(capturePlan("ot", "D")).toEqual({
      effect: "working_extra",
      shift: "nuit",
      motif: "ot",
    });
  });
});

describe("capturePlan — tuiles d'absence", () => {
  const absences: Tuile[] = ["conge", "maladie", "formation", "vacances"];
  for (const tuile of absences) {
    it(`la tuile « ${tuile} » produit une absence sans quart (off ⇒ shift null)`, () => {
      expect(capturePlan(tuile, "A")).toEqual({ effect: "off", shift: null, motif: tuile });
    });
  }
});

describe("capturePlan — tuile échange", () => {
  it("l'échange bascule une équipe de jour vers la nuit", () => {
    expect(capturePlan("echange", "B")).toEqual({
      effect: "shift_swap",
      shift: "nuit",
      motif: "echange",
    });
  });
  it("l'échange bascule une équipe de nuit vers le jour", () => {
    expect(capturePlan("echange", "C")).toEqual({
      effect: "shift_swap",
      shift: "jour",
      motif: "echange",
    });
  });
});

describe("capturePlan — propriétés transverses", () => {
  it("le motif est TOUJOURS la tuile elle-même (jamais dérivé, jamais perdu)", () => {
    for (const tuile of TUILES) {
      expect(capturePlan(tuile, "A").motif).toBe(tuile);
    }
  });
  it("une absence ne porte jamais de quart ; une présence en porte toujours un", () => {
    for (const tuile of TUILES) {
      for (const team of ["A", "B", "C", "D"] as const) {
        const plan = capturePlan(tuile, team);
        if (plan.effect === "off") {
          expect(plan.shift).toBeNull();
        } else {
          expect(plan.shift).not.toBeNull();
        }
      }
    }
  });
});
