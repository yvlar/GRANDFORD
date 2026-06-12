# Carte d'embarquement — Sprint 8 : Mise en ligne + filets

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 7 livré : pipeline de rappels complet au niveau BD + pur + UI (génération transactionnelle, abonnement push, Edge Function écrite mais jamais exécutée). État courant : voir la table en tête de `ROADMAP.md`. Ce sprint **met GRANDFORD en ligne** (Vercel + Supabase Cloud CA/US-est) et solde la **dette « jamais tourné en vrai »** accumulée depuis le Sprint 2 — c'est un sprint d'opérations et de validation, plus que de code.

## LECTURE OBLIGATOIRE

1. `.claude/rules/securite-secrets.md` — vraies clés = `.env` réel et secrets cloud → **confirmation préalable** ; région **CA/US-est** (Loi 25) ; `GRANDFORD_DEMO` ne doit JAMAIS exister en production.
2. `.claude/rules/autonomie-confirmations.md` — tout ce sprint est fait d'actions **distantes et facturables** (projets cloud, envois réels) : demander avant chaque création de ressource et chaque envoi externe.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Dette GoTrue/Edge réelle (Sprints 3-7)** : lien magique + OAuth jamais testés contre un vrai GoTrue (`ROADMAP.md`, Sprint 3 archivé) ; actions serveur de capture jamais E2E (Sprint 5) ; Edge Function `send-reminders` **jamais exécutée** — `supabase/functions/send-reminders/README.md` liste ses secrets et son cron.
- **⚠️ Import relatif hors `functions/`** : `supabase/functions/send-reminders/index.ts:16` importe `../../../lib/notifications/payload.ts` — **à vérifier au premier `supabase functions deploy`** ; plan B documenté dans le README (déplacer vers `_shared/`).
- **pg_cron + pg_net** : extensions à activer sur le projet Cloud seulement ; le SQL de planification est dans le README de la fonction — il n'existe **aucune migration** pg_cron (voulu : inapplicable localement).
- **Clés réelles à créer** : VAPID (`web-push generate-vapid-keys`), Resend (domaine expéditeur), Sentry DSN — `.env.example:12-21` porte les noms attendus. Vraies valeurs → confirmation.
- **iPhone réel disponible** (R11/U-7, `docs/analyse/03-architecture/architecture.md:130`) : le push iOS n'existe que PWA installée — c'est l'utilisateur qui manipule l'appareil, prévoir sa participation.

## TÂCHE — Sprint 8

### Spécification

1. **Supabase Cloud** (région CA/US-est) : projet créé, migrations appliquées par CLI (`supabase db push`), types régénérés identiques, secrets Edge posés, fonction `send-reminders` déployée, pg_cron planifié.
2. **Vercel** : projet relié au dépôt, variables d'env (sans `GRANDFORD_DEMO`), build de prod, domaine.
3. **Dette réelle soldée** : lien magique reçu et connexion réussie ; OAuth Google ; capture d'un écart sur le site réel ; rappels générés en BD Cloud ; **push reçu sur l'iPhone réel (PWA installée)** ; courriel de repli Resend reçu.
4. **Filets** : Sentry (sans donnée personnelle ni motif — R7), UptimeRobot (uptime + réveil du projet gratuit), sauvegarde `pg_dump` quotidienne par GitHub Action (+ restauration essayée une fois, NFR-11).

### Tests / validation obligatoires (gates)

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts (aucune régression locale).
- Les validations cloud sont **manuelles et observées** : chaque point de la preuve ci-dessous est constaté, pas supposé.

### Preuve d'acceptation observable

1. Connexion par lien magique réel (courriel reçu) sur l'URL de prod.
2. Écart capturé à J+40 sur le site réel → 3 `reminders` constatés dans la BD Cloud.
3. Notification push **reçue sur l'iPhone** (PWA installée) via un rappel de test ; payload affiché sans motif.
4. Courriel de repli Resend reçu pour un compte sans abonnement push.
5. Sentry reçoit un événement de test ; UptimeRobot voit le site UP ; un artefact `pg_dump` daté existe.

## SPRINTS SUGGÉRÉS

### v1.1 — Co-planification conjointe (FR-8, FR-9)
**Objectif** : notes de la conjointe sur une date + requêtes approuver/refuser (mécanisme de fraîcheur O-1).
**Complexité** : Moyenne
**Justification** : premier apport actif pour la conjointe ; tables prêtes. ⚠️ Revue Sprint 7 : FR-9 crée un **2ᵉ chemin d'écriture d'exceptions** → déplacer la génération des rappels de la RPC vers un **trigger sur `exceptions`** (sinon les écarts issus de requêtes n'auront pas de rappels).
**Référence** : `notes` — `supabase/migrations/20260611192620_initial_schema.sql:152` ; `requests` — `…:163` ; génération actuelle dans la RPC — `supabase/migrations/20260612193000_sprint07_reminders.sql:54`. UI **à créer**.

### v1.1 — Journal des changements + export (FR-13, FR-14)
**Objectif** : journal « qui a changé quoi » + export iCal/PDF.
**Complexité** : Moyenne
**Justification** : confiance + partage hors app ; `audit_log` existe, rien ne l'alimente.
**Référence** : `audit_log` — `supabase/migrations/20260611192620_initial_schema.sql:191` (vérifié) ; alimentation et UI **à créer**.

### Conformité Loi 25 (dès le 2ᵉ foyer)
**Objectif** : politique de confidentialité, consentement à l'inscription, responsable des renseignements personnels.
**Complexité** : Faible (texte + écran), mais bloquante avant d'inviter un foyer externe.
**Justification** : exigence `.claude/rules/securite-secrets.md` ; déclenchée par la mise en ligne du Sprint 8.
**Référence** : règle citée ; tout **à créer**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 8 (Mise en ligne + filets) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint08-mise-en-ligne (à créer depuis dev), sauf branche de
session imposée par l'environnement (la documenter alors dans ROADMAP).

Rappels non négociables :
- Ce sprint est fait d'actions DISTANTES : création de ressources cloud, vraies
  clés, envois réels (push, courriel) → CONFIRMATION PRÉALABLE à chaque fois.
- GRANDFORD_DEMO ne doit jamais être défini en production.
- Vérifier l'import relatif de l'Edge Function au premier deploy (README de
  send-reminders) ; pg_cron seulement sur le Cloud, jamais en migration locale.
- AUCUN motif dans Sentry, les logs, les notifications (R7).
- Gates locaux verts + chaque preuve cloud CONSTATÉE (lien magique, push iPhone,
  repli courriel, sauvegarde) — « déployé » n'est pas une preuve.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
