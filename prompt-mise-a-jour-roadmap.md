# Carte d'embarquement — Sprint 7 : Notifications

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 6 livré : fenêtre de sommeil configurée une fois (page foyer), ajustement au cas par cas (`sleep_adjustments`), repli heuristique intact. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint livre **FR-10** : rappels **1 mois / 1 semaine / 1 jour** avant chaque écart — Web Push (VAPID) + repli courriel (Resend) — le cœur « prothèse de mémoire ».

## LECTURE OBLIGATOIRE

1. `.claude/rules/securite-secrets.md` — `VAPID_PRIVATE_KEY` et `RESEND_API_KEY` = serveur seulement ; **jamais de motif dans une notification, un log ou un courriel** (R7).
2. `.claude/rules/supabase-rls.md` — Edge Functions et `service_role` : le contournement de RLS y est volontaire et doit rester côté serveur ; tests d'isolation si schéma/policy touchés.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter (vérifier dans la session)

- **Tables prêtes, pipeline absent** : `reminders(remind_at, lead month|week|day, channel push|email, sent_at, exception_id)` — `supabase/migrations/20260611192620_initial_schema.sql:178` (aucun motif par design, R7) ; `push_subscriptions(endpoint, p256dh, auth_key)` — `…:204` ; index des rappels dus — `…:227`. **Rien n'écrit dans ces tables aujourd'hui** (aucun code applicatif ne les référence — à re-vérifier par grep).
- **Architecture cible** : pg_cron réveille une Edge Function chaque heure → lit les `reminders` dus → envoie push + repli courriel — `docs/analyse/03-architecture/architecture.md:121`. **À créer en entier** : génération des rappels à la capture d'un écart (RPC `create_exception_with_motif`, `supabase/migrations/20260612172755_sprint05_capture_exception.sql:17`, est le point d'entrée naturel), abonnement push côté client (service worker Serwist déjà en place — `app/sw.ts`), Edge Function d'envoi.
- **Clés** : `.env.example:13-18` porte déjà les clés VAPID et Resend (factices). Vraies clés = `.env` réel → **confirmation préalable** (`.claude/rules/autonomie-confirmations.md`).
- **⚠️ Contrainte d'environnement (Sprints 2-6)** : ni GoTrue ni Edge Functions n'ont tourné localement (Docker bloqué). L'envoi RÉEL (push à un vrai appareil, courriel Resend) est un **envoi externe → confirmation préalable obligatoire** ; en session, prouver le pipeline au niveau BD + fonctions pures (calcul des échéances) + appels mockés à la frontière réseau.

## TÂCHE — Sprint 7

### Spécification

1. **Génération des rappels (FR-10)** : à la création d'un écart, créer les `reminders` aux échéances 1 mois / 1 semaine / 1 jour **antérieures à l'écart et futures au moment de la saisie** ; à la suppression de l'écart, les rappels suivent (cascade FK — à constater).
2. **Abonnement Web Push** : geste UI (activer les rappels) → `PushManager.subscribe` (VAPID public) → upsert `push_subscriptions` (RLS : ses propres appareils).
3. **Envoi** : Edge Function (service_role) lisant les rappels dus (`sent_at is null`, `remind_at <= now()`), envoi push, repli courriel Resend, marquage `sent_at`. Planification pg_cron documentée (active seulement sur Supabase Cloud — Sprint 8).
4. **R7 absolu** : le payload d'une notification dit « écart le DATE » (disponibilité), **jamais le motif**.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` — calcul des échéances en pur (dates limites : écart < 1 mois, < 1 semaine, < 1 jour, passé) ; isolation RLS de `push_subscriptions` (appareils personnels) et du chemin d'écriture des `reminders` ; compteur **mesuré**.
- `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.

### Preuve d'acceptation observable

1. Saisir un écart à J+40 → 3 lignes `reminders` (month/week/day) aux bons instants, constatées en BD ; un écart à J+3 → seules week/day… selon la règle « échéance future ».
2. Supprimer l'écart → 0 rappel orphelin (constaté).
3. Le contenu généré d'une notification (payload) ne contient **aucun motif** (inspecté).

## SPRINTS SUGGÉRÉS

### Sprint 8 — Mise en ligne + filets
**Objectif** : Vercel + Supabase Cloud (CA/US-est), pg_cron actif, Sentry/UptimeRobot, sauvegardes `pg_dump`, test PWA installable + push sur l'iPhone réel (R11/U-7) — **et solde de la dette GoTrue/Edge réelle** (lien magique, OAuth, actions serveur, envoi réel) accumulée depuis le Sprint 3.
**Complexité** : Élevée
**Justification** : rien n'a jamais tourné contre les vrais services gérés ; `GRANDFORD_DEMO` ne doit jamais y être défini.
**Référence** : `docs/analyse/03-architecture/architecture.md:130` ; contraintes documentées dans `ROADMAP.md` (Sprints 3-6) et `docs/roadmap-archive.md` (Sprint 2).

### v1.1 — Co-planification conjointe
**Objectif** : notes (FR-8) et requêtes approuver/refuser (FR-9, mécanisme de fraîcheur O-1).
**Complexité** : Moyenne
**Justification** : premier apport actif pour la conjointe ; tables prêtes.
**Référence** : `notes` — `supabase/migrations/20260611192620_initial_schema.sql:152` ; `requests` — `…:163`. UI **à créer**.

### v1.1 — Journal des changements + export
**Objectif** : journal (FR-13, `audit_log` — `supabase/migrations/20260611192620_initial_schema.sql:191`) et export iCal/PDF (FR-14).
**Complexité** : Moyenne
**Justification** : confiance (qui a changé quoi) + partage hors app ; `audit_log` existe, rien ne l'alimente encore.
**Référence** : table vérifiée ; alimentation et UI **à créer**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 7 (Notifications) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint07-notifications (à créer depuis dev), sauf branche de
session imposée par l'environnement (la documenter alors dans ROADMAP).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter — en particulier
  « rien n'écrit dans reminders/push_subscriptions » (grep).
- AUCUN motif dans un payload de notification, un courriel, un log (R7).
- Tout envoi externe réel (push, courriel) et toute modification du .env réel :
  confirmation préalable. Le moteur (lib/engine/) ne se modifie PAS.
- Toute capacité affirmée existante porte une référence fichier:ligne vérifiée en session.
- Gates : pnpm vitest run + pnpm tsc --noEmit + pnpm biome check . + pnpm build,
  tous verts ; isolation RLS pour push_subscriptions et le chemin des reminders.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans me demander.
```
