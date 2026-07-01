# Carte d'embarquement — Sprint 29 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 28 livré : **titres de section visibles sur l'accueil**. La bande semaine porte désormais un titre visible « **Cette semaine** » et la légende un titre « **Légende** » (composant local `TitreSection` dans `components/horaire/vue-coup-doeil.tsx`, `<h2>` muet lié à sa `<section>` par `aria-labelledby`). Frontend pur, **aucune migration**. Clé morte `fr.horaire.semaine` retirée, remplacée par `fr.horaire.{cetteSemaine,legende}`. Version 0.28.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 28)** : les titres de section de l'accueil passent par **`TitreSection`** (`components/horaire/vue-coup-doeil.tsx` — `<h2 id=…>` à altitude « étiquette », lié par `aria-labelledby` ; réutilisable pour toute nouvelle section de la vue). Les `id` de titres sont **codés en dur** (`titre-semaine`, `titre-legende`) — sûr tant qu'**une seule** instance de `<VueCoupDoeil>` est montée par page (vérifié Sprint 28 : `app/page.tsx`, `app/demo/horaire/page.tsx`, `demo-capture.tsx` en montent chacune une). La pastille de tuile reste **`PastilleNombre`**, les tuiles **`TuileNav`** (`components/ui/tuile-nav.tsx`), les noms d'auteur **`parseAuthorNames`** (`lib/foyer/author-names.ts`). La preuve UI s'observe sur `/demo/horaire` (gabarit `GRANDFORD_DEMO=1`, Chromium via Playwright **global** `/opt/node22/lib/node_modules/playwright`, exécutable `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), `next dev` avec des `NEXT_PUBLIC_*` factices. **Avant tout gate** : `pnpm install` (le conteneur démarre sans `node_modules`).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `.claude/rules/supabase-rls.md` si le sprint touche `supabase/**` ou un accès données (RLS sur toute table, étanchéité du motif R7, RPC SECURITY DEFINER) ; `.claude/rules/conventions-frontend.md` si `app/**`/`components/**` (Server Components, NFR-12, i18n d'abord) ; `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migrations Cloud Sprints 23/24/25 — ✅ FAIT** (vérifié en sessions antérieures via Supabase MCP, projet `eirlzscgxeybyeinpmsi`) : tables/RPC/triggers/Realtime `fridge_notes` (pin, réponses) et `grocery_*` présents et RLS active ; Edge `notify-grocery` ACTIVE. Donc `/frigo`, `/epicerie` et les pastilles d'accueil **fonctionnent en prod**.
**Dérive du journal de migrations (cosmétique, persistante)** : sur Cloud, les horodatages des migrations ne correspondent pas 1:1 aux noms de fichiers du dépôt. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis. **Seule vraie tâche opérationnelle restante.**
**Sprint 28 — aucune tâche opérationnelle** (frontend pur ; aucune migration, aucun déploiement).

## SPRINTS SUGGÉRÉS (3-5)

### Épicerie — vider/archiver les articles cochés d'une liste (suite Sprint 25)
**Objectif** : un bouton « Vider les achetés » qui retire en un geste tous les articles cochés d'une liste.
**Complexité** : Moyenne (suppression en lot sous RLS membre — déjà permise ; ou colonne `archived_at` + filtre). Pas de schéma si simple suppression en lot. **À confirmer avant d'implémenter** (supprimer vs archiver).
**Référence** : action `retirerElementEpicerie` (`app/epicerie/actions.ts:147`, **vérifié Sprint 28** — à généraliser en lot ; revalide déjà `/epicerie` + `/` car le compte « à acheter » change) ; RLS `grocery_items_delete` (membre — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 28** : `grant select, insert, delete … to authenticated`, l.91-92) ; helper `compteRestant` (`lib/epicerie/types.ts:77`, **vérifié Sprint 28**).

### Épicerie — renommer une liste / quantités par article (suite Sprint 25)
**Objectif** : **renommer** une liste après création et/ou ajouter une **quantité** à un article (« Lait ×2 »).
**Complexité** : Moyenne. `grocery_lists` n'a **aucune policy/grant UPDATE** (volontaire, protège `last_check_notified_at`) → un **RPC `renommer_liste_epicerie`** (calque `cocher_element_epicerie`) ; quantité = colonne `quantity` + RPC d'ajustement. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `grocery_lists` sans UPDATE (`supabase/migrations/20260628120000_sprint25_grocery_lists.sql` l.91-92, **vérifié Sprint 28**) ; RPC `cocher_element_epicerie` (même fichier, l.151-200, **vérifié Sprint 28** — gabarit SECURITY DEFINER) ; `grocery_items` **sans** colonne `quantity` (l.40-57, **vérifié Sprint 28**) ; `GROCERY_ITEM_COLUMNS` (`lib/epicerie/db-rows.ts:14`, **vérifié Sprint 28**).

### Accueil — suite du soin visuel (distinction week-end / surbrillance / légende en carte)
**Objectif** : prolonger le polissage de l'accueil au-delà des titres (Sprint 28) — options écartées ce sprint : marquer samedi/dimanche dans la grille, renforcer la surbrillance « aujourd'hui », transformer la légende en carte bordée.
**Complexité** : Faible (frontend pur ; respecter NFR-12, i18n, ne jamais allonger un parcours clé). **Cadrer le périmètre exact avec l'auteur avant d'implémenter** (« plus beau » est subjectif).
**Référence** : `VueCoupDoeil` (`components/horaire/vue-coup-doeil.tsx` — grille `grid grid-cols-7`, en-tête `LETTRES_SEMAINE`, cases `h-11`, ring `ring-2 ring-white` pour aujourd'hui, **vérifié Sprint 28**) ; `TitreSection`/`PastilleNombre`/`TuileNav` réutilisables (**vérifiés Sprint 28**) ; i18n `fr.horaire` (`lib/i18n/fr.ts`).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests ; `payday.test.ts:69-71` asserte aujourd'hui que `"mensuel"` est **rejeté** → à inverser). **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye` l.11, `frequencePayeSchema` l.14, `JOURS_PAR_FREQUENCE` l.22-25 — **vérifié Sprint 28**) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` (`supabase/migrations/20260624120000_sprint17_payday_settings.sql:14`, **vérifié Sprint 28**) ; `payday.test.ts:69-71` (rejet `"mensuel"` à inverser, **vérifié Sprint 28**).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 29 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint29-<nom-court> (à créer depuis dev).

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
