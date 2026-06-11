# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.1.0 |
| **Phase active** | MVP (pré-code) |
| **Sprint actif** | **Sprint 1 — Échafaudage** (Next.js PWA + Supabase + moteur Pitman testé) |
| **Dernier sprint complété** | Phase d'analyse (`docs/analyse/`) ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints MVP

### Sprint 1 — Échafaudage + moteur Pitman 🟡 ACTIF
**Livre** : dépôt Next.js (App Router, TS strict, pnpm, Biome, Tailwind, shadcn/ui, Serwist PWA), init Supabase CLI (sans tables), et le **moteur Pitman pur testé en premier** — golden encodant les points réels validés (`docs/analyse/01-decouverte/02-cas-utilisation.md:108`). Couvre FR-1.
**Carte détaillée** : `prompt-mise-a-jour-roadmap.md`.

### Sprint 2 — Schéma Postgres + RLS + tests d'isolation ⬜
Tables du domaine (`architecture.md:109`) avec `household_id` porteur ; **RLS « membre du foyer » sur toutes** ; **étanchéité du motif** via `exception_private` (`architecture.md:111`) ; **tests d'isolation automatisés** (R7) — gate de sécurité critique. Fondation de FR-12.

### Sprint 3 — Auth sans mot de passe + foyer ⬜
Lien magique + OAuth Google/Apple ; invitation de la conjointe par lien/code à usage unique ; révocation par le propriétaire (`architecture.md:114`). Couvre FR-11, FR-12.

### Sprint 4 — Vue « coup d'œil » ⬜
Accueil : pastille Aujourd'hui (CONGÉ / JOUR / NUIT / SOMMEIL) + semaine + mois, lisible en < 2 s (NFR-1) ; vue conjointe = **disponibilité sans motif**. Couvre FR-2, FR-3.

### Sprint 5 — Capture d'exception ≤ 3 taps ⬜
1 bouton → 6 tuiles (OT, congé, maladie, échange, formation, vacances) ; motif stocké côté privé seulement ; OT = geste le plus rapide de l'app. Couvre FR-4, FR-5, FR-7.

### Sprint 6 — Fenêtre de sommeil par défaut ⬜
Configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas. Couvre FR-6.

### Sprint 7 — Notifications ⬜
Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 semaine / 1 jour via pg_cron + Edge Function (`architecture.md:119`). Couvre FR-10.

### Sprint 8 — Mise en ligne + filets ⬜
Déploiement Vercel + Supabase Cloud (CA/US-est) ; Sentry + UptimeRobot (uptime **et** réveil du projet gratuit) ; sauvegarde `pg_dump` quotidienne (GitHub Action) ; **test PWA installable + push sur l'iPhone réel** (R11/U-7, `architecture.md:130`).

## Horizons post-MVP (non planifiés en sprints)

- **v1.1** : co-planification conjointe (notes FR-8, requêtes approuver/refuser FR-9 — qui sert aussi de mécanisme de fraîcheur, opportunité O-1), journal des changements (FR-13), export iCal/PDF (FR-14).
- **v2+** : intégration Dayforce (FR-15), facturation Stripe (FR-16), gabarits de cycle multi-usines (FR-17), conformité Loi 25 opérationnalisée dès le 2ᵉ foyer.
