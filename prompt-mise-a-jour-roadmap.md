# Carte d'embarquement — Sprint 18 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 17 livré : **jour de paye worker-private, déterministe** — config (ancre + fréquence) persistée dans `payday_settings`, jours calculés à la volée par `lib/schedule/payday.ts` (`estJourDePaye`, pur, réutilise `civilToDays`/`mathMod`). RLS étanche owner-only (la conjointe lit 0 ligne) + durcissement `is_household_member` dans `with check`. Marqueur 💰 + badge « Paye aujourd'hui » côté travailleur seulement (non-fuite R7 constatée sur `/demo/horaire`). Version 0.17.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 17)** : feature dirigée par l'auteur, **hors FR-1→17** (ce n'est pas dans `docs/analyse/` ; `CLAUDE.md` exclut « tracker de paie/OT$ » — cadré comme marqueur de *date*, pas de montants). Le Postgres local (`scripts/local-db.sh`, Postgres 16) permet d'exécuter **réellement** migrations + tests d'isolation RLS en session — utilisé au Sprint 17 (6 tests RLS verts contre un vrai Postgres). **Type BD** : `payday_settings` inséré à la main dans `lib/database.types.ts` (fidèle au générateur) car le PG local n'a pas pg_graphql — à régénérer par l'auteur sur Cloud quand la migration y sera appliquée.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâche opérationnelle en attente (hors session de code)

**Appliquer la migration Sprint 17 sur Supabase Cloud** (après confirmation) : `supabase migration up` (ou via dashboard rejoué en migration), puis `node scripts/gen-types.mjs <db_url_cloud>` pour régénérer `lib/database.types.ts` avec `__InternalSupabase` + `graphql_public` réels. Vérifier ensuite que la conjointe lit bien 0 ligne de `payday_settings` en prod.
**+ rappel Sprint 16** : validation E2E des notifications en prod (déploiement `send-reminders`, secrets VAPID/Resend, pg_cron, `cron.job_run_details`) — toujours en attente, machine de l'auteur requise.

## SPRINTS SUGGÉRÉS (3-5)

### Dette technique — Harmonisation du miroir de format de date
**Objectif** : `FORMAT_JOUR` (`lib/notifications/payload.ts:26`) est un « miroir assumé » de `FORMAT_JOUR_LONG` (`lib/schedule/format.ts:14`) imposé par la contrainte zéro-import Deno ; ajouter un test pur qui constate que les deux produisent la même chaîne pour une date donnée (garde analogue à la parité payload du Sprint 16).
**Complexité** : Faible (un test pur, aucun schéma).
**Justification** : même classe de risque que la dérive payload corrigée au Sprint 16 ; aujourd'hui non gardé. Réalisable intégralement en session.
**Référence** : `lib/notifications/payload.ts:22-31` (commentaire MIROIR ASSUMÉ, vérifié en session Sprint 17), `lib/schedule/format.ts:14` (`FORMAT_JOUR_LONG`).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (ex. « le dernier vendredi », ou un jour fixe du mois). Sort du modèle ancre+mod-en-jours (mois 28–31 j) → nécessite de l'arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon non prioritaire (hebdo/aux 2 semaines couvrent l'usine). À confirmer avec l'auteur avant d'implémenter.
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `JOURS_PAR_FREQUENCE` — vérifié Sprint 17), `supabase/migrations/20260624120000_sprint17_payday_settings.sql` (CHECK `frequence`).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — nécessite creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Justification** : prérequis business pour tout 2ᵉ foyer externe ; FR-17 ✅ rend l'unité de facturation adressable.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql:42-48`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md:38` (vérifié Sprint 17).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise) ; réconcilier avec les écarts existants.
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation) — bloqué sans accès réel à l'API ni client cible.
**Justification** : non prioritaire sans accès ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md:37` (vérifié Sprint 17).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 18 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint18-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence NI de jour de paye vers la conjointe (R7) — BD, payload, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
