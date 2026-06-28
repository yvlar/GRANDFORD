# Carte d'embarquement — Sprint 27 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 26 livré : **tuiles de navigation d'accueil**. Les deux liens textuels empilés du header de `/` (`📌 Note du frigo` et `Mon foyer`) sont devenus **deux grandes tuiles contrastées côte à côte** — **Mon foyer à gauche** (🏠 → `/foyer`), **Note du frigo à droite** (📌 → `/frigo`, pastille de non-lues conservée). Composant local `TuileNav` (`components/horaire/vue-coup-doeil.tsx`), `<nav aria-label={fr.horaire.navAria}>`, param démo `frigo` sur `/demo/horaire`. Frontend pur, aucune migration. Version 0.26.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 26)** : `VueCoupDoeil` (`components/horaire/vue-coup-doeil.tsx`) est un **composant client** (le moteur Pitman tourne dans le navigateur, NFR-4). Le header ne porte plus que le logo + `t.horaireDe(workerName)` ; la navigation vit dans un `<nav className="grid grid-cols-2 gap-3">` **sous** le header, rendu par deux `TuileNav`. **Ordre = ordre source** (grille 2 colonnes) : Mon foyer d'abord (gauche), Note du frigo ensuite (droite). La pastille de non-lues (`frigoNonLues`, prop défaut `0`) est passée en `children` de la tuile frigo et garde son `aria-label` (`fr.frigo.pastilleAria`). **R7** : la pastille n'est qu'un **compte**, jamais un corps de note. Toute chaîne visible passe par `lib/i18n/fr.ts` (jamais en dur) — la clé `fr.horaire.navAria` a été ajoutée pour le landmark. La preuve UI s'observe sur `/demo/horaire` (gabarit `GRANDFORD_DEMO=1`) : param `frigo=N` pour afficher la pastille ; le rendu réel se constate dans Chromium (Playwright global `/opt/node22/lib/node_modules/playwright`, browser via `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` ; lancer `next dev` avec des `NEXT_PUBLIC_*` factices car ces variables sont **inlinées au build** — un `next start` buildé sans elles fait planter le middleware).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `.claude/rules/conventions-frontend.md` si le sprint touche `app/**`/`components/**` (Server Components par défaut, NFR-12 accessibilité TDAH, i18n d'abord, R7 côté client) ; `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migration Cloud Sprint 25 — À APPLIQUER** : `20260628120000_sprint25_grocery_lists.sql` (tables `grocery_lists`/`grocery_items`, trigger, RLS, RPC `cocher_element_epicerie`, publication Realtime) **pas encore confirmée sur Cloud** (projet `eirlzscgxeybyeinpmsi`, via Supabase MCP après confirmation). Puis **régénérer les types** (le générateur MCP retire `graphql_public` — ne pas écraser le fichier du dépôt ; `lib/database.types.ts` a été hand-edité fidèlement). **Déployer l'Edge `notify-grocery`** (+ confirmer `SUPABASE_SERVICE_ROLE`/`SUPABASE_FUNCTIONS_URL` côté Vercel).
**Migrations Cloud Sprints 23/24 — À VÉRIFIER/APPLIQUER si pas déjà fait** : `20260627120000_sprint23_fridge_note_replies.sql` et `20260627130000_sprint24_fridge_note_pin.sql` (colonne `parent_id`, trigger un-seul-niveau, `is_pinned`, index unique, RPC `epingler_note_frigo`).
**Dérive du journal de migrations (cosmétique).** Sur Cloud, certains objets ne correspondent pas 1:1 aux noms/horodatages des fichiers. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis.
**Sprint 26 — aucune tâche opérationnelle** (frontend pur, aucune migration, aucun déploiement).

## SPRINTS SUGGÉRÉS (3-5)

### Épicerie — renommer une liste / quantités par article (suite Sprint 25)
**Objectif** : permettre de **renommer** une liste après création et/ou d'ajouter une **quantité** à un article (« Lait ×2 »).
**Complexité** : Moyenne. Renommage = nouveau chemin d'écriture sur `grocery_lists` : la table n'a **aucun grant/policy UPDATE** aujourd'hui (volontaire, pour protéger `last_check_notified_at`) → il faudra un **RPC `renommer_liste_epicerie`** (calque `cocher_element_epicerie`) ; quantité = colonne `quantity` + RPC d'ajustement. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `grocery_lists` (pas de policy UPDATE — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**) ; `GROCERY_ITEM_COLUMNS` (`lib/epicerie/db-rows.ts`, colonne `quantity` **à créer**) ; `grouperListes` (`lib/epicerie/types.ts`).

### Épicerie — vider/archiver les articles cochés d'une liste (suite Sprint 25)
**Objectif** : un bouton « Vider les achetés » qui retire (ou archive) en un geste tous les articles cochés d'une liste.
**Complexité** : Moyenne (suppression en lot sous RLS membre — déjà permise ; ou colonne `archived_at` + filtre). Pas de schéma si simple suppression en lot. **À confirmer avant d'implémenter.**
**Référence** : RLS `grocery_items_delete` (membre — `supabase/migrations/20260628120000_sprint25_grocery_lists.sql`, **vérifié Sprint 25**) ; action `retirerElementEpicerie` (`app/epicerie/actions.ts`) à généraliser en lot.

### UI/UX — poursuivre la modernisation de l'accueil (suite Sprint 26)
**Objectif** : prolonger le travail visuel du Sprint 26 — p. ex. soigner la **bande semaine** / la **légende** de la grille, ou ajouter un raccourci visuel vers l'épicerie sur `/` (pas d'indicateur épicerie aujourd'hui sur l'accueil).
**Complexité** : Faible à Moyenne (frontend pur ; respecter NFR-12, i18n, ne jamais allonger un parcours clé sans justification). **Cadrer le périmètre exact avec l'auteur avant d'implémenter** (le « plus beau » est subjectif).
**Référence** : `VueCoupDoeil` (`components/horaire/vue-coup-doeil.tsx` — bande semaine `grid grid-cols-7`, légende `flex flex-wrap`, **vérifié Sprint 26**) ; `TuileNav` réutilisable (`components/horaire/vue-coup-doeil.tsx`, **créé Sprint 26**) ; i18n `fr.horaire` (`lib/i18n/fr.ts`).

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
le Sprint 27 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint27-<nom-court> (à créer depuis dev).

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
