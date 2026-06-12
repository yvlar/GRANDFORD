# Carte d'embarquement — Sprint 6 : Fenêtre de sommeil par défaut

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 5 livré : capture d'écart ≤ 3 taps (OT = 2 taps), RPC atomique écart + motif, suppression cascade, motif jamais vers la conjointe. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint livre **FR-6** : la fenêtre de sommeil configurée **une fois**, auto-appliquée à chaque quart de nuit, **ajustable au cas par cas**.

## LECTURE OBLIGATOIRE

1. `.claude/rules/conventions-frontend.md` — reconnaissance > rappel, chaînes dans `lib/i18n/fr.ts`, la fenêtre de sommeil est de la **disponibilité partageable** (pas un motif).
2. `.claude/rules/supabase-rls.md` — tests d'isolation si le sprint touche schéma/policy (l'ajustement au cas par cas pourrait l'exiger).
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Table prête** : `sleep_defaults(start_time, end_time)`, unique par (foyer, travailleur) — `supabase/migrations/20260611192620_initial_schema.sql:138` ; RLS « membre du foyer » déjà posée (`20260611192623_rls_policies.sql:162`). **Aucune UI d'écriture n'existe** : seul un test d'isolation y insère (`supabase/tests/rls-isolation.test.ts:171`).
- **La vue consomme déjà la fenêtre** : chargement accueil — `app/page.tsx:112` ; repli heuristique 8 h après la fin du quart de nuit — `defaultSleepWindow`, `lib/schedule/status.ts:36` ; application au jour suivant un quart de nuit — `dayStatuses`, `status.ts:68`. Configurer = insérer/upserter une ligne, la vue suit.
- **⚠️ « Ajustable au cas par cas » n'a PAS de support en BD** : aucune table d'ajustement par date. À trancher en session SANS réinventer le schéma : nouvelle table dédiée (migration + RLS + tests d'isolation) ou report de l'ajustement fin à un sprint ultérieur si FR-6 est satisfaisable autrement — décision à documenter.
- **Modèles existants** : upsert sous RLS — `definirEquipe`, `app/foyer/actions.ts:62` ; formulaire serveur simple — `components/equipe/selecteur-equipe.tsx` ; panneau client interactif — `components/capture/panneau-capture.tsx`.

## TÂCHE — Sprint 6

### Spécification

1. **Configuration unique (FR-6)** : le travailleur règle sa fenêtre (début/fin) une seule fois — UI minimale (page foyer ou accueil 1re fois), upsert `sleep_defaults`.
2. **Auto-application** : chaque jour suivant un quart de nuit affiche la fenêtre configurée (déjà câblé dans `dayStatuses` — le vérifier, pas le réécrire).
3. **Ajustement au cas par cas** : selon la décision de la prémisse 3 (table dédiée ou report documenté).
4. La conjointe voit la fenêtre (disponibilité partagée) — déjà le cas, à constater.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — logique pure testée ; isolation RLS étendue si schéma/policy touchés ; compteur **mesuré**.
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.

### Preuve d'acceptation observable

1. Configurer la fenêtre une fois ; un jour post-nuit l'affiche dans la pastille/grille (constaté à l'écran).
2. Sans configuration : l'heuristique 8 h reste le repli (constaté).
3. Si ajustement par date livré : l'ajuster sur UN jour ne change pas les autres (constaté).

## SPRINTS SUGGÉRÉS

### Sprint 7 — Notifications
**Objectif** : Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 sem. / 1 jour.
**Complexité** : Élevée
**Justification** : cœur « prothèse de mémoire » ; tables prêtes, tout le déclenchement à bâtir.
**Référence** : `reminders` — `supabase/migrations/20260611192620_initial_schema.sql:178` ; `push_subscriptions` — `…:204` ; pg_cron + Edge Function — `docs/analyse/03-architecture/architecture.md:121`. Pipeline d'envoi **à créer**.

### Sprint 8 — Mise en ligne + filets
**Objectif** : Vercel + Supabase Cloud (CA/US-est), Sentry/UptimeRobot, sauvegardes, test PWA + push sur l'iPhone réel (R11/U-7) — **et validation des flux GoTrue réels** (lien magique, OAuth, actions serveur de capture) reportée des Sprints 3-5.
**Complexité** : Moyenne
**Justification** : la dette « GoTrue jamais exécuté » doit se solder contre un vrai projet ; `GRANDFORD_DEMO` ne doit jamais y être défini.
**Référence** : `docs/analyse/03-architecture/architecture.md:130` ; contraintes documentées dans `ROADMAP.md` (Sprints 2-5).

### v1.1 (après MVP) — Co-planification conjointe
**Objectif** : notes (FR-8) et requêtes approuver/refuser (FR-9, mécanisme de fraîcheur O-1).
**Complexité** : Moyenne
**Justification** : premier apport actif pour la conjointe ; tables prêtes.
**Référence** : `notes` — `supabase/migrations/20260611192620_initial_schema.sql:152` ; `requests` — `…:163`. UI **à créer**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 6 (Fenêtre de sommeil par défaut) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint06-sommeil-defaut (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier
  l'absence de support BD pour l'ajustement par date (décision à documenter).
- La fenêtre de sommeil est de la disponibilité PARTAGEABLE — jamais un motif (R7).
- Le moteur (lib/engine/) ne se modifie PAS ; golden intouchables.
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build,
  tous verts ; isolation RLS étendue si schéma/policy touchés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
