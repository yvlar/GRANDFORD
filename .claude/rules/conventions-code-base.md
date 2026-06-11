# Conventions de base

**Portée** : universel (tout le dépôt).

- **Bilingue FR/EN** : code (fonctions, types, modules, variables techniques) en **anglais** ; commentaires, textes UI et vocabulaire métier exposé en **français** (Québec).
- **TypeScript strict, zéro `any`** : ni `any`, ni `as any`, ni `@ts-ignore`. Exception impossible à éviter → commentaire WHY + plan de retrait.
- **`async/await`** partout ; jamais de chaînage `.then()` ; erreurs typées et gérées aux frontières.
- **Commentaires = WHY non évident uniquement.** Jamais de paraphrase du code (« incrémente i »). Si le code a besoin d'explication WHAT, le réécrire plus clair.
- **Validation aux frontières** : toute entrée externe (formulaire, API, webhook) passe par un schéma **Zod** ; à l'intérieur, on fait confiance aux types.
- Types BD : générés par `supabase gen types typescript` — jamais écrits à la main.
- Fonctions pures privilégiées ; modules courts ; imports absolus (`@/…`).
- Pas de nouveau package sans justification (une ligne dans le message de commit).
