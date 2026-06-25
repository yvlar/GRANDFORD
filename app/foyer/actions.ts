"use server";

import { frequencePayeSchema } from "@/lib/schedule/payday";
import { gabaritNomSchema, trouverGabarit } from "@/lib/schedule/predefined-templates";
import { createClient } from "@/lib/supabase/server";
import { cheminInterneSchema, dateCivileSchema, equipeSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const nomProfilSchema = z.string().trim().max(120);

const reglagePayeSchema = z.object({
  anchorDate: dateCivileSchema,
  frequence: frequencePayeSchema,
});

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

/**
 * Le travailleur règle son jour de paye (Sprint 17) : une paye connue (ancre) + une
 * fréquence. Worker-private — la RLS (payday_settings_owner_only : profile_id = auth.uid())
 * réserve l'écriture au travailleur ; la conjointe n'a ni le formulaire ni l'accès BD (R7).
 * Upsert : une seule config par travailleur/foyer (PK household_id,profile_id).
 */
export async function definirReglagePaye(householdId: string, formData: FormData): Promise<void> {
  const hid = uuidSchema.safeParse(householdId);
  const reglage = reglagePayeSchema.safeParse({
    anchorDate: formData.get("anchorDate"),
    frequence: formData.get("frequence"),
  });
  if (!hid.success || !reglage.success) {
    redirect("/foyer?erreur=paye");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase.from("payday_settings").upsert(
    {
      household_id: hid.data,
      profile_id: user.id,
      anchor_date: reglage.data.anchorDate,
      frequence: reglage.data.frequence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,profile_id" },
  );
  if (error) {
    redirect("/foyer?erreur=paye");
  }
  revalidatePath("/");
  revalidatePath("/foyer");
}

export async function mettreAJourNom(formData: FormData): Promise<void> {
  const raw = nomProfilSchema.safeParse(formData.get("nom"));
  if (!raw.success) {
    redirect("/foyer?erreur=nom");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: raw.data || null })
    .eq("id", user.id);
  if (error) {
    redirect("/foyer?erreur=nom");
  }
  revalidatePath("/foyer");
  revalidatePath("/");
}

export async function revoquerMembre(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  revalidatePath("/foyer");
}

export async function quitterFoyer(membershipId: string): Promise<void> {
  await supprimerMembership(membershipId);
  redirect("/onboarding");
}

/**
 * Met à jour le gabarit actif du foyer (FR-17). Réservé au propriétaire du foyer ;
 * la RLS (cycle_templates_update : is_household_owner) bloque silencieusement
 * toute autre session. Le nom du gabarit est validé contre la liste prédéfinie.
 */
export async function changerGabarit(householdId: string, formData: FormData): Promise<void> {
  const hid = uuidSchema.safeParse(householdId);
  const nom = gabaritNomSchema.safeParse(formData.get("gabaritNom"));
  if (!hid.success || !nom.success) {
    redirect("/foyer?erreur=gabarit");
  }

  const gabarit = trouverGabarit(nom.data);
  if (!gabarit) {
    redirect("/foyer?erreur=gabarit");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { error } = await supabase
    .from("cycle_templates")
    .update({
      name: gabarit.name,
      anchor_date: gabarit.template.anchorDate,
      pattern: [...gabarit.template.pattern],
      day_start: gabarit.template.dayHours.start,
      day_end: gabarit.template.dayHours.end,
      night_start: gabarit.template.nightHours.start,
      night_end: gabarit.template.nightHours.end,
    })
    .eq("household_id", hid.data)
    .eq("is_active", true);

  if (error) {
    redirect("/foyer?erreur=gabarit");
  }
  revalidatePath("/foyer");
  revalidatePath("/");
}
