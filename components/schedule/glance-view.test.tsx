import type { ScheduleException } from "@/lib/schedule";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlanceView } from "./glance-view";

// Rendu OBSERVABLE de la vue « coup d'œil » (critères d'acceptation Sprint 4) :
// on rend le vrai composant en HTML et on constate la pastille — aucun réseau,
// aucun mock du moteur. `initialToday` injecte la date (frontière horloge).

function render(props: Parameters<typeof GlanceView>[0]): string {
  return renderToStaticMarkup(<GlanceView {...props} />);
}

describe("GlanceView — pastille du jour (points réels validés)", () => {
  it("le 11 juin 2026, l'équipe A voit CONGÉ", () => {
    const html = render({
      role: "worker",
      team: "A",
      exceptions: [],
      sleepDefault: null,
      initialToday: "2026-06-11",
    });
    expect(html).toContain("CONGÉ");
    expect(html).toContain("11 juin");
  });

  it("le 25 décembre 2026, l'équipe A voit JOUR avec les heures du quart", () => {
    const html = render({
      role: "worker",
      team: "A",
      exceptions: [],
      sleepDefault: null,
      initialToday: "2026-12-25",
    });
    expect(html).toContain("JOUR");
    expect(html).toContain("07:00 – 19:00");
  });
});

describe("GlanceView — vue conjointe (FR-3, R7)", () => {
  const ecartOff: ScheduleException[] = [{ onDate: "2026-06-12", effect: "off", shift: null }];

  it("un jour d'écart OFF, le travailleur voit CONGÉ et la marque d'écart", () => {
    const html = render({
      role: "worker",
      team: "A",
      exceptions: ecartOff,
      sleepDefault: null,
      initialToday: "2026-06-12",
    });
    expect(html).toContain("CONGÉ");
    // WHY ce fragment : renderToStaticMarkup échappe l'apostrophe d'« Écart à l'horaire ».
    expect(html).toContain("horaire ce jour-là");
  });

  it("le même jour, la conjointe voit DISPONIBLE — et rien qui ressemble à un motif", () => {
    const html = render({
      role: "spouse",
      team: "A",
      exceptions: ecartOff,
      sleepDefault: null,
      initialToday: "2026-06-12",
    });
    expect(html).toContain("DISPONIBLE");
    // R7 : le composant ne possède même pas de champ motif — le HTML non plus.
    expect(html.toLowerCase()).not.toContain("motif");
  });
});
