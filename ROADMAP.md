# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.5.0 |
| **Phase active** | MVP |
| **Sprint actif** | **Sprint 5 — Capture d'exception ≤ 3 taps** |
| **Dernier sprint complété** | Sprint 4 — Vue « coup d'œil » ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints MVP

### Sprint 1 — Échafaudage + moteur Pitman ✅
**Livré** : dépôt Next.js (App Router, TS strict + `noUncheckedIndexedAccess`, pnpm, Biome, Tailwind, shadcn/ui init, Serwist PWA — manifest + `sw.js`), scaffold `supabase/` prêt pour migrations (sans tables), et le **moteur Pitman pur** (`lib/engine/`) testé en premier — golden encodant les points réels validés (`docs/analyse/01-decouverte/02-cas-utilisation.md:108`) : ancre 3 juin, 11 juin congé A, 25 déc. A travaille, table complète de juin. Gates verts (vitest 27, tsc 0, biome 0, build OK). Couvre FR-1.

### Sprint 2 — Schéma Postgres + RLS + tests d'isolation ✅
**Livré** : 13 tables du domaine (toutes porteuses de `household_id`) en 2 migrations versionnées ; **RLS activée sur les 13** avec politique « membre du foyer » (helpers `SECURITY DEFINER` anti-récursion) ; **étanchéité du motif structurelle** — `exception_private` arrimé à l'exception parente par FK composites, lisible par le seul travailleur propriétaire (la conjointe obtient 0 ligne) ; types BD générés (`lib/database.types.ts`) ; **tests d'isolation** des 3 scénarios (isolation inter-foyers · motif étanche · révocation immédiate) contre un **vrai Postgres**. Gates mesurés : vitest **35** (27 moteur + 8 isolation), tsc 0, biome 0, build OK. Contrainte d'env : stack Docker Supabase indisponible (CDN d'images bloqué) → Postgres natif + impersonation de rôle (comme PostgREST), `scripts/local-db.sh` ; `supabase start` reste la voie normale ailleurs. Fondation de FR-12.

### Sprint 3 — Auth sans mot de passe + foyer ✅
**Livré** : client Supabase typé (`lib/supabase/` : navigateur, serveur, middleware — `@supabase/ssr`) ; pages connexion (lien magique + OAuth Google/Apple), callback, déconnexion ; onboarding (création foyer) ; page foyer (membres, invitation par lien à usage unique, révocation, quitter) — Server Components purs, chaînes dans `lib/i18n/fr.ts`. Migration `…_sprint03_auth_household.sql` : trigger `handle_new_user` (auth.users → profiles), RPC atomique `create_household_with_membership` (SECURITY INVOKER, sous RLS), table `invitations` (RLS propriétaire seul, expiration 7 j), RPC `redeem_invitation` (SECURITY DEFINER, refus par ERRCODE stables GF001-GF004) ; types régénérés. Gates mesurés : vitest **48** (35 + 13 cycle de vie foyer), tsc 0, biome 0, build OK. Contrainte d'env : GoTrue inexécutable localement (Docker bloqué, cf. Sprint 2) → flux d'auth validés **au niveau BD** (insert `auth.users` = effet GoTrue) ; la frontière GoTrue réelle (lien magique, OAuth) reste **à valider contre un projet Supabase Cloud** (au plus tard Sprint 8). Couvre FR-11, FR-12.

### Sprint 4 — Vue « coup d'œil » ✅
**Livré** : couche pure `lib/schedule/` (`overviewRange` = moteur + écarts + sommeil ; calendrier ; date civile America/Toronto), vue `GlanceView` (pastille Aujourd'hui + semaine + mois, **calculée côté client** — NFR-4), sélection d'équipe A/B/C/D (`TeamPicker` + action `choisirEquipe` → `worker_assignments`, modifiable dans la page foyer), accueil par rôle : travailleur (FR-2) / conjointe = disponibilité **sans motif** (FR-3, R7 — colonnes explicites, jamais de jointure `exception_private`). Sommeil : heuristique 08 h–16 h le lendemain d'une nuit, `sleep_defaults` prime (FR-6 complet au Sprint 6). Gates mesurés : vitest **78** (48 + 23 logique pure + 4 rendu HTML du composant + 3 isolation `worker_assignments`), tsc 0, biome 0, build OK ; démo `pnpm demo:coup-doeil` (11 juin = CONGÉ, 25 déc. = JOUR, zéro réseau). **Décision** : gabarit `GRANDFORD_CYCLE` lu côté client tant que FR-17 (la table `cycle_templates` reste inutilisée hors seed de tests). Contrainte d'env (héritée S2/S3) : pas de GoTrue local → preuve « écran » par rendu HTML testé + démo CLI ; l'observation navigateur avec session réelle reste due au Sprint 8.

### Sprint 5 — Capture d'exception ≤ 3 taps 🟡 ACTIF
1 bouton → 6 tuiles (OT, congé, maladie, échange, formation, vacances) ; motif stocké côté privé seulement ; OT = geste le plus rapide de l'app. Couvre FR-4, FR-5, FR-7.
**Carte détaillée** : `prompt-mise-a-jour-roadmap.md`.

### Sprint 6 — Fenêtre de sommeil par défaut ⬜
Configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas. Couvre FR-6.

### Sprint 7 — Notifications ⬜
Web Push (VAPID) + repli courriel Resend ; planification 1 mois / 1 semaine / 1 jour via pg_cron + Edge Function (`architecture.md:119`). Couvre FR-10.

### Sprint 8 — Mise en ligne + filets ⬜
Déploiement Vercel + Supabase Cloud (CA/US-est) ; Sentry + UptimeRobot (uptime **et** réveil du projet gratuit) ; sauvegarde `pg_dump` quotidienne (GitHub Action) ; **test PWA installable + push sur l'iPhone réel** (R11/U-7, `architecture.md:130`).

## Horizons post-MVP (non planifiés en sprints)

- **v1.1** : co-planification conjointe (notes FR-8, requêtes approuver/refuser FR-9 — qui sert aussi de mécanisme de fraîcheur, opportunité O-1), journal des changements (FR-13), export iCal/PDF (FR-14).
- **v2+** : intégration Dayforce (FR-15), facturation Stripe (FR-16), gabarits de cycle multi-usines (FR-17), conformité Loi 25 opérationnalisée dès le 2ᵉ foyer.
