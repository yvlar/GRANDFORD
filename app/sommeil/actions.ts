"use server";

import { fr } from "@/lib/i18n/fr";
import type { EtatCapture } from "@/lib/schedule/capture";
import { createClient } from "@/lib/supabase/server";
import { dateCivileSchema, heureSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Fenêtre de sommeil (FR-6, Sprint 6) : configuration unique (sleep_defaults) et
// ajustement au cas par cas (sleep_adjustments). Même partage des responsabilités
// que app/foyer/actions.ts : Zod valide la FORME, la RLS tranche le DROIT (membre
// du foyer). L'écriture vise toujours SA propre ligne (profile_id = auth.uid()) —
// on ne règle pas le sommeil de quelqu'un d'autre par ce chemin.

const fenetreSchema = z.object({ debut: heureSchema, fin: heureSchema });

/** Configuration UNIQUE de la fenêtre (upsert sleep_defaults) — formulaire du foyer. */
export async function definirFenetreSommeil(
  householdId: string,
  formData: FormData,
): Promise<void> {
  const hid = uuidSchema.safeParse(householdId);
  const fenetre = fenetreSchema.safeParse({
    debut: formData.get("debut"),
    fin: formData.get("fin"),
  });
  if (!hid.success || !fenetre.success) {
    redirect("/foyer?erreur=sommeil");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("sleep_defaults").upsert(
    {
      household_id: hid.data,
      profile_id: user.id,
      start_time: fenetre.data.debut,
      end_time: fenetre.data.fin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,profile_id" },
  );
  if (error) {
    redirect("/foyer?erreur=sommeil");
  }
  revalidatePath("/");
  revalidatePath("/foyer");
}

const ajustementSchema = z.object({
  date: dateCivileSchema,
  debut: heureSchema,
  fin: heureSchema,
});

/** Ajustement d'UN jour (upsert sleep_adjustments) — geste du panneau de l'horaire. */
export async function ajusterSommeil(
  householdId: string,
  date: string,
  debut: string,
  fin: string,
): Promise<EtatCapture> {
  const hid = uuidSchema.safeParse(householdId);
  const saisie = ajustementSchema.safeParse({ date, debut, fin });
  if (!hid.success || !saisie.success) {
    return { ok: false, erreur: fr.sommeil.erreurAjustement };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("sleep_adjustments").upsert(
    {
      household_id: hid.data,
      profile_id: user.id,
      on_date: saisie.data.date,
      start_time: saisie.data.debut,
      end_time: saisie.data.fin,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,profile_id,on_date" },
  );
  if (error) {
    return { ok: false, erreur: fr.sommeil.erreurAjustement };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}

/** Retire l'ajustement d'UN jour : le jour revient à la fenêtre par défaut. */
export async function retirerAjustementSommeil(
  householdId: string,
  date: string,
): Promise<EtatCapture> {
  const hid = uuidSchema.safeParse(householdId);
  const jour = dateCivileSchema.safeParse(date);
  if (!hid.success || !jour.success) {
    return { ok: false, erreur: fr.sommeil.erreurAjustement };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase
    .from("sleep_adjustments")
    .delete()
    .eq("household_id", hid.data)
    .eq("profile_id", user.id)
    .eq("on_date", jour.data);
  if (error) {
    return { ok: false, erreur: fr.sommeil.erreurAjustement };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}
