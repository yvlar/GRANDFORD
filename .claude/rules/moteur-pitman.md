# Moteur Pitman — le cœur déterministe

**Portée** : `**/engine/**`.

> Spécification : `docs/analyse/03-architecture/architecture.md:98-106`. Validé sur des points réels (`docs/analyse/01-decouverte/02-cas-utilisation.md:108-118`) — ces faits sont **intouchables**.

- **Fonctions pures uniquement** : aucune I/O, aucun appel Supabase/réseau, pas d'horloge système — la date est toujours un **paramètre**. Le moteur tourne identiquement client et serveur.
- Modèle : `cycleTemplate = { anchorDate: '2026-06-03', pattern: [14 booléens A/C] (02-cas-utilisation.md:61), dayHours, nightHours }` ; `i = floorDays(date − anchorDate) mod 14` avec **mod mathématique** (≥ 0 même avant l'ancre) ; équipes : A,B = jour · C,D = nuit ; A/C et B/D = super-quarts complémentaires.
- **Jamais stocker les jours générés** : tout se calcule à la volée ; seuls les **écarts** (exceptions) sont persistés — ailleurs, pas dans le moteur.
- **Golden tests obligatoires** (les points réels validés) :
  - 2026-06-03 : A jour + C nuit · 2026-06-04 : A + C · 2026-06-05 : B + D
  - 2026-06-11 : équipe A en **congé** (B/D travaille)
  - 2026-12-25 : équipe A **travaille de jour**
  - Table complète de juin 2026 (`02-cas-utilisation.md:68-85`)
  Toucher au moteur avec des golden rouges = **interdit**. Si un golden semble faux, c'est la modification qui est fausse — STOP et signaler.
- **Testé en premier** : aucun écran ne consomme le moteur avant que ses tests passent.
- Fuseaux : raisonner en **date civile locale** (America/Toronto). Un quart de nuit chevauche minuit ; son « jour » = sa date de **début**.
- Paramétrable par design : l'ancre, le pattern et les heures viennent du `cycleTemplate` (jamais en dur dans la logique) — c'est la voie multi-usines (FR-17).
