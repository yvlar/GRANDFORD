import { FALLBACK_GROCERY, groceryPayload } from "@/lib/notifications/grocery-payload";
import { describe, expect, it } from "vitest";

// Payload de notification de l'épicerie (Sprint 25). R7 : on vérifie surtout qu'AUCUN
// libellé d'article ne peut entrer dans le message — la fonction ne reçoit que l'événement.

describe("groceryPayload — type d'événement seul, jamais de contenu", () => {
  it("« nouvelle » annonce une liste sans révéler son contenu", () => {
    const p = groceryPayload("nouvelle");
    expect(p).toEqual({
      title: "GRANDFORD — épicerie",
      body: "Une nouvelle liste d'épicerie vous attend au frigo.",
      url: "/frigo",
    });
  });

  it("« coche » annonce des articles cochés sans révéler lesquels", () => {
    const p = groceryPayload("coche");
    expect(p.body).toBe("Des articles ont été cochés sur une liste d'épicerie.");
    expect(p.url).toBe("/frigo");
  });

  it("le repli reste générique (sans contenu d'article)", () => {
    expect(FALLBACK_GROCERY.title).toBe("GRANDFORD — épicerie");
    expect(FALLBACK_GROCERY.url).toBe("/frigo");
  });
});
