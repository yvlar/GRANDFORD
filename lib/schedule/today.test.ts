import { describe, expect, it } from "vitest";
import { civilDateIn, todayInToronto } from "./today";

describe("today — date civile locale America/Toronto", () => {
  it("en été (UTC−4), 3 h 59 UTC appartient encore à la veille à Toronto", () => {
    expect(todayInToronto(new Date("2026-06-12T03:59:00Z"))).toBe("2026-06-11");
    expect(todayInToronto(new Date("2026-06-12T04:00:00Z"))).toBe("2026-06-12");
  });

  it("en hiver (UTC−5), la bascule se fait à 5 h UTC", () => {
    expect(todayInToronto(new Date("2026-12-25T04:59:00Z"))).toBe("2026-12-24");
    expect(todayInToronto(new Date("2026-12-25T05:00:00Z"))).toBe("2026-12-25");
  });

  it("le fuseau est un paramètre (multi-usines plus tard, FR-17)", () => {
    expect(civilDateIn("UTC", new Date("2026-06-12T03:59:00Z"))).toBe("2026-06-12");
  });
});
