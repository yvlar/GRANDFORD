# Mise en ligne — runbook

> Procédure de go-live (Supabase Cloud + Vercel) et des filets. **Chaque étape est
> une action distante, facturable ou externe** → confirmation de l'auteur avant de la
> lancer (`.claude/rules/autonomie-confirmations.md`). Région **CA/US-est** obligatoire
> (Loi 25). État courant : `ROADMAP.md` — ce fichier ne le duplique pas.

## 0. Pré-requis (sur le poste de l'auteur)

- CLI : `supabase` (déploiement, `db push`, secrets, functions), `vercel` (facultatif),
  `web-push` (génération VAPID). Aucun n'est présent dans l'environnement distant Claude.
- Clés à générer : VAPID (`web-push generate-vapid-keys`), Resend (clé API + domaine
  expéditeur vérifié), Sentry DSN. Noms attendus : `.env.example`.

## 1. Supabase Cloud

1. Créer le projet en **région CA (ca-central-1) ou US-est** (Loi 25).
2. Lier et pousser le schéma (les 6 migrations de `supabase/migrations/`) :
   ```sh
   supabase link --project-ref <ref>
   supabase db push
   supabase gen types typescript --linked > lib/database.types.ts   # doit être identique
   ```
3. **Auth (dette GoTrue)** : dans Authentication → Email, configurer le SMTP custom
   (Resend) pour le lien magique ; activer le provider Google (OAuth) avec l'URL de
   redirection de prod. Sans SMTP custom, le lien magique reste limité au test Supabase.
4. **Edge Function** `send-reminders` — secrets puis déploiement
   (détail et SQL pg_cron : `supabase/functions/send-reminders/README.md`) :
   ```sh
   supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=… \
                        RESEND_API_KEY=… RESEND_FROM="GRANDFORD <rappels@…>"
   supabase functions deploy send-reminders
   ```
   ⚠️ **Premier deploy** : vérifier l'import relatif `../../../lib/notifications/payload.ts`
   (`index.ts:16`). S'il est refusé par le bundler → plan B du README (déplacer vers
   `supabase/functions/_shared/payload.ts`, mettre à jour les imports).
5. **pg_cron + pg_net** : activer les extensions (Database → Extensions), puis jouer
   UNE fois le `cron.schedule(...)` du README. Aucune migration locale (voulu).

## 2. Vercel

1. Importer le dépôt ; build Next.js standard (`next build`, sortie standalone).
2. Variables d'environnement de prod (l'app n'en lit que 3 — vérifié, `grep process.env`) :
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
   - **`GRANDFORD_DEMO` ne doit JAMAIS être défini** (sinon `/demo/horaire` s'ouvre sans auth).
   - Le `SUPABASE_SERVICE_ROLE` n'est **pas** une variable Vercel : il vit côté Edge
     (injecté par la plateforme) et dans les tests locaux uniquement.
3. Domaine de prod + URL de redirection OAuth/magic-link cohérentes avec Supabase Auth.

## 3. Solder la dette « jamais tourné en vrai » (preuves observées)

Chaque point est **constaté**, pas supposé (`prompt-mise-a-jour-roadmap.md` → Preuve d'acceptation) :

1. Connexion par **lien magique** reçu par courriel sur l'URL de prod.
2. Capture d'un écart à **J+40** sur le site réel → **3 `reminders`** en BD Cloud
   (`select lead, remind_at from reminders order by remind_at`).
3. **Push reçu sur l'iPhone réel** (PWA installée via « Sur l'écran d'accueil ») par un
   rappel de test ; le payload affiché ne porte **aucun motif** (R7).
4. **Courriel de repli Resend** reçu pour un compte sans abonnement push.
5. Sentry reçoit un événement de test ; UptimeRobot voit le site UP ; un artefact
   `pg_dump` daté existe.

## 4. Filets

- **Sauvegarde quotidienne** (`.github/workflows/backup.yml`, livrée) : ajouter le
  secret de dépôt **`SUPABASE_DB_URL`** (chaîne Postgres du Cloud, `?sslmode=require`).
  Déclencher une fois à la main (Actions → Sauvegarde BD → Run) et vérifier l'artefact
  daté. La restauration est prouvée hors-ligne : `bash scripts/verifier-restauration.sh`
  (NFR-11 ; round-trip du schéma réel contre le Postgres local — objets, **définitions
  de policies + privilèges**, et données du cœur). **Cible de restauration** : un projet
  Supabase (ou un cluster où `anon`/`authenticated`/`service_role` préexistent) — un
  `pg_dump` mono-base porte les GRANT vers ces rôles mais **pas les rôles eux-mêmes**
  (globaux au cluster) ; sur un Postgres nu, recréer ces rôles avant `pg_restore`.
- **Sentry** : capturer les erreurs **sans donnée personnelle ni motif** (R7) —
  `sendDefaultPii: false`, et un `beforeSend` qui ne laisse passer ni courriel, ni
  contenu d'écart, ni date d'absence. Voir la question ouverte en bas.
- **UptimeRobot** : moniteur HTTP(s) sur l'URL de prod (uptime **et** réveil du projet
  Supabase gratuit).

## 5. Garde-fous permanents

- `GRANDFORD_DEMO` : jamais en prod (cf. §2).
- **R7** : aucun motif d'absence dans Sentry, les logs, les notifications, les courriels.
- **Loi 25** : données en région CA/US-est ; dès le 2ᵉ foyer → politique de
  confidentialité + consentement + responsable désigné (`.claude/rules/securite-secrets.md`).

## Question ouverte (à trancher avec l'auteur)

Intégration **Sentry** : `@sentry/nextjs` apporte une auto-instrumentation qui peut
capturer des données de requête (risque R7). Option A — scaffolding R7-strict
(`beforeSend` filtrant) maintenant ; Option B — wiring fait à la main pendant le
go-live, couplé au DSN réel. À décider avant d'ajouter la dépendance.
