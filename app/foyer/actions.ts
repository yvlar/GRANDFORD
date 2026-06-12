"use server";

import { createClient } from "@/lib/supabase/server";
import { cheminInterneSchema, equipeSchema, uuidSchema } from "@/lib/validation";
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

/**
 * Le travailleur choisit (ou change) son équipe A/B/C/D — pré-requis de la vue
 * « coup d'œil » (Sprint 4). Upsert : une seule affectation par travailleur/foyer
 * (contrainte unique en BD) ; la RLS limite l'écriture aux membres du foyer.
 * `retour` = page d'origine (accueil ou foyer), validée comme chemin interne.
 */
export async function definirEquipe(
  householdId: string,
  retour: string,
  formData: FormData,
): Promise<void> {
  const destination = cheminInterneSchema.safeParse(retour).success ? retour : "/";
  const hid = uuidSchema.safeParse(householdId);
  const equipe = equipeSchema.safeParse(formData.get("equipe"));
  if (!hid.success || !equipe.success) {
    redirect(`${destination}?erreur=equipe`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("worker_assignments").upsert(
    {
      household_id: hid.data,
      profile_id: user.id,
      team: equipe.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,profile_id" },
  );
  if (error) {
    redirect(`${destination}?erreur=equipe`);
  }
  revalidatePath("/");
  revalidatePath("/foyer");
}

export async function revoquerMembre(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  revalidatePath("/foyer");
}

export async function quitterFoyer(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  redirect("/onboarding");
}
