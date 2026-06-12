"use server";

import { fr } from "@/lib/i18n/fr";
import { type EtatCapture, TUILES, capturePlan } from "@/lib/schedule/capture";
import { createClient } from "@/lib/supabase/server";
import { dateCivileSchema, equipeSchema, uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Capture et annulation d'un écart (FR-4/FR-5/FR-7, Sprint 5). Même partage des
// responsabilités que app/foyer/actions.ts : Zod valide la FORME, la RLS tranche le
// DROIT (membre du foyer pour l'écart, propriétaire seul pour le motif). L'écriture
// écart + motif est atomique via la RPC create_exception_with_motif (SECURITY
// INVOKER). R7 : le motif ne sort jamais d'ici — ni log, ni message d'erreur, ni URL.

const captureSchema = z.object({ date: dateCivileSchema, tuile: z.enum(TUILES) });

export async function capturerEcart(
  householdId: string,
  date: string,
  tuile: string,
): Promise<EtatCapture> {
  const hid = uuidSchema.safeParse(householdId);
  const saisie = captureSchema.safeParse({ date, tuile });
  if (!hid.success || !saisie.success) {
    return { ok: false, erreur: fr.capture.erreurCapture };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // L'équipe vient de la BD (jamais du client) : c'est elle qui fixe le quart
  // résultant (OT = quart d'identité ; échange = quart opposé).
  const assignmentRes = await supabase
    .from("worker_assignments")
    .select("team")
    .eq("household_id", hid.data)
    .eq("profile_id", user.id)
    .maybeSingle();
  const equipe = equipeSchema.safeParse(assignmentRes.data?.team);
  if (assignmentRes.error || !equipe.success) {
    return { ok: false, erreur: fr.capture.erreurCapture };
  }

  const plan = capturePlan(saisie.data.tuile, equipe.data);
  const { error } = await supabase.rpc("create_exception_with_motif", {
    p_household_id: hid.data,
    p_on_date: saisie.data.date,
    p_effect: plan.effect,
    p_motif: plan.motif,
    p_shift: plan.shift ?? undefined,
  });
  if (error) {
    // GF005 = déjà un écart ce jour-là (SQLSTATE stable, cf. migration sprint05).
    const erreur = error.code === "GF005" ? fr.capture.erreurDoublon : fr.capture.erreurCapture;
    return { ok: false, erreur };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}

export async function supprimerEcart(exceptionId: string): Promise<EtatCapture> {
  const id = uuidSchema.safeParse(exceptionId);
  if (!id.success) {
    return { ok: false, erreur: fr.capture.erreurSuppression };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // On ne supprime que SES propres écarts (profile_id = soi) — la RLS « membre du
  // foyer » est plus permissive, mais l'annulation est un geste du travailleur sur
  // sa propre saisie. Le motif suit par cascade (FK de exception_private).
  const { data, error } = await supabase
    .from("exceptions")
    .delete()
    .eq("id", id.data)
    .eq("profile_id", user.id)
    .select("id");
  if (error || data.length === 0) {
    return { ok: false, erreur: fr.capture.erreurSuppression };
  }

  revalidatePath("/");
  return { ok: true, erreur: null };
}
