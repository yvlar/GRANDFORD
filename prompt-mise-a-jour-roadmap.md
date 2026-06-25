# Carte d'embarquement — Sprint 19 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 18 livré : **garde de parité du miroir de format de date**. `FORMAT_JOUR` (`lib/notifications/payload.ts:26`) et `FORMAT_JOUR_LONG` (`lib/schedule/format.ts:14`) sont deux `Intl.DateTimeFormat` identiques dupliqués par la contrainte zéro-import de `payload.ts` (Edge Deno) ; `lib/notifications/format-parity.test.ts` (pur) garde désormais par **égalité exacte** qu'ils produisent la même chaîne, dans les deux sens (la revue a corrigé un `toContain` uni-directionnel en `toBe`). Version 0.18.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 18)** : feature de dette technique, fully in-session (un test pur, aucun schéma, aucune migration). La dette « miroir de format » des cartes précédentes est désormais **traitée** — ne pas la re-suggérer. Le Postgres local (`bash scripts/local-db.sh`, Postgres 16) permet d'exécuter **réellement** migrations + tests d'isolation RLS en session (non utilisé au Sprint 18 : aucun schéma touché) — 77 tests RLS restent ignorés quand il n'est pas lancé.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Appliquer la migration Sprint 17 sur Supabase Cloud** (après confirmation) : `supabase migration up` (ou via dashboard rejoué en migration), puis `node scripts/gen-types.mjs <db_url_cloud>` pour régénérer `lib/database.types.ts` avec `__InternalSupabase` + `graphql_public` réels. Vérifier ensuite que la conjointe lit bien 0 ligne de `payday_settings` en prod.
**+ rappel Sprint 16** : validation E2E des notifications en prod (déploiement `send-reminders`, secrets VAPID/Resend, pg_cron, `cron.job_run_details`) — toujours en attente, machine de l'auteur requise.

## SPRINTS SUGGÉRÉS (3-5)

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (ex. « le dernier vendredi », ou un jour fixe du mois). Sort du modèle ancre+mod-en-jours (mois 28–31 j) → nécessite de l'arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon non prioritaire (hebdo/aux 2 semaines couvrent l'usine). À confirmer avec l'auteur avant d'implémenter.
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `JOURS_PAR_FREQUENCE` — vérifié Sprint 17), `supabase/migrations/20260624120000_sprint17_payday_settings.sql` (CHECK `frequence`).

### Dette technique — garde de parité de la copie Edge des échéances
**Objectif** : sur le modèle des gardes de parité Sprints 16 (corps du payload) et 18 (format de date), vérifier s'il existe d'autres miroirs manuels non gardés entre `lib/notifications/` et `supabase/functions/` (la copie Edge `_shared/`), notamment la logique d'échéances ; ajouter un test pur de parité si une duplication non gardée subsiste.
**Complexité** : Faible (audit + éventuel test pur, aucun schéma) — **à réconcilier d'abord** : `echeances.ts` est décrit comme « miroir TS de la RPC » (roadmap-archive Sprint 7), pas forcément dupliqué côté Edge ; vérifier qu'une vraie copie non gardée existe avant d'implémenter, sinon STOP.
**Référence** : `lib/notifications/payload-parity.test.ts` (garde de référence, Sprint 16), `supabase/functions/_shared/payload.ts` (copie Edge — vérifié Sprint 18) ; `lib/notifications/echeances.ts` (**à vérifier** : a-t-il une copie Edge ?).

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
le Sprint 19 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint19-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence NI de jour de paye vers la conjointe (R7) — BD, payload, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
