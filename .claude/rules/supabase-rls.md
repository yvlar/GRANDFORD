# Supabase & RLS — sécurité multi-tenant

**Portée** : `supabase/**` + tout code d'accès aux données (`lib/**` touchant la BD, `middleware.ts`).

> C'est la préoccupation critique du projet : une RLS mal écrite = fuite entre foyers ou fuite du motif dans le couple (R7 — `docs/analyse/02-analyse/analyse.md:77`).

- **RLS activée sur TOUTE table, sans exception.** Politique de base : « membre du foyer » via `household_id` porteur sur chaque table (`docs/analyse/03-architecture/architecture.md:108-110`).
- **Étanchéité du motif (`architecture.md:111`)** : le motif d'une absence vit dans la table séparée `exception_private`, policy « **travailleur propriétaire seul** ». La conjointe lit `exceptions` (présent/absent) et ne peut **jamais** joindre ou sélectionner le motif. Aucune vue, fonction ou Edge Function ne doit recombiner les deux pour un non-propriétaire.
- **Tests d'isolation RLS = livrable de première classe**, obligatoires dès qu'un sprint touche au schéma, à une policy ou à une donnée de foyer :
  1. un membre d'un foyer ne lit jamais les données d'un autre foyer ;
  2. la conjointe ne lit jamais `exception_private` ;
  3. un membre **révoqué** perd tout accès immédiatement.
  Sprint non vert sans eux.
- **Migrations** : Supabase CLI uniquement (`supabase migration new …`), SQL versionné dans `supabase/migrations/`. Toute modification faite au dashboard doit être rejouée en migration. Après chaque migration : `supabase gen types typescript` (types committés).
- `SUPABASE_SERVICE_ROLE` : **serveur seulement** — jamais côté client, jamais préfixé `NEXT_PUBLIC_`, jamais dans un composant.
- Opérations destructives (drop, truncate, reset de données) : confirmation préalable (cf. `autonomie-confirmations.md`).
