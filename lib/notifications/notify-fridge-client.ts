import type { FridgeEvent } from "@/lib/notifications/fridge-payload";

// Déclencheur SERVEUR du push event-driven du frigo (Sprint 20). Appelé UNIQUEMENT par les
// server actions (app/frigo/actions.ts, `"use server"`) après une écriture réussie — il invoque
// l'Edge Function notify-fridge qui, elle, fait l'éventail vers l'AUTRE membre (ou l'auteur)
// sous service_role.
//
// WHY service_role ici (seule exception au principe « jamais de service_role côté Next ») :
// il ne sert PAS de client BD (la règle supabase-rls.md vise le client de données, qui doit
// rester sous RLS). C'est un APPEL SORTANT DE CONFIANCE : le bearer prouve à l'Edge Function
// qu'on est le serveur (même contrat d'auth que pg_cron → send-reminders). Ce module n'est
// importé que par des fichiers `"use server"` → il ne franchit jamais la frontière client, le
// secret ne fuit donc pas (on évite la dépendance `server-only` plutôt que d'en ajouter une).
//
// BEST-EFFORT ABSOLU : un échec ici (réseau, 5xx, secret absent) ne DOIT JAMAIS faire échouer
// l'écriture de la note (déjà persistée). Le live in-app (Realtime) reste la garantie primaire ;
// le push device est un bonus. On avale donc toute erreur.

function functionsBaseUrl(): string | null {
  const explicite = process.env.SUPABASE_FUNCTIONS_URL;
  if (explicite) {
    return explicite.replace(/\/$/, "");
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base.replace(/\/$/, "")}/functions/v1` : null;
}

/**
 * Notifie l'autre membre (event "nouvelle") ou l'auteur (event "lue"). Ne lève jamais :
 * absente en local (pas de secret) → no-op silencieux ; en prod → fire-and-forget.
 */
export async function declencherPushFrigo(noteId: string, event: FridgeEvent): Promise<void> {
  const base = functionsBaseUrl();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !serviceRole) {
    return; // non configuré (dev/local) — le push est un bonus, on n'insiste pas.
  }
  try {
    // Borne dure : le push ne doit jamais retarder la réponse de l'action au-delà de ~2,5 s,
    // même si l'endpoint Edge pend (la note est déjà persistée ; Realtime l'a déjà livrée).
    await fetch(`${base}/notify-fridge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ noteId, event }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // best-effort : on avale tout (réseau, 5xx, dépassement du délai). Realtime porte déjà
    // la notification live in-app ; le push device est un bonus.
  }
}
