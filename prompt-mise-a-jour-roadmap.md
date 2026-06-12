# Carte d'embarquement — Sprint 3 : Auth sans mot de passe + foyer

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 2 livré : 13 tables + RLS « membre du foyer » + étanchéité du motif + tests d'isolation (3 scénarios) verts contre un vrai Postgres. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint branche **l'authentification sans mot de passe** (FR-11) et le **cycle de vie du foyer** (FR-12) par-dessus le schéma existant.

## LECTURE OBLIGATOIRE

1. `.claude/rules/conventions-frontend.md` — Server Components par défaut, accessibilité TDAH (accueil < 2 s, i18n français d'abord), **la vue conjointe ne reçoit jamais le motif**.
2. `.claude/rules/supabase-rls.md` — l'auth crée/révoque des `memberships` ; la révocation doit couper l'accès immédiatement (déjà testé au Sprint 2, à préserver).
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **`@supabase/supabase-js` n'est PAS encore une dépendance** (vérifié : absent de `package.json`). 1re tâche : l'ajouter (+ `@supabase/ssr` pour l'App Router), client **typé avec `lib/database.types.ts`** (généré au Sprint 2).
- **⚠️ BLOQUANT POTENTIEL — Supabase Auth (GoTrue) exige la stack Docker** (indisponible ici : CDN d'images bloqué par l'egress, constaté au Sprint 2) **ou un vrai projet Supabase Cloud**. Les flux d'auth réels (lien magique, OAuth) ne se testent donc pas localement sans Docker. **Décider la stratégie** : (a) brancher un projet Supabase Cloud (région CA/US-est) pour l'auth, ou (b) tester la logique foyer/membership au niveau BD (faisable via le harnais `supabase/tests/` du Sprint 2) et traiter GoTrue comme une frontière d'intégration mockée. Réconcilier avant d'implémenter ; sinon STOP + signalement.
- **Le schéma du foyer existe déjà** (Sprint 2) : `memberships(role 'worker'|'spouse')` — `supabase/migrations/20260611192620_initial_schema.sql:52` ; invitation = INSERT réservé au propriétaire — `supabase/migrations/20260611192623_rls_policies.sql:148` ; révocation = DELETE par le propriétaire (ou soi) — `…192623_rls_policies.sql:152` ; helper `is_household_owner` — `…192623_rls_policies.sql:29`. Ne PAS recréer ces objets : les **consommer**.
- **Création du `profiles` à l'inscription** : `profiles.id` référence `auth.users(id)` (`…192620_initial_schema.sql:32`). Il faut un pont auth.users → profiles **à créer** : trigger `handle_new_user` (migration versionnée) ou création applicative à la 1re connexion.

## TÂCHE — Sprint 3

### Spécification

1. **Client Supabase typé** (`lib/supabase/`) : variantes navigateur + serveur (App Router, `@supabase/ssr`), paramétrées par `Database` (`lib/database.types.ts`). Clés via `.env` (déjà documentées : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. **Auth (FR-11)** : lien magique par courriel + OAuth Google/Apple (`architecture.md:114`). Pages connexion / callback / déconnexion ; sessions côté serveur. Aucun mot de passe.
3. **Foyer (FR-12, `architecture.md:116`)** : à la 1re connexion, créer `profiles` + `households` (le créateur devient `owner_id`) + `memberships(role='worker')`. **Invitation** de la conjointe par lien/code à usage unique → `memberships(role='spouse')`. **Révocation** par le propriétaire (DELETE membership).
4. **Pont inscription → profil** : trigger `handle_new_user` (ou équivalent applicatif), en migration versionnée + types régénérés (`pnpm db:gen-types`).
5. **RLS** : réutiliser les policies du Sprint 2 ; toute nouvelle table (ex. jetons d'invitation, si nécessaire) porte `household_id` + RLS + tests d'isolation.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — moteur + isolation RLS (compteur **mesuré**) ; tests d'isolation **étendus** si le schéma change (trigger, table d'invitation).
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- Logique invitation/révocation testée au niveau BD (le harnais `supabase/tests/` du Sprint 2 sert de base).

### Preuve d'acceptation observable

1. Une connexion par lien magique (contre un projet réel OU la stack locale si la stratégie le permet) crée **profile + household + membership(worker)** — constaté en BD.
2. Un lien/code d'invitation utilisé par la conjointe crée **membership(role='spouse')** ; elle lit la **disponibilité** du foyer mais **0 ligne** de `exception_private` (motif) — constaté.
3. La révocation par le propriétaire fait **perdre l'accès** à la conjointe (le test de révocation du Sprint 2 reste vert).

## SPRINTS SUGGÉRÉS

### Sprint 4 — Vue « coup d'œil »
**Objectif** : accueil pastille Aujourd'hui (CONGÉ/JOUR/NUIT/SOMMEIL) + semaine + mois, consommant le moteur ; vue conjointe = disponibilité sans motif.
**Complexité** : Moyenne
**Justification** : première valeur visible ; le moteur pur (Sprint 1) est prêt et testé.
**Référence** : moteur — `lib/engine/pitman.ts` + `lib/engine/index.ts` (vérifiés) ; FR-2/FR-3 — `docs/analyse/02-analyse/analyse.md:16-17` ; NFR-1 (< 2 s). Écrans **à créer**.

### Sprint 5 — Capture d'exception ≤ 3 taps
**Objectif** : 1 bouton → 6 tuiles → confirmation ; motif stocké côté privé uniquement.
**Complexité** : Moyenne
**Justification** : cœur de la thèse produit ; le schéma est prêt — `exception_private` (motif owner-only) et `exceptions` (disponibilité) existent.
**Référence** : `supabase/migrations/20260611192620_initial_schema.sql:113` (exception_private) ; FR-4/5/7 — `docs/analyse/02-analyse/analyse.md:20-23`. Flux **à créer**.

### Sprint 6 — Fenêtre de sommeil par défaut
**Objectif** : configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas.
**Complexité** : Faible/Moyenne
**Justification** : table prête au Sprint 2.
**Référence** : `supabase/migrations/20260611192620_initial_schema.sql` (table `sleep_defaults`) ; FR-6. Logique d'application **à créer**.

### Sprint 7 — Notifications
**Objectif** : Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 sem. / 1 jour.
**Complexité** : Élevée
**Justification** : tables `reminders` / `push_subscriptions` prêtes au Sprint 2 ; reste pg_cron + Edge Function **à créer**.
**Référence** : `architecture.md:119-123` ; FR-10.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 3 (Auth sans mot de passe + foyer) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint03-auth-foyer (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier la
  stratégie d'auth (GoTrue exige Docker ou un projet Supabase Cloud : trancher d'abord).
- Réutiliser le schéma foyer du Sprint 2 (memberships, is_household_owner) — ne pas le recréer.
- La vue conjointe ne reçoit JAMAIS le motif (R7).
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build, tous verts.
- Preuve d'acceptation observable (sorties réelles), compteurs mesurés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
