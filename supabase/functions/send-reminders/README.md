# send-reminders — envoi des rappels dus (FR-10)

Réveillée **chaque heure** par pg_cron : lit les `reminders` dus (`sent_at is null`,
`remind_at <= now()`), envoie le Web Push à chaque appareil des membres du foyer,
replie sur un courriel Resend pour les membres sans push, puis marque `sent_at`.

**R7** : le contenu vient de `lib/notifications/payload.ts` (date + horizon,
structurellement sans motif). La fonction ne touche jamais `exception_private`.

## État (Sprint 7)

- ❌ **Jamais exécutée** : ni l'Edge Runtime ni Docker ne tournent dans
  l'environnement de dev (contrainte documentée depuis le Sprint 2). Le pipeline est
  prouvé au niveau BD (`supabase/tests/reminders.test.ts`) et fonctions pures
  (`lib/notifications/*.test.ts`).
- Déploiement, exécution réelle et pg_cron : **Sprint 8** (Supabase Cloud).
- ⚠️ À vérifier au déploiement : l'import relatif `../../../lib/notifications/payload.ts`
  hors du dossier `functions/`. Si le bundler le refuse, déplacer le fichier vers
  `supabase/functions/_shared/payload.ts` et mettre à jour les imports (celui-ci,
  `lib/notifications/echeances.ts`, `app/sw.ts`, les tests).

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
