import { describe, expect, it } from "vitest";
import { type ReglagePaye, estJourDePaye, frequencePayeSchema } from "./payday";

// Golden du jour de paye : on fige une ancre réelle et on vérifie le calcul ancre+mod sur
// des points choisis (sur l'ancre, un multiple plus loin, un non-multiple, AVANT l'ancre).
// Le moteur est pur : on l'appelle vraiment, aucun mock (règle tests-vitest.md).

const AUX_2_SEMAINES: ReglagePaye = { anchorDate: "2026-06-04", frequence: "aux_2_semaines" };
const HEBDO: ReglagePaye = { anchorDate: "2026-06-04", frequence: "hebdomadaire" };

describe("estJourDePaye — aux 2 semaines (14 j)", () => {
  it("le jour d'ancrage 2026-06-04 est un jour de paye", () => {
    expect(estJourDePaye("2026-06-04", AUX_2_SEMAINES)).toBe(true);
  });

  it("14 jours après l'ancre (2026-06-18) est un jour de paye", () => {
    expect(estJourDePaye("2026-06-18", AUX_2_SEMAINES)).toBe(true);
  });

  it("28 jours après l'ancre (2026-07-02) est un jour de paye", () => {
    expect(estJourDePaye("2026-07-02", AUX_2_SEMAINES)).toBe(true);
  });

  it("7 jours après l'ancre (2026-06-11) n'est PAS un jour de paye", () => {
    expect(estJourDePaye("2026-06-11", AUX_2_SEMAINES)).toBe(false);
  });

  it("un jour quelconque non-multiple (2026-06-17) n'est PAS un jour de paye", () => {
    expect(estJourDePaye("2026-06-17", AUX_2_SEMAINES)).toBe(false);
  });

  it("14 jours AVANT l'ancre (2026-05-21) est un jour de paye (garde mathMod)", () => {
    expect(estJourDePaye("2026-05-21", AUX_2_SEMAINES)).toBe(true);
  });
});

describe("estJourDePaye — hebdomadaire (7 j)", () => {
  it("7 jours après l'ancre (2026-06-11) est un jour de paye", () => {
    expect(estJourDePaye("2026-06-11", HEBDO)).toBe(true);
  });

  it("7 jours AVANT l'ancre (2026-05-28) est un jour de paye", () => {
    expect(estJourDePaye("2026-05-28", HEBDO)).toBe(true);
  });

  it("3 jours après l'ancre (2026-06-07) n'est PAS un jour de paye", () => {
    expect(estJourDePaye("2026-06-07", HEBDO)).toBe(false);
  });

  it("la même quinzaine donne des résultats différents selon la fréquence (2026-06-11)", () => {
    // +7 j : payé en hebdo, pas payé aux 2 semaines — la fréquence change bien le calcul.
    expect(estJourDePaye("2026-06-11", HEBDO)).toBe(true);
    expect(estJourDePaye("2026-06-11", AUX_2_SEMAINES)).toBe(false);
  });
});

describe("estJourDePaye — frontières", () => {
  it("lève sur une date civile invalide (frontière non validée en amont)", () => {
    expect(() => estJourDePaye("2026-13-99", AUX_2_SEMAINES)).toThrow();
  });
});

describe("frequencePayeSchema", () => {
  it("accepte les deux cadences supportées", () => {
    expect(frequencePayeSchema.parse("hebdomadaire")).toBe("hebdomadaire");
    expect(frequencePayeSchema.parse("aux_2_semaines")).toBe("aux_2_semaines");
  });

  it("rejette une cadence hors liste (ex. mensuel non supporté)", () => {
    expect(frequencePayeSchema.safeParse("mensuel").success).toBe(false);
  });
});
