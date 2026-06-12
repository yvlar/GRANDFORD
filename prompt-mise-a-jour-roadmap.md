# Carte d'embarquement — Sprint 4 : Vue « coup d'œil »

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 3 livré : auth sans mot de passe (lien magique + OAuth, validée au niveau BD), foyer complet (création, invitation à usage unique, révocation), client Supabase typé + middleware de session. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint livre la **première valeur visible** : l'horaire « coup d'œil » (FR-2) et la vue conjointe sans motif (FR-3).

## LECTURE OBLIGATOIRE

1. `.claude/rules/moteur-pitman.md` — le moteur est **consommé**, jamais modifié ; golden intouchables ; date civile America/Toronto ; quart de nuit = date de **début**.
2. `.claude/rules/conventions-frontend.md` — accueil lisible **< 2 s** (NFR-1), reconnaissance > rappel (pastilles/couleurs, pas de texte), hors-ligne (NFR-4 : le moteur tourne côté client), **la vue conjointe ne reçoit jamais le motif** (R7), chaînes dans `lib/i18n/fr.ts`.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Moteur prêt et testé** (Sprint 1, vérifié) : `shiftForDate(team, date, template)` — `lib/engine/pitman.ts:101` ; `scheduleRange` — `lib/engine/pitman.ts:111` ; gabarit validé `GRANDFORD_CYCLE` — `lib/engine/cycle-template.ts`. Ne PAS toucher au moteur.
- **Schéma prêt** (Sprint 2, vérifié) : `worker_assignments(team)` — `supabase/migrations/20260611192620_initial_schema.sql:81` ; `exceptions(effect, shift, on_date)` — `…:95` ; `sleep_defaults` — `…:138` ; `cycle_templates` — `…:65`. La conjointe lit `exceptions`, jamais `exception_private` (RLS, testée).
- **⚠️ Aucune affectation d'équipe en UI** : `worker_assignments` n'a ni écran ni action (seul le seed des tests en crée). La vue a besoin de l'équipe du travailleur → prévoir la sélection d'équipe (onboarding ou page foyer) **à créer** ce sprint.
- **⚠️ Aucun `cycle_templates` réel en BD hors seed des tests** : décider — ensemencer le gabarit du foyer à la création (`create_household_with_membership` étendue ou à l'affectation d'équipe), ou lire `GRANDFORD_CYCLE` côté client en attendant FR-17. Réconcilier avant d'implémenter.
- **Hors-ligne (NFR-4)** : l'horaire de base se calcule **côté client** (moteur pur) ; seuls les écarts viennent du réseau. La pastille du jour ne doit jamais afficher un spinner réseau pour l'horaire normal.

## TÂCHE — Sprint 4

### Spécification

1. **Affectation d'équipe (pré-requis de la vue)** : le travailleur choisit son équipe A/B/C/D (une fois) → `worker_assignments` ; modifiable dans la page foyer.
2. **Vue travailleur (FR-2)** : accueil connecté = pastille **Aujourd'hui** (CONGÉ / JOUR / NUIT / SOMMEIL — gros, contrasté, lisible < 2 s) + bande **semaine** + grille **mois**. Moteur appelé côté client ; écarts (`exceptions`) superposés ; sommeil affiché après un quart de nuit (`sleep_defaults` si présents, sinon heuristique simple documentée).
3. **Vue conjointe (FR-3)** : même accueil, mais sémantique **disponibilité** (travaille / disponible / sommeil) du travailleur du foyer ; aucune donnée de `exception_private` ne transite (ni payload, ni prop, ni log — R7).
4. **Navigation** : l'accueil public actuel devient la porte d'entrée (connexion) ; l'usager connecté voit sa vue selon son rôle (`memberships.role`).

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — moteur (golden intacts) + isolation RLS + logique critique d'UI (superposition écarts/sommeil en fonctions pures testées) ; compteur **mesuré**.
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- Si le sprint touche schéma/policy (ex. seed de `cycle_templates`) : tests d'isolation étendus.

### Preuve d'acceptation observable

1. Captures/démo : pastille du jour correcte pour les **points réels validés** (2026-06-11 : équipe A **CONGÉ** ; 2026-12-25 : équipe A **JOUR**) — constaté à l'écran, pas seulement en test.
2. Le travailleur avec une exception « off » voit CONGÉ ce jour-là ; sa conjointe voit « disponible/absent » **sans motif** — constaté (payload réseau inspecté : aucun champ motif).
3. L'horaire du mois s'affiche sans réseau (moteur client) — constaté (mode hors-ligne).

## SPRINTS SUGGÉRÉS

### Sprint 5 — Capture d'exception ≤ 3 taps
**Objectif** : 1 bouton → 6 tuiles (OT, congé, maladie, échange, formation, vacances) → confirmation ; motif côté privé seulement ; OT = geste le plus rapide.
**Complexité** : Moyenne
**Justification** : cœur de la thèse produit ; schéma prêt.
**Référence** : `exceptions` — `supabase/migrations/20260611192620_initial_schema.sql:95` ; `exception_private` — `…:120` ; FR-4/5/7 — `docs/analyse/02-analyse/analyse.md:20-23`. Flux UI **à créer**.

### Sprint 6 — Fenêtre de sommeil par défaut
**Objectif** : configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas.
**Complexité** : Faible/Moyenne
**Justification** : table prête ; la vue du Sprint 4 consomme déjà l'affichage sommeil.
**Référence** : `sleep_defaults` — `supabase/migrations/20260611192620_initial_schema.sql:138` ; FR-6 — `analyse.md:22`. Logique d'application **à créer**.

### Sprint 7 — Notifications
**Objectif** : Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 sem. / 1 jour.
**Complexité** : Élevée
**Justification** : tables `reminders`/`push_subscriptions` prêtes (Sprint 2) ; pg_cron + Edge Function **à créer**.
**Référence** : `architecture.md:119-123` ; FR-10.

### Sprint 8 — Mise en ligne + filets
**Objectif** : Vercel + Supabase Cloud (CA/US-est), Sentry/UptimeRobot, sauvegardes, test PWA + push sur l'iPhone réel (R11/U-7) — **et validation des flux GoTrue réels** (lien magique, OAuth) reportée du Sprint 3.
**Complexité** : Moyenne
**Justification** : la dette « GoTrue jamais exécuté » doit se solder contre un vrai projet.
**Référence** : `architecture.md:130` ; contrainte documentée dans `ROADMAP.md` (Sprint 3).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 4 (Vue « coup d'œil ») en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint04-vue-coup-doeil (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier
  l'absence d'affectation d'équipe et de cycle_templates réels (trancher d'abord).
- Le moteur (lib/engine/) ne se modifie PAS ; golden intouchables.
- La vue conjointe ne reçoit JAMAIS le motif (R7) — vérifier le payload réseau.
- L'horaire s'affiche sans réseau (NFR-4) ; accueil lisible < 2 s (NFR-1).
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build, tous verts.
- Preuve d'acceptation observable (écran réel, mode hors-ligne), compteurs mesurés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
