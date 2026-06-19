import type { Database } from "@/lib/database.types";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import type { CycleTemplate } from "@/lib/engine";
import type { SupabaseClient } from "@supabase/supabase-js";

// Supabase retourne les colonnes `time` avec secondes (ex. '07:00:00').
// On tronque à HH:MM pour rester cohérent avec CycleTemplate.ShiftHours.
function toHHMM(t: string): string {
  return t.slice(0, 5);
}

/**
 * Charge le gabarit actif du foyer depuis `cycle_templates`.
 * Retourne `null` si absent ou en cas d'erreur — le consommateur utilise
 * GRANDFORD_CYCLE comme fallback (NFR-4 : hors-ligne).
 */
export async function fetchCycleTemplate(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<CycleTemplate | null> {
  const { data, error } = await supabase
    .from("cycle_templates")
    .select("anchor_date, pattern, day_start, day_end, night_start, night_end")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    anchorDate: data.anchor_date,
    pattern: data.pattern,
    dayHours: { start: toHHMM(data.day_start), end: toHHMM(data.day_end) },
    nightHours: { start: toHHMM(data.night_start), end: toHHMM(data.night_end) },
  };
}

/**
 * Charge le gabarit depuis la BD ; fallback sur GRANDFORD_CYCLE si absent (NFR-4).
 */
export async function fetchCycleTemplateWithFallback(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<CycleTemplate> {
  const template = await fetchCycleTemplate(supabase, householdId);
  return template ?? GRANDFORD_CYCLE;
}

/**
 * Charge le gabarit actif avec son nom (pour la page /foyer où le nom est affiché).
 * Retourne null si absent ou en cas d'erreur — le consommateur choisit son fallback.
 */
export async function fetchActiveGabarit(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<{ name: string; template: CycleTemplate } | null> {
  const { data, error } = await supabase
    .from("cycle_templates")
    .select("name, anchor_date, pattern, day_start, day_end, night_start, night_end")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    name: data.name,
    template: {
      anchorDate: data.anchor_date,
      pattern: data.pattern,
      dayHours: { start: toHHMM(data.day_start), end: toHHMM(data.day_end) },
      nightHours: { start: toHHMM(data.night_start), end: toHHMM(data.night_end) },
    },
  };
}
