# Carte d'embarquement — Sprint 9 : Co-planification conjointe

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 8 livré : MVP en ligne — Supabase Cloud (CA/US-est) + Vercel déployés, GoTrue soldé (lien magique + OAuth réels), push iPhone reçu, Sentry + UptimeRobot + sauvegarde opérationnels. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint **ouvre la phase v1.1** avec le premier apport actif pour la conjointe : notes sur une date (FR-8) et requêtes approuver/refuser (FR-9).

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — nouvelles tables touchant des données de foyer → policies RLS obligatoires avant toute UI ; tests d'isolation = livrable de première classe.
2. `.claude/rules/workflow-sprint.md` — le trigger est un nouveau chemin critique : anti-hallucination (existant ⇒ `fichier:ligne` vérifié) ; golden moteur intouchables.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

- **Tables `notes` et `requests`** : créées dans `supabase/migrations/20260611192620_initial_schema.sql:152` et `:163` (vérifiées). Vérifier dans la session si des policies RLS existent déjà sur ces tables (migrations ultérieures) avant d'en écrire de nouvelles.
- **Génération des rappels dans la RPC** : `supabase/migrations/20260612193000_sprint07_reminders.sql:54` — l'INSERT direct dans `reminders` doit être **retiré** de la RPC et **remplacé par un trigger** `AFTER INSERT ON exceptions`. Vérifier la migration sprint07 avant de toucher la RPC pour ne pas casser les tests existants.
- **Colonne `status`** de `requests` : `check (status in ('pending', 'approved', 'declined'))` (initial_schema:170, vérifié). Pas besoin de migration pour le domaine ; la logique d'approbation crée l'écart via la RPC existante.
- **R7** : le `body` d'une requête (`requests.body`) est la demande de la conjointe, visible par le travailleur — ce n'est pas un motif d'absence. Le motif de l'écart éventuel va dans `exception_private` (travailleur seul). Aucun `body` de requête dans Sentry, logs ou payload conjointe.

## TÂCHE — Sprint 9

### Spécification

1. **Migration trigger** (`supabase migration new sprint09_trigger_reminders`) : créer une fonction `generate_reminders_for_exception()` et un trigger `AFTER INSERT ON public.exceptions FOR EACH ROW` qui matérialise les rappels 30/7/1 j strictement futurs (logique identique à l'actuel INSERT dans la RPC) ; **retirer** l'INSERT direct dans la RPC `create_exception_with_motif` (le trigger s'en charge). Tests : 0 doublement de rappels.

2. **Migration RLS notes + requests** (`supabase migration new sprint09_notes_requests_rls`) : policies sur `notes` (membre du foyer : SELECT/INSERT/UPDATE/DELETE) et `requests` (SELECT = membre du foyer ; INSERT = tout membre ; UPDATE `status` = travailleur propriétaire `target_profile_id` seul). Types régénérés après migration.

3. **FR-8 — Notes** : composant `NoteDuJour` (≤ 3 taps depuis le panneau de la date) — créer/lire/supprimer une note ; visible par les deux membres du foyer dans le panneau du jour concerné.

4. **FR-9 — Requêtes** : flux complet côté conjointe (formulaire « Demander une disponibilité » sur une date → `pending`) + côté travailleur (liste des requêtes en attente → approuver / refuser). Approuver = RPC `create_exception_with_motif` (le travailleur choisit le type d'écart) → trigger génère les rappels ; le statut de la requête passe à `approved`. Refuser = `declined`, aucun écart créé. La conjointe voit le statut final.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- **Tests d'isolation RLS** (obligatoires, sprint touche schéma + policies) :
  - notes inter-foyers : membre foyer B ne lit pas les notes de foyer A ;
  - requêtes inter-foyers : même isolation ;
  - conjointe ne peut pas modifier `status` d'une requête.
- **Tests trigger** : INSERT dans `exceptions` à J+40 → 3 `reminders` ; INSERT à J-1 → 0 rappel ; INSERT via RPC après modification → 3 rappels (pas 6 — doublement interdit).
- **Golden moteur** restent verts (intouchables).

### Preuve d'acceptation observable

1. Conjointe soumet une requête sur une date à **J+40** — statut `pending` constaté en BD.
2. Travailleur approuve → `select count(*) from reminders where exception_id = '<id>'` = **3** (via trigger, mesuré en session).
3. Conjointe voit le statut **`approved`** dans sa vue ; payload réseau inspecté : **0 champ motif** ni corps `exception_private` (R7).
4. Note créée par le travailleur → conjointe voit la **même note** dans le panneau du même jour.
5. Test de non-doublement : `select count(*) from reminders` avant et après — différence = **3 exactement** (pas 6).

## SPRINTS SUGGÉRÉS

### v1.1 — Journal des changements + export (FR-13, FR-14)
**Objectif** : journal « qui a changé quoi » + export iCal/PDF.
**Complexité** : Moyenne
**Justification** : confiance + partage hors app ; `audit_log` scaffoldé mais non alimenté.
**Référence** : `audit_log` — `supabase/migrations/20260611192620_initial_schema.sql:191` (à vérifier en session) ; alimentation et UI **à créer**.

### Conformité Loi 25 (dès le 2ᵉ foyer)
**Objectif** : politique de confidentialité, consentement à l'inscription, responsable des renseignements personnels désigné.
**Complexité** : Faible (texte + écran), mais **bloquante avant d'inviter un foyer externe**.
**Justification** : exigence `.claude/rules/securite-secrets.md` ; déclenchée par la mise en ligne du Sprint 8.
**Référence** : règle citée ; tout **à créer**.

### v2+ — Gabarits multi-usines (FR-17)
**Objectif** : paramétrer l'ancre et le pattern via `cycle_templates` (table existante, non ensemencée) pour supporter d'autres usines/cycles.
**Complexité** : Moyenne
**Justification** : fondation du produit SaaS (FR-16 + FR-17) ; décision prise au Sprint 4 de reporter à FR-17.
**Référence** : `cycle_templates` — `supabase/migrations/20260611192620_initial_schema.sql` (à vérifier en session) ; `GRANDFORD_CYCLE` côté client **à migrer vers la table**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 9 (Co-planification conjointe) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint09-coplanification (à créer depuis dev).

Rappels non négociables :
- Réconcilier en premier : policies RLS existantes sur notes + requests (migrations
  après initial_schema.sql) ; INSERT trigger 0 doublement avec la RPC.
- Tests d'isolation RLS obligatoires (sprint touche schéma + policies).
- Trigger sur exceptions : intouchable si golden moteur passent au rouge.
- R7 : le body de requests n'est pas un motif — mais aucun body dans Sentry ni logs.
- Preuve : 3 rappels via trigger constatés en BD (pas 6), statut conjointe sans motif.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
