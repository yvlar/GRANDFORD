# Carte d'embarquement — Sprint 16 : Notifications E2E prod + nettoyage push

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 15 livré : passe accessibilité & cibles tactiles (focus clavier global, cibles ≥ 44 px, feedback `useFormStatus`, parité daltonien de la grille mois, `/foyer` en cartes, tokens couleur sémantiques). Aucune migration BD, aucun changement moteur. Version 0.15.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> Note : la tâche « Notifications E2E prod » ci-dessous était la carte du Sprint 15 mais a été reportée (le Sprint 15 a porté sur l'UX/accessibilité à la demande de l'auteur). Elle reste la priorité recommandée et n'a **pas** été commencée.

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — Edge Functions utilisent `SUPABASE_SERVICE_ROLE` (serveur seulement, jamais `NEXT_PUBLIC_`).
2. `.claude/rules/securite-secrets.md` — VAPID clés : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (publique) + `VAPID_PRIVATE_KEY` (serveur seulement, jamais côté client).
3. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, envoi push réel à de vrais appareils = confirmation préalable.
4. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

- **`supabase/functions/send-reminders/`** : vérifier que la fonction existe (`ls supabase/functions/`) et inspecter son code — est-ce que `VAPID_PRIVATE_KEY` et `RESEND_API_KEY` sont lus depuis les secrets Vault ou les variables d'environnement ?
- **`push_subscriptions`** : `SELECT count(*) FROM push_subscriptions` en prod — combien d'abonnements actifs ? Y en a-t-il d'expirés (endpoint mort) ?
- **`reminders`** : `SELECT count(*) FROM reminders WHERE send_at <= now() AND sent_at IS NULL` — des rappels en attente non envoyés ?
- **`pg_cron`** : `SELECT * FROM cron.job WHERE jobname LIKE '%reminder%'` — job planifié actif ? Logs récents (`SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10`).
- **Réseau Edge → endpoints push** : une requête push vers un endpoint expiré renvoie HTTP 410 Gone (Chrome) ou 404 — la fonction les nettoie-t-elle ?

## TÂCHE — Sprint 16

### Option A — Validation E2E notifications + nettoyage (recommandé)

1. **Inspecter `send-reminders`** : lire `supabase/functions/send-reminders/index.ts` — vérifier le flux : récupère rappels dus → Web Push → repli courriel Resend → mark `sent_at`. Corriger si nécessaire.
2. **Nettoyage des endpoints expirés** : ajouter dans `send-reminders` (ou trigger séparé) la suppression des `push_subscriptions` dont le push retourne 410/404 — évite la croissance silencieuse de la table.
3. **Test d'intégration** (si possible en local avec Supabase CLI) : insérer un rappel dû → appeler la fonction → vérifier `sent_at` renseigné, 0 motif dans le payload (R7).
4. **Tests** : test unitaire payload (zéro motif, libellé générique si conjointe) — `lib/notifications/payload.test.ts` (à vérifier en session : déjà 4 tests). Test RLS `push_subscriptions` : un abonné ne voit pas les abonnements d'un autre.

### Option B — Facturation SaaS (FR-16, Stripe)

Premier foyer gratuit, suivants payants. Webhook Stripe → `households.plan` ; portail client. Complexité haute — à adresser quand un 2ᵉ foyer réel (hors prod du développeur) est prêt à payer.

### Gates

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- Si `send-reminders` est modifiée : `supabase functions deploy send-reminders` (après confirmation).

### Preuve d'acceptation observable

1. `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5` montre des exécutions récentes sans erreur.
2. Un rappel inséré manuellement (`INSERT INTO reminders ...`) est marqué `sent_at` après une exécution de la fonction.
3. `SELECT count(*) FROM push_subscriptions` est stable (pas de fuite d'abonnements expirés).
4. Payload inspecté (log ou test) : zéro motif d'absence — champ `body` = libellé générique uniquement (R7 ✅).

## SPRINTS SUGGÉRÉS

### v2+ — Notifications E2E prod (suivi Sprint 8) [recommandé pour Sprint 16]
**Objectif** : valider `send-reminders` en prod sur au moins 1 appareil réel ; nettoyer les endpoints push expirés.
**Complexité** : Faible-Moyenne (inspection + correctifs mineurs + test d'intégration)
**Justification** : FR-10 livré Sprint 7 mais jamais testé E2E sur plus d'un appareil — risque silencieux de rappels non reçus.
**Référence** : `supabase/functions/send-reminders/` (à vérifier en session) ; `push_subscriptions` (table existante, Sprint 2).

### v2+ — Facturation SaaS (FR-16)
**Objectif** : Stripe pour les foyers supplémentaires (1er foyer gratuit, suivants payants).
**Complexité** : Haute (Stripe webhooks, portail client, gates d'accès par foyer)
**Justification** : prérequis business pour tout 2ᵉ utilisateur externe ; FR-17 ✅ rend l'unité de facturation (foyer × gabarit) adressable.
**Référence** : FR-16 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise).
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation écarts existants)
**Justification** : non prioritaire sans accès réel à l'API et sans client cible ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Vérification visuelle de la passe accessibilité (suivi Sprint 15)
**Objectif** : confirmer en conditions réelles les correctifs UX du Sprint 15 — focus clavier, cibles ≥ 44 px, parité daltonien — via démo `/demo/horaire` et simulation deuteranopia (DevTools).
**Complexité** : Faible (vérification, pas de code — ou ajustements mineurs si un écart est constaté)
**Justification** : le Sprint 15 a validé par gates + build + revue, mais la preuve **visuelle** (capture d'écran, navigation clavier réelle) reste à constater sur appareil.
**Référence** : `app/globals.css` (`:focus-visible`), `components/horaire/vue-coup-doeil.tsx` (`ContenuCase`), `components/ui/bouton-soumettre.tsx`.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 16 (Notifications E2E prod) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint16-notifications-e2e (à créer depuis dev, après merge de sprint15).

Rappels non négociables :
- Réconcilier en premier : lire supabase/functions/send-reminders/index.ts ;
  vérifier push_subscriptions (SELECT count(*)) et reminders en attente.
- Jamais de motif dans le payload push (R7) — vérifier dans le code et les tests.
- VAPID_PRIVATE_KEY = secret serveur seulement, jamais NEXT_PUBLIC_.
- Si send-reminders est modifiée : déployer seulement après confirmation.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
