# Carte d'embarquement — Sprint 24 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 23 livré : **réponses au frigo (fil à un seul niveau)**. Colonne auto-référente `parent_id` sur `fridge_notes` (migration `supabase/migrations/20260627120000_sprint23_fridge_note_replies.sql`), trigger `enforce_fridge_note_single_level` (un seul niveau + même foyer + interdit de re-parenter une note qui a des réponses), RPC `marquer_note_frigo_lue` resserré (refuse une réponse, D1). Helper pur `grouperEnFils` + `FrigoNote.parentId` threadé via `parseFrigoRows` et la constante `FRIGO_NOTE_COLUMNS`. UI : réponses indentées + composeur inline (`components/frigo/tableau-frigo.tsx`). Push event `"reponse"` (miroir TS↔Deno gardé). Version 0.23.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 23)** : la règle produit D1 « une réponse n'a pas d'accusé de lecture » vit dans **plusieurs couches volontairement** — la RLS `with check` (read_* nuls, Sprint 21), le RPC (`parent_id is null`), les helpers TS `statutLecture`/`estNouvellePourMoi` (réponse → non-applicable/false), et le compteur d'accueil `app/page.tsx` (`.is("parent_id", null)`). Toute évolution de l'accusé sur réponse doit toucher ces points de façon cohérente. La **garde de parité** des miroirs TS↔Deno (Sprints 16/18/20/21/23) reste le patron pour tout nouveau miroir. Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (le trigger et la cascade ne sont observables que là). La constante `FRIGO_NOTE_COLUMNS` (`lib/frigo/db-rows.ts`) est désormais la **source unique** des colonnes d'une note complète : tout nouveau champ s'y ajoute une seule fois.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migration Cloud Sprint 23 — À APPLIQUER** : `20260627120000_sprint23_fridge_note_replies.sql` (colonne `parent_id`, trigger `enforce_fridge_note_single_level`, index, RPC `marquer_note_frigo_lue` resserré) **n'est pas encore sur Cloud** (à appliquer via Supabase MCP après confirmation, projet `eirlzscgxeybyeinpmsi`). Après application : **régénérer les types** (le générateur MCP retire `graphql_public` — ne pas écraser le fichier du dépôt ; ici `lib/database.types.ts` a été hand-edité fidèlement pour `parent_id` + la self-FK). **Redéployer l'Edge `notify-fridge`** (v3 gère l'event `"reponse"`). **Couplage env à garder** côté Vercel : `SUPABASE_SERVICE_ROLE` = même valeur que le `SUPABASE_SERVICE_ROLE_KEY` de l'Edge (sinon push 401 silencieux).
**Dérive du journal de migrations (cosmétique).** Sur Cloud, plusieurs objets (Sprints 12/17 + migrations appliquées par MCP) ne correspondent pas 1:1 aux noms/horodatages des fichiers du dépôt. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis.

## SPRINTS SUGGÉRÉS (3-5)

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye` = `"hebdomadaire" | "aux_2_semaines"` ligne 11, `frequencePayeSchema` ligne 14, `JOURS_PAR_FREQUENCE` lignes 22-25 — **vérifié Sprint 23 via exploration**) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql:14` (à revérifier en session).

### Note du frigo — épingler une note (suite Sprints 20-23)
**Objectif** : permettre d'**épingler** une note de tête en haut du tableau (ex. liste d'épicerie permanente), au-dessus du tri récent-d'abord.
**Complexité** : Moyenne (colonne `pinned_at` ou `is_pinned` + RLS héritée + tri à deux niveaux dans `grouperEnFils`/`trierRecentDabord` + UI bouton épingle). Schéma requis.
**Justification** : prolonge le canal du frigo ; à ne faire que si l'auteur veut une note persistante en tête. **À confirmer avant d'implémenter.**
**Référence** : table `fridge_notes` (`supabase/migrations/20260626120000_sprint20_fridge_notes.sql:14-25`, colonne `is_pinned`/`pinned_at` **à créer**) ; `grouperEnFils`/`trierRecentDabord` (`lib/frigo/types.ts`, `components/frigo/tableau-frigo.tsx` — **vérifiés Sprint 23**).

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
le Sprint 24 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint24-<nom-court> (à créer depuis dev).

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
