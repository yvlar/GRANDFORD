# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.16.0 |
| **Phase active** | v2+ |
| **Sprint actif** | **Sprint 17 — à définir** |
| **Dernier sprint complété** | Sprint 16 — Garde anti-dérive du payload (R7) ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints

> Sprints 1-12 archivés : `docs/roadmap-archive.md`.

### Sprint 13 — Gabarits multi-usines fondation BD (FR-17) ✅
**Livré** : fondation BD + câblage serveur de `cycle_templates`. Migration seed `20260619212431_sprint13_cycle_templates_seed.sql` : `INSERT … SELECT` idempotent — 5 foyers prod ensemencés. **Helper** `lib/schedule/cycle-template.ts` : `fetchCycleTemplate` + `fetchCycleTemplateWithFallback` (repli `GRANDFORD_CYCLE`, NFR-4). **Câblage `app/page.tsx`** : 6ᵉ entrée `Promise.all` → `template` au moteur. **Tests** : 5 purs + 4 RLS isolation `cycle_templates`. Gates mesurés : vitest **184** (+9), tsc 0, biome 0, build OK. Branche : `claude/sprint13-cycle-templates`.

### Sprint 14 — Sélecteur de gabarit UI (FR-17 fin) ✅
**Livré** : FR-17 complété — sélecteur de gabarit dans `/foyer` + server action sécurisée. **Migration RLS affinée** (`20260619230000_sprint14_rls_cycle_templates_owner.sql`) : `cycle_templates_all` (tous membres) → `cycle_templates_select` (membres : SELECT) + `cycle_templates_update` (propriétaire seul : `is_household_owner` using + with check). **`lib/schedule/predefined-templates.ts`** (nouveau) : 2 gabarits Pitman 2-2-3 (ancres 2026-06-03 et 2026-06-10), `gabaritNomSchema` Zod, `trouverGabarit`. **`fetchActiveGabarit`** dans `lib/schedule/cycle-template.ts` : retourne `{ name, template }` (nom requis pour l'affichage). **Server action `changerGabarit`** (`app/foyer/actions.ts`) : `getUser()` → redirect `/connexion` si session absente + validation Zod + `trouverGabarit` + `UPDATE cycle_templates WHERE is_active = true` sous RLS ; revalide `/foyer` et `/`. **Page `/foyer`** : `fetchActiveGabarit` en 7ᵉ entrée du `Promise.all` ; section sélecteur au propriétaire (`role = 'worker'`) ; `fr.foyer.gabarit.*` i18n. **Revue** : 2 bugs corrigés (missing `getUser()` + fallback `"Pitman 2-2-3"` → `GABARITS_PREDEFINIS[0].name`) ; `find` inline → `trouverGabarit`. Gates mesurés : vitest **199** (+15), tsc 0, biome 0, build OK. Branche : `claude/sprint14-selecteur-gabarit`.

### Sprint 15 — Accessibilité & cibles tactiles ✅
**Livré** : passe UX/UI transverse (audit via skill `ui-ux-pro-max` — choix produit préservés : mode sombre, emojis-pictogrammes NFR-12, budget ≤ 3 taps, payload conjointe sans motif R7). **Lot A — socle** : tokens de couleur sémantiques d'état dans `tailwind.config.ts` (`quart-jour`/`quart-nuit`/`conge`/`sommeil`/`travaille` + `-fg`, dérivés de la palette, teintes inchangées) consommés par les `Record` d'affichage de `vue-coup-doeil.tsx` ; **focus clavier visible global** dans `app/globals.css` (`:focus-visible` outline emerald sur tout élément interactif — une règle couvre boutons/liens/champs) + garde `prefers-reduced-motion` ; nouveau composant partagé `components/ui/bouton-soumettre.tsx` (`useFormStatus` → pending). **Lot B — tactile** : cibles ≥ 44 px (`min-h-11`) sur cases du mois (`h-10`→`h-11`), flèches de nav, boutons « fermer », et liens-texte minuscules (déconnexion, annuler invitation, supprimer note, retirer sommeil, monFoyer). **Lot C — feedback** : `BoutonSoumettre` sur tous les formulaires Server Action (`/foyer`, `/connexion`, `/onboarding`, sommeil) — désactive + « Envoi… » pendant la soumission (anti double-soumission) ; `selecteur-equipe.tsx` passé client avec `TuileEquipe`/`useFormStatus` (tuiles conservées). **Lot D — parité daltonien** : pictogramme d'état ajouté dans chaque case du mois (`ContenuCase`) pour distinguer les statuts sans la couleur ; `aria-hidden` sur les glyphes décoratifs inline. **Lot E — hiérarchie** : `/foyer` regroupé en cartes thématiques (`Carte`, 2 niveaux de titres) — membres · Travailleur · Réglages de l'horaire · Rappels et export · Invitations · Historique ; nouvelles chaînes `fr.commun.envoiEnCours` + `fr.foyer.groupes.*`. **Revue indépendante** (`/code-review` high, 2 angles) : 0 finding ; passe `/simplify` (3 props mortes retirées de `BoutonSoumettre`). Aucune migration BD, aucun changement moteur. Gates mesurés : vitest **199** (inchangé — changements présentationnels sans logique testable), tsc 0, biome 0, build OK. Note env : `biome check .` localement bruité par CRLF (`core.autocrlf` Windows) sur des fichiers non touchés dont l'index est en LF — neutralisé, diff inchangé. Branche : `claude/sprint15-ux-accessibilite`.

**Patch 0.15.1 — contraste congé/disponible** (suite feedback UX externe) : l'état congé/disponible affichait l'emoji `✅` (vert-et-blanc) sur `bg-conge` (emerald-500) — coche « invisible » sur fond de même teinte. Remplacé par `✔` (U+2714 **présentation texte**, sans sélecteur de variation : l'emoji `✔️` se rend vert sous Segoe/Windows) dans les deux `Record` d'affichage de `vue-coup-doeil.tsx` (propage à pastille/semaine/cases/légende) + bouton « Approuver » de `panneau-capture.tsx`. Le glyphe hérite de `text-conge-fg` (emerald-950) → coche sombre contrastée, garantie multiplateforme, parité daltonien préservée (NFR-12). Purement présentationnel : aucune migration, aucun moteur, aucun test impacté. Gates mesurés : vitest **199** (inchangé), tsc 0, biome 0 (fichiers touchés), build OK. Revue `/code-review` high : 0 finding ; vérification octet par octet des glyphes (U+2714 nu confirmé). Branche : `claude/sprint16-ux-contraste`.

### Sprint 16 — Garde anti-dérive du payload de rappel (R7) ✅
**Réconciliation d'abord** (loi anti-hallucination) : la carte « Notifications E2E prod + nettoyage push » était en grande partie **déjà faite ou non réalisable en session**. Nettoyage des endpoints 404/410 → **déjà implémenté** (`supabase/functions/send-reminders/index.ts:150-153`) ; flux send→push→Resend→`sent_at` complet et correct ; test payload R7 (4 tests) et isolation RLS `push_subscriptions` déjà présents (`supabase/tests/reminders.test.ts:246-322`). La preuve E2E prod (déploiement, `cron.job_run_details`, push réel) exige la machine de l'auteur + creds + confirmations → reportée comme **tâche opérationnelle** (Sprint 17). **Re-scope (décision auteur)** vers le seul risque corrigeable ici : `supabase/functions/_shared/payload.ts` est une **copie manuelle** de `lib/notifications/payload.ts` (contrainte zéro-import Deno) — aucun test ne les gardait contre la dérive, alors que la garantie R7 « aucun motif » vit dans les deux. **Livré** : `lib/notifications/payload-parity.test.ts` (nouveau) — compare le corps exécutable (du premier `export` à la fin, fins de ligne normalisées) des deux fichiers ; échoue si l'un dérive de l'autre. **Preuve que le test mord** : drift temporaire injecté dans `_shared/payload.ts` → test **rouge** ; restauré → **vert** (constaté en session). Doc `send-reminders/README.md` synchronisée (note de contingence bundler périmée + état « jamais exécutée » retirés ; pointeur vers le test de parité). Aucune migration BD, aucun changement moteur, aucun changement de payload. Revue indépendante `/code-review` high : **0 finding** ; passe `/simplify` : code déjà propre. Gates mesurés : vitest **200** (+1 ; 129 passés + 71 isolation RLS ignorés faute de Postgres local), tsc 0, biome 0, build OK. Branche : `claude/prompt-executer-sprint-m4t4ug`.

## Horizons (non planifiés en sprints)

- **v1.1** : ✅ complétée (FR-8 notes + FR-9 requêtes + FR-13 journal + FR-14 iCal).
- **v2+** : FR-17 ✅ complet (fondation BD Sprint 13 + UI sélecteur Sprint 14) ; intégration Dayforce (FR-15), facturation Stripe (FR-16).
