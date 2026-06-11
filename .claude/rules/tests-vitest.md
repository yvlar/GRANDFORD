# Tests — Vitest

**Portée** : `**/*.test.ts`, `**/*.spec.ts`.

- **Ordre de priorité** : 1) moteur (golden + propriétés) · 2) isolation RLS · 3) logique critique d'UI. Le moteur est testé **avant** d'être consommé.
- **Compteurs TOUJOURS mesurés** par une commande réelle dans la session (`pnpm vitest run`), jamais estimés, jamais recopiés d'un document. Un chiffre non mesuré dans la session : on l'**omet**.
- Un test = un comportement, nommé en français descriptif :
  `it("le 11 juin 2026, l'équipe A est en congé")`.
- **Pas de mock du moteur** : il est pur, on l'appelle vraiment. Les mocks sont réservés aux frontières (réseau, Supabase, horloge).
- Propriétés à couvrir pour le moteur : 7 jours ON / 14 ; complémentarité stricte A/C vs B/D (jamais les deux, jamais aucun) ; périodicité 14 jours ; dates antérieures à l'ancre.
- **Gates de sprint** (tous verts, sinon le sprint n'est pas terminé) :
  `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · tests d'isolation RLS quand le sprint touche schéma/policy/données de foyer.
- Un test qui échoue de façon intermittente est un **bug à corriger**, pas à réessayer.
