import type { GroceryEvent } from "@/lib/notifications/grocery-payload";

// Déclencheur SERVEUR du push event-driven de l'épicerie (Sprint 25). Appelé UNIQUEMENT par
// les server actions (app/epicerie/actions.ts, `"use server"`) après une écriture réussie —
// il invoque l'Edge Function notify-grocery qui, elle, fait l'éventail vers l'AUTRE membre
// (≠ acteur) sous service_role. Calque notify-fridge-client.ts (Sprint 20).
//
// WHY service_role ici (même exception assumée que le frigo) : ce n'est PAS un client BD
// (la règle supabase-rls.md vise le client de données sous RLS) mais un APPEL SORTANT DE
// CONFIANCE — le bearer prouve à l'Edge qu'on est le serveur. Ce module n'est importé que
// par des fichiers `"use server"` → le secret ne franchit jamais la frontière client.
//
// BEST-EFFORT ABSOLU : un échec ici (réseau, 5xx, secret absent) ne DOIT JAMAIS faire échouer
// l'écriture (déjà persistée). Le live in-app (Realtime) reste la garantie primaire ; le push
// device est un bonus. On avale donc toute erreur.

function functionsBaseUrl(): string | null {
  const explicite = process.env.SUPABASE_FUNCTIONS_URL;
  if (explicite) {
    return explicite.replace(/\/$/, "");
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base.replace(/\/$/, "")}/functions/v1` : null;
}

/**
 * Notifie l'AUTRE membre (≠ `actorId`) d'un événement d'épicerie. Ne lève jamais : absente
 * en local (pas de secret) → no-op silencieux ; en prod → fire-and-forget.
 */
export async function declencherPushEpicerie(
  listId: string,
  event: GroceryEvent,
  actorId: string,
): Promise<void> {
  const base = functionsBaseUrl();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE;
  if (!base || !serviceRole) {
    return; // non configuré (dev/local) — le push est un bonus, on n'insiste pas.
  }
  try {
    // Borne dure : le push ne doit jamais retarder la réponse de l'action au-delà de ~2,5 s,
    // même si l'endpoint Edge pend (l'écriture est déjà persistée ; Realtime l'a déjà livrée).
    await fetch(`${base}/notify-grocery`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listId, event, actorId }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // best-effort : on avale tout (réseau, 5xx, dépassement du délai). Realtime porte déjà
    // la notification live in-app ; le push device est un bonus.
  }
}
