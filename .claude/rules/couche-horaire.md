# Couche horaire — superposition pure

**Portée** : `lib/schedule/**`.

> Couche entre le moteur Pitman (`lib/engine/`, règle `moteur-pitman.md`) et l'UI : elle superpose les **écarts** persistés à l'horaire déterministe pour produire ce qui s'affiche (`DayStatus`, grilles, capture, paie, sommeil, coplanification).

- **Mêmes exigences de pureté que le moteur** : fonctions pures, aucun appel Supabase/réseau, la date est toujours un **paramètre**. Deux frontières explicites, et seulement elles :
  - `today.ts` — l'horloge vit là (date civile America/Toronto), jamais dans la logique ;
  - `db-rows.ts` — validation Zod des lignes Supabase (cf. `conventions-code-base.md`, validation aux frontières).
- **R7 — étanchéité du motif** : les schémas de `db-rows.ts` sont la **liste blanche** de ce qui transite vers le client — aucune colonne de motif n'y entre, jamais. Étendre un schéma = re-vérifier R7 avant de committer.
- Raisonner en **date civile locale** (America/Toronto), jamais en `Date` UTC nu ; un quart de nuit appartient à sa date de **début**.
- Tests colocalisés (`*.test.ts`, règle `tests-vitest.md`) : la logique est testée **avant** d'être consommée par un écran, **sans mock** (elle est pure — les mocks restent aux frontières).
