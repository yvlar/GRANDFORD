// Edge Function — envoi des rappels dus (FR-10, Sprint 7).
// Réveillée chaque heure par pg_cron (architecture.md:121 ; planification documentée
// dans README.md — active seulement sur Supabase Cloud, Sprint 8).
//
// Contexte d'exécution : Deno (npm:), HORS du tsc racine (tsconfig.json l'exclut).
// Non exécutable localement (contrainte Docker, Sprints 2-7) : la logique testable
// vit dans lib/notifications/ (échéances, payload) — ici, seulement l'orchestration
// d'I/O sous service_role (contournement de RLS VOULU et serveur seulement,
// règle supabase-rls.md).
//
// R7 : le payload vient de reminderPayload (date + horizon, structurellement sans
// motif) ; la fonction ne lit JAMAIS exception_private ; les logs ne portent ni
// courriel, ni endpoint, ni date d'écart — des compteurs et des ids, rien d'autre.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { type ReminderLead, reminderPayload } from "../../../lib/notifications/payload.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";

// WHY 50 : pg_cron repasse dans l'heure — un lot borné garde la fonction sous les
// limites de temps d'exécution, le reste part au prochain réveil.
const BATCH = 50;
// WHY 24 h : un rappel qu'on n'a pas réussi à livrer pendant une journée entière est
// périmé (la prochaine échéance arrive) — on le clôt plutôt que de réessayer sans fin.
const STALE_MS = 24 * 60 * 60 * 1000;

interface DueReminder {
  id: string;
  household_id: string;
  profile_id: string | null;
  lead: ReminderLead;
  remind_at: string;
  exceptions: { on_date: string } | null;
}

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

Deno.serve(async (req) => {
  // verify_jwt laisse passer la clé anon : on exige la clé service (pg_cron l'envoie).
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return Response.json({ error: "non autorisé" }, { status: 401 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const { data: dus, error } = await supabase
    .from("reminders")
    .select("id, household_id, profile_id, lead, remind_at, exceptions(on_date)")
    .is("sent_at", null)
    .lte("remind_at", now.toISOString())
    .order("remind_at")
    .limit(BATCH);
  if (error) {
    console.error(`lecture des rappels dus échouée : ${error.code ?? "?"}`);
    return Response.json({ error: "lecture échouée" }, { status: 500 });
  }

  let envoyes = 0;
  let reportes = 0;
  for (const rappel of (dus ?? []) as unknown as DueReminder[]) {
    const onDate = rappel.exceptions?.on_date;
    const perime = now.getTime() - new Date(rappel.remind_at).getTime() > STALE_MS;
    // Sans écart (FK nulle) ou périmé : on clôt sans envoyer, sinon retry infini.
    let livre = false;
    if (onDate && !perime) {
      livre = await deliverToHousehold(supabase, rappel, onDate);
    }
    if (livre || perime || !onDate) {
      await supabase.from("reminders").update({ sent_at: now.toISOString() }).eq("id", rappel.id);
      envoyes += livre ? 1 : 0;
    } else {
      // Aucune livraison (panne push ET courriel) : sent_at reste nul, pg_cron
      // retentera au prochain réveil — c'est le filet de fiabilité (R11).
      reportes += 1;
    }
  }

  console.info(`rappels traités : ${envoyes} livrés, ${reportes} reportés`);
  return Response.json({ dus: dus?.length ?? 0, livres: envoyes, reportes });
});

/**
 * Éventail des destinataires : profile_id nul = TOUS les membres du foyer
 * (convention de la table, FR-10 bidirectionnel) ; renseigné = ce membre seul.
 * Push d'abord, repli courriel (R11).
 */
async function deliverToHousehold(
  supabase: ReturnType<typeof createClient>,
  rappel: DueReminder,
  onDate: string,
): Promise<boolean> {
  const payload = reminderPayload(onDate, rappel.lead);
  const { data: membres } = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("household_id", rappel.household_id);
  const destinataires = (membres ?? []).filter(
    (m) => rappel.profile_id === null || m.profile_id === rappel.profile_id,
  );

  let livre = false;
  for (const membre of destinataires) {
    const pushOk = await sendPush(supabase, membre.profile_id as string, payload);
    const emailOk = pushOk
      ? false
      : await sendEmail(supabase, membre.profile_id as string, payload);
    livre = livre || pushOk || emailOk;
  }
  return livre;
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  profileId: string,
  payload: ReturnType<typeof reminderPayload>,
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
  payload: ReturnType<typeof reminderPayload>,
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
