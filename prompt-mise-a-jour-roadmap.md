# Carte d'embarquement — Sprint 25 : à définir

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 24 livré : **épingler une note du frigo** (une seule épingle par foyer, **auteur seul**, pas de push). Colonne `is_pinned` sur `fridge_notes` (migration `supabase/migrations/20260627130000_sprint24_fridge_note_pin.sql`), CHECK `fridge_notes_pin_head_only` (tête seulement), **index unique partiel** `idx_fridge_notes_one_pin (household_id) where is_pinned`, RPC **`epingler_note_frigo(note_id, pin)` SECURITY DEFINER** (membre + auteur seul + tête seulement + détache l'épingle existante). Tri épingle-d'abord dans `grouperEnFils`, badge « 📌 Épinglée » (deux membres) + bouton bascule auteur-seul. Version 0.24.0. Phase courante : **v2+**. État courant : voir la table en tête de `ROADMAP.md`.

> **À connaître (Sprint 24)** : pin/unpin passe **uniquement** par le RPC `epingler_note_frigo` (la policy `fridge_notes_update` durcie au Sprint 21 impose `read_* null` → un UPDATE direct de `is_pinned` sur une note lue échoue ; le RPC, DEFINER, contourne cette contrainte sans toucher `read_at`). L'invariant « une épingle par foyer » vit en **deux couches** : l'index unique partiel (rempart BD) **et** le détachement cross-auteur dans le RPC (UX propre). Le RPC vérifie `is_household_member` comme `marquer_note_frigo_lue` (un membre **révoqué** garde `author_id` — sans cette garde il pourrait épingler par appel direct). La constante `FRIGO_NOTE_COLUMNS` (`lib/frigo/db-rows.ts`) reste la **source unique** des colonnes d'une note : tout nouveau champ s'y ajoute une fois (+ schéma Zod + `parseFrigoRows` + `FrigoNote`). Le Postgres local (`bash scripts/local-db.sh`) exécute **réellement** migrations + isolation RLS (index unique, CHECK et garde révoqué ne sont observables que là).

## LECTURE OBLIGATOIRE

1. `.claude/rules/workflow-sprint.md` — loi anti-hallucination : toute capacité « existante » porte une référence `fichier:ligne` vérifiée en session ; sinon « à créer / à vérifier ».
2. `.claude/rules/autonomie-confirmations.md` — `git push`, PR, déploiement Edge, envoi push/courriel réel, migration appliquée sur Cloud = confirmation préalable.
3. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Tâches opérationnelles en attente (hors session de code)

**Migration Cloud Sprint 24 — À APPLIQUER** : `20260627130000_sprint24_fridge_note_pin.sql` (colonne `is_pinned`, CHECK `fridge_notes_pin_head_only`, index unique `idx_fridge_notes_one_pin`, RPC `epingler_note_frigo`) **n'est pas encore sur Cloud** (à appliquer via Supabase MCP après confirmation, projet `eirlzscgxeybyeinpmsi`). Après application : **régénérer les types** (le générateur MCP retire `graphql_public` — ne pas écraser le fichier du dépôt ; ici `lib/database.types.ts` a été hand-edité fidèlement pour `is_pinned` + la signature du RPC).
**Migration Cloud Sprint 23 — À VÉRIFIER/APPLIQUER** : `20260627120000_sprint23_fridge_note_replies.sql` (colonne `parent_id`, trigger `enforce_fridge_note_single_level`, RPC resserré) — confirmer si déjà appliquée ; sinon l'appliquer avant la 24. **Redéployer l'Edge `notify-fridge`** si nécessaire (v3 gère l'event `"reponse"` ; le pin n'envoie PAS de push, aucun changement d'Edge requis pour la 24). **Couplage env à garder** côté Vercel : `SUPABASE_SERVICE_ROLE` = même valeur que le `SUPABASE_SERVICE_ROLE_KEY` de l'Edge.
**Dérive du journal de migrations (cosmétique).** Sur Cloud, plusieurs objets ne correspondent pas 1:1 aux noms/horodatages des fichiers du dépôt. Sans impact fonctionnel ; à régulariser un jour **sans forger de faux enregistrements**.
**Toujours en attente — E2E rappels (Sprint 16)** : validation des notifications de rappel en prod (`cron.job_run_details`, push réel sur appareil) — machine de l'auteur + vrais appareils requis.

## SPRINTS SUGGÉRÉS (3-5)

### Jour de paye — fréquence mensuelle (suite Sprint 17)
**Objectif** : ajouter une cadence `mensuel` au jour de paye (jour fixe du mois ou dernier vendredi). Sort du modèle ancre+mod-en-jours → arithmétique calendaire dans `payday.ts`.
**Complexité** : Moyenne (logique calendaire + élargir `frequencePayeSchema` + CHECK BD + UI + tests ; `payday.test.ts` asserte aujourd'hui que `"mensuel"` est **rejeté** → à inverser).
**Justification** : seulement si l'auteur paie au mois ; sinon hebdo/aux 2 semaines couvrent l'usine. **À confirmer avec l'auteur avant d'implémenter.**
**Référence** : `lib/schedule/payday.ts` (`FrequencePaye` ligne 11, `frequencePayeSchema` ligne 14, `JOURS_PAR_FREQUENCE` lignes 22-25 — **vérifié Sprint 24 via exploration**) ; CHECK `frequence in ('hebdomadaire','aux_2_semaines')` dans `supabase/migrations/20260624120000_sprint17_payday_settings.sql:14` ; `payday.test.ts:69-71` (rejet `"mensuel"` à inverser) ; UI `app/foyer/page.tsx:355-363` ; i18n `lib/i18n/fr.ts` `paye.frequences` (à revérifier en session).

### Note du frigo — archiver/masquer une note résolue (suite Sprints 20-24)
**Objectif** : permettre de **masquer** une note de tête résolue (sans la supprimer) — elle quitte le tableau actif mais reste retrouvable, pour désencombrer sans perdre l'historique.
**Complexité** : Moyenne (colonne `archived_at` ou `is_archived` + filtre du tableau + RLS héritée + UI bouton + éventuel onglet « archivées »). Schéma requis.
**Justification** : prolonge le canal du frigo ; à ne faire que si l'auteur trouve le tableau encombré. **À confirmer avant d'implémenter.**
**Référence** : table `fridge_notes` (`supabase/migrations/20260626120000_sprint20_fridge_notes.sql:14-25`, colonne `archived_at`/`is_archived` **à créer**) ; `grouperEnFils` (`lib/frigo/types.ts`), `FRIGO_NOTE_COLUMNS` (`lib/frigo/db-rows.ts`) — **vérifiés Sprint 24**.

### v2+ — Facturation SaaS (FR-16, Stripe)
**Objectif** : premier foyer gratuit, suivants payants ; webhook Stripe → `households.plan` ; portail client ; gate d'accès par foyer.
**Complexité** : Haute (webhooks Stripe, portail, états d'abonnement) — creds Stripe + décisions business, peu adapté à un conteneur éphémère.
**Justification** : prérequis business pour tout 2ᵉ foyer externe ; FR-17 ✅ rend l'unité de facturation adressable.
**Référence** : `households` (table — `supabase/migrations/20260611192620_initial_schema.sql`, colonne `plan` **à créer**) ; FR-16 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

### v2+ — Intégration Dayforce (FR-15)
**Objectif** : importer l'horaire publié depuis l'API Dayforce (source optionnelle, jamais requise) ; réconcilier avec les écarts existants.
**Complexité** : Haute (API externe, OAuth Dayforce, réconciliation) — bloqué sans accès réel à l'API ni client cible.
**Justification** : non prioritaire sans accès ; documenter le point d'entrée quand l'accès est disponible.
**Référence** : FR-15 — `docs/analyse/02-analyse/analyse.md` (à revérifier).

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis choisis et exécute
le Sprint 25 (parmi les SPRINTS SUGGÉRÉS, ou la tâche que je précise) en suivant
.claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint25-<nom-court> (à créer depuis dev).

Rappels non négociables :
- Réconcilier la carte avec le code réel AVANT d'implémenter (référence fichier:ligne) ;
  prémisse fausse → STOP + signalement.
- Compteurs de tests TOUJOURS mesurés en session (pnpm test). Le Postgres local
  (bash scripts/local-db.sh) permet d'exécuter les tests d'isolation RLS pour de vrai.
- Jamais de motif d'absence, de jour de paye, NI de corps de note du frigo vers un
  destinataire non prévu (R7) — BD, payload push, logs, rendu.
- Secrets serveur (VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE…) jamais NEXT_PUBLIC_.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
