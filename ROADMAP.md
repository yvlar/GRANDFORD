# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.7.0 |
| **Phase active** | MVP |
| **Sprint actif** | **Sprint 7 — Notifications** |
| **Dernier sprint complété** | Sprint 6 — Fenêtre de sommeil par défaut ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints MVP

> Sprints 1-2 archivés : `docs/roadmap-archive.md`.

### Sprint 3 — Auth sans mot de passe + foyer ✅
**Livré** : client Supabase typé (`lib/supabase/` : navigateur, serveur, middleware — `@supabase/ssr`) ; pages connexion (lien magique + OAuth Google/Apple), callback, déconnexion ; onboarding (création foyer) ; page foyer (membres, invitation par lien à usage unique, révocation, quitter) — Server Components purs, chaînes dans `lib/i18n/fr.ts`. Migration `…_sprint03_auth_household.sql` : trigger `handle_new_user` (auth.users → profiles), RPC atomique `create_household_with_membership` (SECURITY INVOKER, sous RLS), table `invitations` (RLS propriétaire seul, expiration 7 j), RPC `redeem_invitation` (SECURITY DEFINER, refus par ERRCODE stables GF001-GF004) ; types régénérés. Gates mesurés : vitest **48** (35 + 13 cycle de vie foyer), tsc 0, biome 0, build OK. Contrainte d'env : GoTrue inexécutable localement (Docker bloqué, cf. Sprint 2) → flux d'auth validés **au niveau BD** (insert `auth.users` = effet GoTrue) ; la frontière GoTrue réelle (lien magique, OAuth) reste **à valider contre un projet Supabase Cloud** (au plus tard Sprint 8). Couvre FR-11, FR-12.

### Sprint 4 — Vue « coup d'œil » ✅
**Livré** : accueil connecté = vue « coup d'œil » (FR-2/FR-3) — pastille **Aujourd'hui** (CONGÉ/JOUR/NUIT/SOMMEIL, lisible < 2 s) + bande semaine + grille mois navigable, **moteur exécuté côté client** (hors-ligne constaté, NFR-4) ; écarts `exceptions` superposés (couche pure `lib/schedule/`, marqueur d'écart propagé au sommeil dérivé) ; sommeil après quart de nuit (`sleep_defaults`, sinon heuristique 8 h documentée) ; **vue conjointe = disponibilité (travaille/disponible/sommeil) sans motif** — payload réseau inspecté, 0 champ motif (R7) ; **sélection d'équipe A/B/C/D** (accueil 1re fois + page foyer, upsert `worker_assignments`) ; au-delà de ±62 j d'écarts chargés, la grille l'annonce (jamais de faux « horaire normal » silencieux). Décision : gabarit = `GRANDFORD_CYCLE` côté client (l'ensemencement `cycle_templates` attendra FR-17). Gates mesurés : vitest **74** (dont 12 isolation RLS, +4 sur les données de la vue), tsc 0, biome 0, build OK ; preuve Playwright sur les points réels validés (11 juin CONGÉ · 25 déc JOUR · écart sans motif · hors-ligne). Contrainte d'env (GoTrue indisponible, cf. Sprint 3) : preuve à l'écran via `/demo/horaire` (activable seulement par `GRANDFORD_DEMO=1`, données factices). Note : branche de session imposée `claude/prompt-executer-sprint-vgmvtn` (environnement distant) au lieu du nom standard.

### Sprint 5 — Capture d'exception ≤ 3 taps ✅
**Livré** : flux de capture complet (FR-4/FR-5/FR-7) — bouton accueil → 6 tuiles → confirmation ; jour par défaut = aujourd'hui ou jour tapé dans la grille ; **OT = 2 taps** (enregistré dès le tap de sa tuile, FR-7), autres tuiles = 3 taps — **comptés à l'écran** (Playwright sur `/demo/horaire?capture=1`, flux démo sans BD : mêmes composants + même sémantique pure, contrainte GoTrue des Sprints 2-4). Sémantique tranchée (`lib/schedule/capture.ts`, pur) : OT → `working_extra` au quart d'identité · congé/maladie/formation/vacances → `off` · échange → `shift_swap` au quart opposé ; motif = la tuile, vers `exception_private` seulement. **Écriture atomique** écart + motif par RPC `create_exception_with_motif` (SECURITY INVOKER sous RLS, doublon de jour → ERRCODE `GF005`) ; **annulation** = suppression par le propriétaire, cascade du motif constatée (0 orphelin). Le travailleur voit son motif (panneau détail) ; la conjointe : payload inspecté, **0 champ motif** (R7). Gates mesurés : vitest **95** (dont 14 mapping tuiles + 7 isolation du nouveau chemin RPC), tsc 0, biome 0, build OK. Note : E2E du chemin réel (actions serveur + revalidation) reste lié à la dette GoTrue → Sprint 8. Branche de session imposée `claude/prompt-executer-sprint-1z0e1d`.

### Sprint 6 — Fenêtre de sommeil par défaut ✅
**Livré** : FR-6 complet. **Configuration unique** : formulaire « Fenêtre de sommeil » sur la page foyer (travailleur seulement), upsert `sleep_defaults`, valeurs proposées = fenêtre configurée sinon heuristique du gabarit. **Auto-application** : déjà câblée dans `dayStatuses` (vérifiée, pas réécrite). **Ajustement au cas par cas** (prémisse 3 de la carte tranchée : table dédiée) : nouvelle table `sleep_adjustments` — unique (foyer, travailleur, date), RLS « membre du foyer », migration `…_sprint06_sleep_adjustments.sql`, types régénérés — exposée dans le panneau du jour tapé quand c'est une journée de sommeil (bloc SOUS la capture : budget ≤ 3 taps des écarts intact, NFR-1) ; retirer l'ajustement ramène le jour au défaut. Priorité dans la couche pure : ajustement du jour > fenêtre configurée > heuristique 8 h ; un ajustement sur un jour sans sommeil est ignoré. La conjointe voit la fenêtre (disponibilité partagée), payload toujours sans motif (R7). Gates mesurés : vitest **103** (dont 15 isolation RLS — 3 nouveaux sur `sleep_adjustments`), tsc 0, biome 0, build OK ; preuve Playwright **11/11** sur `/demo/horaire` (fenêtre configurée affichée le jour post-nuit · repli heuristique 07:00-15:00 sans config · ajuster UN jour ne change pas les autres · retrait = retour au défaut · vue conjointe sans motif) — contrainte GoTrue inchangée (cf. Sprints 2-5). Branche de session imposée `claude/prompt-executer-sprint-kk603d`.

### Sprint 7 — Notifications 🟡 ACTIF
Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 semaine / 1 jour via pg_cron + Edge Function (`architecture.md:121`). Couvre FR-10.
**Carte détaillée** : `prompt-mise-a-jour-roadmap.md`.

### Sprint 8 — Mise en ligne + filets ⬜
Déploiement Vercel + Supabase Cloud (CA/US-est) ; Sentry + UptimeRobot (uptime **et** réveil du projet gratuit) ; sauvegarde `pg_dump` quotidienne (GitHub Action) ; **test PWA installable + push sur l'iPhone réel** (R11/U-7, `architecture.md:130`).

## Horizons post-MVP (non planifiés en sprints)

- **v1.1** : co-planification conjointe (notes FR-8, requêtes approuver/refuser FR-9 — qui sert aussi de mécanisme de fraîcheur, opportunité O-1), journal des changements (FR-13), export iCal/PDF (FR-14).
- **v2+** : intégration Dayforce (FR-15), facturation Stripe (FR-16), gabarits de cycle multi-usines (FR-17), conformité Loi 25 opérationnalisée dès le 2ᵉ foyer.
