# Carte d'embarquement — Sprint 21 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 20 livré : **Note du frigo** (`/frigo`) — tableau de notes partagé du foyer, accusés de lecture live (Realtime), push device event-driven, retrait auteur-seul. Table `fridge_notes` (migration `supabase/migrations/20260626120000_sprint20_fridge_notes.sql`) ; RPC `marquer_note_frigo_lue` (SECURITY DEFINER) ; Edge `supabase/functions/notify-fridge/index.ts` ; composant `components/frigo/tableau-frigo.tsx` ; page `app/frigo/page.tsx` ; actions `app/frigo/actions.ts`. Version 0.20.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 20)** : feature dirigée par l'auteur, hors FR-1→17. Push device + Realtime **construits mais non vérifiables en conteneur** (creds + déploiement Edge = tâche opérationnelle, comme l'E2E push depuis Sprint 16). Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (13 tests frigo verts contre une vraie BD ce sprint). La **garde de parité** des miroirs TS↔Deno est la lignée Sprints 16/18/20 — réutiliser ce patron pour tout nouveau miroir.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Appliquer les migrations Sprints 17 + 19 + 20 sur Supabase Cloud** (après confirmation) : `payday_settings` (17), `sleep_defaults.enabled` (19) et `fridge_notes` + RPC `marquer_note_frigo_lue` + publication Realtime (20) ne sont pas encore en prod. `supabase migration up`, puis `node scripts/gen-types.mjs <db_url_cloud>` pour régénérer `lib/database.types.ts` avec `__InternalSupabase` + `graphql_public` réels (les ajouts hand-edit `fridge_notes` et la fonction seront confirmés par le générateur). Vérifier ensuite : `alter publication supabase_realtime` a bien pris la table (sinon le live ne marche pas en prod).
**Déployer l'Edge `notify-fridge`** (Sprint 20) + ses secrets (VAPID/Resend/service-role déjà posés pour `send-reminders`), et poser côté Vercel `SUPABASE_SERVICE_ROLE` (= **même valeur** que le `SUPABASE_SERVICE_ROLE_KEY` injecté dans l'Edge — sinon push 401 silencieux) + éventuellement `SUPABASE_FUNCTIONS_URL`. Sans ça, le push du frigo reste un no-op ; le live Realtime, lui, marche dès la migration appliquée.
**+ rappel Sprint 16** : validation E2E des notifications de rappel en prod (`cron.job_run_details`, push réel) — toujours en attente, machine de l'auteur requise.

## SPRINTS SUGGÉRÉS (3-5)

### Note du frigo — édition d'une note par son auteur (suite Sprint 20)
**Objectif** : permettre à l'auteur de **modifier** le corps d'une de ses notes (la policy `fridge_notes_update` autorise déjà l'auteur en BD ; il manque l'UI + une action `modifierNoteFrigo`). Réinitialiser l'accusé de lecture à l'édition ? (décision produit).
**Complexité** : Faible-Moyenne (UI inline d'édition + server action Zod ; pas de schéma — la colonne `body` et la policy UPDATE existent).
**Justification** : complète le CRUD du tableau ; à n'entreprendre que si l'auteur veut corriger une note plutôt que retirer+reposter.
**Référence** : policy `fridge_notes_update` auteur seul (`supabase/migrations/20260626120000_sprint20_fridge_notes.sql`, **vérifiée en session Sprint 20**) ; `app/frigo/actions.ts` (patron `supprimerNoteFrigo`, vérifié Sprint 20).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `JOURS_PAR_FREQUENCE` — **vérifiés Sprint 20** par l'explorateur : 2 valeurs `hebdomadaire`/`aux_2_semaines`), CHECK dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql:14` (vérifié Sprint 20).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Justification** : prérequis business pour tout 2ᵉ foyer externe ; FR-17 ✅ rend l'unité de facturation adressable.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise) ; réconcilier avec les écarts existants.
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation) — bloqué sans accès réel à l'API ni client cible.
**Justification** : non prioritaire sans accès ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 21 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint21-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence, de jour de paye, NI de corps de note du frigo vers un
  destinataire non prévu (R7) — BD, payload push, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
