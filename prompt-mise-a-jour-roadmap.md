# Carte d'embarquement — Sprint 22 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 21 livré : **édition d'une note du frigo par son auteur** — bouton ✏️ auteur-seul sur `/frigo`, server action `modifierNoteFrigo` (`app/frigo/actions.ts`), UI inline dans `components/frigo/tableau-frigo.tsx`, event push `"modifiee"` (miroir TS↔Deno + Edge `notify-fridge`). L'édition **réinitialise l'accusé de lecture** (la note redevient « non lue ») et **pousse seulement si la note était déjà lue**. Durcissement RLS : migration `supabase/migrations/20260626130000_sprint21_fridge_update_no_receipt_forge.sql` interdit à l'auteur de forger un accusé non-nul. Version 0.21.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 21)** : feature dirigée par l'auteur, hors FR-1→17. Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (18 tests frigo verts contre une vraie BD, dont 6 nouveaux sur l'édition). Le push device + le live Realtime restent **non vérifiables en conteneur** (creds + déploiement Edge = tâche opérationnelle) ; la preuve d'acceptation se constate sur `/demo/frigo` (Chromium réel, `realtimeActif=false`). La **garde de parité** des miroirs TS↔Deno est la lignée Sprints 16/18/20/21 — réutiliser ce patron pour tout nouveau miroir.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Appliquer les migrations Sprints 17 + 19 + 20 + 21 sur Supabase Cloud** (après confirmation) : `payday_settings` (17), `sleep_defaults.enabled` (19), `fridge_notes` + RPC `marquer_note_frigo_lue` + publication Realtime (20) et le **durcissement de la policy UPDATE `fridge_notes`** (21, `20260626130000_sprint21_fridge_update_no_receipt_forge.sql`) ne sont pas encore en prod. `supabase migration up`, puis `node scripts/gen-types.mjs <db_url_cloud>` pour régénérer `lib/database.types.ts` avec `__InternalSupabase` + `graphql_public` réels. Vérifier ensuite : `alter publication supabase_realtime` a bien pris `fridge_notes` (sinon le live ne marche pas en prod).
**Redéployer l'Edge `notify-fridge`** (Sprint 21 ajoute l'event `"modifiee"`) + ses secrets (VAPID/Resend/service-role déjà posés), et garder côté Vercel `SUPABASE_SERVICE_ROLE` (= **même valeur** que le `SUPABASE_SERVICE_ROLE_KEY` de l'Edge — sinon push 401 silencieux) + éventuellement `SUPABASE_FUNCTIONS_URL`. Sans ça, le push du frigo (nouvelle/lue/modifiée) reste un no-op ; le live Realtime, lui, marche dès la migration appliquée.
**+ rappel Sprint 16** : validation E2E des notifications de rappel en prod (`cron.job_run_details`, push réel) — toujours en attente, machine de l'auteur requise.

## SPRINTS SUGGÉRÉS (3-5)

### Note du frigo — indicateur « Édité » (suite Sprint 21)
**Objectif** : afficher discrètement qu'une note a été modifiée (et quand), en s'appuyant sur la colonne `updated_at` déjà bumpée par le trigger `trg_fridge_notes_updated`. Volontairement laissé hors périmètre Sprint 21 (le reset d'accusé suffit déjà à signaler le changement).
**Complexité** : Faible (ajouter `updatedAt` à `FrigoNote` + parser `parseFrigoRows` + colonne dans les `select` ; badge UI « Édité » si `updatedAt > createdAt`). Aucun schéma.
**Justification** : améliore la lisibilité du tableau ; à ne faire que si l'auteur veut distinguer une note rééditée d'une note neuve.
**Référence** : colonne `updated_at` + trigger `trg_fridge_notes_updated` (`supabase/migrations/20260626120000_sprint20_fridge_notes.sql:23,34-35`, **vérifié Sprint 21**) ; `parseFrigoRows` (`lib/frigo/db-rows.ts`, vérifié Sprint 21) ; `FrigoNote` (`lib/frigo/types.ts:10-17`, vérifié Sprint 21).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `JOURS_PAR_FREQUENCE`, à revérifier en session) ; CHECK dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql` (à revérifier).

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
le Sprint 22 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint22-<nom-court> (à créer depuis dev).

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
