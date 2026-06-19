# Carte d'embarquement — Sprint 14 : Sélecteur de gabarit (FR-17 fin) ou Notifications E2E

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 13 livré : fondation `cycle_templates` BD + câblage `app/page.tsx` (FR-17 partiel). 5 foyers prod ensemencés. `fetchCycleTemplateWithFallback` dans `lib/schedule/cycle-template.ts`. Version 0.13.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

## LECTURE OBLIGATOIRE

1. `.claude/rules/moteur-pitman.md` — `GRANDFORD_CYCLE` reste la constante de fallback ; jamais supprimer l'export.
2. `.claude/rules/supabase-rls.md` — `cycle_templates` : RLS membre du foyer déjà en place (`supabase/migrations/20260611192623_rls_policies.sql:156`).
3. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, opérations DB destructives = confirmation préalable.
4. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

**Option A — Sélecteur de gabarit (FR-17 fin)**
- **`cycle_templates`** : vérifier que les 5 foyers ont bien leur ligne (`SELECT household_id FROM cycle_templates` — confirmé Sprint 13 ; re-vérifier si des foyers ont été ajoutés).
- **`app/foyer/page.tsx`** : utilise encore `GRANDFORD_CYCLE` pour `defaultSleepWindow` (`app/foyer/page.tsx:280` — ligne à vérifier en session). Ce composant devrait aussi charger le template depuis BD.
- **Schéma `cycle_templates`** : colonnes `name, anchor_date, pattern, day_start/end, night_start/end, is_active` — `app/foyer/page.tsx` à vérifier en session ; aucune migration de schéma requise.
- **Multi-gabarits** : pour Sprint 14, un seul gabarit par foyer reste valide ; l'UI laisse le propriétaire choisir parmi les gabarits prédéfinis (liste en dur dans le code pour l'instant).

**Option B — Notifications E2E en prod (priorité opérationnelle)**
- **`send-reminders`** Edge Function : `supabase/functions/send-reminders/` (à vérifier en session) — jamais validée E2E sur plus d'un appareil en prod.
- **`push_subscriptions`** : table existante, contenu à inspecter (`SELECT count(*) FROM push_subscriptions`).
- **`pg_cron`** : job planifié (`:05` chaque heure) — vérifier logs Supabase.
- **Expirés** : endpoints push expirés ne sont pas nettoyés — risque silencieux.

## TÂCHE — Sprint 14 (recommandé : Option A)

### Option A — Sélecteur de gabarit en UI `/foyer`

1. **Câbler `app/foyer/page.tsx`** : remplacer `GRANDFORD_CYCLE` par `fetchCycleTemplateWithFallback(supabase, householdId)` (même pattern que `app/page.tsx`, Sprint 13).
2. **Section sélecteur** : liste de gabarits prédéfinis (Pitman 2-2-3 seulement pour l'instant) affichée au propriétaire du foyer (`role = 'worker'`) — bouton « Modifier le gabarit » ouvre un modal ou une section inline.
3. **Server action `changerGabarit`** : valide le gabarit choisi (Zod), `UPDATE cycle_templates SET ... WHERE household_id = $1 AND is_active = true` sous RLS propriétaire ; revalide `/foyer` et `/`.
4. **i18n** : chaînes dans `lib/i18n/fr.ts` (`fr.foyer.gabarit.*`).
5. **Tests** : isolation RLS — seul le propriétaire peut modifier le gabarit (la conjointe est bloquée) ; test unitaire de `changerGabarit`.

### Gates

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- Test RLS : conjointe ne peut pas UPDATE `cycle_templates`.

### Preuve d'acceptation observable

1. `/foyer` affiche le gabarit actif (`Pitman 2-2-3`, ancre 2026-06-03).
2. Le propriétaire modifie le gabarit → `/` affiche le bon quart pour aujourd'hui (recalculé avec le nouveau template).
3. La conjointe ne voit pas le bouton de modification ; si elle tente un UPDATE SQL direct → 0 ligne modifiée.

## SPRINTS SUGGÉRÉS

### v2+ — Sélecteur de gabarit UI (FR-17 complété) [recommandé pour Sprint 14]
**Objectif** : permettre au propriétaire de changer son gabarit dans `/foyer` — UI + server action + RLS.
**Complexité** : Faible-Moyenne (câblage similaire Sprint 13, UI simple)
**Justification** : complète FR-17 et valide le flux end-to-end de la fondation BD.
**Référence** : `app/foyer/page.tsx:280` (ligne à vérifier en session) ; `lib/schedule/cycle-template.ts` — `fetchCycleTemplateWithFallback` (créé Sprint 13).

### v2+ — Notifications E2E prod (suivi Sprint 8)
**Objectif** : valider `send-reminders` sur un 2ᵉ appareil réel ; nettoyer les endpoints push expirés.
**Complexité** : Faible-Moyenne (test d'intégration bout-en-bout + nettoyage `push_subscriptions`)
**Justification** : FR-10 livré Sprint 7 mais jamais testé E2E en prod sur plus d'un appareil — risque silencieux de rappels non reçus.
**Référence** : `supabase/functions/send-reminders/` (à vérifier en session) ; `push_subscriptions` (table existante).

### v2+ — Facturation SaaS (FR-16)
**Objectif** : Stripe pour les foyers supplémentaires (1er foyer gratuit, suivants payants).
**Complexité** : Haute (Stripe webhooks, portail client, gates d'accès par foyer)
**Justification** : unité de facturation = 1 foyer × 1 gabarit — fondation FR-17 ✅ rend ça adressable.
**Référence** : FR-16 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise).
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation écarts existants)
**Justification** : non prioritaire sans accès réel à l'API et sans client cible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (ligne à vérifier en session).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 14 (Sélecteur de gabarit — FR-17 fin) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint14-selecteur-gabarit (à créer depuis dev, après merge de sprint13).

Rappels non négociables :
- Réconcilier en premier : `app/foyer/page.tsx` ligne utilisant GRANDFORD_CYCLE (280 à vérifier) ;
  vérifier que cycle_templates a bien une ligne par foyer (SELECT count(*) FROM cycle_templates).
- GRANDFORD_CYCLE reste exporté (fallback + tests) — ne pas supprimer.
- RLS : seul le propriétaire du foyer peut UPDATE cycle_templates (tester explicitement).
- NFR-4 : fetchCycleTemplateWithFallback garantit le repli hors-ligne.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
