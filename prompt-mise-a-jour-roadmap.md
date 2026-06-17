# Carte d'embarquement — Sprint 10 : Export iCal + conformité Loi 25

> Cette carte est **réécrite à chaque fin de sprint** pour le sprint suivant (règle : `.claude/rules/workflow-sprint.md`).
> ⚠️ C'est une **prémisse à vérifier**, pas une vérité terrain : réconcilier chaque dépendance avec le code réel avant d'implémenter ; prémisse fausse → STOP + signalement.

## État

Sprint 9 livré : co-planification conjointe (FR-8 notes + FR-9 requêtes + trigger rappels). Version 0.10.0. État courant : voir la table en tête de `ROADMAP.md`. Ce sprint complète la **phase v1.1** avec l'export de l'horaire vers les calendriers natifs (FR-14) et, si un 2ᵉ foyer est imminent, la conformité Loi 25 de base.

## LECTURE OBLIGATOIRE

1. `.claude/rules/moteur-pitman.md` — l'export iCal appelle le moteur pur ; golden intouchables.
2. `.claude/rules/securite-secrets.md` — le fichier .ics du travailleur ne contient PAS de motif (R7) ; ni le .ics de la conjointe.
3. `.claude/rules/supabase-rls.md` — si une route ou Edge Function génère le .ics côté serveur, le motif ne doit jamais apparaître dans son payload.
4. `ROADMAP.md` (état + périmètre) ; les règles universelles s'appliquent toujours.

## Prémisses à réconcilier AVANT d'implémenter

- **Moteur Pitman** : `lib/engine/` génère les quarts à la volée — vérifier l'API en session (`getShift`, `getDayStatus` ou équivalent `engine/index.ts`, à vérifier `:ligne`).
- **Exceptions stockées** : `app/page.tsx` charge déjà les exceptions ±62 j ; l'export peut réutiliser le même chargement ou déclencher un fetch dédié côté serveur.
- **`audit_log`** (FR-13 éventuel) : `supabase/migrations/20260611192620_initial_schema.sql` (vérifier si la table existe et si elle est alimentée) — sinon **à créer**.
- **Loi 25** : aucune page de politique de confidentialité ni consentement à l'inscription n'existe actuellement (à vérifier en session) — **à créer** si un 2ᵉ foyer est prévu.

## TÂCHE — Sprint 10

### Option A (recommandée) : Export iCal — FR-14

1. **Route `GET /api/ical/[token]`** (ou Server Action qui renvoie un blob) : génère un fichier `.ics` valide (RFC 5545) couvrant ±90 jours — quarts du moteur + exceptions stockées. Le token est un UUID lié au foyer (sans authentification GoTrue, pour import direct dans Calendrier iPhone/Google).
2. **Deux fichiers** distincts : un pour le travailleur (ses quarts + ses exceptions, sans motif, mais libellé « En quart » / « Congé » / « TS ») ; un pour la conjointe (disponibilité uniquement — « Partenaire en quart » / « Partenaire disponible »). Le motif n'apparaît **jamais** dans aucun fichier (R7).
3. **Lien de téléchargement** sur la page foyer (travailleur + conjointe) : bouton « Exporter vers mon calendrier » → télécharge ou propose le lien d'abonnement.
4. Pas de nouvelle table requise si le token est dérivé du `household_id` + un secret HMAC (`ICAL_SECRET` serveur seulement, ajout à `.env.example`).

### Option B : Conformité Loi 25 (bloqueuse avant 2ᵉ foyer)

1. **Page `/politique`** : politique de confidentialité minimale (données collectées, finalités, droits, responsable des renseignements personnels).
2. **Consentement à l'inscription** : lors du redeem d'invitation (`/invitation/[code]`), afficher un résumé + case à cocher avant d'accepter.
3. **Suppression de compte** : vérifier que le DELETE sur `profiles` entraîne la suppression de toutes les données personnelles (cascade BD) — test à mesurer.

### Tests / validation obligatoires (gates)

- `pnpm vitest run` · `pnpm tsc --noEmit` · `pnpm biome check .` · `pnpm build` — tous verts.
- **Option A** : golden moteur restent verts ; le .ics généré ne contient aucun champ `motif` / `reason` (inspecté par test ou par grep du payload).
- **Option B** : test d'isolation RLS — suppression d'un profil entraîne 0 ligne résiduelle dans les tables de foyer (cascade, mesuré en session).
- **Golden moteur** restent verts (intouchables).

### Preuve d'acceptation observable

**Option A** :
1. Télécharger le `.ics` du travailleur — l'importer dans Calendrier (ou valider avec `ical-expander` / inspection manuelle) — les événements des **3 prochains mois** sont présents.
2. Inspecter le contenu : **0 occurrence de motif / reason / maladie / conge** dans le fichier.
3. Idem pour le .ics de la conjointe : libellés génériques uniquement.

**Option B** :
1. Ouvrir `/politique` sans être connecté — page visible.
2. Accepter une invitation (redeem) — case de consentement requise avant de continuer.
3. Supprimer un compte de test → `select count(*) from public.exceptions where household_id = '<id>'` = **0**.

## SPRINTS SUGGÉRÉS

### v1.1 — Export iCal (FR-14) [recommandé pour Sprint 10]
**Objectif** : `.ics` téléchargeable / abonnement pour iPhone/Google Calendrier.
**Complexité** : Faible-Moyenne (moteur pur + RFC 5545 ; pas de table)
**Justification** : valeur immédiate pour le couple — l'horaire apparaît dans le calendrier natif sans ouvrir l'app.
**Référence** : `lib/engine/` (moteur pur, à vérifier en session) ; `.env.example` (`ICAL_SECRET` **à créer**).

### v1.1 — Conformité Loi 25 [bloqueuse avant 2ᵉ foyer]
**Objectif** : politique de confidentialité + consentement + vérification cascade de suppression.
**Complexité** : Faible (texte + UI légère + test cascade)
**Justification** : exigence `securite-secrets.md` ; déclenchée dès qu'un 2ᵉ foyer est invité.
**Référence** : règle citée (`securite-secrets.md`) ; pages **à créer**.

### v1.1 — Journal des changements (FR-13)
**Objectif** : alimenter `audit_log` à chaque écart saisi / modifié / supprimé ; vue « historique » sur la page foyer.
**Complexité** : Moyenne (trigger BD + UI)
**Justification** : traçabilité du couple — « qui a changé quoi et quand ».
**Référence** : `audit_log` — `supabase/migrations/20260611192620_initial_schema.sql` (existence à vérifier en session ; alimentation **à créer**).

### v2+ — Gabarits multi-usines (FR-17)
**Objectif** : paramétrer l'ancre et le pattern via `cycle_templates` pour d'autres usines/cycles.
**Complexité** : Moyenne
**Justification** : fondation du produit SaaS (FR-16 + FR-17).
**Référence** : `cycle_templates` — `supabase/migrations/20260611192620_initial_schema.sql` (à vérifier en session) ; `GRANDFORD_CYCLE` côté client **à migrer vers la table**.

## Template de démarrage (coller tel quel dans une nouvelle session)

```
Lis CLAUDE.md, ROADMAP.md et prompt-mise-a-jour-roadmap.md, puis exécute le
Sprint 10 (Export iCal + conformité Loi 25) en suivant .claude/prompts/prompt-executer-sprint.md — Phase A.

Branche : claude/sprint10-ical-loi25 (à créer depuis dev).

Rappels non négociables :
- Réconcilier en premier : API du moteur (lib/engine/), existence de audit_log,
  existence d'une page /politique et d'un consentement d'invitation.
- R7 : AUCUN motif / reason dans le .ics travailleur ni conjointe.
- ICAL_SECRET = serveur seulement, jamais NEXT_PUBLIC_, ajouter à .env.example.
- Golden moteur intouchables.
- Fin de sprint = ROADMAP à jour + nouvelle carte + commit. PAS de push sans demander.
```
