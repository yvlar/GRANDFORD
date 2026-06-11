# Conventions frontend

**Portée** : `app/**`, `components/**`.

- **Next.js App Router** : Server Components par défaut ; `'use client'` seulement si nécessaire (état, événements, hooks navigateur).
- **PWA (Serwist)** : les vues clés (accueil, horaire) restent consultables **hors-ligne** (NFR-4) — le moteur est pur et tourne côté client, l'horaire ne doit jamais dépendre du réseau pour s'afficher.
- **Tailwind + shadcn/ui** uniquement ; pas d'autre lib UI sans justification.
- **Accessibilité TDAH (NFR-12 — `docs/analyse/02-analyse/analyse.md:61`)** : fort contraste, peu de texte, **reconnaissance > rappel** (icônes + couleurs + gros états, pas des paragraphes). L'accueil se lit en **< 2 s** ; la capture d'exception tient en **≤ 3 taps** (NFR-1). Tout changement qui allonge un parcours clé doit être justifié explicitement.
- **i18n : français d'abord (NFR-13)** : aucune chaîne en dur dans les composants — chaînes centralisées dès le départ pour permettre le bilingue plus tard.
- **La vue conjointe ne reçoit JAMAIS le motif d'une exception** — pas même dans un payload non affiché (R7). La confidentialité se joue en BD **et** dans ce qui transite vers le client.
- Dates/heures : raisonner en date civile locale (America/Toronto) ; un quart de nuit appartient à sa date de **début**.
