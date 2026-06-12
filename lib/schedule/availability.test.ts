import { GRANDFORD_CYCLE } from "@/lib/engine";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLEEP_WINDOW,
  type ScheduleException,
  overviewRange,
  spouseStatus,
} from "./availability";

// Superposition écarts + sommeil sur le moteur (FR-2/FR-3, carte Sprint 4).
// Le moteur n'est JAMAIS mocké (règle tests-vitest.md) : on l'appelle vraiment,
// avec le gabarit validé. Les points réels (11 juin congé A, 25 déc. A jour)
// restent la référence intouchable.

function overviewDay(
  team: "A" | "B" | "C" | "D",
  date: string,
  exceptions: readonly ScheduleException[] = [],
  sleepDefault: { start: string; end: string } | null = null,
) {
  const days = overviewRange({
    team,
    from: date,
    to: date,
    template: GRANDFORD_CYCLE,
    exceptions,
    sleepDefault,
  });
  expect(days).toHaveLength(1);
  const day = days[0];
  if (!day) {
    throw new Error("jour manquant");
  }
  return day;
}

describe("overviewRange — horaire de base (golden consommés)", () => {
  it("le 11 juin 2026, l'équipe A est en CONGÉ", () => {
    const day = overviewDay("A", "2026-06-11");
    expect(day.status).toBe("conge");
    expect(day.shift).toBeNull();
    expect(day.hasException).toBe(false);
  });

  it("le 25 décembre 2026, l'équipe A travaille de JOUR", () => {
    const day = overviewDay("A", "2026-12-25");
    expect(day.status).toBe("jour");
    expect(day.shift).toBe("jour");
  });

  it("le 12 juin 2026, l'équipe C travaille de NUIT (table de juin)", () => {
    const day = overviewDay("C", "2026-06-12");
    expect(day.status).toBe("nuit");
  });

  it("si from > to, retourne un tableau vide", () => {
    const days = overviewRange({
      team: "A",
      from: "2026-06-12",
      to: "2026-06-11",
      template: GRANDFORD_CYCLE,
      exceptions: [],
      sleepDefault: null,
    });
    expect(days).toEqual([]);
  });
});

describe("overviewRange — sommeil après une nuit (heuristique FR-6 minimale)", () => {
  it("le 10 juin 2026, l'équipe C est en SOMMEIL (elle a travaillé la nuit du 9)", () => {
    const day = overviewDay("C", "2026-06-10");
    expect(day.status).toBe("sommeil");
    expect(day.sleepWindow).toEqual(DEFAULT_SLEEP_WINDOW);
  });

  it("la fenêtre de sleep_defaults remplace l'heuristique quand elle existe", () => {
    const fenetre = { start: "09:30", end: "17:00" };
    const day = overviewDay("C", "2026-06-10", [], fenetre);
    expect(day.status).toBe("sommeil");
    expect(day.sleepWindow).toEqual(fenetre);
  });

  it("le 5 juin 2026, l'équipe A est en CONGÉ simple (la veille était un quart de JOUR)", () => {
    const day = overviewDay("A", "2026-06-05");
    expect(day.status).toBe("conge");
    expect(day.sleepWindow).toBeNull();
  });

  it("un écart OFF sur la nuit de la veille annule le SOMMEIL du lendemain", () => {
    // L'équipe C devait travailler la nuit du 9 juin ; absente → pas de sommeil le 10.
    const exceptions: ScheduleException[] = [{ onDate: "2026-06-09", effect: "off", shift: null }];
    const day = overviewDay("C", "2026-06-10", exceptions);
    expect(day.status).toBe("conge");
  });

  it("un OT de NUIT la veille (jour off) produit un SOMMEIL le lendemain", () => {
    // 10 et 11 juin : C au repos. OT de nuit le 10 → sommeil le 11.
    const exceptions: ScheduleException[] = [
      { onDate: "2026-06-10", effect: "working_extra", shift: "nuit" },
    ];
    const day = overviewDay("C", "2026-06-11", exceptions);
    expect(day.status).toBe("sommeil");
  });
});

describe("overviewRange — superposition des écarts (FR-2)", () => {
  it("un écart OFF un jour travaillé affiche CONGÉ et marque l'écart", () => {
    const exceptions: ScheduleException[] = [{ onDate: "2026-06-12", effect: "off", shift: null }];
    const day = overviewDay("A", "2026-06-12", exceptions);
    expect(day.status).toBe("conge");
    expect(day.hasException).toBe(true);
  });

  it("un écart WORKING un jour de congé affiche le quart porté par l'écart", () => {
    const exceptions: ScheduleException[] = [
      { onDate: "2026-06-11", effect: "working", shift: "jour" },
    ];
    const day = overviewDay("A", "2026-06-11", exceptions);
    expect(day.status).toBe("jour");
    expect(day.hasException).toBe(true);
  });

  it("un écart WORKING sans quart retombe sur le quart d'identité de l'équipe", () => {
    const exceptions: ScheduleException[] = [
      { onDate: "2026-06-11", effect: "working", shift: null },
    ];
    expect(overviewDay("A", "2026-06-11", exceptions).status).toBe("jour");
    expect(
      overviewDay(
        "C",
        "2026-06-10",
        exceptions.map((e) => ({ ...e, onDate: "2026-06-10" })),
      ).status, // C au repos le 10
    ).toBe("nuit");
  });

  it("un échange de quart vers la NUIT s'affiche NUIT", () => {
    const exceptions: ScheduleException[] = [
      { onDate: "2026-06-12", effect: "shift_swap", shift: "nuit" },
    ];
    const day = overviewDay("A", "2026-06-12", exceptions);
    expect(day.status).toBe("nuit");
    expect(day.hasException).toBe(true);
  });
});

describe("spouseStatus — sémantique disponibilité (FR-3)", () => {
  it("jour et nuit deviennent TRAVAILLE", () => {
    expect(spouseStatus("jour")).toBe("travaille");
    expect(spouseStatus("nuit")).toBe("travaille");
  });

  it("congé devient DISPONIBLE", () => {
    expect(spouseStatus("conge")).toBe("disponible");
  });

  it("sommeil reste SOMMEIL", () => {
    expect(spouseStatus("sommeil")).toBe("sommeil");
  });
});
