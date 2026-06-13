# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.8.0 |
| **Phase active** | MVP |
| **Sprint actif** | **Sprint 8 — Mise en ligne + filets** |
| **Dernier sprint complété** | Sprint 7 — Notifications ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints MVP

> Sprints 1-3 archivés : `docs/roadmap-archive.md`.

### Sprint 4 — Vue « coup d'œil » ✅
**Livré** : accueil connecté = vue « coup d'œil » (FR-2/FR-3) — pastille **Aujourd'hui** (CONGÉ/JOUR/NUIT/SOMMEIL, lisible < 2 s) + bande semaine + grille mois navigable, **moteur exécuté côté client** (hors-ligne constaté, NFR-4) ; écarts `exceptions` superposés (couche pure `lib/schedule/`, marqueur d'écart propagé au sommeil dérivé) ; sommeil après quart de nuit (`sleep_defaults`, sinon heuristique 8 h documentée) ; **vue conjointe = disponibilité (travaille/disponible/sommeil) sans motif** — payload réseau inspecté, 0 champ motif (R7) ; **sélection d'équipe A/B/C/D** (accueil 1re fois + page foyer, upsert `worker_assignments`) ; au-delà de ±62 j d'écarts chargés, la grille l'annonce (jamais de faux « horaire normal » silencieux). Décision : gabarit = `GRANDFORD_CYCLE` côté client (l'ensemencement `cycle_templates` attendra FR-17). Gates mesurés : vitest **74** (dont 12 isolation RLS, +4 sur les données de la vue), tsc 0, biome 0, build OK ; preuve Playwright sur les points réels validés (11 juin CONGÉ · 25 déc JOUR · écart sans motif · hors-ligne). Contrainte d'env (GoTrue indisponible, cf. Sprint 3) : preuve à l'écran via `/demo/horaire` (activable seulement par `GRANDFORD_DEMO=1`, données factices). Note : branche de session imposée `claude/prompt-executer-sprint-vgmvtn` (environnement distant) au lieu du nom standard.

### Sprint 5 — Capture d'exception ≤ 3 taps ✅
**Livré** : flux de capture complet (FR-4/FR-5/FR-7) — bouton accueil → 6 tuiles → confirmation ; jour par défaut = aujourd'hui ou jour tapé dans la grille ; **OT = 2 taps** (enregistré dès le tap de sa tuile, FR-7), autres tuiles = 3 taps — **comptés à l'écran** (Playwright sur `/demo/horaire?capture=1`, flux démo sans BD : mêmes composants + même sémantique pure, contrainte GoTrue des Sprints 2-4). Sémantique tranchée (`lib/schedule/capture.ts`, pur) : OT → `working_extra` au quart d'identité · congé/maladie/formation/vacances → `off` · échange → `shift_swap` au quart opposé ; motif = la tuile, vers `exception_private` seulement. **Écriture atomique** écart + motif par RPC `create_exception_with_motif` (SECURITY INVOKER sous RLS, doublon de jour → ERRCODE `GF005`) ; **annulation** = suppression par le propriétaire, cascade du motif constatée (0 orphelin). Le travailleur voit son motif (panneau détail) ; la conjointe : payload inspecté, **0 champ motif** (R7). Gates mesurés : vitest **95** (dont 14 mapping tuiles + 7 isolation du nouveau chemin RPC), tsc 0, biome 0, build OK. Note : E2E du chemin réel (actions serveur + revalidation) reste lié à la dette GoTrue → Sprint 8. Branche de session imposée `claude/prompt-executer-sprint-1z0e1d`.

### Sprint 6 — Fenêtre de sommeil par défaut ✅
**Livré** : FR-6 complet. **Configuration unique** : formulaire « Fenêtre de sommeil » sur la page foyer (travailleur seulement), upsert `sleep_defaults`, valeurs proposées = fenêtre configurée sinon heuristique du gabarit. **Auto-application** : déjà câblée dans `dayStatuses` (vérifiée, pas réécrite). **Ajustement au cas par cas** (prémisse 3 de la carte tranchée : table dédiée) : nouvelle table `sleep_adjustments` — unique (foyer, travailleur, date), RLS « membre du foyer », migration `…_sprint06_sleep_adjustments.sql`, types régénérés — exposée dans le panneau du jour tapé quand c'est une journée de sommeil (bloc SOUS la capture : budget ≤ 3 taps des écarts intact, NFR-1) ; retirer l'ajustement ramène le jour au défaut. Priorité dans la couche pure : ajustement du jour > fenêtre configurée > heuristique 8 h ; un ajustement sur un jour sans sommeil est ignoré. La conjointe voit la fenêtre (disponibilité partagée), payload toujours sans motif (R7). Gates mesurés : vitest **103** (dont 15 isolation RLS — 3 nouveaux sur `sleep_adjustments`), tsc 0, biome 0, build OK ; preuve Playwright **11/11** sur `/demo/horaire` (fenêtre configurée affichée le jour post-nuit · repli heuristique 07:00-15:00 sans config · ajuster UN jour ne change pas les autres · retrait = retour au défaut · vue conjointe sans motif) — contrainte GoTrue inchangée (cf. Sprints 2-5). Branche de session imposée `claude/prompt-executer-sprint-kk603d`.

### Sprint 7 — Notifications ✅
**Livré** : pipeline FR-10 complet (hors envoi réel). **Génération** : `create_exception_with_motif` (migration `…_sprint07_reminders.sql`) matérialise les rappels dans la même transaction que l'écart — échéances **30/7/1 j** strictement futures (date civile America/Toronto), envoi à 09:00 locale, `profile_id null` = tout le foyer (bidirectionnel), `channel push` ; suppression de l'écart → cascade (0 orphelin constaté). **Couche pure `lib/notifications/`** : `echeances.ts` (miroir TS de la RPC — parité SQL↔TS testée par balayage des bords), `payload.ts` (« écart le DATE », zéro motif structurel + repli `FALLBACK_REMINDER`, R7), `push.ts` (décodage VAPID). **Abonnement** : `ActiverRappels` sur la page foyer (deux rôles) → actions serveur → upsert `push_subscriptions` (RLS appareils strictement personnels) ; réception push + clic dans `app/sw.ts` (payload illisible → notification générique, jamais un rappel perdu en silence). **Envoi** : Edge Function `send-reminders` (service_role : rappels dus → push, repli courriel Resend, `sent_at`, destinataire `profile_id` respecté) — **jamais exécutée** (contrainte Docker/Edge, cf. Sprints 2-6) : déploiement + pg_cron documentés (`supabase/functions/send-reminders/README.md`), validation réelle au Sprint 8. Gates mesurés : vitest **133** (dont 13 BD/RLS rappels + push_subscriptions, 17 purs notifications), tsc 0, biome 0, build OK ; preuves BD observées (J+40 → 3 rappels · J+3 → veille seule · cascade → 0 orphelin · payloads inspectés sans motif). Note revue : si un 2ᵉ chemin d'écriture d'exceptions apparaît (FR-9, FR-15), déplacer la génération vers un trigger sur `exceptions`. Branche de session imposée `claude/prompt-executer-sprint-mktcm9`.

### Sprint 8 — Mise en ligne + filets 🟡 ACTIF
Déploiement Vercel + Supabase Cloud (CA/US-est) ; Edge Function + pg_cron actifs ; solde de la **dette GoTrue/Edge réelle** (Sprints 3-7) ; Sentry + UptimeRobot (uptime **et** réveil du projet gratuit) ; sauvegarde `pg_dump` quotidienne (GitHub Action) ; **test PWA installable + push sur l'iPhone réel** (R11/U-7, `architecture.md:130`).
**Livré (filets) — partiel** : CI GitHub Actions (`.github/workflows/ci.yml`) — 4 portes (`biome` · `tsc` · `vitest` avec **service Postgres 16 → isolation RLS réelle** · `build`) sur push `dev`/`main` et PR ; conteneurisation — `Dockerfile` (sortie Next « standalone », image non-root) + `docker-compose.yml` (Postgres 16 sur `:54322`, la cible des tests RLS). Gates verts en session : **133/133** (dont 15 isolation RLS). **Version tenue à 0.8.0** : le bump mineur n'intervient qu'à la **clôture** du sprint (règle `workflow-sprint.md`) — déploiement, Edge/pg_cron réels, dette GoTrue, Sentry/UptimeRobot, `pg_dump` quotidien et test iPhone restent à faire.
**Carte détaillée** : `prompt-mise-a-jour-roadmap.md`.

## Horizons post-MVP (non planifiés en sprints)

- **v1.1** : co-planification conjointe (notes FR-8, requêtes approuver/refuser FR-9 — qui sert aussi de mécanisme de fraîcheur, opportunité O-1), journal des changements (FR-13), export iCal/PDF (FR-14).
- **v2+** : intégration Dayforce (FR-15), facturation Stripe (FR-16), gabarits de cycle multi-usines (FR-17), conformité Loi 25 opérationnalisée dès le 2ᵉ foyer.
