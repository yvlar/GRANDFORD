import { GRANDFORD_CYCLE } from "@/lib/engine";
import {
  parseExceptionRows,
  parseSleepAdjustmentRows,
  parseSleepRow,
} from "@/lib/schedule/db-rows";
import {
  addDays,
  availabilityFor,
  dayStatuses,
  defaultSleepWindow,
  monthGrid,
  shiftMonth,
  statusForDate,
} from "@/lib/schedule/status";
import { todayCivil } from "@/lib/schedule/today";
import type { ScheduleException } from "@/lib/schedule/types";
import { describe, expect, it } from "vitest";

// La couche de superposition est testée AVANT d'être consommée par l'UI
// (règle tests-vitest.md). Le moteur n'est jamais mocké : on l'appelle vraiment,
// sur les points réels validés (02-cas-utilisation.md:108-118).

const T = GRANDFORD_CYCLE;
const AUCUN_ECART: ScheduleException[] = [];

describe("statusForDate — pastille du jour (points réels validés)", () => {
  it("le 11 juin 2026, l'équipe A est en CONGÉ", () => {
    const s = statusForDate("A", "2026-06-11", T, AUCUN_ECART, null);
    expect(s.kind).toBe("conge");
    expect(s.fromException).toBe(false);
  });

  it("le 25 décembre 2026, l'équipe A travaille de JOUR", () => {
    const s = statusForDate("A", "2026-12-25", T, AUCUN_ECART, null);
    expect(s.kind).toBe("jour");
  });

  it("le 3 juin 2026 (ancre), A est de JOUR et C de NUIT", () => {
    expect(statusForDate("A", "2026-06-03", T, AUCUN_ECART, null).kind).toBe("jour");
    expect(statusForDate("C", "2026-06-03", T, AUCUN_ECART, null).kind).toBe("nuit");
  });

  it("le 5 juin 2026, l'équipe C est en SOMMEIL (récupération après sa nuit du 4)", () => {
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null);
    expect(s.kind).toBe("sommeil");
    // Heuristique par défaut : 8 h à partir de la fin du quart de nuit (07:00).
    expect(s.sleep).toEqual({ start: "07:00", end: "15:00" });
  });

  it("le 5 juin 2026, l'équipe A (jour) est en simple CONGÉ, sans fenêtre de sommeil", () => {
    const s = statusForDate("A", "2026-06-05", T, AUCUN_ECART, null);
    expect(s.kind).toBe("conge");
    expect(s.sleep).toBeNull();
  });

  it("la fenêtre configurée (sleep_defaults) remplace l'heuristique", () => {
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, {
      start: "08:30",
      end: "16:00",
    });
    expect(s.sleep).toEqual({ start: "08:30", end: "16:00" });
  });
});

describe("statusForDate — superposition des écarts", () => {
  it("un écart « off » transforme un jour travaillé en CONGÉ", () => {
    const ecarts: ScheduleException[] = [{ onDate: "2026-06-03", effect: "off", shift: null }];
    const s = statusForDate("A", "2026-06-03", T, ecarts, null);
    expect(s.kind).toBe("conge");
    expect(s.fromException).toBe(true);
  });

  it("un écart « working » (jour) rend travaillé le congé du 11 juin", () => {
    const ecarts: ScheduleException[] = [
      { onDate: "2026-06-11", effect: "working", shift: "jour" },
    ];
    const s = statusForDate("A", "2026-06-11", T, ecarts, null);
    expect(s.kind).toBe("jour");
    expect(s.fromException).toBe(true);
  });

  it("un écart « working » sans quart explicite retombe sur le quart d'identité", () => {
    expect(
      statusForDate(
        "A",
        "2026-06-11",
        T,
        [{ onDate: "2026-06-11", effect: "working", shift: null }],
        null,
      ).kind,
    ).toBe("jour");
    expect(
      statusForDate(
        "C",
        "2026-06-10",
        T,
        [{ onDate: "2026-06-10", effect: "working", shift: null }],
        null,
      ).kind,
    ).toBe("nuit");
  });

  it("l'écart de la VEILLE compte pour le sommeil : nuit annulée → pas de récupération", () => {
    const ecarts: ScheduleException[] = [{ onDate: "2026-06-04", effect: "off", shift: null }];
    const s = statusForDate("C", "2026-06-05", T, ecarts, null);
    expect(s.kind).toBe("conge");
    expect(s.sleep).toBeNull();
    // L'état du 5 découle de l'écart du 4 : le marqueur d'écart doit suivre.
    expect(s.fromException).toBe(true);
  });

  it("un écart de nuit la veille d'un congé crée une journée de SOMMEIL (marquée écart)", () => {
    // Le 10 juin, A est en congé ; un écart « nuit » le 10 rend le 11 une récupération.
    const ecarts: ScheduleException[] = [
      { onDate: "2026-06-10", effect: "working_extra", shift: "nuit" },
    ];
    const s = statusForDate("A", "2026-06-11", T, ecarts, null);
    expect(s.kind).toBe("sommeil");
    expect(s.fromException).toBe(true);
  });

  it("le sommeil NORMAL après une nuit régulière ne porte aucun marqueur d'écart", () => {
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null);
    expect(s.kind).toBe("sommeil");
    expect(s.fromException).toBe(false);
  });
});

describe("ajustement de sommeil au cas par cas (FR-6, Sprint 6)", () => {
  const AJUSTEMENT_5_JUIN = [{ onDate: "2026-06-05", window: { start: "09:00", end: "13:00" } }];

  it("l'ajustement remplace la fenêtre configurée pour SA date seulement", () => {
    const configuree = { start: "08:30", end: "16:00" };
    // C dort le 5 (après ses nuits des 3-4) et le 10 (après ses nuits des 8-9).
    const days = dayStatuses("C", "2026-06-05", "2026-06-10", T, AUCUN_ECART, configuree, [
      ...AJUSTEMENT_5_JUIN,
    ]);
    expect(days[0]?.kind).toBe("sommeil");
    expect(days[0]?.sleep).toEqual({ start: "09:00", end: "13:00" });
    expect(days[5]?.kind).toBe("sommeil");
    expect(days[5]?.sleep).toEqual(configuree);
  });

  it("sans fenêtre configurée, l'ajustement remplace l'heuristique pour SA date seulement", () => {
    const ajuste = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null, AJUSTEMENT_5_JUIN);
    expect(ajuste.sleep).toEqual({ start: "09:00", end: "13:00" });
    const autreJour = statusForDate("C", "2026-06-10", T, AUCUN_ECART, null, AJUSTEMENT_5_JUIN);
    expect(autreJour.sleep).toEqual({ start: "07:00", end: "15:00" });
  });

  it("un ajustement sur un jour SANS sommeil est ignoré (pas de fenêtre inventée)", () => {
    // Le 3 juin, C travaille de nuit — aucune fenêtre de sommeil ce jour-là.
    const s = statusForDate("C", "2026-06-03", T, AUCUN_ECART, null, [
      { onDate: "2026-06-03", window: { start: "09:00", end: "13:00" } },
    ]);
    expect(s.kind).toBe("nuit");
    expect(s.sleep).toBeNull();
  });

  it("monthGrid applique l'ajustement au seul jour visé", () => {
    const grid = monthGrid("C", "2026-06-11", T, AUCUN_ECART, null, AJUSTEMENT_5_JUIN);
    const jours = new Map(grid.days.map((d) => [d.date, d]));
    expect(jours.get("2026-06-05")?.sleep).toEqual({ start: "09:00", end: "13:00" });
    expect(jours.get("2026-06-10")?.sleep).toEqual({ start: "07:00", end: "15:00" });
  });
});

describe("interrupteur de la fenêtre de sommeil (FR-6, Sprint 19)", () => {
  it("désactivée → le jour de récupération après une nuit redevient un simple CONGÉ", () => {
    // Le 5 juin, C dort après sa nuit du 4 ; l'interrupteur OFF efface la fenêtre.
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null, [], false);
    expect(s.kind).toBe("conge");
    expect(s.sleep).toBeNull();
    expect(s.fromException).toBe(false);
  });

  it("désactivée → la conjointe voit « disponible » plutôt que « sommeil »", () => {
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null, [], false);
    expect(availabilityFor(s)).toBe("disponible");
  });

  it("désactivée → la fenêtre configurée n'est pas affichée non plus", () => {
    const configuree = { start: "08:30", end: "16:00" };
    const s = statusForDate("C", "2026-06-05", T, AUCUN_ECART, configuree, [], false);
    expect(s.kind).toBe("conge");
    expect(s.sleep).toBeNull();
  });

  it("réactivée (défaut) → le sommeil et sa fenêtre reviennent à l'identique", () => {
    const actif = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null, [], true);
    expect(actif.kind).toBe("sommeil");
    expect(actif.sleep).toEqual({ start: "07:00", end: "15:00" });
    // Parité : omettre le paramètre équivaut à `true` (comportement historique).
    const parDefaut = statusForDate("C", "2026-06-05", T, AUCUN_ECART, null);
    expect(parDefaut).toEqual(actif);
  });

  it("désactivée → monthGrid n'affiche aucun jour de sommeil", () => {
    const grid = monthGrid("C", "2026-06-11", T, AUCUN_ECART, null, [], false);
    expect(grid.days.some((d) => d.kind === "sommeil")).toBe(false);
  });

  it("désactivée → un jour TRAVAILLÉ reste inchangé (seul le sommeil est touché)", () => {
    // Le 3 juin, C travaille de nuit : l'interrupteur ne concerne que la récupération.
    const s = statusForDate("C", "2026-06-03", T, AUCUN_ECART, null, [], false);
    expect(s.kind).toBe("nuit");
  });
});

describe("dayStatuses — intervalle", () => {
  it("couvre chaque jour de l'intervalle, dans l'ordre", () => {
    const days = dayStatuses("A", "2026-06-01", "2026-06-30", T, AUCUN_ECART, null);
    expect(days).toHaveLength(30);
    expect(days[0]?.date).toBe("2026-06-01");
    expect(days[29]?.date).toBe("2026-06-30");
  });

  it("reproduit la table validée de juin 2026 pour l'équipe A (jours travaillés)", () => {
    // 02-cas-utilisation.md:68-85 : A travaille les 3-4, 8-9, 12-13-14, puis le
    // cycle se répète (17-18, 22-23, 26-27-28). Les 1-2 juin : B/D.
    const days = dayStatuses("A", "2026-06-01", "2026-06-30", T, AUCUN_ECART, null);
    const travailles = days.filter((d) => d.kind === "jour").map((d) => Number(d.date.slice(8)));
    expect(travailles).toEqual([3, 4, 8, 9, 12, 13, 14, 17, 18, 22, 23, 26, 27, 28]);
  });
});

describe("availabilityFor — sémantique conjointe (FR-3)", () => {
  it("jour et nuit → travaille ; congé → disponible ; sommeil → sommeil", () => {
    expect(availabilityFor(statusForDate("A", "2026-06-03", T, AUCUN_ECART, null))).toBe(
      "travaille",
    );
    expect(availabilityFor(statusForDate("C", "2026-06-03", T, AUCUN_ECART, null))).toBe(
      "travaille",
    );
    expect(availabilityFor(statusForDate("A", "2026-06-11", T, AUCUN_ECART, null))).toBe(
      "disponible",
    );
    expect(availabilityFor(statusForDate("C", "2026-06-05", T, AUCUN_ECART, null))).toBe("sommeil");
  });
});

describe("monthGrid / navigation", () => {
  it("juin 2026 : 30 jours, le 1er tombe un lundi (1 case vide, dimanche en tête)", () => {
    const grid = monthGrid("A", "2026-06-11", T, AUCUN_ECART, null);
    expect(grid.year).toBe(2026);
    expect(grid.month).toBe(6);
    expect(grid.days).toHaveLength(30);
    expect(grid.leadingBlanks).toBe(1);
  });

  it("shiftMonth navigue d'un mois, y compris à cheval sur l'année", () => {
    expect(shiftMonth("2026-06-11", 1)).toBe("2026-07-01");
    expect(shiftMonth("2026-12-25", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("addDays traverse les mois et années", () => {
    expect(addDays("2026-06-01", -1)).toBe("2026-05-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("defaultSleepWindow", () => {
  it("dérive 8 h de récupération depuis la fin du quart de nuit du gabarit", () => {
    expect(defaultSleepWindow(T)).toEqual({ start: "07:00", end: "15:00" });
  });
});

describe("frontières (db-rows, horloge)", () => {
  it("parseExceptionRows accepte les colonnes partageables et rejette un effet inconnu", () => {
    expect(parseExceptionRows([{ on_date: "2026-06-15", effect: "off", shift: null }])).toEqual([
      { onDate: "2026-06-15", effect: "off", shift: null },
    ]);
    expect(() =>
      parseExceptionRows([{ on_date: "2026-06-15", effect: "motif-secret", shift: null }]),
    ).toThrow();
  });

  it("parseSleepRow tronque les secondes de Postgres et tolère l'absence", () => {
    expect(parseSleepRow({ start_time: "08:30:00", end_time: "16:00:00" })).toEqual({
      start: "08:30",
      end: "16:00",
    });
    expect(parseSleepRow(null)).toBeNull();
  });

  it("parseSleepAdjustmentRows produit des ajustements datés, secondes tronquées", () => {
    expect(
      parseSleepAdjustmentRows([
        { on_date: "2026-06-05", start_time: "09:00:00", end_time: "13:00:00" },
      ]),
    ).toEqual([{ onDate: "2026-06-05", window: { start: "09:00", end: "13:00" } }]);
    expect(() => parseSleepAdjustmentRows([{ on_date: "2026-06-05" }])).toThrow();
  });

  it("todayCivil rend la date civile de Toronto (soirée UTC = même jour à Toronto)", () => {
    // 23:30 UTC le 11 juin = 19:30 à Toronto (UTC-4 en été) → encore le 11 juin.
    expect(todayCivil(new Date("2026-06-11T23:30:00Z"))).toBe("2026-06-11");
    // 03:30 UTC le 12 juin = 23:30 le 11 à Toronto → toujours le 11 juin.
    expect(todayCivil(new Date("2026-06-12T03:30:00Z"))).toBe("2026-06-11");
  });
});
