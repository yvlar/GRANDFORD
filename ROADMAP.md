# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.14.0 |
| **Phase active** | v2+ |
| **Sprint actif** | **Sprint 15 — à définir** |
| **Dernier sprint complété** | Sprint 14 — Sélecteur de gabarit ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints

> Sprints 1-10 archivés : `docs/roadmap-archive.md`.

### Sprint 11 — Nom du travailleur page foyer ✅
**Livré** : section « Travailleur » dans `/foyer` — le travailleur voit et peut éditer son nom (`profiles.full_name`) ; la conjointe voit le nom en lecture seule. **Server action `mettreAJourNom`** (`app/foyer/actions.ts`) : valide via Zod (`max 120`), `UPDATE profiles SET full_name` sous RLS authenticated, revalide `/foyer` et `/`. **Page foyer** : extraction `monNom` et `nomTravailleur` depuis la requête `membres` existante (0 requête supplémentaire) ; section i18n-ready (`nomPlaceholder`, `enregistrerNom`, `erreurNom` dans `lib/i18n/fr.ts`). Gates mesurés : vitest **175** (inchangé), tsc 0, biome 0. Branche : `claude/sprint10-ical-loi25`.

### Sprint 12 — Journal des changements (FR-13) ✅
**Livré** : FR-13 complet — traçabilité partagée dans le couple. Migration `20260619120000_sprint12_audit_trigger.sql` : trigger `trg_audit_exception` (AFTER INSERT OR UPDATE OR DELETE ON exceptions, SECURITY INVOKER, `set search_path = ''`) → `log_exception_change()` — insère dans `audit_log` avec `action` ∈ {`exception_created`, `exception_updated`, `exception_deleted`}, `metadata = jsonb_build_object('on_date', on_date, 'effect', effect, 'shift', shift)` — **jamais le motif** (R7) ; `actor_id = auth.uid()` avec repli `NULL` ; garde FK : `IF EXISTS (households)` avant INSERT. Policy `audit_log_insert` resserrée : `actor_id = auth.uid() OR actor_id IS NULL`. **Couche TS** : `parseAuditRows()` (`lib/schedule/db-rows.ts`, schéma Zod + `safeParse`) + `FORMAT_DATE_COURTE` (`lib/schedule/format.ts`). **Vue foyer** : 6ᵉ requête en `Promise.all` (50 entrées, `entity = 'exception'`) + section « Historique des écarts ». **i18n** : `fr.foyer.historique` (3 libellés d'action). Gates mesurés : vitest **179** (+4), tsc 0, biome 0, build OK. Branche : `claude/sprint12-journal`.

### Sprint 13 — Gabarits multi-usines fondation BD (FR-17) ✅
**Livré** : fondation BD + câblage serveur de `cycle_templates`. Migration seed `20260619212431_sprint13_cycle_templates_seed.sql` : `INSERT … SELECT` idempotent — 5 foyers prod ensemencés. **Helper** `lib/schedule/cycle-template.ts` : `fetchCycleTemplate` + `fetchCycleTemplateWithFallback` (repli `GRANDFORD_CYCLE`, NFR-4). **Câblage `app/page.tsx`** : 6ᵉ entrée `Promise.all` → `template` au moteur. **Tests** : 5 purs + 4 RLS isolation `cycle_templates`. Gates mesurés : vitest **184** (+9), tsc 0, biome 0, build OK. Branche : `claude/sprint13-cycle-templates`.

### Sprint 14 — Sélecteur de gabarit UI (FR-17 fin) ✅
**Livré** : FR-17 complété — sélecteur de gabarit dans `/foyer` + server action sécurisée. **Migration RLS affinée** (`20260619230000_sprint14_rls_cycle_templates_owner.sql`) : `cycle_templates_all` (tous membres) → `cycle_templates_select` (membres : SELECT) + `cycle_templates_update` (propriétaire seul : `is_household_owner` using + with check). **`lib/schedule/predefined-templates.ts`** (nouveau) : 2 gabarits Pitman 2-2-3 (ancres 2026-06-03 et 2026-06-10), `gabaritNomSchema` Zod, `trouverGabarit`. **`fetchActiveGabarit`** dans `lib/schedule/cycle-template.ts` : retourne `{ name, template }` (nom requis pour l'affichage). **Server action `changerGabarit`** (`app/foyer/actions.ts`) : `getUser()` → redirect `/connexion` si session absente + validation Zod + `trouverGabarit` + `UPDATE cycle_templates WHERE is_active = true` sous RLS ; revalide `/foyer` et `/`. **Page `/foyer`** : `fetchActiveGabarit` en 7ᵉ entrée du `Promise.all` ; section sélecteur au propriétaire (`role = 'worker'`) ; `fr.foyer.gabarit.*` i18n. **Revue** : 2 bugs corrigés (missing `getUser()` + fallback `"Pitman 2-2-3"` → `GABARITS_PREDEFINIS[0].name`) ; `find` inline → `trouverGabarit`. Gates mesurés : vitest **199** (+15), tsc 0, biome 0, build OK. Branche : `claude/sprint14-selecteur-gabarit`.

## Horizons (non planifiés en sprints)

- **v1.1** : ✅ complétée (FR-8 notes + FR-9 requêtes + FR-13 journal + FR-14 iCal).
- **v2+** : FR-17 ✅ complet (fondation BD Sprint 13 + UI sélecteur Sprint 14) ; intégration Dayforce (FR-15), facturation Stripe (FR-16).
