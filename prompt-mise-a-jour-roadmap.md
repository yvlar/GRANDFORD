# Carte d'embarquement — Sprint 2 : Schéma Postgres + RLS + tests d'isolation

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 1 livré : le squelette du dépôt et le **moteur Pitman pur** (`lib/engine/`) existent et sont verts (vitest 27, tsc 0, biome 0, build OK). État courant : voir la table en tête de `ROADMAP.md`. Ce sprint pose la **base de données** et sa sécurité — la préoccupation critique du projet (R7).

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — **règle cadrée centrale de ce sprint** (RLS partout, étanchéité du motif, tests d'isolation = livrable de 1re classe).
2. `.claude/rules/tests-vitest.md` — priorité 2 = isolation RLS ; compteurs mesurés.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Le CLI Supabase n'est PAS encore une devDependency** (`package.json` ne le contient pas — vérifié au Sprint 1). 1re tâche : `pnpm add -D supabase`, puis confirmer `pnpm supabase --version`. Le `supabase/config.toml` existe déjà (rédigé à la main au Sprint 1) ; le rejouer/étendre via le CLI.
- **Les tests d'isolation RLS exigent un Postgres réel** (`supabase start` → Docker). Vérifier que l'environnement le permet ; sinon, STOP et signaler (l'isolation ne se teste pas à blanc).
- **Aucune table n'existe** (`supabase/migrations/` ne contient que `.gitkeep`). Tout est **à créer**.

## TÂCHE — Sprint 2

### Spécification

1. **Migrations SQL** (`supabase/migrations/`, via `supabase migration new …`) créant les tables du domaine, **toutes porteuses de `household_id`** (`docs/analyse/03-architecture/architecture.md:109`) :
   `households · profiles · memberships(role) · cycle_templates · worker_assignments(team) · exceptions · exception_private(motif) · sleep_defaults · notes · requests(status) · reminders · audit_log · push_subscriptions`.
   - `cycle_templates` doit pouvoir stocker un gabarit du moteur (ancre, pattern 14 bits, heures) — aligné sur `lib/engine/types.ts` (`CycleTemplate`).
   - `worker_assignments(team)` relie un profil à une équipe `'A'|'B'|'C'|'D'`.
2. **RLS activée sur TOUTE table, sans exception** ; politique de base « membre du foyer » via `household_id` (`architecture.md:110`).
3. **Étanchéité du motif** (`architecture.md:111`, R7) : le motif vit **uniquement** dans `exception_private`, policy « travailleur propriétaire seul ». La conjointe lit `exceptions` (présent/absent) et ne peut **jamais** joindre/sélectionner le motif. Aucune vue/fonction ne recombine les deux pour un non-propriétaire.
4. **Types générés** : `supabase gen types typescript` → fichier committé (jamais écrit à la main).
5. **Tests d'isolation** (Vitest + supabase-js, contre le Postgres local) — les 3 scénarios de `supabase-rls.md` :
   1. un membre du foyer A ne lit jamais les données du foyer B ;
   2. la conjointe ne lit jamais `exception_private` (motif) ;
   3. un membre **révoqué** perd tout accès immédiatement.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — moteur (déjà vert) **+ isolation RLS** verts (compteur **mesuré**)
- `pnpm tsc --noEmit` — 0 erreur (types générés inclus)
- `pnpm biome check .` — 0 erreur / 0 warning
- `pnpm build` — succès

### Preuve d'acceptation observable

1. La sortie réelle de `pnpm vitest run` montre les 3 tests d'isolation **qui passent** — dont une requête de la conjointe sur le motif qui **échoue ou retourne 0 ligne** (constaté, pas supposé).
2. `supabase db reset` (ou équivalent) applique toutes les migrations **sans erreur** sur une base vierge.
3. Une requête manuelle d'un membre du foyer B sur une ligne du foyer A retourne **0 ligne** (RLS active), démontré dans la session.

## SPRINTS SUGGÉRÉS

### Sprint 3 — Auth sans mot de passe + foyer
**Objectif** : lien magique + OAuth Google/Apple ; invitation de la conjointe par lien/code à usage unique ; révocation par le propriétaire.
**Complexité** : Moyenne
**Justification** : préalable à toute donnée réelle de foyer ; Supabase Auth porte le gros du travail ; s'appuie sur `memberships(role)` du Sprint 2.
**Référence** : spécification — `docs/analyse/03-architecture/architecture.md:114-117`. Flux d'invitation/révocation **à créer**.

### Sprint 4 — Vue « coup d'œil »
**Objectif** : accueil pastille Aujourd'hui (CONGÉ/JOUR/NUIT/SOMMEIL) + semaine + mois, consommant le moteur ; vue conjointe = disponibilité sans motif.
**Complexité** : Moyenne
**Justification** : première valeur visible ; le moteur (Sprint 1) expose déjà `crewsForDate`/`shiftForDate`/`scheduleRange` — vérifié dans `lib/engine/pitman.ts`.
**Référence** : FR-2, FR-3 — `docs/analyse/02-analyse/analyse.md:16-17` ; NFR-1 (< 2 s) — `analyse.md:50`. Écrans **à créer**.

### Sprint 5 — Capture d'exception ≤ 3 taps
**Objectif** : 1 bouton → 6 tuiles → confirmation ; motif stocké côté privé uniquement (`exception_private`).
**Complexité** : Moyenne
**Justification** : cœur de la thèse produit (fiabilité des écarts) ; dépend du schéma + étanchéité du Sprint 2.
**Référence** : FR-4, FR-5, FR-7 — `docs/analyse/02-analyse/analyse.md:20-23`. Flux **à créer**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 2 (Schéma Postgres + RLS + tests d'isolation) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint02-schema-rls (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (le CLI Supabase
  n'est pas encore installé ; les tests d'isolation exigent un Postgres réel).
- RLS sur TOUTE table ; le motif ne sort JAMAIS vers la conjointe (R7).
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build, tous verts,
  + les 3 tests d'isolation RLS.
- Preuve d'acceptation observable (sorties réelles), compteurs mesurés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
