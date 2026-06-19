import type { Database } from "@/lib/database.types";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { fetchCycleTemplate, fetchCycleTemplateWithFallback } from "./cycle-template";

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
