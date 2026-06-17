# Carte d'embarquement — Sprint 12 : Journal des changements (FR-13)

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 11 livré : section « Travailleur » dans `/foyer` — nom affiché et éditable. Version 0.11.1. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint complète la **phase v1.1** avec le journal des changements (FR-13) : traçabilité partagée dans le couple — chaque écart saisi, modifié ou supprimé laisse une trace lisible dans le foyer.

## LECTURE OBLIGATOIRE

1. `.claude/rules/supabase-rls.md` — `audit_log` a ses propres policies (SELECT membres du foyer, INSERT par un membre authentifié) ; la `metadata` ne doit **jamais** contenir le motif d'une absence (R7).
2. `.claude/rules/securite-secrets.md` — R7 : aucun champ motif dans `audit_log.metadata`, Sentry ni logs.
3. `.claude/rules/tests-vitest.md` — les tests d'isolation RLS sur `audit_log` sont des livrables de première classe.
4. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

- **`audit_log` existe** : `supabase/migrations/20260611192620_initial_schema.sql:190` — table avec colonnes `household_id, actor_id, action, entity, entity_id, metadata jsonb, created_at`. RLS active (`supabase/migrations/20260611192623_rls_policies.sql:91`). **Alimentée ?** → vérifier l'existence d'un trigger ou d'une insertion dans le code en session ; si absente, **à créer**.
- **Chemin d'écriture des exceptions** : `create_exception_with_motif` (RPC) + trigger `trg_generate_reminders` (Sprint 9). L'insertion dans `audit_log` devrait être proche du point d'écriture des exceptions — un trigger `AFTER INSERT/UPDATE/DELETE ON exceptions` est la voie naturelle.
- **Contenu de `metadata`** : ne jamais inclure le motif (colonne `motif` de `exception_private`) — seul `on_date`, `effect`, `shift` sont autorisés (`R7`).
- **Vue historique** : aucune page d'historique n'existe actuellement (à vérifier en session) — **à créer**.

## TÂCHE — Sprint 12

### Sous-tâche 1 : Alimentation de `audit_log` via trigger Postgres

1. Migration `…_sprint12_audit_trigger.sql` : trigger `AFTER INSERT OR UPDATE OR DELETE ON public.exceptions` → `log_exception_change()` (SECURITY INVOKER, `set search_path = ''`) — insère une ligne dans `audit_log` avec `action` = `'exception_created'` / `'exception_updated'` / `'exception_deleted'`, `entity = 'exception'`, `entity_id = exceptions.id::text`, `metadata = jsonb_build_object('on_date', NEW.on_date, 'effect', NEW.effect, 'shift', NEW.shift)`. **Jamais** le motif dans `metadata`.
2. Vérifier que le trigger ne double-logue pas les rappels (trigger Sprint 9 existe déjà sur `exceptions`).
3. Types régénérés si un nouveau champ s'ajoute.

### Sous-tâche 2 : Vue « Historique » sur la page foyer

1. Charger les 50 dernières entrées `audit_log` pour le `household_id` courant (côté serveur, Server Component).
2. Afficher : date, action humaine (« Écart ajouté », « Écart retiré »), date de l'écart concernée — **pas d'effet, pas de motif** en vue conjointe.
3. Vue identique pour travailleur et conjointe : seuls `on_date` + `action` sont affichés (jamais `effect`, jamais `metadata.shift` si jugé sensible — trancher en session).
4. Chaînes dans `lib/i18n/fr.ts` ; aucune chaîne en dur dans les composants.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- **Tests d'isolation RLS** (`supabase/tests/`) :
  1. Un membre du foyer A lit ses entrées `audit_log` — 0 entrée du foyer B visible.
  2. La `metadata` d'une entrée ne contient aucun champ motif (inspecté par test).
  3. Un membre révoqué obtient 0 entrée.
- **Test fonctionnel** : saisir un écart → `SELECT count(*) FROM audit_log WHERE household_id = X` ≥ 1 ; supprimer l'écart → une 2ᵉ entrée avec `action = 'exception_deleted'`.
- Golden moteur restent verts (intouchables).

### Preuve d'acceptation observable

1. Saisir un écart de test → ouvrir la page foyer → la section « Historique » affiche l'entrée avec la date et l'action — **sans motif**.
2. Supprimer l'écart → l'historique affiche une 2ᵉ entrée « Écart retiré ».
3. `SELECT metadata FROM public.audit_log LIMIT 10` → aucun champ `motif` / `reason` / `maladie` dans les lignes retournées.

## SPRINTS SUGGÉRÉS

### v1.1 — Journal des changements (FR-13) [recommandé pour Sprint 12]
**Objectif** : alimenter `audit_log` à chaque exception + vue « Historique » dans le foyer.
**Complexité** : Faible-Moyenne (trigger BD + Server Component + i18n)
**Justification** : dernier livrable v1.1 ; traçabilité partagée dans le couple.
**Référence** : `audit_log` — `supabase/migrations/20260611192620_initial_schema.sql:190` (table existante, trigger **à créer**).

### v2+ — Gabarits multi-usines (FR-17)
**Objectif** : paramétrer l'ancre et le pattern via `cycle_templates` pour d'autres usines/cycles.
**Complexité** : Moyenne
**Justification** : fondation du produit SaaS (FR-16 + FR-17).
**Référence** : `cycle_templates` — `supabase/migrations/20260611192620_initial_schema.sql` (existence à vérifier en session) ; `GRANDFORD_CYCLE` côté client **à migrer vers la table**.

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer automatiquement l'horaire publié depuis Dayforce (source optionnelle).
**Complexité** : Haute (API externe, réconciliation écarts)
**Justification** : valeur ajoutée pour l'usine avec Dayforce déployé.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (à vérifier ligne en session).

### v2+ — Facturation SaaS (FR-16)
**Objectif** : Stripe pour monétiser les foyers supplémentaires.
**Complexité** : Haute
**Justification** : modèle d'affaires long terme — non prioritaire avant 10 foyers actifs.
**Référence** : FR-16 — `docs/analyse/02-analyse/analyse.md`.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 12 (Journal des changements — FR-13) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint12-journal (à créer depuis dev).

Rappels non négociables :
- Réconcilier en premier : existence et colonnes de audit_log (supabase/migrations/20260611192620_initial_schema.sql:190),
  existence d'un trigger existant sur exceptions (sprint 9 — trg_generate_reminders).
- R7 : audit_log.metadata ne contient JAMAIS le motif (exception_private.motif).
- Tests d'isolation RLS sur audit_log sont des livrables de première classe.
- Golden moteur intouchables.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
