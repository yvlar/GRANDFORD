# Autonomie & confirmations

**Portée** : universel.

**Principe** : action **locale et réversible** → agir sans demander. Action **distante, irréversible ou partagée** → demander d'abord. En cas de doute → demander (une question coûte moins qu'un dégât).

## Actions libres (sans confirmation)
- Créer/modifier des fichiers du projet (code, docs, tests, règles).
- Lancer tests, linters, builds, commandes d'inspection (`git status/diff/log`, recherches).
- **Commits locaux** sur la branche de sprint.
- Mettre à jour `ROADMAP.md` et la carte de sprint en fin de sprint (les 3 étapes automatiques).

## Confirmation préalable de l'auteur OBLIGATOIRE
- `git push` (toute branche).
- Ouvrir, fusionner ou fermer une **PR**.
- **Supprimer** des fichiers existants (hors fichiers créés dans la session courante).
- Modifier le **`.env` réel** (l'exemple `.env.example` est libre).
- Opérations **DB destructives** : drop, truncate, reset de données, suppression de projet Supabase.
- Tout envoi **externe** réel : courriels (Resend), notifications push à de vrais appareils, webhooks.
- Création/modification de ressources cloud facturables.
