# Workflow de sprint

**Portée** : universel.

## Source unique de vérité
- L'état courant (version, phase, sprint) vit **uniquement** dans `ROADMAP.md`. Partout ailleurs : des **pointeurs**, jamais des copies. Aucune table de versions/sprints dupliquée dans `CLAUDE.md` ou ailleurs.
- `ROADMAP.md` : < 200 lignes ; ~4 sprints **détaillés** max — au 5ᵉ, **rotation** du plus ancien vers `docs/roadmap-archive.md` par **couper-coller** (jamais réécrit de mémoire).

## Branches
- **Une branche par sprint** : `claude/sprintNN-<nom-court>`, créée depuis la branche d'intégration. Jamais de commit applicatif direct sur l'intégration.

## Loi anti-hallucination (rigueur centrale)
- Toute capacité présentée comme **EXISTANTE** (« champ déjà là », « table X », « hook Y ») porte une **référence `fichier:ligne` obtenue par recherche réelle dans la session** — jamais de mémoire. Introuvable → reformuler « **à créer / à vérifier** », jamais l'affirmer existante.
- **La carte de sprint (`prompt-mise-a-jour-roadmap.md`) est une prémisse, pas une vérité terrain** : avant d'implémenter, réconcilier ses dépendances avec le code réel ; prémisse fausse → **STOP** + signalement.
- **Compteurs de tests toujours mesurés** par une commande dans la session ; non mesuré → omis.

## Fin de sprint = 3 étapes automatiques (sans demander confirmation pour la doc)
1. **`ROADMAP.md`** : sprint ✅, **version++** (pré-1.0 : bump mineur par sprint complété, patch pour correctif), rotation d'archive si un 5ᵉ bloc détaillé apparaît.
2. **Réécrire `prompt-mise-a-jour-roadmap.md`** pour le sprint suivant : État (2-3 lignes, pointe vers ROADMAP) · LECTURE OBLIGATOIRE (1-2 règles cadrées) · TÂCHE (Spécification + Tests + **Preuve d'acceptation observable**) · SPRINTS SUGGÉRÉS (3-5, format : Objectif / Complexité / Justification / **Référence** `fichier:ligne` vérifiée ou « à créer ») · Template de démarrage.
3. **Commit unique** incluant code + doc du sprint, message structuré.

`git push` et l'ouverture de PR restent à **confirmation** (cf. `autonomie-confirmations.md`).

## Vert ne veut dire vert que si…
Tous les gates passent (`pnpm vitest run`, `pnpm tsc --noEmit`, `pnpm biome check .`, isolation RLS si applicable) **et** la **preuve d'acceptation observable** de la carte a été constatée réellement (sortie de commande, démo) — « ça compile » n'est pas une preuve.

## Revue indépendante (contexte frais)
La session auteure ne se relit pas elle-même : déléguer la revue du diff à un sous-agent dédié — `/code-review` à effort **high**, en fournissant les **critères d'acceptation du sprint** ; traiter les findings ; puis une passe `/simplify`. Des tests verts écrits par le même agent ne valent pas une revue.
