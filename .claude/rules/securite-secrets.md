# Sécurité & secrets

**Portée** : universel.

- **Secrets via `.env` uniquement** — jamais commité (`.gitignore` le couvre). **`.env.example` obligatoire et maintenu** : toute nouvelle clé y est ajoutée avec une valeur **factice** le sprint même.
- Classement des clés :
  - Publiques par design : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (la sécurité repose sur RLS, pas sur leur secret).
  - **Serveur seulement** : `SUPABASE_SERVICE_ROLE`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, `ICAL_SECRET` — jamais dans du code client, jamais préfixées `NEXT_PUBLIC_`.
- **Jamais de secret ni de donnée personnelle dans les logs, messages d'erreur ou Sentry** — en particulier le **motif d'une absence** (donnée la plus sensible du produit, R7).
- **Loi 25 (Québec) / PIPEDA** : minimisation (on ne stocke pas ce qu'on n'affiche pas — pas de motif détaillé partagé, pas de paie) ; région de données CA/US-est ; suppression de compte = effacement réel (droit à l'oubli). Dès le **2ᵉ foyer** : politique de confidentialité + consentement à l'inscription + responsable des renseignements personnels désigné.
- Modifier `.env` réel, ou toute opération DB destructive → **confirmation préalable** (cf. `autonomie-confirmations.md`).
