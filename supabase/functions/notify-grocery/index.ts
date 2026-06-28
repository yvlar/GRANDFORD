// Edge Function — push event-driven d'une liste d'épicerie (Sprint 25).
// Déclenchée par la server action (app/epicerie/actions.ts) après une écriture réussie :
//   • event "nouvelle" → notifie l'AUTRE membre (≠ acteur) qu'une nouvelle liste l'attend ;
//   • event "coche"    → notifie l'AUTRE membre que des articles ont été cochés (anti-spam :
//     le RPC cocher_element_epicerie ne demande le push qu'une fois par fenêtre de cooldown).
//
// Le destinataire est TOUJOURS « l'autre membre du foyer » relatif à `actorId` (l'acteur,
// fourni par la server action authentifiée — service_role de confiance). Un foyer est un
// couple : il y a au plus un autre membre.
//
// Contexte d'exécution : Deno (npm:), HORS du tsc racine (tsconfig.json l'exclut).
// Non exécutable localement (contrainte Docker) : la logique testable (payload) vit dans
// lib/notifications/grocery-payload.ts ; ici, seulement l'orchestration d'I/O sous
// service_role (contournement de RLS VOULU et serveur seulement, supabase-rls.md).
//
// R7 : le payload vient de groceryPayload (type d'événement seul, structurellement SANS
// libellé d'article) ; la fonction ne lit JAMAIS un label pour le pousser ; les logs ne
// portent ni courriel, ni endpoint, ni contenu — des compteurs et des ids, rien d'autre.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { type GroceryEvent, groceryPayload } from "../_shared/grocery-payload.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

interface GroceryListRow {
  household_id: string;
}

Deno.serve(async (req) => {
  // verify_jwt laisse passer la clé anon : on exige la clé service (la server action
  // l'envoie côté serveur — jamais exposée au client).
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  let corps: { listId?: unknown; event?: unknown; actorId?: unknown };
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "corps illisible" }, { status: 400 });
  }
  const listId = typeof corps.listId === "string" ? corps.listId : null;
  const actorId = typeof corps.actorId === "string" ? corps.actorId : null;
  const event = corps.event === "nouvelle" || corps.event === "coche" ? corps.event : null;
  if (!listId || !event || !actorId) {
    return Response.json({ error: "listId/event/actorId manquant" }, { status: 400 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: liste, error } = await supabase
    .from("grocery_lists")
    .select("household_id")
    .eq("id", listId)
    .maybeSingle<GroceryListRow>();
  if (error || !liste) {
    // Liste disparue (retirée entre l'écriture et le push) : rien à notifier, pas une erreur.
    return Response.json({ livre: false, raison: "liste absente" });
  }

  const destinataire = await resolveDestinataire(supabase, liste.household_id, actorId);
  if (!destinataire) {
    return Response.json({ livre: false, raison: "aucun destinataire" });
  }

  const payload = groceryPayload(event);
  const pushOk = await sendPush(supabase, destinataire, payload);
  const emailOk = pushOk ? false : await sendEmail(supabase, destinataire, payload);

  console.info(`liste d'épicerie (${event}) : push=${pushOk} courriel=${emailOk}`);
  return Response.json({ livre: pushOk || emailOk });
});

/**
 * Destinataire = l'AUTRE membre du foyer (≠ acteur). Un foyer est un couple : il y a au plus
 * un autre membre (celui qui n'a pas créé la liste / coché l'article).
 */
async function resolveDestinataire(
  supabase: ReturnType<typeof createClient>,
  householdId: string,
  actorId: string,
): Promise<string | null> {
  const { data: membres } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("household_id", householdId)
    .neq("profile_id", actorId);
  return (membres?.[0]?.profile_id as string | undefined) ?? null;
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  payload: ReturnType<typeof groceryPayload>,
): Promise<boolean> {
  const { data: appareils } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("profile_id", profileId);

  let livre = false;
  for (const appareil of (appareils ?? []) as unknown as Subscription[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: appareil.endpoint,
          keys: { p256dh: appareil.p256dh, auth: appareil.auth_key },
        },
        JSON.stringify(payload),
      );
      livre = true;
    } catch (err) {
      // 404/410 = abonnement mort (appareil désabonné par le navigateur) : on le purge.
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", appareil.id);
      } else {
        console.warn(`push refusé (statut ${statusCode ?? "?"})`);
      }
    }
  }
  return livre;
}

async function sendEmail(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  payload: ReturnType<typeof groceryPayload>,
): Promise<boolean> {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return false;
  }
  // Le courriel vit dans auth.users (jamais dans profiles — minimisation) : seul
  // service_role peut le lire, via l'API admin.
  const { data, error } = await supabase.auth.admin.getUserById(profileId);
  const to = data?.user?.email;
  if (error || !to) {
    return false;
  }
  const reponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: payload.title,
      text: payload.body,
    }),
  });
  if (!reponse.ok) {
    console.warn(`courriel de repli refusé (statut ${reponse.status})`);
  }
  return reponse.ok;
}
