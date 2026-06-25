# Carte d'embarquement — Sprint 20 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 19 livré : **interrupteur de la Fenêtre de sommeil** (FR-6). Colonne `sleep_defaults.enabled` (boolean, défaut `true`, migration `supabase/migrations/20260625120000_sprint19_sleep_enabled.sql`) ; paramètre moteur **en queue** `sleepEnabled = true` sur `dayStatuses`/`statusForDate`/`monthGrid` (`lib/schedule/status.ts:78`, garde ligne `lib/schedule/status.ts:103`) ; parseur `parseSleepEnabled` (`lib/schedule/db-rows.ts:88`) ; case à cocher dans `components/sommeil/fenetre-sommeil.tsx`. Désactivé, la récupération redevient `conge`/`disponible`, `sleep: null` ; **disponibilité partagée** (la conjointe le lit, R7 intact). Version 0.19.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 19)** : feature dirigée par l'auteur, in-session (schéma + moteur + UI). Le Postgres local (`bash scripts/local-db.sh`, Postgres 16) exécute **réellement** migrations + tests d'isolation RLS — utilisé ce sprint (35 tests RLS verts contre une vraie BD). **Dette de parité « miroir » désormais SOLDÉE** : Sprints 16 (corps payload), 18 (format date) ; la piste « copie Edge des échéances » a été **réconciliée à STOP** — `lib/notifications/echeances.ts` n'a PAS de copie Edge (`send-reminders/index.ts:66` lit des `remind_at` pré-calculés), la duplication des offsets `30/7/1` est TS↔SQL et déjà gardée par `supabase/tests/reminders.test.ts`. **Ne pas re-suggérer cette piste.**

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Appliquer les migrations Sprints 17 + 19 sur Supabase Cloud** (après confirmation) : `payday_settings` (Sprint 17) et `sleep_defaults.enabled` (Sprint 19) ne sont pas encore en prod. `supabase migration up` (ou dashboard rejoué en migration), puis `node scripts/gen-types.mjs <db_url_cloud>` pour régénérer `lib/database.types.ts` avec `__InternalSupabase` + `graphql_public` réels (les ajouts hand-edit `payday_settings` et `sleep_defaults.enabled` seront alors confirmés par le générateur). Vérifier ensuite : la conjointe lit 0 ligne de `payday_settings` ET lit bien `sleep_defaults.enabled` (disponibilité partagée).
**+ rappel Sprint 16** : validation E2E des notifications en prod (déploiement `send-reminders`, secrets VAPID/Resend, pg_cron, `cron.job_run_details`) — toujours en attente, machine de l'auteur requise.

## SPRINTS SUGGÉRÉS (3-5)

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (ex. « le dernier vendredi », ou un jour fixe du mois). Sort du modèle ancre+mod-en-jours (mois 28–31 j) → nécessite de l'arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon non prioritaire (hebdo/aux 2 semaines couvrent l'usine). **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `JOURS_PAR_FREQUENCE` — **à revérifier**, cité Sprint 17), `supabase/migrations/20260624120000_sprint17_payday_settings.sql` (CHECK `frequence`, vérifié Sprint 19 par lecture de la liste des migrations).

### Rappel de sommeil pour la conjointe (FR-6, suite Sprint 19)
**Objectif** : explorer si l'interrupteur de sommeil (Sprint 19) doit aussi se refléter ailleurs — ex. la légende du coup d'œil masque la pastille « Sommeil » quand la fonction est désactivée pour ce foyer, ou un texte d'aide. Petite finition UX.
**Complexité** : Faible (présentationnel, aucun schéma) — **à réconcilier** : vérifier d'abord que c'est un vrai manque (la légende liste tous les états possibles par design ; ce n'est pas forcément un bug).
**Justification** : cohérence d'affichage ; à n'entreprendre que si l'auteur constate une gêne réelle. Sinon STOP.
**Référence** : `components/horaire/vue-coup-doeil.tsx` (légende `legende`/`AFFICHAGE_TRAVAILLEUR` — vérifié Sprint 19), prop `sleepEnabled` (vérifié Sprint 19).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — nécessite creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Justification** : prérequis business pour tout 2ᵉ foyer externe ; FR-17 ✅ rend l'unité de facturation adressable.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (cité Sprint 17, à revérifier).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise) ; réconcilier avec les écarts existants.
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation) — bloqué sans accès réel à l'API ni client cible.
**Justification** : non prioritaire sans accès ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (cité Sprint 17, à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 20 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint20-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence NI de jour de paye vers la conjointe (R7) — BD, payload, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
