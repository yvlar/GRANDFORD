import { TUILES } from "@/lib/schedule/capture";
import { describe, expect, it } from "vitest";
import { FALLBACK_REMINDER, reminderPayload } from "./payload";

// Contenu des notifications (FR-10) — et surtout R7 : le payload dit « écart le
// DATE », jamais pourquoi. La preuve est structurelle (la fonction ne reçoit pas
// de motif) ET constatée ici sur le contenu généré.

describe("reminderPayload", () => {
  it("dit la date de l'écart et l'horizon « dans 1 mois »", () => {
    expect(reminderPayload("2026-07-22", "month")).toEqual({
      title: "GRANDFORD — rappel",
      body: "Écart à l'horaire mercredi 22 juillet (dans 1 mois).",
      url: "/",
    });
  });

  it("dit « dans 1 semaine » puis « demain » selon l'échéance", () => {
    expect(reminderPayload("2026-07-22", "week").body).toBe(
      "Écart à l'horaire mercredi 22 juillet (dans 1 semaine).",
    );
    expect(reminderPayload("2026-07-22", "day").body).toBe(
      "Écart à l'horaire mercredi 22 juillet (demain).",
    );
  });

  it("la date civile ne glisse jamais d'un jour (interprétée en UTC, pas au fuseau du runtime)", () => {
    expect(reminderPayload("2026-01-01", "day").body).toContain("jeudi 1 janvier");
    expect(reminderPayload("2026-12-31", "day").body).toContain("jeudi 31 décembre");
  });

  it("R7 : aucun motif possible dans le payload — aucune tuile n'apparaît, aucun champ en trop", () => {
    const payloads = [
      ...(["month", "week", "day"] as const).map((lead) => reminderPayload("2026-07-22", lead)),
      FALLBACK_REMINDER, // le repli du service worker obéit à la même loi
    ];
    for (const payload of payloads) {
      expect(Object.keys(payload).sort()).toEqual(["body", "title", "url"]);
      const serialise = JSON.stringify(payload).toLowerCase();
      for (const tuile of TUILES) {
        expect(serialise).not.toContain(tuile);
      }
    }
  });
});
