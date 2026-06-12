# Carte d'embarquement — Sprint 5 : Capture d'exception ≤ 3 taps

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 4 livré : vue « coup d'œil » (pastille + semaine + mois, calcul client), sélection d'équipe, vue conjointe sans motif. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint livre le **cœur de la thèse produit** : capturer un écart en ≤ 3 taps (FR-4), motif privé (FR-5), OT ultra-rapide (FR-7) — et la vue du Sprint 4 l'affiche déjà.

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — le motif vit dans `exception_private` (travailleur propriétaire SEUL) ; toute écriture passe sous RLS ; tests d'isolation = livrable de première classe.
2. `.claude/rules/conventions-frontend.md` — capture en **≤ 3 taps** (NFR-1), reconnaissance > rappel (6 tuiles, pas un formulaire), chaînes dans `lib/i18n/fr.ts`.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifiées au Sprint 4)

- **Schéma prêt, rien à migrer a priori** : `exceptions(on_date, effect, shift)` — `supabase/migrations/20260611192620_initial_schema.sql:95` ; CHECK des 4 effets — `…:102` ; « off ⇒ shift null » — `…:109` ; `exception_private(motif, note)` avec CHECK des 6 motifs — `…:120-125` ; FK composites d'étanchéité — `…:129-133` ; un écart par travailleur/jour — `…:110`.
- **RLS prête** : écriture d'`exceptions` = membre du foyer (`…192623_rls_policies.sql:160`) ; `exception_private` = propriétaire seul (`…:173`) — testée (conjointe : 0 ligne).
- **La vue affiche déjà les écarts** : `GlanceView` superpose `exceptions` via `overviewRange` — `lib/schedule/availability.ts:94` ; effets typés par `exceptionEffectSchema` — `availability.ts:19` (source unique à réutiliser pour le formulaire).
- **⚠️ Aucune UI d'écriture d'exception n'existe** : ni bouton, ni tuiles, ni action serveur — tout le flux de capture est **à créer**. Seul le seed des tests insère des `exceptions`.
- **⚠️ Sémantique à trancher en l'implémentant** (le schéma ne l'enferme pas, voir commentaire `initial_schema.sql:107-108`) : mapping tuile → (`effect`, `shift`, `motif`) — p. ex. OT → `working_extra`, maladie/congé/vacances → `off`, échange → `shift_swap` + quart résultant, formation → à décider (`working` ou `off`). Consigner le mapping retenu.

## TÂCHE — Sprint 5

### Spécification

1. **Bouton unique** sur l'accueil travailleur (gros, sous la pastille) → écran/feuille de **6 tuiles** (OT, congé, maladie, échange, formation, vacances) → choix du jour (défaut : aujourd'hui ; OT : prochain jour de repos proposé) → confirmation. **≤ 3 taps** au total pour le cas nominal (NFR-1) ; OT = le plus court.
2. **Écriture atomique** : `exceptions` (effet partageable) + `exception_private` (motif, note facultative) — idéalement une RPC ou deux inserts dans la même action serveur ; le motif ne sort jamais de la paire table privée/travailleur (R7).
3. **Affichage immédiat** : l'écart créé apparaît dans la vue du Sprint 4 (pastille/mois) au retour ; suppression/annulation d'un écart depuis le jour concerné (geste simple).
4. **Validation Zod aux frontières** : réutiliser `exceptionEffectSchema` et le CHECK des 6 motifs ; jamais de chaîne libre pour `effect`/`motif`.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — mapping tuile → (effect, shift, motif) en fonctions pures testées ; golden moteur intacts ; compteur **mesuré**.
- **Tests d'isolation RLS étendus** (le sprint écrit des données de foyer + motif) : le travailleur crée écart + motif ; la conjointe voit l'écart mais **jamais** le motif (0 ligne) ; un membre d'un autre foyer ne peut rien créer ni lire.
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.

### Preuve d'acceptation observable

1. Compter les taps du flux réel (démo/HTML rendu) : bouton → tuile → confirmation = **3 taps**, constaté.
2. Après capture d'un « congé » sur un jour travaillé : la pastille du jour passe à CONGÉ avec marque d'écart ; la requête de la vue conjointe ne contient **aucun champ motif** (constaté : colonnes sélectionnées + test RLS).
3. Un OT sur un jour de repos s'affiche JOUR/NUIT avec marque d'écart (FR-7).

## SPRINTS SUGGÉRÉS

### Sprint 6 — Fenêtre de sommeil par défaut
**Objectif** : configurée une fois (page foyer), auto-appliquée à chaque quart de nuit, ajustable au cas par cas.
**Complexité** : Faible
**Justification** : la vue consomme déjà `sleepDefault` (heuristique 08–16 h en place) ; il ne manque que l'UI d'édition.
**Référence** : `sleep_defaults` — `supabase/migrations/20260611192620_initial_schema.sql:138` ; consommation — `lib/schedule/availability.ts:94` (`overviewRange`), `app/page.tsx` (lecture). UI d'édition **à créer**.

### Sprint 7 — Notifications
**Objectif** : Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 sem. / 1 jour à la création d'un écart.
**Complexité** : Élevée
**Justification** : tables `reminders`/`push_subscriptions` prêtes (Sprint 2) ; dépend des écarts réels du Sprint 5 ; pg_cron + Edge Function **à créer**.
**Référence** : `reminders` — `initial_schema.sql:178` ; `push_subscriptions` — `…:204` ; architecture — `docs/analyse/03-architecture/architecture.md:119`.

### Sprint 8 — Mise en ligne + filets
**Objectif** : Vercel + Supabase Cloud (CA/US-est), Sentry/UptimeRobot, sauvegardes, **test PWA + push sur l'iPhone réel** — et solde des dettes : flux GoTrue réels (S3) + observation navigateur de la vue avec session réelle (S4).
**Complexité** : Moyenne
**Justification** : deux sprints ont des preuves « écran » dues contre un vrai projet cloud.
**Référence** : `architecture.md:130` ; contraintes documentées dans `ROADMAP.md` (Sprints 3 et 4).

### (option) Sprint 5b — Journal des changements minimal
**Objectif** : tracer création/suppression d'écarts dans `audit_log` (sans motif) dès le Sprint 5, pour préparer FR-13.
**Complexité** : Faible
**Justification** : la table existe et est append-only ; l'insérer au moment de la capture coûte peu.
**Référence** : `audit_log` — `initial_schema.sql:191` ; policies — `…192623_rls_policies.sql:178-181`. FR-13 = v1.1 — à n'activer que si le Sprint 5 reste sous budget.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 5 (Capture d'exception ≤ 3 taps) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint05-capture-exception (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier
  le mapping tuile → (effect, shift, motif), à trancher et consigner.
- Le moteur (lib/engine/) ne se modifie PAS ; golden intouchables.
- Le motif ne sort JAMAIS de exception_private (R7) — étendre les tests d'isolation.
- Capture ≤ 3 taps (NFR-1) ; OT = geste le plus rapide (FR-7).
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build, tous verts.
- Preuve d'acceptation observable (taps comptés, payload conjointe sans motif), compteurs mesurés.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
