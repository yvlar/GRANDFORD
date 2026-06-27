// Edge Function — push event-driven d'une note du frigo (Sprint 20).
// Déclenchée par la server action (app/frigo/actions.ts) après une écriture réussie :
//   • event "nouvelle" → notifie l'AUTRE membre qu'une note l'attend ;
//   • event "modifiee" → notifie l'AUTRE membre qu'une note déjà lue a changé de contenu ;
//   • event "reponse"  → notifie l'AUTRE membre qu'une réponse l'attend (Sprint 23) ;
//   • event "lue"      → notifie l'AUTEUR que sa note a été lue (accusé de lecture).
//
// Contexte d'exécution : Deno (npm:), HORS du tsc racine (tsconfig.json l'exclut).
// Non exécutable localement (contrainte Docker, Sprints 2-7) : la logique testable
// (payload) vit dans lib/notifications/fridge-payload.ts ; ici, seulement l'orchestration
// d'I/O sous service_role (contournement de RLS VOULU et serveur seulement, supabase-rls.md).
//
// R7 : le payload vient de fridgePayload (type d'événement seul, structurellement SANS
// contenu de note) ; la fonction ne lit JAMAIS le body pour le pousser ; les logs ne
// portent ni courriel, ni endpoint, ni corps — des compteurs et des ids, rien d'autre.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { type FridgeEvent, fridgePayload } from "../_shared/fridge-payload.ts";

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

interface FridgeNoteRow {
  household_id: string;
  author_id: string;
}

Deno.serve(async (req) => {
  // verify_jwt laisse passer la clé anon : on exige la clé service (la server action
  // l'envoie côté serveur — jamais exposée au client).
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  let corps: { noteId?: unknown; event?: unknown };
  try {
    corps = await req.json();
  } catch {
    return Response.json({ error: "corps illisible" }, { status: 400 });
  }
  const noteId = typeof corps.noteId === "string" ? corps.noteId : null;
  const event =
    corps.event === "nouvelle" ||
    corps.event === "lue" ||
    corps.event === "modifiee" ||
    corps.event === "reponse"
      ? corps.event
      : null;
  if (!noteId || !event) {
    return Response.json({ error: "noteId/event manquant" }, { status: 400 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: note, error } = await supabase
    .from("fridge_notes")
    .select("household_id, author_id")
    .eq("id", noteId)
    .maybeSingle<FridgeNoteRow>();
  if (error || !note) {
    // Note disparue (retirée entre l'écriture et le push) : rien à notifier, pas une erreur.
    return Response.json({ livre: false, raison: "note absente" });
  }

  const destinataire = await resolveDestinataire(supabase, note, event);
  if (!destinataire) {
    return Response.json({ livre: false, raison: "aucun destinataire" });
  }

  const payload = fridgePayload(event);
  const pushOk = await sendPush(supabase, destinataire, payload);
  const emailOk = pushOk ? false : await sendEmail(supabase, destinataire, payload);

  console.info(`note du frigo (${event}) : push=${pushOk} courriel=${emailOk}`);
  return Response.json({ livre: pushOk || emailOk });
});

/**
 * « lue » → l'auteur lui-même ; « nouvelle »/« modifiée »/« reponse » → l'AUTRE membre du
 * foyer (≠ auteur). Un foyer est un couple : pour ces trois derniers, il y a au plus un
 * autre membre (le destinataire de la réponse = celui qui n'a PAS écrit la réponse).
 */
async function resolveDestinataire(
  supabase: ReturnType<typeof createClient>,
  note: FridgeNoteRow,
  event: FridgeEvent,
): Promise<string | null> {
  if (event === "lue") {
    return note.author_id;
  }
  const { data: membres } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("household_id", note.household_id)
    .neq("profile_id", note.author_id);
  return (membres?.[0]?.profile_id as string | undefined) ?? null;
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  payload: ReturnType<typeof fridgePayload>,
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
  payload: ReturnType<typeof fridgePayload>,
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
