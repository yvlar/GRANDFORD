# Carte d'embarquement — Sprint 5 : Capture d'exception ≤ 3 taps

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 4 livré : vue « coup d'œil » (pastille + semaine + mois, moteur côté client, hors-ligne constaté), vue conjointe sans motif, sélection d'équipe. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint livre le **cœur de la thèse produit** : capturer un écart en ≤ 3 taps (FR-4), motif privé (FR-5), OT = geste le plus rapide (FR-7).

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — le motif vit dans `exception_private`, **travailleur propriétaire seul** ; toute écriture qui touche les deux tables doit rester étanche (R7) ; tests d'isolation obligatoires si schéma/policy/RPC touchés.
2. `.claude/rules/conventions-frontend.md` — capture en **≤ 3 taps** (NFR-1), reconnaissance > rappel (6 grosses tuiles), chaînes dans `lib/i18n/fr.ts`, la conjointe ne reçoit JAMAIS le motif.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Schéma prêt, rien à migrer a priori** : `exceptions(on_date, effect, shift)` — `supabase/migrations/20260611192620_initial_schema.sql:95` (un écart par jour/travailleur :110 ; `effect in ('off','working','working_extra','shift_swap')` :102) ; `exception_private(motif, note)` — `…:120` (6 motifs des tuiles :125, FK composites d'étanchéité :132-133).
- **La vue affiche déjà les écarts** : superposition pure — `lib/schedule/status.ts` (`dayStatuses`) ; chargement accueil (±62 j) — `app/page.tsx` ; marqueur visuel — `components/horaire/vue-coup-doeil.tsx`. Capturer = insérer en BD, la vue suit toute seule (revalidation à prévoir).
- **⚠️ Aucune UI ni action d'écriture d'`exceptions`/`exception_private`** : seuls les seeds de test en créent (`supabase/tests/helpers.ts:144-153`). Tout le flux de capture est **à créer**.
- **⚠️ Écriture atomique exceptions + motif** : deux inserts client ne sont pas transactionnels — prévoir une **RPC** (modèle : `create_household_with_membership`, SECURITY INVOKER sous RLS — `supabase/migrations/20260612005902_sprint03_auth_household.sql`) ou justifier explicitement l'alternative. Mapper tuile → (`effect`, `shift`, `motif`) : OT = `working_extra` sur jour de repos (FR-7) ; congé/maladie/vacances/formation = `off` ; échange = `shift_swap` (sémantique à trancher dans la session, sans réinventer le schéma).
- **Actions serveur existantes comme modèle** : `app/foyer/actions.ts` (validation Zod en forme, RLS en droit, `revalidatePath`).

## TÂCHE — Sprint 5

### Spécification

1. **Geste de capture (FR-4)** : depuis l'accueil travailleur, 1 bouton → 6 tuiles (OT, congé, maladie, échange, formation, vacances) → choix du jour (défaut : aujourd'hui ou jour tapé dans la grille) → confirmation. **≤ 3 taps** pour le cas nominal ; OT le plus court (FR-7).
2. **Persistance étanche (FR-5)** : `exceptions` (effet partageable) + `exception_private` (motif, propriétaire seul) écrits atomiquement ; jamais le motif dans `exceptions`, les logs ou l'URL.
3. **Boucle de la vue** : après capture, la pastille/grille reflète l'écart (revalidation) ; le travailleur voit son motif (badge/détail), la conjointe seulement l'absence/présence.
4. **Annulation** : pouvoir supprimer un écart saisi (erreur de doigt TDAH) — suppression cascade du motif (FK déjà en place).

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — mapping tuile → (effect, shift, motif) en fonctions pures testées ; **tests d'isolation étendus** si RPC/policy ajoutées (la conjointe ne peut ni lire ni écrire le motif via le nouveau chemin) ; compteur **mesuré**.
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.

### Preuve d'acceptation observable

1. Capture d'un OT en ≤ 3 taps **comptés à l'écran** ; l'écart apparaît dans la grille avec son marqueur.
2. Le travailleur voit le motif ; la conjointe voit l'absence **sans motif** — payload réseau inspecté (0 champ motif), et test d'isolation BD vert.
3. Suppression d'un écart : la vue redevient l'horaire de base ; `exception_private` orphelin = 0 ligne (cascade constatée).

## SPRINTS SUGGÉRÉS

### Sprint 6 — Fenêtre de sommeil par défaut
**Objectif** : configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas.
**Complexité** : Faible/Moyenne
**Justification** : la vue consomme déjà `sleep_defaults` (heuristique de repli en place — `lib/schedule/status.ts`, `defaultSleepWindow`).
**Référence** : `sleep_defaults` — `supabase/migrations/20260611192620_initial_schema.sql:138` ; FR-6 — `docs/analyse/02-analyse/analyse.md:22`. UI de configuration **à créer**.

### Sprint 7 — Notifications
**Objectif** : Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 sem. / 1 jour.
**Complexité** : Élevée
**Justification** : cœur « prothèse de mémoire » ; tables prêtes, déclenchement à bâtir.
**Référence** : `reminders` — `supabase/migrations/20260611192620_initial_schema.sql:178` ; `push_subscriptions` — `…:204` ; pg_cron + Edge Function — `docs/analyse/03-architecture/architecture.md:121`. Tout le pipeline d'envoi **à créer**.

### Sprint 8 — Mise en ligne + filets
**Objectif** : Vercel + Supabase Cloud (CA/US-est), Sentry/UptimeRobot, sauvegardes, test PWA + push sur l'iPhone réel (R11/U-7) — **et validation des flux GoTrue réels** (lien magique, OAuth) reportée des Sprints 3-4.
**Complexité** : Moyenne
**Justification** : la dette « GoTrue jamais exécuté » doit se solder contre un vrai projet ; `GRANDFORD_DEMO` ne doit jamais y être défini.
**Référence** : `architecture.md:130` ; contraintes documentées dans `ROADMAP.md` (Sprints 2-4).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 5 (Capture d'exception ≤ 3 taps) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint05-capture-exception (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier
  l'atomicité exceptions + exception_private (RPC à trancher d'abord).
- Le motif ne sort JAMAIS vers la conjointe — ni payload, ni log, ni URL (R7).
- ≤ 3 taps constatés à l'écran (NFR-1) ; OT = geste le plus rapide (FR-7).
- Le moteur (lib/engine/) ne se modifie PAS ; golden intouchables.
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build,
  tous verts ; tests d'isolation étendus si RPC/policy ajoutées.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
