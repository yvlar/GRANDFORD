# Carte d'embarquement — Sprint 28 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 27 livré : **raccourci épicerie sur l'accueil**. L'épicerie a été **déplacée** de `/frigo` vers une **page `/epicerie` dédiée** (`app/epicerie/page.tsx`) ; `/frigo` redevient **notes seulement**. L'accueil `/` porte une **3ᵉ tuile** `🛒 Épicerie` (`<nav grid-cols-3>` dans `components/horaire/vue-coup-doeil.tsx`) avec une **pastille « X à acheter »** (compteur d'articles non cochés, requête de lecture dans `app/page.tsx`, dégradation gracieuse à 0). Frontend + une requête, **aucune migration**. Version 0.27.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 27)** : la pastille de tuile vit dans le composant local **`PastilleNombre`** (`components/horaire/vue-coup-doeil.tsx`) — un seul style partagé frigo + épicerie (rien si compte ≤ 0, `aria-label` = `${n} ${aria}`). Les **noms d'auteur** d'un foyer passent par le helper partagé **`parseAuthorNames`** (`lib/foyer/author-names.ts`, créé Sprint 27) — `/frigo` et `/epicerie` l'utilisent tous deux (ne pas dupliquer la boucle membreships→profiles). Les **actions épicerie** (`app/epicerie/actions.ts`) revalident `/epicerie` + `/` (sauf `creerListeEpicerie` : liste vide → compte inchangé). Le compteur d'accueil et la page `/epicerie` **dépendent en prod** des tables `grocery_*` (migration Sprint 25 **appliquée sur Cloud**, vérifié en session — cf. tâches opérationnelles). La preuve UI s'observe sur `/demo/horaire?epicerie=N` (pastille) et `/demo/epicerie` (listes), gabarit `GRANDFORD_DEMO=1`, Chromium via Playwright global (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), `next dev` avec des `NEXT_PUBLIC_*` factices (inlinées au build). **Avant tout gate** : `pnpm install` (le conteneur démarre sans `node_modules` ; sinon `pnpm tsc` tombe sur un TS global 6.x qui crie `baseUrl` déprécié — faux négatif).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `.claude/rules/supabase-rls.md` si le sprint touche `supabase/**` ou un accès données (RLS sur toute table, étanchéité du motif R7, RPC SECURITY DEFINER) ; `.claude/rules/conventions-frontend.md` si `app/**`/`components/**` (Server Components, NFR-12, i18n d'abord) ; `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migration Cloud Sprint 25 — ✅ FAIT (vérifié en session via Supabase MCP, projet `eirlzscgxeybyeinpmsi`)** : migration `sprint25_grocery_lists` **enregistrée** (`list_migrations`, version Cloud `20260628125500`), tables `grocery_lists`/`grocery_items` présentes avec **RLS activée** (`grocery_lists` porte une ligne réelle → table + policy INSERT fonctionnelles), RPC/trigger/Realtime appliqués (migration atomique). Edge **`notify-grocery` ACTIVE** (`list_edge_functions`). Donc `/epicerie` et la pastille d'accueil **fonctionnent en prod**. Types : `lib/database.types.ts` déjà hand-édité fidèlement au Sprint 25 — **rien à régénérer** (ne pas écraser, le générateur MCP retire `graphql_public`).
**Migrations Cloud Sprints 23/24 — ✅ FAIT** : `sprint23_fridge_note_replies` et `sprint24_fridge_note_pin` présentes dans `list_migrations` (vérifié en session).
**Dérive du journal de migrations (cosmétique, persistante).** Sur Cloud, les horodatages des migrations ne correspondent pas 1:1 aux noms de fichiers du dépôt (ex. Sprint 25 = `20260628125500` sur Cloud vs fichier `20260628120000`). Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis. **Seule vraie tâche opérationnelle restante.**
**Sprint 27 — aucune tâche opérationnelle** (frontend + requête de lecture ; les tables `grocery_*` dont `/epicerie` dépend sont déjà sur Cloud).

## SPRINTS SUGGÉRÉS (3-5)

### Épicerie — renommer une liste / quantités par article (suite Sprint 25)
**Objectif** : permettre de **renommer** une liste après création et/ou d'ajouter une **quantité** à un article (« Lait ×2 »).
**Complexité** : Moyenne. Renommage = nouveau chemin d'écriture sur `grocery_lists` : la table n'a **aucun grant/policy UPDATE** aujourd'hui (volontaire, pour protéger `last_check_notified_at`) → il faudra un **RPC `renommer_liste_epicerie`** (calque `cocher_element_epicerie`) ; quantité = colonne `quantity` + RPC d'ajustement. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `grocery_lists` (pas de policy UPDATE — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**) ; `GROCERY_ITEM_COLUMNS` (`lib/epicerie/db-rows.ts`, colonne `quantity` **à créer**) ; `grouperListes` (`lib/epicerie/types.ts:56`, **vérifié Sprint 27**).

### Épicerie — vider/archiver les articles cochés d'une liste (suite Sprint 25)
**Objectif** : un bouton « Vider les achetés » qui retire (ou archive) en un geste tous les articles cochés d'une liste.
**Complexité** : Moyenne (suppression en lot sous RLS membre — déjà permise ; ou colonne `archived_at` + filtre). Pas de schéma si simple suppression en lot. **À confirmer avant d'implémenter.**
**Référence** : action `retirerElementEpicerie` (`app/epicerie/actions.ts:143`, **vérifié Sprint 27** — à généraliser en lot ; pense à `revalidatePath("/")` car le compte « à acheter » change) ; RLS `grocery_items_delete` (membre — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**).

### Accueil — indicateur d'épicerie hors-pastille / soin de la grille (suite Sprints 26-27)
**Objectif** : prolonger la modernisation de l'accueil — p. ex. soigner la **bande semaine** / la **légende** de la grille, ou enrichir le signal épicerie au-delà du simple compteur.
**Complexité** : Faible à Moyenne (frontend pur ; respecter NFR-12, i18n, ne jamais allonger un parcours clé sans justification). **Cadrer le périmètre exact avec l'auteur avant d'implémenter** (le « plus beau » est subjectif).
**Référence** : `VueCoupDoeil` (`components/horaire/vue-coup-doeil.tsx` — bande semaine `grid grid-cols-7`, légende `flex flex-wrap`, tuiles `grid grid-cols-3`, **vérifié Sprint 27**) ; `PastilleNombre`/`TuileNav` réutilisables (`components/horaire/vue-coup-doeil.tsx`, `components/ui/tuile-nav.tsx`, **vérifiés Sprint 27**) ; i18n `fr.horaire`/`fr.epicerie` (`lib/i18n/fr.ts`).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests ; `payday.test.ts` asserte aujourd'hui que `"mensuel"` est **rejeté** → à inverser). **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye`, `frequencePayeSchema`, `JOURS_PAR_FREQUENCE` — à revérifier en session) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql:14` ; `payday.test.ts` (rejet `"mensuel"` à inverser).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 28 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint28-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- pnpm install AVANT les gates (le conteneur démarre sans node_modules). Compteurs de
  tests TOUJOURS mesurés en session (pnpm vitest run). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence, de jour de paye, NI de corps de note / libellé d'article
  d'épicerie vers un destinataire non prévu (R7) — BD, payload push, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
