# send-reminders — envoi des rappels dus (FR-10)

Réveillée **chaque heure** par pg_cron : lit les `reminders` dus (`sent_at is null`,
`remind_at <= now()`), envoie le Web Push à chaque appareil des membres du foyer,
replie sur un courriel Resend pour les membres sans push, puis marque `sent_at`.

**R7** : le contenu vient de `lib/notifications/payload.ts` (date + horizon,
structurellement sans motif). La fonction ne touche jamais `exception_private`.

## État

- Code **complet** : flux lecture des dus → Web Push → repli courriel Resend →
  `sent_at` ; les abonnements morts (HTTP 404/410) sont **purgés** au passage
  (`index.ts`, `sendPush`). Pipeline prouvé au niveau BD
  (`supabase/tests/reminders.test.ts`) et fonctions pures
  (`lib/notifications/*.test.ts`).
- **Validation E2E prod** (déploiement, `pg_cron`, push réel à un appareil,
  observation de `cron.job_run_details` / `sent_at`) : tâche **opérationnelle**, à
  faire depuis la machine de l'auteur (creds prod + confirmations) — non réalisable
  en conteneur de dev (ni Edge Runtime ni Docker, contrainte documentée Sprint 2).
- Payload : la source vit dans `lib/notifications/payload.ts` (app Next.js + tests) ;
  la **copie Edge** dans `_shared/payload.ts` (contrainte zéro-import Deno). Les deux
  sont gardées identiques par `lib/notifications/payload-parity.test.ts` — toute
  évolution doit toucher LES DEUX fichiers, sous peine d'échec de la suite.

## Secrets (Edge Function — `supabase secrets set`)

| Clé | Rôle |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Signature Web Push (la privée ne sort JAMAIS du serveur) |
| `RESEND_API_KEY` / `RESEND_FROM` | Courriel de repli (R11) |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées par la plateforme.
L'appel exige la clé service en `Authorization` (verify_jwt accepterait la clé anon).

## Déploiement + planification (Sprint 8, sur Supabase Cloud)

```sh
supabase functions deploy send-reminders
```

```sql
-- pg_cron + pg_net (extensions à activer sur le projet Cloud). À jouer UNE fois.
-- Minute 5 : laisse passer l'heure pile (09:00 locale) avant la lecture des dus.
select cron.schedule(
  'send-reminders-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://<ref-du-projet>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'service_role_key')
    )
  );
  $$
);
```

(La clé service est lue du Vault Supabase — jamais en clair dans le SQL du cron.)
