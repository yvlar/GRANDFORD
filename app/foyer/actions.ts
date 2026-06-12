"use server";

import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Toutes ces actions s'exécutent sous le rôle authenticated : la RLS du Sprint 2/3
// est la vraie barrière (propriétaire seul pour inviter/révoquer/annuler ; soi-même
// pour quitter). Les ids reçus du client sont validés en forme, jamais en droit —
// le droit, c'est la BD qui le tranche.

export async function creerInvitation(householdId: string): Promise<void> {
  const hid = uuidSchema.safeParse(householdId);
  if (!hid.success) {
    redirect("/foyer?erreur=invitation");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({ household_id: hid.data });
  if (error) {
    redirect("/foyer?erreur=invitation");
  }
  revalidatePath("/foyer");
}

export async function annulerInvitation(invitationId: string): Promise<void> {
  const id = uuidSchema.safeParse(invitationId);
  if (!id.success) {
    redirect("/foyer?erreur=invitation");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invitations").delete().eq("id", id.data);
  if (error) {
    redirect("/foyer?erreur=invitation");
  }
  revalidatePath("/foyer");
}

// Révoquer (propriétaire) et quitter (soi-même) = le même DELETE sous RLS ;
// seule la destination change.
async function supprimerMembership(membershipId: string): Promise<void> {
  const id = uuidSchema.safeParse(membershipId);
  if (!id.success) {
    redirect("/foyer?erreur=revocation");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", id.data);
  if (error) {
    redirect("/foyer?erreur=revocation");
  }
}

export async function revoquerMembre(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  revalidatePath("/foyer");
}

export async function quitterFoyer(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  redirect("/onboarding");
}
