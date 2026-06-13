import { describe, expect, it } from "vitest";
import { reminderSchedule } from "./echeances";

// Échéances de rappel (FR-10, Sprint 7) — les cas limites exigés par la carte :
// écart lointain (3 échéances), écart proche (< 1 mois, < 1 semaine, < 1 jour),
// écart passé. La parité avec la RPC SQL est testée dans supabase/tests/reminders.test.ts.

const TODAY = "2026-06-12";

describe("reminderSchedule — règle « antérieure à l'écart ET strictement future »", () => {
  it("un écart à J+40 génère les 3 échéances (mois, semaine, veille) aux bonnes dates", () => {
    expect(reminderSchedule("2026-07-22", TODAY)).toEqual([
      { lead: "month", date: "2026-06-22" },
      { lead: "week", date: "2026-07-15" },
      { lead: "day", date: "2026-07-21" },
    ]);
  });

  it("à J+31, l'échéance « mois » tombe demain : encore les 3", () => {
    expect(reminderSchedule("2026-07-13", TODAY)).toEqual([
      { lead: "month", date: "2026-06-13" },
      { lead: "week", date: "2026-07-06" },
      { lead: "day", date: "2026-07-12" },
    ]);
  });

  it("à J+30, l'échéance « mois » tomberait aujourd'hui : elle est omise (pas strictement future)", () => {
    expect(reminderSchedule("2026-07-12", TODAY).map((e) => e.lead)).toEqual(["week", "day"]);
  });

  it("à J+8, il reste semaine et veille", () => {
    expect(reminderSchedule("2026-06-20", TODAY)).toEqual([
      { lead: "week", date: "2026-06-13" },
      { lead: "day", date: "2026-06-19" },
    ]);
  });

  it("à J+7, l'échéance « semaine » tomberait aujourd'hui : seule la veille reste", () => {
    expect(reminderSchedule("2026-06-19", TODAY)).toEqual([{ lead: "day", date: "2026-06-18" }]);
  });

  it("à J+3, seule la veille reste (la « semaine » serait déjà passée)", () => {
    expect(reminderSchedule("2026-06-15", TODAY)).toEqual([{ lead: "day", date: "2026-06-14" }]);
  });

  it("à J+1, la veille tomberait aujourd'hui : aucun rappel", () => {
    expect(reminderSchedule("2026-06-13", TODAY)).toEqual([]);
  });

  it("un écart aujourd'hui ne génère aucun rappel", () => {
    expect(reminderSchedule(TODAY, TODAY)).toEqual([]);
  });

  it("un écart passé ne génère aucun rappel", () => {
    expect(reminderSchedule("2026-06-01", TODAY)).toEqual([]);
  });

  it("le changement d'année est géré (écart en janvier, saisie en décembre)", () => {
    expect(reminderSchedule("2027-01-20", "2026-12-15")).toEqual([
      { lead: "month", date: "2026-12-21" },
      { lead: "week", date: "2027-01-13" },
      { lead: "day", date: "2027-01-19" },
    ]);
  });

  it("une date civile invalide est refusée (frontière du domaine)", () => {
    expect(() => reminderSchedule("2026-13-01", TODAY)).toThrow(RangeError);
    expect(() => reminderSchedule("2026-07-22", "pas-une-date")).toThrow(RangeError);
  });
});
