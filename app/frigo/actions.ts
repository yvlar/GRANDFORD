"use server";

import { FRIGO_NOTE_COLUMNS, parseFrigoRows } from "@/lib/frigo/db-rows";
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
    .select(FRIGO_NOTE_COLUMNS)
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

export async function repondreNoteFrigo(parentId: string, body: string): Promise<ResultatCreation> {
  const pid = uuidSchema.safeParse(parentId);
  const corps = frigoBodySchema.safeParse(body);
  if (!pid.success || !corps.success) {
    return { ok: false, erreur: fr.frigo.erreurReponse, note: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // On NE FAIT PAS confiance au client pour le foyer : on le dérive de la note parente,
  // lue sous RLS (un non-membre ne voit pas la ligne → maybeSingle null → échec propre).
  // Le trigger BD enforce_fridge_note_single_level vérifie en plus que le parent est bien
  // une note de tête et du même foyer (un seul niveau).
  const { data: parent } = await supabase
    .from("fridge_notes")
    .select("household_id")
    .eq("id", pid.data)
    .maybeSingle();
  if (!parent) {
    return { ok: false, erreur: fr.frigo.erreurReponse, note: null };
  }

  const { data, error } = await supabase
    .from("fridge_notes")
    .insert({
      household_id: parent.household_id,
      author_id: user.id,
      body: corps.data,
      parent_id: pid.data,
    })
    .select(FRIGO_NOTE_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, erreur: fr.frigo.erreurReponse, note: null };
  }

  // Best-effort : notifie l'AUTRE membre qu'une réponse l'attend (event "reponse").
  await declencherPushFrigo(data.id, "reponse");

  revalidatePath("/frigo");
  return { ok: true, erreur: null, note: parseFrigoRows([data])[0] ?? null };
}

export async function modifierNoteFrigo(noteId: string, body: string): Promise<ResultatCreation> {
  const id = uuidSchema.safeParse(noteId);
  const corps = frigoBodySchema.safeParse(body);
  if (!id.success || !corps.success) {
    return { ok: false, erreur: fr.frigo.erreurModification, note: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Décision push : on ne re-signale que les notes DÉJÀ lues (contenu périmé). On lit donc
  // l'état d'accusé AVANT l'édition. Scoping auteur : un non-auteur ne voit pas la ligne (RLS).
  const { data: avant } = await supabase
    .from("fridge_notes")
    .select("read_at")
    .eq("id", id.data)
    .eq("author_id", user.id)
    .maybeSingle();
  const etaitLue = avant?.read_at != null;

  // UPDATE auteur seul (RLS fridge_notes_update) + double-garde .eq("author_id").
  // On RÉINITIALISE l'accusé : le contenu a changé, l'ancien « lu » est périmé → la note
  // redevient « non lue ». Hardcoder read_at/read_by à null fait double emploi : c'est le
  // reset voulu ET ça interdit de forger un accusé (on n'accepte jamais ces champs du client).
  const { data, error } = await supabase
    .from("fridge_notes")
    .update({ body: corps.data, read_at: null, read_by: null })
    .eq("id", id.data)
    .eq("author_id", user.id)
    .select(FRIGO_NOTE_COLUMNS);

  if (error || data.length === 0) {
    return { ok: false, erreur: fr.frigo.erreurModification, note: null };
  }

  // Best-effort : ne notifie l'autre membre que si la note était déjà lue (sinon une simple
  // correction avant lecture resterait silencieuse). Un échec n'invalide pas l'écriture.
  if (etaitLue) {
    await declencherPushFrigo(id.data, "modifiee");
  }

  revalidatePath("/frigo");
  revalidatePath("/"); // la pastille « non lues » de l'accueil (la note redevient non lue)
  return { ok: true, erreur: null, note: parseFrigoRows(data)[0] ?? null };
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

export async function epinglerNoteFrigo(noteId: string, pin: boolean): Promise<EtatFrigo> {
  const id = uuidSchema.safeParse(noteId);
  const drapeau = z.boolean().safeParse(pin);
  if (!id.success || !drapeau.success) {
    return { ok: false, erreur: fr.frigo.erreurEpinglage };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Le RPC (SECURITY DEFINER) vérifie « auteur seul » et tient l'invariant « une épingle par
  // foyer » (il détache l'épingle existante avant de poser la nouvelle). Il ne touche ni body
  // ni read_at → pas de faux « Édité », pas de reset d'accusé. Pas de push (action de tri).
  const { error } = await supabase.rpc("epingler_note_frigo", {
    note_id: id.data,
    pin: drapeau.data,
  });
  if (error) {
    return { ok: false, erreur: fr.frigo.erreurEpinglage };
  }

  // Realtime délivre déjà le changement d'épingle aux deux membres ; on revalide pour le
  // rendu serveur (et le tri épingle-d'abord) au prochain chargement.
  revalidatePath("/frigo");
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
