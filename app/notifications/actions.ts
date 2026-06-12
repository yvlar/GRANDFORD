"use server";

import { fr } from "@/lib/i18n/fr";
import type { EtatRappels, PushSubscriptionInput } from "@/lib/notifications/push";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { redirect } from "next/navigation";
import { z } from "zod";

// Abonnement Web Push (FR-10, Sprint 7). Même partage des responsabilités que
// app/ecarts/actions.ts : Zod valide la FORME, la RLS tranche le DROIT
// (push_subscriptions_own : profile_id = soi ; reminders restent côté RPC/Edge).
// Minimisation (Loi 25, securite-secrets.md) : on ne stocke QUE ce que l'envoi
// exige (endpoint + clés) — pas de user_agent, rien ne l'affiche.

const abonnementSchema = z.object({
  // L'endpoint est une URL du service push du navigateur — toujours HTTPS.
  endpoint: z.url().startsWith("https://").max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
});

export async function enregistrerAbonnementPush(
  householdId: string,
  abonnement: PushSubscriptionInput,
): Promise<EtatRappels> {
  const hid = uuidSchema.safeParse(householdId);
  const abo = abonnementSchema.safeParse(abonnement);
  if (!hid.success || !abo.success) {
    return { ok: false, erreur: fr.rappels.erreur };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Upsert sur l'endpoint (unique) : ré-activer sur le même appareil remplace les
  // clés au lieu d'empiler des doublons. Si l'endpoint appartenait à un autre
  // compte, la RLS refuse l'update — on retombe en erreur générique.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      household_id: hid.data,
      profile_id: user.id,
      endpoint: abo.data.endpoint,
      p256dh: abo.data.p256dh,
      auth_key: abo.data.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return { ok: false, erreur: fr.rappels.erreur };
  }
  return { ok: true, erreur: null };
}

export async function supprimerAbonnementPush(endpoint: string): Promise<EtatRappels> {
  const cible = abonnementSchema.shape.endpoint.safeParse(endpoint);
  if (!cible.success) {
    return { ok: false, erreur: fr.rappels.erreur };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // Idempotent : 0 ligne supprimée n'est pas une erreur (l'appareil était déjà
  // désabonné côté serveur) — l'état visé est atteint.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", cible.data);
  if (error) {
    return { ok: false, erreur: fr.rappels.erreur };
  }
  return { ok: true, erreur: null };
}
