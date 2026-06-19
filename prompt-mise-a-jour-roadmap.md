# Carte d'embarquement — Sprint 13 : Gabarits multi-usines (FR-17)

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 12 livré : journal des changements (FR-13) complet — trigger `trg_audit_exception`, `parseAuditRows()`, section Historique sur `/foyer`. **v1.1 entièrement complétée** (FR-8, FR-9, FR-13, FR-14). Version 0.12.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

## LECTURE OBLIGATOIRE

1. `.claude/rules/moteur-pitman.md` — le moteur est **paramétrable par design** ; l'ancre, le pattern et les heures viennent du `cycleTemplate` (jamais en dur dans la logique). FR-17 = migration de `GRANDFORD_CYCLE` vers une table BD, sans toucher à la logique pure.
2. `.claude/rules/supabase-rls.md` — nouvelle table `cycle_templates` : RLS activée, politique « membre du foyer » via `household_id` comme toutes les autres tables.
3. `.claude/rules/tests-vitest.md` — les **golden tests** du moteur sont intouchables ; tout refactoring de l'ancre ou du pattern doit les laisser verts.
4. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

- **`GRANDFORD_CYCLE` côté client** : `lib/engine/index.ts` (ligne à vérifier en session) — constante TypeScript avec `anchorDate`, `pattern`, `dayHours`, `nightHours`. À migrer vers un fetch BD, mais la constante reste le **fallback hors-ligne** (NFR-4).
- **Table `cycle_templates`** : existence à vérifier dans `supabase/migrations/20260611192620_initial_schema.sql` — si absente, à créer ; si présente, vérifier colonnes et RLS.
- **Consommateurs du moteur** : `app/page.tsx`, `lib/schedule/`, `lib/engine/` — chaque appel au `GRANDFORD_CYCLE` doit être localisé avant de modifier le type du paramètre.
- **Multi-usines au sens réel** : un foyer = un `cycle_template_id`. Le MVP 1-foyer = 1 seul template (le gabarit GRANDFORD). Pas de selector multi-usines en UI pour Sprint 13 (trop large) — seulement la fondation BD + câblage côté client.

## TÂCHE — Sprint 13

### Sous-tâche 1 : Table `cycle_templates` (migration)

1. Si absente : migration `…_sprint13_cycle_templates.sql` — table `cycle_templates (id uuid PK, household_id uuid FK → households, anchor_date date, pattern boolean[14], day_hours jsonb, night_hours jsonb, created_at)` ; RLS activée, policy `is_household_member(household_id)`.
2. Si présente : vérifier colonnes, policies, et adapter.
3. Migration de données : insérer le gabarit GRANDFORD dans `cycle_templates` pour le foyer existant (seed de test) ; en prod, appliquer via Edge Function ou script one-shot.
4. `supabase gen types typescript` → types committés.

### Sous-tâche 2 : Fetch BD côté serveur + fallback hors-ligne

1. Nouveau helper `lib/engine/template.ts` : `fetchCycleTemplate(supabase, householdId)` → `CycleTemplate | null`.
2. `app/page.tsx` : charger le template depuis la BD (Promise.all) → passer au moteur ; fallback = `GRANDFORD_CYCLE` si null (NFR-4, hors-ligne).
3. `GRANDFORD_CYCLE` reste exporté comme constante (fallback + tests) — ne pas supprimer.
4. Moteur inchangé (fonctions pures, le paramètre `CycleTemplate` existait déjà) — les golden restent verts.

### Sous-tâche 3 : Tests

- Tests d'isolation RLS sur `cycle_templates` (membre foyer A ≠ foyer B).
- Test : fallback `GRANDFORD_CYCLE` quand le fetch retourne `null`.
- Golden moteur intouchables (les faire tourner en premier avant tout refactoring).

### Gates

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- Tests d'isolation RLS si la table `cycle_templates` est créée ou modifiée.
- Golden moteur verts en premier.

### Preuve d'acceptation observable

1. `SELECT * FROM cycle_templates` → au moins une ligne avec `anchor_date = '2026-06-03'` et `pattern` de 14 booléens.
2. L'accueil (`/`) affiche toujours le bon quart pour aujourd'hui (même résultat qu'avant le sprint).
3. Couper le réseau → l'accueil reste fonctionnel (fallback `GRANDFORD_CYCLE` vérifié par test).

## SPRINTS SUGGÉRÉS

### v2+ — Gabarits multi-usines (FR-17) [recommandé pour Sprint 13]
**Objectif** : migrer `GRANDFORD_CYCLE` vers la table `cycle_templates` — fondation du produit SaaS multi-usines.
**Complexité** : Moyenne (migration BD + refactoring client léger, moteur inchangé)
**Justification** : fondation requise avant FR-16 (facturation par foyer = 1 template par foyer) et avant toute démo SaaS.
**Référence** : `GRANDFORD_CYCLE` — `lib/engine/index.ts` (ligne à vérifier en session) ; `cycle_templates` — `supabase/migrations/20260611192620_initial_schema.sql` (existence à vérifier en session).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer automatiquement l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise).
**Complexité** : Haute (API externe, tokens OAuth Dayforce, réconciliation écarts existants)
**Justification** : valeur pour les usines avec Dayforce déployé — mais dépend d'un accès réel à l'API ; non prioritaire sans client cible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Facturation SaaS (FR-16)
**Objectif** : Stripe pour les foyers supplémentaires (1er foyer gratuit, suivants payants).
**Complexité** : Haute (Stripe webhooks, portail client, gates d'accès)
**Justification** : modèle d'affaires long terme — non prioritaire avant FR-17 (1 template/foyer = unité de facturation) et avant 10 foyers actifs.
**Référence** : FR-16 — `docs/analyse/02-analyse/analyse.md`.

### Amélioration PWA — Notifications fiables (suivi Sprint 8)
**Objectif** : valider l'envoi push en production (pg_cron + Edge `send-reminders`) sur un 2ᵉ appareil réel ; résoudre les expirés de `push_subscriptions`.
**Complexité** : Faible-Moyenne (test d'intégration bout-en-bout, nettoyage des souscriptions)
**Justification** : FR-10 livré mais jamais validé E2E en prod sur plus d'un appareil — risque silencieux.
**Référence** : `supabase/functions/send-reminders/README.md` (à vérifier en session) ; `push_subscriptions` (table existante).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 13 (Gabarits multi-usines — FR-17) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint13-cycle-templates (à créer depuis dev).

Rappels non négociables :
- Réconcilier en premier : existence de cycle_templates dans les migrations, colonnes et RLS ;
  localiser GRANDFORD_CYCLE (lib/engine/index.ts) et tous ses consommateurs.
- Golden tests du moteur = intouchables ; les faire tourner en premier.
- RLS sur cycle_templates : même pattern is_household_member que toutes les autres tables.
- NFR-4 : fallback GRANDFORD_CYCLE quand la BD est inaccessible (hors-ligne).
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
