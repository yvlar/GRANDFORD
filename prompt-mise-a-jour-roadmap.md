# Carte d'embarquement — Sprint 17 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 16 livré : **garde anti-dérive du payload de rappel** (`lib/notifications/payload-parity.test.ts`) — le test compare le corps exécutable de `lib/notifications/payload.ts` (source) et `supabase/functions/_shared/payload.ts` (copie Edge), gardant la garantie R7 « aucun motif » contre une dérive silencieuse. Doc `send-reminders/README.md` synchronisée. Aucune migration, aucun changement moteur. Version 0.16.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **Réconciliation Sprint 16 (à connaître)** : la carte précédente (« Notifications E2E prod + nettoyage push ») visait une validation E2E en prod. Vérification faite : le **nettoyage des endpoints 404/410 est déjà implémenté** (`supabase/functions/send-reminders/index.ts:150-153`), le flux d'envoi est complet, les tests payload R7 (4) et isolation RLS `push_subscriptions` (`supabase/tests/reminders.test.ts:246-322`) existent déjà. **Ne pas re-coder ces éléments.** Ce qui reste est purement **opérationnel** (voir tâche reportée ci-dessous).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâche reportée du Sprint 16 (opérationnelle — hors session de code)

**Validation E2E des notifications en prod** — non réalisable dans un conteneur de dev éphémère ; nécessite la machine de l'auteur, des creds prod et des confirmations explicites. À faire par l'auteur, pas par une session Claude Code automatisée :

1. `supabase functions deploy send-reminders` (après confirmation).
2. Vérifier les secrets : `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `RESEND_API_KEY` / `RESEND_FROM` (`supabase secrets list`).
3. Planifier `pg_cron` + `pg_net` (SQL dans `supabase/functions/send-reminders/README.md`).
4. Preuve observable : `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5` (exécutions sans erreur) ; un `INSERT INTO reminders …` dû marqué `sent_at` au passage suivant ; `SELECT count(*) FROM push_subscriptions` stable ; payload reçu sur un appareil réel = libellé générique, **zéro motif** (R7).

## SPRINTS SUGGÉRÉS (3-5)

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement).
**Justification** : prérequis business pour tout 2ᵉ foyer externe ; FR-17 ✅ rend l'unité de facturation (foyer × gabarit) adressable.
**Référence** : `households` (table existante — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise) ; réconcilier avec les écarts existants.
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation).
**Justification** : non prioritaire sans accès réel à l'API ni client cible ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Vérification visuelle de la passe accessibilité (suivi Sprint 15)
**Objectif** : confirmer en conditions réelles les correctifs UX du Sprint 15 — focus clavier, cibles ≥ 44 px, parité daltonien — via `/demo/horaire` et simulation deuteranopia (DevTools) ; ajustements mineurs si écart.
**Complexité** : Faible (vérification surtout, peu ou pas de code).
**Référence** : `app/globals.css` (`:focus-visible`), `components/horaire/vue-coup-doeil.tsx` (`ContenuCase`), `components/ui/bouton-soumettre.tsx`.

### v1.1+ — Harmonisation du miroir de format de date (dette technique)
**Objectif** : `FORMAT_JOUR` (`lib/notifications/payload.ts:26`) est un « miroir assumé » de `FORMAT_JOUR_LONG` (`lib/schedule/format.ts`) imposé par la contrainte zéro-import ; ajouter un test qui constate que les deux formats produisent la même chaîne pour une date donnée (garde analogue au test de parité du Sprint 16, mais sur le format inter-modules).
**Complexité** : Faible (un test pur).
**Justification** : même classe de risque que la dérive payload corrigée au Sprint 16 ; aujourd'hui non gardé.
**Référence** : `lib/notifications/payload.ts:22-31` (commentaire « MIROIR ASSUMÉ »), `lib/schedule/format.ts` (`FORMAT_JOUR_LONG`).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 17 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint17-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm vitest run), jamais recopiés.
- Jamais de motif d'absence vers la conjointe (R7) — BD, payload, logs.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
