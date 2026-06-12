# GRANDFORD — Index du projet

> 📍 **État courant (version, phase, sprint actif) : voir `ROADMAP.md`** — source unique de vérité.
> Ce fichier est un **index** : il pointe, il ne duplique jamais l'état.

## Identité

**GRANDFORD** est une **PWA** pour travailleurs d'usine en rotation 12 h (cycle **Pitman 2-2-3**, équipes A/B de jour 07–19 · C/D de nuit 19–07) **et leur conjoint(e)**. Thèse produit : une **prothèse de mémoire partagée** pour un couple TDAH. La valeur n'est **pas** l'horaire normal (déterministe, calculable à la volée) mais la **fiabilité des écarts** (OT, congés, maladie, échanges…) et leur **diffusion automatique** à la conjointe : capture ≤ 3 taps, rappels 1 mois / 1 semaine / 1 jour, vie privée structurelle (le **motif** d'une absence n'est jamais partagé — seule l'absence l'est).

**Source de vérité produit : `docs/analyse/`** (découverte → analyse → architecture). Toute exigence (FR-1…FR-17 : `docs/analyse/02-analyse/analyse.md:12`), risque (R1…R11 : `analyse.md:67`) et choix de stack (`docs/analyse/03-architecture/architecture.md:180`) y est consigné. **Ne jamais inventer d'exigence** : si ce n'est pas dans `docs/analyse/`, ça n'existe pas.

## Gouvernance — où regarder

| Besoin | Fichier |
|---|---|
| État courant (version, phase, sprint) | `ROADMAP.md` (table en tête) |
| Carte du prochain sprint | `prompt-mise-a-jour-roadmap.md` |
| Procédure d'exécution d'un sprint | `.claude/prompts/prompt-executer-sprint.md` |
| Audit de la gouvernance (CLAUDE.md, règles, prompts) | `.claude/prompts/prompt-audit-gouvernance.md` |
| Sprints archivés (rotation) | `docs/roadmap-archive.md` (créé à la 1re rotation) |

## Stack (détail : `architecture.md:180` ; versions exactes : `package.json` — à créer au Sprint 1)

| Couche | Choix |
|---|---|
| Langage | TypeScript **strict** partout (front, back, moteur) — zéro `any` |
| Framework | Next.js (App Router) + React, en **PWA** (Serwist) |
| UI | Tailwind CSS + shadcn/ui (accessibilité TDAH) |
| Données client | supabase-js + TanStack Query |
| Formulaires / validation | React Hook Form + Zod |
| BaaS | **Supabase** : Postgres · Auth sans mot de passe · **RLS** · Edge Functions · Realtime |
| Moteur horaire | TypeScript **pur** (fonctions sans I/O), testé en premier |
| Tests | Vitest (+ tests d'isolation RLS) |
| Notifications | Web Push (VAPID) + repli courriel Resend |
| Outils | pnpm · Biome · GitHub Actions |
| Hébergement | Vercel Hobby + Supabase Cloud (région CA/US-est) |
| Monitoring | Sentry + UptimeRobot |

## Structure cible du dépôt (créée au Sprint 1)

```
app/                  # Routes Next.js (App Router)
components/           # UI (shadcn/ui + composants maison)
lib/engine/           # Moteur Pitman — fonctions pures, zéro I/O
lib/                  # Client Supabase, helpers
supabase/             # Migrations SQL, policies RLS, Edge Functions
docs/analyse/         # Dossier produit (source de vérité des exigences)
docs/roadmap-archive.md   # Sprints archivés (rotation)
.claude/rules/        # Règles scopées (table ci-dessous)
.claude/prompts/      # Prompts réutilisables
```

## Règles — table de pointeurs (`.claude/rules/`)

| Règle | Portée (glob) | Fichier |
|---|---|---|
| Conventions de base (bilingue FR/EN, TS strict, WHY) | universel | `.claude/rules/conventions-code-base.md` |
| Frontend (App Router, PWA, accessibilité TDAH, i18n) | `app/**`, `components/**` | `.claude/rules/conventions-frontend.md` |
| Supabase & RLS (isolation foyers, motif étanche, migrations) | `supabase/**`, accès données | `.claude/rules/supabase-rls.md` |
| Moteur Pitman (pureté, golden, jamais stocker les jours) | `**/engine/**` | `.claude/rules/moteur-pitman.md` |
| Tests Vitest (priorités, compteurs mesurés) | `**/*.test.ts`, `**/*.spec.ts` | `.claude/rules/tests-vitest.md` |
| Sécurité & secrets (.env, Loi 25/PIPEDA, logs) | universel | `.claude/rules/securite-secrets.md` |
| Workflow de sprint (3 étapes de fin, anti-hallucination) | universel | `.claude/rules/workflow-sprint.md` |
| Autonomie & confirmations | universel | `.claude/rules/autonomie-confirmations.md` |

## Confirmation obligatoire (résumé — détail : `.claude/rules/autonomie-confirmations.md`)

Action **locale et réversible** → agir. Action **distante, irréversible ou partagée** → **demander d'abord** : `git push`, ouvrir/fusionner une PR, supprimer des fichiers, modifier `.env`, opérations DB destructives.

## Ce projet N'est PAS

- **Pas TradingClaude** : aucun Python/pytest/ruff, aucune machinerie RAG, skills ou evals LLM. Les portes de qualité sont Vitest + `tsc` + Biome + tests d'isolation RLS.
- **Pas un calendrier générique** : un moteur déterministe (ancre + pattern 14 j) + des **écarts** persistés — jamais un CRUD de tous les jours.
- **Pas dépendant de Dayforce** : autonome ; Dayforce = source future optionnelle (FR-15), jamais requise.
- **Pas une app native, pas de microservices** : une PWA + Supabase, un seul dépôt — anti-sur-ingénierie pour mainteneur solo (R5).
- **Pas un tracker de paie/OT$/banques de congés** : explicitement hors périmètre (analyse, Q15).
