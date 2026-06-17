"use server";

import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { dateCivileSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Server actions requêtes (FR-9, Sprint 9).
// La RLS requests_select/insert permet à tout membre du foyer de voir et créer.
// Seul le travailleur cible (target_profile_id) peut UPDATE le statut.
// R7 : le body d'une requête est la demande de la conjointe — ce n'est pas un
// motif d'absence. Jamais dans Sentry, ni les logs, ni le payload conjointe.

const bodySchema = z.string().trim().min(1).max(500);

export type EtatRequete = { ok: boolean; erreur: string | null };

/** Conjointe : soumettre une demande de disponibilité sur une date. */
export async function soumettreRequete(
  householdId: string,
  targetProfileId: string,
  onDate: string,
  body: string,
): Promise<EtatRequete> {
  const hid = uuidSchema.safeParse(householdId);
  const target = uuidSchema.safeParse(targetProfileId);
  const date = dateCivileSchema.safeParse(onDate);
  const corps = bodySchema.safeParse(body);
  if (!hid.success || !target.success || !date.success || !corps.success) {
    return { ok: false, erreur: fr.requetes.erreurSoumission };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("requests").insert({
    household_id: hid.data,
    requester_id: user.id,
    target_profile_id: target.data,
    on_date: date.data,
    body: corps.data,
  });

  if (error) {
    return { ok: false, erreur: fr.requetes.erreurSoumission };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}

/** Travailleur : approuver une requête et créer l'écart correspondant.
 * householdId est pré-lié depuis AccueilPage (pattern identique à capturerEcart). */
export async function approuverRequete(
  householdId: string,
  requestId: string,
  onDate: string,
  effet: string,
): Promise<EtatRequete> {
  const hid = uuidSchema.safeParse(householdId);
  const reqId = uuidSchema.safeParse(requestId);
  const date = dateCivileSchema.safeParse(onDate);
  const effetSchema = z.enum(["off", "working", "working_extra", "shift_swap"]);
  const parsedEffet = effetSchema.safeParse(effet);
  if (!hid.success || !reqId.success || !date.success || !parsedEffet.success) {
    return { ok: false, erreur: fr.requetes.erreurApprobation };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Créer l'écart : le trigger trg_generate_reminders génère les rappels.
  // Le motif = 'requete' (non partagé, dans exception_private). R7 respecté.
  const { error: rpcError } = await supabase.rpc("create_exception_with_motif", {
    p_household_id: hid.data,
    p_on_date: date.data,
    p_effect: parsedEffet.data,
    p_motif: "requete",
    p_shift: undefined,
  });

  if (rpcError) {
    const erreur =
      rpcError.code === "GF005" ? fr.capture.erreurDoublon : fr.requetes.erreurApprobation;
    return { ok: false, erreur };
  }

  // Mettre le statut de la requête à 'approved'.
  // La RLS requests_update (target_profile_id = auth.uid()) s'applique.
  const { error: updateError } = await supabase
    .from("requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", reqId.data);

  if (updateError) {
    return { ok: false, erreur: fr.requetes.erreurApprobation };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}

/** Travailleur : refuser une requête. */
export async function refuserRequete(requestId: string): Promise<EtatRequete> {
  const reqId = uuidSchema.safeParse(requestId);
  if (!reqId.success) {
    return { ok: false, erreur: fr.requetes.erreurRefus };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase
    .from("requests")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", reqId.data);

  if (error) {
    return { ok: false, erreur: fr.requetes.erreurRefus };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}
