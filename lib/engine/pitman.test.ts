import { describe, expect, it } from "vitest";
import { civilToDays, daysToCivil, formatCivilDate, parseCivilDate } from "./civil-date";
import { GRANDFORD_CYCLE } from "./cycle-template";
import {
  activeSuperCrew,
  crewsForDate,
  cycleIndex,
  otherSuperCrew,
  scheduleRange,
  shiftForDate,
} from "./pitman";
import type { CycleTemplate, SuperCrew, Team } from "./types";

const cycle = GRANDFORD_CYCLE;

describe("Ancrage — 3, 4, 5 juin 2026 (faits intouchables)", () => {
  it("le 3 juin 2026, l'équipe A travaille de jour et l'équipe C de nuit (A/C)", () => {
    expect(shiftForDate("A", "2026-06-03", cycle)).toEqual({
      working: true,
      shift: "jour",
      superCrew: "AC",
    });
    expect(shiftForDate("C", "2026-06-03", cycle)).toEqual({
      working: true,
      shift: "nuit",
      superCrew: "AC",
    });
    expect(shiftForDate("B", "2026-06-03", cycle).working).toBe(false);
    expect(shiftForDate("D", "2026-06-03", cycle).working).toBe(false);
  });

  it("le 4 juin 2026, le super-quart A/C travaille encore", () => {
    expect(activeSuperCrew("2026-06-04", cycle)).toBe("AC");
  });

  it("le 5 juin 2026, le super-quart bascule sur B/D", () => {
    expect(activeSuperCrew("2026-06-05", cycle)).toBe("BD");
    expect(shiftForDate("B", "2026-06-05", cycle)).toEqual({
      working: true,
      shift: "jour",
      superCrew: "BD",
    });
    expect(shiftForDate("D", "2026-06-05", cycle)).toEqual({
      working: true,
      shift: "nuit",
      superCrew: "BD",
    });
  });
});

describe("Points réels validés (02-cas-utilisation.md:108-118)", () => {
  it("le 11 juin 2026, l'équipe A est en congé (B/D travaille)", () => {
    expect(shiftForDate("A", "2026-06-11", cycle)).toEqual({
      working: false,
      shift: null,
      superCrew: "AC",
    });
    expect(activeSuperCrew("2026-06-11", cycle)).toBe("BD");
  });

  it("le 25 décembre 2026, l'équipe A travaille de jour", () => {
    expect(shiftForDate("A", "2026-12-25", cycle)).toEqual({
      working: true,
      shift: "jour",
      superCrew: "AC",
    });
  });
});

// Table validée — 02-cas-utilisation.md:68-85. Colonnes : [jour, équipe jour, équipe nuit, super-quart au repos].
const JUNE_2026: ReadonlyArray<readonly [number, Team, Team, SuperCrew]> = [
  [1, "B", "D", "AC"],
  [2, "B", "D", "AC"],
  [3, "A", "C", "BD"],
  [4, "A", "C", "BD"],
  [5, "B", "D", "AC"],
  [6, "B", "D", "AC"],
  [7, "B", "D", "AC"],
  [8, "A", "C", "BD"],
  [9, "A", "C", "BD"],
  [10, "B", "D", "AC"],
  [11, "B", "D", "AC"],
  [12, "A", "C", "BD"],
  [13, "A", "C", "BD"],
  [14, "A", "C", "BD"],
];

describe("Reconstruction intégrale de la table de juin 2026", () => {
  it("reproduit chaque ligne du 1er au 14 juin (équipe jour, équipe nuit, repos)", () => {
    for (const [day, dayTeam, nightTeam, rest] of JUNE_2026) {
      const date = `2026-06-${String(day).padStart(2, "0")}`;
      const active: SuperCrew = rest === "AC" ? "BD" : "AC";
      expect(activeSuperCrew(date, cycle)).toBe(active);
      expect(shiftForDate(dayTeam, date, cycle)).toEqual({
        working: true,
        shift: "jour",
        superCrew: active,
      });
      expect(shiftForDate(nightTeam, date, cycle)).toEqual({
        working: true,
        shift: "nuit",
        superCrew: active,
      });
    }
  });
});

describe("crewsForDate — vue « qui travaille » (Sprint 4)", () => {
  it("le 3 juin 2026 : A de jour, C de nuit, B/D au repos", () => {
    expect(crewsForDate("2026-06-03", cycle)).toEqual({
      activeCrew: "AC",
      restCrew: "BD",
      dayTeam: "A",
      nightTeam: "C",
    });
  });

  it("le 5 juin 2026 : B de jour, D de nuit, A/C au repos", () => {
    expect(crewsForDate("2026-06-05", cycle)).toEqual({
      activeCrew: "BD",
      restCrew: "AC",
      dayTeam: "B",
      nightTeam: "D",
    });
  });

  it("otherSuperCrew est l'involution des deux super-quarts", () => {
    expect(otherSuperCrew("AC")).toBe("BD");
    expect(otherSuperCrew("BD")).toBe("AC");
  });
});

describe("Robustesse du gabarit (frontière multi-usines, FR-17)", () => {
  const emptyPattern: CycleTemplate = { ...GRANDFORD_CYCLE, pattern: [] };

  it("refuse un pattern vide plutôt que de produire un index NaN", () => {
    expect(() => cycleIndex("2026-06-03", emptyPattern)).toThrow();
    expect(() => activeSuperCrew("2026-06-03", emptyPattern)).toThrow();
    expect(() => scheduleRange("A", "2026-06-03", "2026-06-04", emptyPattern)).toThrow();
  });
});

describe("Propriétés du cycle", () => {
  const teams: readonly Team[] = ["A", "B", "C", "D"];

  it("chaque équipe travaille exactement 7 jours sur 14", () => {
    for (const team of teams) {
      const days = scheduleRange(team, "2026-06-03", "2026-06-16", cycle);
      expect(days).toHaveLength(14);
      expect(days.filter((d) => d.working)).toHaveLength(7);
    }
  });

  it("A/C et B/D sont strictement complémentaires (jamais les deux, jamais aucun)", () => {
    const span = scheduleRange("A", "2026-06-01", "2026-06-30", cycle);
    for (const { date } of span) {
      const a = shiftForDate("A", date, cycle).working;
      const b = shiftForDate("B", date, cycle).working;
      const c = shiftForDate("C", date, cycle).working;
      const d = shiftForDate("D", date, cycle).working;
      expect(a).not.toBe(b); // exactement un super-quart actif
      expect(a).toBe(c); // A et C (super-quart AC) travaillent ensemble
      expect(b).toBe(d); // B et D (super-quart BD) travaillent ensemble
    }
  });

  it("le cycle est strictement périodique sur 14 jours", () => {
    const base = scheduleRange("A", "2026-06-01", "2026-06-28", cycle);
    for (const jour of base) {
      const plus14 = formatCivilDate(daysToCivil(civilToDays(parseCivilDate(jour.date)) + 14));
      expect(shiftForDate("A", plus14, cycle)).toEqual({
        working: jour.working,
        shift: jour.shift,
        superCrew: jour.superCrew,
      });
    }
  });

  it("gère les dates antérieures à l'ancre via le mod mathématique", () => {
    // 1er et 2 juin 2026 sont avant l'ancre (3 juin) : A/C au repos.
    expect(activeSuperCrew("2026-06-01", cycle)).toBe("BD");
    expect(activeSuperCrew("2026-06-02", cycle)).toBe("BD");
    expect(shiftForDate("A", "2026-06-01", cycle).working).toBe(false);
    // 20 mai 2026 = ancre − 14 jours → identique à l'ancre (A/C).
    expect(activeSuperCrew("2026-05-20", cycle)).toBe("AC");
  });
});
