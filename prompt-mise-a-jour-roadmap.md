# Carte d'embarquement — Sprint 26 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 25 livré : **listes d'épicerie dans le frigo** (partagées, cochage par les deux membres, push anti-spam au cochage). 2 tables `grocery_lists` / `grocery_items` (migration `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`), RPC **`cocher_element_epicerie(item_id, checked)` SECURITY DEFINER** (seul chemin de bascule de la coche ; membre vérifié, idempotent, débounce du push), trigger `enforce_grocery_item_household`, Edge `notify-grocery`. UI section dédiée dans `/frigo` (`components/epicerie/listes-epicerie.tsx`). Version 0.25.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 25)** : la coche passe **uniquement** par le RPC `cocher_element_epicerie` (aucun grant/policy UPDATE sur `grocery_items` — la RLS ne sait pas restreindre les colonnes ; le RPC, DEFINER, est le seul à écrire `is_checked`/`checked_*`). Le RPC vérifie `is_household_member` (un **membre révoqué** garde `author_id` — sans cette garde il cocherait par appel direct) et retourne `true` **seulement** quand il faut pousser (cochage hors fenêtre de cooldown de la liste). Le débounce vit dans `grocery_lists.last_check_notified_at`, **jamais** dans `GROCERY_LIST_COLUMNS` (`lib/epicerie/db-rows.ts`) → ni lu ni forgeable côté client. Les constantes `GROCERY_LIST_COLUMNS`/`GROCERY_ITEM_COLUMNS` sont la **source unique** des colonnes (tout nouveau champ : +schéma Zod + `parseGrocery*Rows` + type + `lib/database.types.ts`). Miroir payload R7 TS↔Deno gardé par `grocery-payload-parity.test.ts`. Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (le refus d'UPDATE direct, la garde révoqué et le débounce ne sont observables que là).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migration Cloud Sprint 25 — À APPLIQUER** : `20260628120000_sprint25_grocery_lists.sql` (tables `grocery_lists`/`grocery_items`, trigger, RLS, RPC `cocher_element_epicerie`, publication Realtime) **pas encore sur Cloud** (projet `eirlzscgxeybyeinpmsi`, via Supabase MCP après confirmation). Puis **régénérer les types** (le générateur MCP retire `graphql_public` — ne pas écraser le fichier du dépôt ; `lib/database.types.ts` a été hand-edité fidèlement). **Déployer l'Edge `notify-grocery`** (+ confirmer `SUPABASE_SERVICE_ROLE`/`SUPABASE_FUNCTIONS_URL` côté Vercel = mêmes valeurs que les secrets Edge ; le cochage et la création de liste poussent via cette fonction).
**Migrations Cloud Sprints 23/24 — À VÉRIFIER/APPLIQUER si pas déjà fait** : `20260627120000_sprint23_fridge_note_replies.sql` et `20260627130000_sprint24_fridge_note_pin.sql` (colonne `parent_id`, trigger un-seul-niveau, `is_pinned`, index unique, RPC `epingler_note_frigo`). Confirmer l'état avant d'empiler la 25.
**Dérive du journal de migrations (cosmétique).** Sur Cloud, certains objets ne correspondent pas 1:1 aux noms/horodatages des fichiers. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis.

## SPRINTS SUGGÉRÉS (3-5)

### Épicerie — renommer une liste / quantités par article (suite Sprint 25)
**Objectif** : permettre de **renommer** une liste après création (hors périmètre Sprint 25) et/ou d'ajouter une **quantité** à un article (« Lait ×2 »).
**Complexité** : Moyenne. Renommage = nouveau chemin d'écriture sur `grocery_lists` : la table n'a **aucun grant/policy UPDATE** aujourd'hui (volontaire, pour protéger `last_check_notified_at`) → il faudra soit une policy UPDATE colonne-sûre impossible en RLS, soit un **RPC `renommer_liste_epicerie`** (calque `cocher_element_epicerie`), soit une colonne `quantity` + RPC d'ajustement. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `grocery_lists` (pas de policy UPDATE — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**) ; `GROCERY_ITEM_COLUMNS` (`lib/epicerie/db-rows.ts`, colonne `quantity` **à créer**) ; `grouperListes` (`lib/epicerie/types.ts`).

### Épicerie — vider/archiver les articles cochés d'une liste (suite Sprint 25)
**Objectif** : un bouton « Vider les achetés » qui retire (ou archive) en un geste tous les articles cochés d'une liste, pour repartir d'une liste propre la semaine suivante.
**Complexité** : Moyenne (suppression en lot sous RLS membre — déjà permise ; ou colonne `archived_at` + filtre). Pas de schéma si simple suppression en lot.
**Justification** : prolonge l'usage « liste d'épicerie permanente » ; à ne faire que si l'auteur trouve l'accumulation gênante. **À confirmer avant d'implémenter.**
**Référence** : RLS `grocery_items_delete` (membre — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**) ; action `retirerElementEpicerie` (`app/epicerie/actions.ts`) à généraliser en lot.

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests ; `payday.test.ts` asserte aujourd'hui que `"mensuel"` est **rejeté** → à inverser).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `frequencePayeSchema`, `JOURS_PAR_FREQUENCE` — à revérifier en session) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql:14` ; `payday.test.ts` (rejet `"mensuel"` à inverser).

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
le Sprint 26 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint26-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence, de jour de paye, NI de corps de note / libellé d'article
  d'épicerie vers un destinataire non prévu (R7) — BD, payload push, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
