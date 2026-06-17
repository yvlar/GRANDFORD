# ROADMAP — GRANDFORD

> **Source unique de l'état courant.** Les autres fichiers pointent ici, sans copier.
> Rotation : max ~4 sprints détaillés ; au-delà, le plus ancien part dans `docs/roadmap-archive.md` (couper-coller, jamais réécrire de mémoire). Cible : < 200 lignes.

## État courant

| Champ | Valeur |
|---|---|
| **Version** | 0.11.1 |
| **Phase active** | v1.1 |
| **Sprint actif** | **Sprint 12 — à définir** |
| **Dernier sprint complété** | Sprint 11 — Nom du travailleur page foyer ✅ |

Note dépôt : branche d'intégration = **`dev`** (créée le 2026-06-11 depuis `claude/brave-pascal-5o9eiv`, première branche du dépôt — analyse + gouvernance). Chaque sprint : une branche `claude/sprintNN-<nom-court>` depuis `dev`, fusionnée par PR vers `dev`. Une `main` de production pourra naître de `dev` à la première mise en ligne (Sprint 8).

## Périmètre (découpage source : `docs/analyse/02-analyse/analyse.md:41`)

- **MVP** = FR-1→FR-7 (moteur, vues, exceptions, sommeil) + FR-10 (notifications) + FR-11 (auth) + FR-12 (foyer).
- **v1.1** = FR-8 (notes), FR-9 (requêtes), FR-13 (journal), FR-14 (export iCal/PDF).
- **v2+** = FR-15 (Dayforce), FR-16 (facturation SaaS), FR-17 (multi-usines).

## Sprints MVP

> Sprints 1-7 archivés : `docs/roadmap-archive.md`.

### Sprint 8 — Mise en ligne + filets ✅
**Livré** : MVP **en ligne**. Supabase Cloud (CA/US-est) : migrations appliquées, types régénérés, secrets Edge posés, `send-reminders` déployée (v4) ; pg_cron planifié (`:05`), opérationnel. Vercel : projet lié, variables d'env posées (sans `GRANDFORD_DEMO`), build de prod vert, domaine de prod. **Dette GoTrue soldée** : lien magique reçu et connexion réussie sur le site réel ; OAuth Google validé. **Push reçu sur l'iPhone réel** (PWA installée), payload sans motif (R7 ✅) ; courriel de repli Resend reçu. **Sentry** : DSN réel branché (`NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` sur Vercel), événement de test reçu sans courriel ni motif (R7 ✅). **UptimeRobot** : moniteur HTTP(s) sur le site de prod (uptime + réveil du projet gratuit). **Sauvegarde** : secret `SUPABASE_DB_URL` posé, 1er run réel de `backup.yml` → artefact `pg_dump` daté vérifié (NFR-11). Filets locaux déjà livrés (session précédente) : CI 4 gates · Dockerfile + docker-compose · `scripts/verifier-restauration.sh` (round-trip 15 tables, 44 fonctions, policies + GRANT, données cœur) · `docs/mise-en-ligne.md` · scaffolding Sentry R7-strict (`lib/monitoring/scrub.ts`) · correction Edge (`verify_jwt = false`, `_shared/payload.ts`, secret Vault). Gates mesurés : vitest **145** (dont 15 isolation RLS + 12 purs scrubber Sentry), tsc 0, biome 0, build OK. Branche de session : `claude/sprint08-mise-en-ligne`.

### Sprint 9 — Co-planification conjointe ✅
**Livré** : FR-8 (notes de couple partagées dans le foyer) + FR-9 (requêtes disponibilité : conjointe soumet → travailleur approuve / refuse) + **trigger génération rappels** (prérequis Sprint 7 soldé). **Trigger** : migration `…_sprint09_trigger_reminders.sql` — `generate_reminders_for_exception()` (SECURITY INVOKER, `set search_path = ''`) + `trg_generate_reminders` (AFTER INSERT ON exceptions) ; `create_exception_with_motif` allégée (INSERT reminders retiré) — 0 doublement garanti par test. **RLS requests granulaire** : migration `…_sprint09_notes_requests_rls.sql` — `requests_all` trop permissive remplacée par 4 policies ; UPDATE réservé à `target_profile_id` (travailleur ciblé, conjointe bloquée en test). **Server actions** : `creerNote` / `supprimerNote` (`app/notes/actions.ts`) + `soumettreRequete` / `approuverRequete` / `refuserRequete` (`app/requetes/actions.ts`) — approbation appelle la RPC (`motif = 'requete'` → `exception_private`, R7) puis met à jour `requests.status`. **Composants** : `NoteDuJour` (saisie inline + liste + suppression) ; `PanneauJourConjointe` (modal conjointe : notes + formulaire demande + `StatusBadge` pending/approved/declined) ; `PanneauCapture` étendu (section notes + section requête pendante pour le travailleur). **Câblage** `app/page.tsx` : notes + requêtes chargés en parallèle (±62 j), `parseNoteRows` / `parseRequeteRows` aux frontières Zod ; `requests.body` jamais dans Sentry ni logs (R7). Gates mesurés : vitest **155** (+10 : 7 isolation RLS sprint 9 + 3 trigger), tsc 0, biome 0, build OK. Migrations appliquées sur Supabase Cloud. Branche : `claude/sprint09-coplanification`.

### Sprint 11 — Nom du travailleur page foyer ✅
**Livré** : section « Travailleur » dans `/foyer` — le travailleur voit et peut éditer son nom (`profiles.full_name`) ; la conjointe voit le nom en lecture seule. **Server action `mettreAJourNom`** (`app/foyer/actions.ts`) : valide via Zod (`max 120`), `UPDATE profiles SET full_name` sous RLS authenticated, revalide `/foyer` et `/`. **Page foyer** : extraction `monNom` et `nomTravailleur` depuis la requête `membres` existante (0 requête supplémentaire) ; section i18n-ready (`nomPlaceholder`, `enregistrerNom`, `erreurNom` dans `lib/i18n/fr.ts`). Gates mesurés : vitest **175** (inchangé), tsc 0, biome 0. Branche : `claude/sprint10-ical-loi25`.

### Sprint 10 — Export iCal + conformité Loi 25 ✅
**Livré** : FR-14 (export `.ics` pour iPhone/Google Calendrier) + conformité Loi 25 de base. **Tokens HMAC stateless** (`ICAL_SECRET` serveur seulement, ajouté à `.env.example` et `securite-secrets.md`) : `signIcalToken` / `verifyIcalToken` (`lib/ical/generate.ts`) — comparaison timing-safe, zéro table requise. **Génération `.ics` pure** (RFC 5545) : travailleur = quarts du moteur + écarts (libellé « Absent » uniquement pour `off`, jamais le motif, R7) ; conjointe = libellés génériques uniquement (« Partenaire en quart / disponible »). DTSTAMP dynamique, `buildVcalendar` sans ligne vide, CRLF. **Route `GET /api/ical/[token]`** : `SUPABASE_SERVICE_ROLE` stateless (pas de GoTrue) ; lookup `memberships` → `profile_id` travailleur → `worker_assignments` + `exceptions` filtrées par `profile_id` (R7 structurel : jamais d'exception d'un autre membre) ; Zod à la frontière BD (team + effect + shift). **Page `/politique`** : accessible sans auth, politique de confidentialité Loi 25 (données collectées, finalités, droits, responsable RVP). **Consentement invitation** : case à cocher + lien `/politique` dans `app/invitation/[code]` ; validation côté serveur dans l'action (contourne le bypass HTML). **Cascade Loi 25** : 2 tests BD — suppression conjointe (auth.users → membership cascade, 0 résidu) ; suppression foyer → 6 tables = 0 résidu. Gates mesurés : vitest **175** (+20 : 18 purs `.ics` + 2 cascade Loi 25), tsc 0, biome 0. Branche : `claude/sprint09-coplanification`.

## Horizons post-MVP (non planifiés en sprints)

- **v1.1 restant** : journal des changements (FR-13).
- **v2+** : intégration Dayforce (FR-15), facturation Stripe (FR-16), gabarits de cycle multi-usines (FR-17).
