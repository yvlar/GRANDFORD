# ROADMAP — Archive des sprints

> Sprints détaillés sortis de `ROADMAP.md` par rotation (règle : `.claude/rules/workflow-sprint.md` — max ~4 blocs détaillés dans la roadmap active). Contenu déplacé par couper-coller, jamais réécrit de mémoire.

### Sprint 1 — Échafaudage + moteur Pitman ✅
**Livré** : dépôt Next.js (App Router, TS strict + `noUncheckedIndexedAccess`, pnpm, Biome, Tailwind, shadcn/ui init, Serwist PWA — manifest + `sw.js`), scaffold `supabase/` prêt pour migrations (sans tables), et le **moteur Pitman pur** (`lib/engine/`) testé en premier — golden encodant les points réels validés (`docs/analyse/01-decouverte/02-cas-utilisation.md:108`) : ancre 3 juin, 11 juin congé A, 25 déc. A travaille, table complète de juin. Gates verts (vitest 27, tsc 0, biome 0, build OK). Couvre FR-1.

### Sprint 2 — Schéma Postgres + RLS + tests d'isolation ✅
**Livré** : 13 tables du domaine (toutes porteuses de `household_id`) en 2 migrations versionnées ; **RLS activée sur les 13** avec politique « membre du foyer » (helpers `SECURITY DEFINER` anti-récursion) ; **étanchéité du motif structurelle** — `exception_private` arrimé à l'exception parente par FK composites, lisible par le seul travailleur propriétaire (la conjointe obtient 0 ligne) ; types BD générés (`lib/database.types.ts`) ; **tests d'isolation** des 3 scénarios (isolation inter-foyers · motif étanche · révocation immédiate) contre un **vrai Postgres**. Gates mesurés : vitest **35** (27 moteur + 8 isolation), tsc 0, biome 0, build OK. Contrainte d'env : stack Docker Supabase indisponible (CDN d'images bloqué) → Postgres natif + impersonation de rôle (comme PostgREST), `scripts/local-db.sh` ; `supabase start` reste la voie normale ailleurs. Fondation de FR-12.
