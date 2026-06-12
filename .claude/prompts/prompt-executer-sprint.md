# Prompt réutilisable — Exécuter un sprint GRANDFORD

> À utiliser avec la carte du sprint courant (`prompt-mise-a-jour-roadmap.md`).
> Stack : TypeScript/Next.js/Supabase — gates Vitest + tsc + Biome (+ isolation RLS). Pas de pytest, pas d'evals.

## Phase A — Exécution

0. **Lire** : `CLAUDE.md` → `ROADMAP.md` → la carte du sprint → les règles cadrées listées par la carte (les universelles s'appliquent toujours).
1. **Brancher** : créer `claude/sprintNN-<nom-court>` depuis la branche d'intégration.
2. **Réconcilier la carte avec le code réel** (la carte est une prémisse) : pour chaque dépendance affirmée existante, vérifier la référence `fichier:ligne` par recherche réelle. Prémisse fausse → **STOP**, signaler, proposer la correction de la carte avant toute implémentation.
3. **Implémenter** par petits incréments cohérents. Si le sprint contient du moteur ou du schéma : tests d'abord (golden / isolation), implémentation ensuite.
4. **Gates** (tous verts, compteurs mesurés dans la session) :
   - `pnpm vitest run`
   - `pnpm tsc --noEmit`
   - `pnpm biome check .`
   - tests d'isolation RLS si le sprint touche schéma / policy / données de foyer
5. **Preuve d'acceptation observable** : exécuter ce que la carte décrit et **constater** le résultat (sortie de commande, démo, comportement) — « ça compile » ou « les tests passent » ne suffit pas si la carte exige une observation précise.
6. **Revue indépendante** (contexte frais — jamais l'auteur) : lancer `/code-review` à effort **high** en fournissant les critères d'acceptation du sprint ; **traiter** les findings (corriger ou justifier) ; puis une passe `/simplify`.
7. **Fin de sprint — 3 étapes automatiques** (sans confirmation) :
   1. `ROADMAP.md` : sprint ✅, version++, synchroniser `version` de `package.json`, rotation vers `docs/roadmap-archive.md` si 5ᵉ bloc détaillé ;
   2. réécrire `prompt-mise-a-jour-roadmap.md` pour le sprint suivant (format complet, champ **Référence** vérifié) ;
   3. **commit unique** : code + tests + doc du sprint, message structuré (quoi, pourquoi, gates mesurés).
8. **Demander confirmation** pour `git push`. Sans accord explicite : ne pas pousser.

## Phase B — Livraison (sur confirmation de l'auteur)

9. Pousser la branche (`git push -u origin claude/sprintNN-…`).
10. **Sur demande explicite seulement** : ouvrir la PR — titre `Sprint NN — <nom>` ; corps : objectif, preuve d'acceptation observée, gates mesurés (chiffres réels), risques résiduels.
11. Surveiller la PR (CI, revues), corriger ce qui est actionnable. Une PR n'est terminée que **MERGED ou CLOSED**.

## Rappels permanents

- Loi anti-hallucination : existant ⇒ `fichier:ligne` vérifié en session ; sinon « à créer / à vérifier ».
- État courant : uniquement `ROADMAP.md` — ne le dupliquer nulle part.
- Confirmation obligatoire : push, PR, suppressions, `.env`, DB destructive (cf. `.claude/rules/autonomie-confirmations.md`).
- Le motif d'une absence ne sort JAMAIS vers la conjointe — ni en BD, ni en payload, ni en log (R7).
