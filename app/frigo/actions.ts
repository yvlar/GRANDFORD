"use server";

import { parseFrigoRows } from "@/lib/frigo/db-rows";
import type { EtatFrigo, ResultatCreation } from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { declencherPushFrigo } from "@/lib/notifications/notify-fridge-client";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Server actions de la note du frigo (Sprint 20). La RLS fridge_notes_* (membre du foyer +
// auteur seul pour le retrait) garantit qu'on ne lit/écrit/retire que dans son propre foyer.
// R7 : le body d'une note du frigo est une remarque de couple — ce n'est PAS un motif
// d'absence. Jamais dans Sentry ni les logs ; le payload push n'en porte rien (fridgePayload).

const frigoBodySchema = z.string().trim().min(1).max(500);

export async function creerNoteFrigo(householdId: string, body: string): Promise<ResultatCreation> {
  const hid = uuidSchema.safeParse(householdId);
  const corps = frigoBodySchema.safeParse(body);
  if (!hid.success || !corps.success) {
    return { ok: false, erreur: fr.frigo.erreurCreation, note: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { data, error } = await supabase
    .from("fridge_notes")
    .insert({ household_id: hid.data, author_id: user.id, body: corps.data })
    .select("id, author_id, body, read_at, read_by, created_at")
    .single();

  if (error || !data) {
    return { ok: false, erreur: fr.frigo.erreurCreation, note: null };
  }

  // Best-effort : notifie l'autre membre (push device). Un échec n'invalide pas l'écriture —
  // Realtime délivre déjà la note en direct dans l'app de l'autre.
  await declencherPushFrigo(data.id, "nouvelle");

  revalidatePath("/frigo");
  revalidatePath("/"); // la pastille « non lues » de l'accueil
  // parseFrigoRows = la seule frontière BD→métier (réutilisée par la page et le Realtime).
  return { ok: true, erreur: null, note: parseFrigoRows([data])[0] ?? null };
}

export async function marquerNoteFrigoLue(noteId: string): Promise<EtatFrigo> {
  const id = uuidSchema.safeParse(noteId);
  if (!id.success) {
    return { ok: false, erreur: fr.frigo.erreurLecture };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Le RPC (SECURITY DEFINER) pose l'accusé seulement si l'appelant est membre, n'est pas
  // l'auteur, et que la note n'était pas déjà lue. Retour true = transition null→lu.
  const { data, error } = await supabase.rpc("marquer_note_frigo_lue", { note_id: id.data });
  if (error) {
    return { ok: false, erreur: fr.frigo.erreurLecture };
  }

  if (data === true) {
    // On ne notifie l'auteur QUE sur la vraie transition (le RPC est idempotent) : pas de
    // double push si la page re-marque une note déjà lue.
    await declencherPushFrigo(id.data, "lue");
    revalidatePath("/frigo");
    revalidatePath("/");
  }
  return { ok: true, erreur: null };
}

export async function supprimerNoteFrigo(noteId: string): Promise<EtatFrigo> {
  const id = uuidSchema.safeParse(noteId);
  if (!id.success) {
    return { ok: false, erreur: fr.frigo.erreurSuppression };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // La RLS fridge_notes_delete (auteur seul) est le rempart BD ; le .eq("author_id") explicite
  // double la garde et rend 0 ligne supprimée détectable (note d'un autre → échec clair).
  const { data, error } = await supabase
    .from("fridge_notes")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id)
    .select("id");

  if (error || data.length === 0) {
    return { ok: false, erreur: fr.frigo.erreurSuppression };
  }

  revalidatePath("/frigo");
  revalidatePath("/");
  return { ok: true, erreur: null };
}
