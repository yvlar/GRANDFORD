import type { Database } from "@/lib/database.types";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  fetchActiveGabarit,
  fetchCycleTemplate,
  fetchCycleTemplateWithFallback,
} from "./cycle-template";
import { GABARITS_PREDEFINIS, gabaritNomSchema, trouverGabarit } from "./predefined-templates";

// Mock minimal du client Supabase — frontière réseau (mocks autorisés).
// La chaîne .from().select().eq().eq().maybeSingle() est la seule utilisée.
function makeMockSupabase(data: unknown, error: unknown = null): SupabaseClient<Database> {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data, error }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

const ROW_STANDARD = {
  name: "Pitman 2-2-3",
  anchor_date: "2026-06-03",
  pattern: [
    true,
    true,
    false,
    false,
    false,
    true,
    true,
    false,
    false,
    true,
    true,
    true,
    false,
    false,
  ],
  day_start: "07:00:00",
  day_end: "19:00:00",
  night_start: "19:00:00",
  night_end: "07:00:00",
};

describe("fetchCycleTemplate", () => {
  it("retourne null quand la BD retourne une erreur", async () => {
    const client = makeMockSupabase(null, new Error("connexion perdue"));
    const result = await fetchCycleTemplate(client, "some-household-id");
    expect(result).toBeNull();
  });

  it("retourne null quand aucune ligne trouvée (is_active absent ou table vide)", async () => {
    const client = makeMockSupabase(null);
    const result = await fetchCycleTemplate(client, "some-household-id");
    expect(result).toBeNull();
  });

  it("mappe les colonnes BD vers CycleTemplate et tronque les heures à HH:MM", async () => {
    const row = {
      anchor_date: "2026-06-03",
      pattern: [
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
      ],
      day_start: "07:00:00",
      day_end: "19:00:00",
      night_start: "19:00:00",
      night_end: "07:00:00",
    };
    const client = makeMockSupabase(row);
    const result = await fetchCycleTemplate(client, "any-id");
    expect(result).toEqual({
      anchorDate: "2026-06-03",
      pattern: row.pattern,
      dayHours: { start: "07:00", end: "19:00" },
      nightHours: { start: "19:00", end: "07:00" },
    });
  });
});

describe("fetchActiveGabarit", () => {
  it("retourne null quand la BD retourne une erreur", async () => {
    const client = makeMockSupabase(null, new Error("connexion perdue"));
    expect(await fetchActiveGabarit(client, "any")).toBeNull();
  });

  it("retourne null quand aucune ligne (is_active absent ou table vide)", async () => {
    const client = makeMockSupabase(null);
    expect(await fetchActiveGabarit(client, "any")).toBeNull();
  });

  it("retourne le nom et le template avec heures tronquées", async () => {
    const client = makeMockSupabase(ROW_STANDARD);
    const result = await fetchActiveGabarit(client, "any");
    expect(result?.name).toBe("Pitman 2-2-3");
    expect(result?.template.anchorDate).toBe("2026-06-03");
    expect(result?.template.dayHours.start).toBe("07:00");
    expect(result?.template.nightHours.end).toBe("07:00");
  });
});

describe("GABARITS_PREDEFINIS + trouverGabarit", () => {
  it("la liste contient au moins deux gabarits", () => {
    expect(GABARITS_PREDEFINIS.length).toBeGreaterThanOrEqual(2);
  });

  it("chaque gabarit a un pattern de 14 booléens", () => {
    for (const g of GABARITS_PREDEFINIS) {
      expect(g.template.pattern).toHaveLength(14);
    }
  });

  it("gabaritNomSchema accepte les noms de la liste et rejette les inconnus", () => {
    for (const g of GABARITS_PREDEFINIS) {
      expect(gabaritNomSchema.safeParse(g.name).success).toBe(true);
    }
    expect(gabaritNomSchema.safeParse("inconnu").success).toBe(false);
  });

  it("trouverGabarit retrouve un gabarit par nom exact", () => {
    const g = trouverGabarit("Pitman 2-2-3");
    expect(g?.template.anchorDate).toBe("2026-06-03");
  });

  it("trouverGabarit retourne undefined pour un nom inconnu", () => {
    expect(trouverGabarit("inexistant")).toBeUndefined();
  });
});

describe("fetchCycleTemplateWithFallback", () => {
  it("retourne GRANDFORD_CYCLE quand le fetch retourne null (NFR-4 : fallback hors-ligne)", async () => {
    const client = makeMockSupabase(null);
    const result = await fetchCycleTemplateWithFallback(client, "some-household-id");
    expect(result).toBe(GRANDFORD_CYCLE);
  });

  it("retourne le gabarit BD quand la ligne existe — heures tronquées", async () => {
    const row = {
      anchor_date: "2026-06-03",
      pattern: [
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        true,
        false,
        false,
      ],
      day_start: "07:00:00",
      day_end: "19:00:00",
      night_start: "19:00:00",
      night_end: "07:00:00",
    };
    const client = makeMockSupabase(row);
    const result = await fetchCycleTemplateWithFallback(client, "any-id");
    expect(result.anchorDate).toBe("2026-06-03");
    expect(result.dayHours.start).toBe("07:00");
    expect(result.nightHours.end).toBe("07:00");
  });
});
