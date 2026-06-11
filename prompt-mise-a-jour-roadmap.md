# Carte d'embarquement — Sprint 1 : Échafaudage + moteur Pitman

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Pré-code : la gouvernance est posée, **aucun code applicatif n'existe**. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint crée le squelette du dépôt et la première brique de valeur — le moteur.

## LECTURE OBLIGATOIRE

1. `CLAUDE.md` (index, structure cible, stack)
2. `ROADMAP.md` (état courant + périmètre)
3. `.claude/rules/moteur-pitman.md` + `.claude/rules/tests-vitest.md` (règles cadrées à ce sprint ; les règles universelles s'appliquent toujours)

## TÂCHE — Sprint 1

### Spécification

1. **Échafauder** le projet : Next.js (App Router) + TypeScript **strict**, pnpm, Biome, Tailwind CSS, shadcn/ui (init), Serwist (manifest PWA + service worker minimal). Respecter la structure cible de `CLAUDE.md`. Aucune page produit encore — une page d'accueil placeholder suffit.
2. **Init Supabase CLI** (`supabase init`) : dossier `supabase/` prêt pour les migrations. **Aucune table** (c'est le Sprint 2).
3. **Moteur Pitman** dans `lib/engine/` (spécification : `docs/analyse/03-architecture/architecture.md:98-106`) :
   - Types `Team` (`'A'|'B'|'C'|'D'`), `CycleTemplate` (`anchorDate: '2026-06-03'`, `pattern` = 14 booléens A/C — `docs/analyse/01-decouverte/02-cas-utilisation.md:61`, heures de quart).
   - Fonction pure `shiftForDate(team, date, cycleTemplate)` → `{ working, shift: 'jour'|'nuit'|null, superCrew: 'AC'|'BD' }` (`architecture.md:101`).
   - Helper `scheduleRange(team, from, to, cycleTemplate)` (génération à la volée, **aucune date stockée**).
   - Mod **mathématique** (résultat ≥ 0 pour les dates antérieures à l'ancre) ; raisonner en date civile locale (America/Toronto).
4. **Tests golden** (Vitest) encodant les points réels validés (`02-cas-utilisation.md:108-118`) :
   - 3 juin 2026 = A jour + C nuit · 4 juin = A + C · 5 juin = B + D (ancrage)
   - 11 juin 2026 = équipe A en **congé** (B/D travaille)
   - 25 déc. 2026 = équipe A **travaille de jour** (`02-cas-utilisation.md:87`)
   - Reconstruction **intégrale** de la table juin 2026 (`02-cas-utilisation.md:68-85`)
   - Propriétés : 7 jours ON sur 14 ; complémentarité stricte A/C vs B/D ; périodicité 14 jours ; dates avant l'ancre.
5. **Script de démonstration** `pnpm demo:juin` : imprime le calendrier de juin 2026 (jour | équipe jour | équipe nuit | au repos).
6. Câbler `.env.example` (déjà à la racine) : le scaffold lit `.env`, ne le commite jamais.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — golden + propriétés verts (compteur **mesuré**, jamais estimé)
- `pnpm tsc --noEmit` — 0 erreur
- `pnpm biome check .` — 0 erreur / 0 warning
- `pnpm build` — succès

### Preuve d'acceptation observable

1. La sortie réelle de `pnpm vitest run` montre les golden des points réels **qui passent** (3-5 juin, 11 juin, 25 déc. 2026).
2. La sortie de `pnpm demo:juin` est **identique** à la table validée de `02-cas-utilisation.md:68-85` — dont 11 juin = A/C au repos.
3. `pnpm build` produit une PWA : manifest présent et service worker enregistré (constaté, pas supposé).

## SPRINTS SUGGÉRÉS

### Sprint 2 — Schéma Postgres + RLS + tests d'isolation
**Objectif** : créer les tables du domaine avec RLS « membre du foyer » partout et l'étanchéité du motif, prouvées par des tests d'isolation automatisés.
**Complexité** : Élevée
**Justification** : gate de sécurité critique (R7) ; tout le produit s'appuie dessus ; à faire avant toute UI connectée.
**Référence** : liste des tables — `docs/analyse/03-architecture/architecture.md:109` ; étanchéité `exception_private` — `architecture.md:111`. Les tables elles-mêmes sont **à créer** (aucune n'existe).

### Sprint 3 — Auth sans mot de passe + foyer
**Objectif** : lien magique + OAuth, invitation de la conjointe par lien/code, révocation par le propriétaire.
**Complexité** : Moyenne
**Justification** : préalable à toute donnée réelle de foyer ; Supabase Auth porte le gros du travail.
**Référence** : spécification — `architecture.md:114-117`. Flux d'invitation/révocation **à créer**.

### Sprint 4 — Vue « coup d'œil »
**Objectif** : accueil pastille Aujourd'hui + semaine + mois, consommant le moteur ; vue conjointe = disponibilité sans motif.
**Complexité** : Moyenne
**Justification** : première valeur visible ; dépend du moteur (Sprint 1) et de l'auth (Sprint 3).
**Référence** : FR-2, FR-3 — `docs/analyse/02-analyse/analyse.md:16-17` ; NFR-1 (< 2 s) — `analyse.md:50`. Écrans **à créer**.

### Sprint 5 — Capture d'exception ≤ 3 taps
**Objectif** : 1 bouton → 6 tuiles → confirmation ; motif stocké côté privé uniquement.
**Complexité** : Moyenne
**Justification** : c'est le cœur de la thèse produit (fiabilité des écarts) ; dépend du schéma (Sprint 2).
**Référence** : FR-4, FR-5, FR-7 — `analyse.md:20-23`. Flux **à créer**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 1 (Échafaudage + moteur Pitman) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint01-echafaudage-moteur (à créer).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (prémisse fausse → STOP).
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build, tous verts.
- Preuve d'acceptation observable (sorties réelles), compteurs mesurés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
