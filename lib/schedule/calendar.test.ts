import { describe, expect, it } from "vitest";
import { addDays, firstOfMonth, lastOfMonth, monthGrid, nextDates } from "./calendar";

describe("calendar — arithmétique pure pour la vue", () => {
  it("addDays traverse les bornes de mois et d'année", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-06-12", 0)).toBe("2026-06-12");
  });

  it("firstOfMonth et lastOfMonth encadrent le mois (février bissextile inclus)", () => {
    expect(firstOfMonth("2026-06-12")).toBe("2026-06-01");
    expect(lastOfMonth("2026-06-12")).toBe("2026-06-30");
    expect(lastOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(lastOfMonth("2026-12-25")).toBe("2026-12-31");
  });

  it("nextDates donne la bande de 7 jours à partir d'aujourd'hui", () => {
    const semaine = nextDates("2026-06-12", 7);
    expect(semaine).toHaveLength(7);
    expect(semaine[0]).toBe("2026-06-12");
    expect(semaine[6]).toBe("2026-06-18");
  });

  it("monthGrid de juin 2026 : le 1er est un lundi, 5 semaines, cellules hors mois nulles", () => {
    const weeks = monthGrid("2026-06-12");
    expect(weeks).toHaveLength(5);
    // Dimanche en premier : la 1re cellule (dimanche 31 mai) est hors mois.
    expect(weeks[0]?.[0]).toBeNull();
    expect(weeks[0]?.[1]).toBe("2026-06-01");
    expect(weeks[4]?.[2]).toBe("2026-06-30");
    expect(weeks[4]?.[6]).toBeNull();
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });
});
