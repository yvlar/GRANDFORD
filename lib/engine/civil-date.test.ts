import { describe, expect, it } from "vitest";
import {
  civilToDays,
  daysToCivil,
  formatCivilDate,
  mathMod,
  parseCivilDate,
  weekdayIndex,
} from "./civil-date";

describe("mathMod — modulo mathématique", () => {
  it("retourne un reste positif pour un nombre négatif", () => {
    expect(mathMod(-1, 14)).toBe(13);
    expect(mathMod(-2, 14)).toBe(12);
    expect(mathMod(-14, 14)).toBe(0);
    expect(mathMod(-15, 14)).toBe(13);
  });

  it("se comporte comme le modulo usuel pour un nombre positif", () => {
    expect(mathMod(0, 14)).toBe(0);
    expect(mathMod(14, 14)).toBe(0);
    expect(mathMod(20, 14)).toBe(6);
  });
});

describe("civilToDays — comptage de jours sans fuseau", () => {
  it("place l'époque Unix (1970-01-01) à zéro", () => {
    expect(civilToDays({ year: 1970, month: 1, day: 1 })).toBe(0);
  });

  it("compte deux jours entre le 1er et le 3 juin 2026", () => {
    const premier = civilToDays({ year: 2026, month: 6, day: 1 });
    const trois = civilToDays({ year: 2026, month: 6, day: 3 });
    expect(trois - premier).toBe(2);
  });

  it("compte 205 jours entre le 3 juin et le 25 décembre 2026 (validation Noël)", () => {
    const ancre = civilToDays({ year: 2026, month: 6, day: 3 });
    const noel = civilToDays({ year: 2026, month: 12, day: 25 });
    expect(noel - ancre).toBe(205);
  });
});

describe("daysToCivil — inverse de civilToDays", () => {
  it("fait un aller-retour fidèle sur une plage d'un an", () => {
    const base = civilToDays({ year: 2026, month: 1, day: 1 });
    for (let i = 0; i < 366; i += 1) {
      const civil = daysToCivil(base + i);
      expect(civilToDays(civil)).toBe(base + i);
    }
  });
});

describe("parseCivilDate / formatCivilDate", () => {
  it("fait un aller-retour sur une date valide", () => {
    expect(formatCivilDate(parseCivilDate("2026-06-03"))).toBe("2026-06-03");
  });

  it("rejette un format non zéro-paddé ou non ISO", () => {
    expect(() => parseCivilDate("2026-6-3")).toThrow();
    expect(() => parseCivilDate("03/06/2026")).toThrow();
  });

  it("rejette une date inexistante", () => {
    expect(() => parseCivilDate("2026-02-30")).toThrow();
    expect(() => parseCivilDate("2026-13-01")).toThrow();
  });

  it("rejette une année hors domaine (avant 1970)", () => {
    expect(() => parseCivilDate("0000-01-01")).toThrow();
    expect(() => parseCivilDate("1969-12-31")).toThrow();
  });
});

describe("weekdayIndex — jour de semaine (0 = dimanche)", () => {
  it("place le 1er janvier 1970 un jeudi (indice 4)", () => {
    expect(weekdayIndex({ year: 1970, month: 1, day: 1 })).toBe(4);
  });

  it("place l'ancre du 3 juin 2026 un mercredi (indice 3)", () => {
    expect(weekdayIndex({ year: 2026, month: 6, day: 3 })).toBe(3);
  });

  it("place le 7 juin 2026 un dimanche (indice 0)", () => {
    expect(weekdayIndex({ year: 2026, month: 6, day: 7 })).toBe(0);
  });
});
