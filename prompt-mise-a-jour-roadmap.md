# Carte d'embarquement — Sprint 31 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 30 livré : **Vider les achetés d'une liste d'épicerie en un geste** — un bouton `/epicerie` retire en un DELETE tous les articles **cochés** d'une liste, sous la RLS `grocery_items_delete` existante. Frontend + une action serveur, **aucune migration**. Version 0.30.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 30)** : l'action `viderLesAchetesEpicerie(listId)` (`app/epicerie/actions.ts`) traite un DELETE à **0 ligne comme un no-op bénin**, PAS une erreur (diverge délibérément de `retirerElementEpicerie`/`supprimerListeEpicerie`) — pattern réutilisable pour toute future action « en lot » où une course avec l'autre membre est acceptable. Composant local **`ActionConfirmee`** (`components/epicerie/listes-epicerie.tsx`) factorise le bouton « action destructive confirmée en 2 temps » — **à réutiliser** pour toute nouvelle action destructive sur une liste/un article plutôt que de recopier le JSX. Piège identifié et corrigé pendant la revue : un filtre client optimiste qui ré-évalue un prédicat sur l'état COURANT après un `await` (au lieu d'un instantané pris AVANT l'aller-retour serveur) peut faire disparaître localement une donnée que le serveur n'a jamais touchée — capturer les ids ciblés avant l'`await`, filtrer sur ces ids après. La preuve d'acceptation Sprint 30 s'observe sur `/demo/epicerie` (route démo existante, gabarit `GRANDFORD_DEMO=1`, Chromium via Playwright **global** `/opt/node22/lib/node_modules/playwright`, exécutable `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`), `next dev` avec des `NEXT_PUBLIC_*` factices. **Avant tout gate** : `pnpm install` (le conteneur démarre sans `node_modules`).

> **Lacune découverte (non corrigée, hors périmètre Sprint 30 — voir SPRINTS SUGGÉRÉS)** : les tables `grocery_lists`/`grocery_items`/`fridge_notes` n'ont pas `REPLICA IDENTITY FULL`. Par défaut, Postgres n'inclut que la clé primaire dans l'« ancienne ligne » d'un événement `DELETE` répliqué — si c'est le cas ici, les abonnements Realtime `postgres_changes` **filtrés sur `household_id`** (utilisés par `components/epicerie/listes-epicerie.tsx` et `components/frigo/tableau-frigo.tsx` pour les événements DELETE) pourraient ne **jamais se déclencher** chez l'autre membre, qui ne verrait la suppression qu'au prochain rechargement. Pré-existant (touche déjà `retirerElementEpicerie`/`supprimerListeEpicerie`/suppression de note), pas introduit par Sprint 30 — mais ce sprint le rend routinier (usage hebdomadaire prévu). **Non vérifié empiriquement** (le Postgres local des tests d'isolation n'a pas la publication `supabase_realtime` — voir garde dans les migrations) : à confirmer contre le Cloud avant de corriger.

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `.claude/rules/supabase-rls.md` si le sprint touche `supabase/**` ou un accès données (RLS sur toute table, étanchéité du motif R7, RPC SECURITY DEFINER) ; `.claude/rules/conventions-frontend.md` si `app/**`/`components/**` (Server Components, NFR-12, i18n d'abord) ; `.claude/rules/moteur-pitman.md` / `.claude/rules/tests-vitest.md` si le sprint touche la couche horaire/moteur ; `ROADMAP.md` (état + périmètre). Les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migrations Cloud Sprints 23/24/25 — ✅ FAIT** (vérifié en sessions antérieures via Supabase MCP, projet `eirlzscgxeybyeinpmsi`) : tables/RPC/triggers/Realtime `fridge_notes` et `grocery_*` présents, RLS active, Edge `notify-grocery` ACTIVE. `/frigo`, `/epicerie` et les pastilles d'accueil fonctionnent en prod.
**Dérive du journal de migrations (cosmétique, persistante)** : sur Cloud, les horodatages des migrations ne correspondent pas 1:1 aux noms de fichiers du dépôt. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis. **Seule vraie tâche opérationnelle restante.**
**Sprint 30 — aucune tâche opérationnelle** (RLS existante suffit ; aucune migration, aucun déploiement).

## SPRINTS SUGGÉRÉS (3-5)

### Realtime DELETE : vérifier/corriger REPLICA IDENTITY sur les tables filtrées par household_id (suite Sprint 30)
**Objectif** : confirmer contre Supabase Cloud si les événements `postgres_changes` DELETE filtrés par `household_id` sont bien livrés à l'autre membre pour `grocery_items`, `grocery_lists`, `fridge_notes` ; si non, poser `alter table … replica identity full` en migration.
**Complexité** : Faible à vérifier (test manuel ou script contre Cloud), faible à corriger si confirmé (1 migration, 3 `ALTER TABLE`). **Nécessite un projet Cloud réel** (le Postgres local des tests d'isolation n'a pas la publication `supabase_realtime` — non testable en session sans BD distante).
**Référence** : lacune découverte pendant la revue Sprint 30 (voir « À connaître » ci-dessus) ; garde publication `supabase_realtime` (`supabase/migrations/20260628120000_sprint25_grocery_lists.sql:123-134`, **vérifié Sprint 30**) ; gestionnaires DELETE filtrés `household_id=eq.…` (`components/epicerie/listes-epicerie.tsx:141-150`, `components/frigo/tableau-frigo.tsx`, **vérifiés Sprint 30**).

### Accueil — distinguer les journées d'ÉCHANGE de quart (suite Sprint 29)
**Objectif** : sur le modèle du marqueur OT, donner une couleur + une icône aux journées d'**échange de quart** (`effect: "shift_swap"`) — l'autre effet partageable actuellement fondu dans le point d'écart générique.
**Complexité** : Faible (le patron est posé). Ajouter un booléen `shiftSwap`/`echange` à `DayStatus` (calqué sur `overtime`), une constante `AFFICHAGE_*` + marqueur, une couleur. **Vérifier R7** : `shift_swap` est un effet partageable (`exceptions`), le motif `"echange"` reste privé.
**Référence** : `overtime` (`lib/schedule/types.ts`, posé Sprint 29) et son calcul dans `dayStatuses` (`lib/schedule/status.ts` — `exc?.effect === "working_extra"`, posé Sprint 29 ; `ExceptionEffect` inclut `"shift_swap"`, `types.ts:8`) ; `MarqueurSupplementaire`/`AFFICHAGE_SUPPLEMENTAIRE` (`components/horaire/vue-coup-doeil.tsx`, posés Sprint 29) ; label déjà présent `fr.capture.effets.shift_swap = "Échange de quart"` (`lib/i18n/fr.ts:64`, vérifié Sprint 29).

### Épicerie — renommer une liste / quantités par article (suite Sprint 25)
**Objectif** : **renommer** une liste après création et/ou ajouter une **quantité** à un article (« Lait ×2 »).
**Complexité** : Moyenne. `grocery_lists` n'a **aucune policy/grant UPDATE** (volontaire, protège `last_check_notified_at`) → un **RPC `renommer_liste_epicerie`** (calque `cocher_element_epicerie`) ; quantité = colonne `quantity` + RPC d'ajustement. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : RPC `cocher_element_epicerie` SECURITY DEFINER (`supabase/migrations/20260628120000_sprint25_grocery_lists.sql:151-200`, vérifié Sprint 29 — gabarit) ; grants `grocery_lists` sans UPDATE (même fichier `:91`, vérifié Sprint 29) ; `GROCERY_ITEM_COLUMNS` (`lib/epicerie/db-rows.ts`).

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests ; `payday.test.ts:69-71` asserte aujourd'hui que `"mensuel"` est **rejeté** → à inverser). **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye` l.11, `frequencePayeSchema` l.14, `JOURS_PAR_FREQUENCE` l.22-25 — vérifié Sprint 29) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` (`supabase/migrations/20260624120000_sprint17_payday_settings.sql:14`, vérifié Sprint 29) ; `payday.test.ts:69-71` (rejet `"mensuel"` à inverser, vérifié Sprint 29).

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 31 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint31-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- pnpm install AVANT les gates (le conteneur démarre sans node_modules). Compteurs de
  tests TOUJOURS mesurés en session (pnpm vitest run). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence, de jour de paye, NI de corps de note / libellé d'article
  d'épicerie vers un destinataire non prévu (R7) — BD, payload push, logs, rendu.
  (L'EFFET d'un écart — présent/absent/temps supplémentaire/échange — est partageable ;
  seul le MOTIF ne l'est jamais.)
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
