# Carte d'embarquement — Sprint 23 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 22 livré : **indicateur « Édité » de note du frigo**. Un trigger **propre à `fridge_notes`** (`set_fridge_notes_updated`, migration `supabase/migrations/20260626140000_sprint22_fridge_edited_trigger.sql`) ne bumpe `updated_at` **que si le corps change** — une lecture (RPC `marquer_note_frigo_lue`) ne le bouge plus. Helper pur `estEditee` (`lib/frigo/types.ts`), badge « ✎ Édité » dans `components/frigo/tableau-frigo.tsx`, `updatedAt` threadé via `parseFrigoRows` + 3 SELECT. Version 0.22.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 22)** : la prémisse de la carte précédente était **fausse** (le trigger partagé `set_updated_at` bumpe `updated_at` à chaque UPDATE, y compris l'accusé de lecture) — d'où le trigger spécifique au frigo. Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (2 nouveaux tests : lecture ne bumpe pas `updated_at`, édition l'avance). Le `set_updated_at` **partagé** reste sur les 9 autres tables — ne jamais le modifier globalement. La **garde de parité** des miroirs TS↔Deno (Sprints 16/18/20/21) reste le patron pour tout nouveau miroir.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migrations Cloud — À JOUR** (appliquées en session via Supabase MCP, projet `eirlzscgxeybyeinpmsi`, après confirmation). Le trigger `set_fridge_notes_updated` (Sprint 22) **est en prod** ; 17/19/20/21 y étaient déjà ; la RLS owner-only de `cycle_templates` (**Sprint 14, qui manquait sur Cloud**) a aussi été appliquée. Vérifié en session : le trigger du frigo exécute bien `set_fridge_notes_updated` (⇒ **une lecture ne pose plus « Édité »**) ; `fridge_notes` est dans la publication `supabase_realtime` ; `cycle_templates` n'a plus que `cycle_templates_select` (membres) + `cycle_templates_update` (propriétaire). **Types** `lib/database.types.ts` déjà corrects — Sprint 22 n'ajoute aucune colonne, pas de régénération nécessaire (et le générateur MCP retire `graphql_public`, donc ne pas écraser le fichier du dépôt). **Edge `notify-fridge`** déjà à jour (v2 gère l'event `"modifiee"`, `verify_jwt=false`). **Couplage env à garder** côté Vercel : `SUPABASE_SERVICE_ROLE` = même valeur que le `SUPABASE_SERVICE_ROLE_KEY` de l'Edge (sinon push 401 silencieux).
**Dérive du journal de migrations (cosmétique).** Sur Cloud, plusieurs objets (`audit_log` Sprint 12, `payday_settings` Sprint 17, et les migrations appliquées par MCP cette session) ne correspondent pas 1:1 aux noms/horodatages des fichiers du dépôt. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis.

## SPRINTS SUGGÉRÉS (3-5)

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `frequencePayeSchema` — à revérifier en session) ; CHECK dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql` (à revérifier).

### Note du frigo — fil de discussion / réponses (suite Sprints 20-22)
**Objectif** : permettre une **réponse** courte à une note (un seul niveau, pas un fil profond), pour un échange asynchrone du couple sans quitter le frigo.
**Complexité** : Moyenne (colonne `parent_id` nullable + RLS héritée du foyer + UI imbriquée + accusés par réponse à décider). Schéma requis.
**Justification** : prolonge le tableau partagé vers un vrai canal léger ; à ne faire que si l'auteur veut plus qu'une liste de notes plates. **À confirmer avant d'implémenter.**
**Référence** : table `fridge_notes` (`supabase/migrations/20260626120000_sprint20_fridge_notes.sql:14-25`, **vérifié Sprint 22** — colonne `parent_id` **à créer**) ; `parseFrigoRows`/`FrigoNote` (`lib/frigo/db-rows.ts`, `lib/frigo/types.ts:10-18`, **vérifié Sprint 22**).

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
le Sprint 23 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint23-<nom-court> (à créer depuis dev).

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
