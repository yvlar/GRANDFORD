import {
  FALLBACK_FRIDGE,
  type FridgeEvent,
  fridgePayload,
} from "@/lib/notifications/fridge-payload";
import { describe, expect, it } from "vitest";

// Payload de notification du frigo (Sprint 20). R7 STRUCTUREL : la fonction ne reçoit
// que le type d'événement — jamais le corps d'une note. Ces tests vérouillent la forme
// ET l'absence de tout contenu de note dans le texte (impossible par construction).

describe("fridgePayload — forme et étanchéité (R7)", () => {
  const evenements: FridgeEvent[] = ["nouvelle", "lue"];

  it.each(evenements)("l'événement « %s » produit exactement {title, body, url}", (event) => {
    const p = fridgePayload(event);
    expect(Object.keys(p).sort()).toEqual(["body", "title", "url"]);
    expect(p.url).toBe("/frigo");
    expect(p.title).toBe("GRANDFORD — note du frigo");
    expect(p.body.length).toBeGreaterThan(0);
  });

  it("le texte « nouvelle » annonce une note sans en révéler le contenu", () => {
    expect(fridgePayload("nouvelle").body).toBe("Une nouvelle note vous attend au frigo.");
  });

  it("le texte « lue » annonce l'accusé sans contenu", () => {
    expect(fridgePayload("lue").body).toBe("Votre note du frigo a été lue.");
  });

  it("le repli reste générique et pointe vers /frigo (R11)", () => {
    expect(Object.keys(FALLBACK_FRIDGE).sort()).toEqual(["body", "title", "url"]);
    expect(FALLBACK_FRIDGE.url).toBe("/frigo");
  });
});
