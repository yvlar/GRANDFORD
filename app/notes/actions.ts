"use server";

import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { dateCivileSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Server actions notes (FR-8, Sprint 9). La RLS notes_all (membre du foyer)
// garantit qu'on ne lit et n'écrit que les notes de son propre foyer.
// R7 : une note (body) est la remarque d'un conjoint — ce n'est pas un motif
// d'absence. Jamais dans Sentry ni les logs.

const noteBodySchema = z.string().trim().min(1).max(500);

export type EtatNote = { ok: boolean; erreur: string | null };

export async function creerNote(
  householdId: string,
  onDate: string,
  body: string,
): Promise<EtatNote> {
  const hid = uuidSchema.safeParse(householdId);
  const date = dateCivileSchema.safeParse(onDate);
  const corps = noteBodySchema.safeParse(body);
  if (!hid.success || !date.success || !corps.success) {
    return { ok: false, erreur: fr.notes.erreurCreation };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("notes").insert({
    household_id: hid.data,
    author_id: user.id,
    on_date: date.data,
    body: corps.data,
  });

  if (error) {
    return { ok: false, erreur: fr.notes.erreurCreation };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}

export async function supprimerNote(noteId: string): Promise<EtatNote> {
  const id = uuidSchema.safeParse(noteId);
  if (!id.success) {
    return { ok: false, erreur: fr.notes.erreurSuppression };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // On ne supprime que les notes de son propre foyer (la RLS notes_all s'en charge),
  // et on restreint à l'auteur pour éviter qu'un membre supprime la note de l'autre.
  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id)
    .select("id");

  if (error || data.length === 0) {
    return { ok: false, erreur: fr.notes.erreurSuppression };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}
