# Phase 1 — Découverte · Section 2 : Cas d'utilisation

> Statut : ❓ Questions envoyées, en attente des réponses.
> Pré-requis critique : extraire la mécanique exacte du cycle rotatif (moteur de génération).

## Cas d'utilisation dérivés (à valider / prioriser)

**Principaux**
- UC1 — Travailleur : consulter mon horaire généré, d'aujourd'hui à plusieurs semaines/mois.
- UC2 — Travailleur : saisir une exception (OT, congé, maladie, échange de quart, formation, vacances) en quelques secondes.
- UC3 — Conjointe : consulter la disponibilité à une date (travaille / disponible / sommeil).
- UC4 — Conjointe : attacher une note ou une question à une date (« notes du frigo »).
- UC5 — Conjointe : soumettre une requête sur une date ; le travailleur approuve ou refuse.
- UC6 — Notifications bidirectionnelles aux échéances 1 mois / 1 semaine / 1 jour.

**Secondaires (à confirmer)**
- Changement d'équipe permanent (A→B), p. ex. après réaffectation.
- Vue « semaine » vs « mois » ; export ou synchro vers l'agenda du téléphone.
- Historique des changements (qui a modifié quoi, quand).

**Cas limites (à confirmer)**
- Transition jour→nuit ou nuit→jour à l'intérieur d'une même semaine (fenêtre de sommeil).
- Exception qui chevauche un jour de quart vs un jour de congé.
- Saisies contradictoires travailleur vs conjointe sur la même date.
- Jours fériés / temps des Fêtes.

**Exceptionnels (à confirmer)**
- Travailleur qui quitte/change d'usine (cycle différent) — lié à la croissance multi-foyers.
- Reprise après une longue absence (vacances de plusieurs semaines) : le cycle se réaligne-t-il automatiquement ?

## EXTRACTION DU CYCLE (bloc prioritaire)

L'exemple « simplifié » fourni est irrégulier (semaine 2 a un mercredi A/C isolé) — donc non littéral. Hypothèse la plus probable pour 4 équipes (A,B jour / C,D nuit) : **rotation Pitman / 2-2-3** (2 jours travaillés, 2 off, 3 travaillés, sur un cycle de 14 jours, week-ends alternés), où chaque équipe travaille exactement la moitié des jours.

- Q-CYCLE-1 — Est-ce un patron connu (2-2-3 / Pitman ? 4 jours-4 nuits-congés ? DuPont ?) ou un patron maison ?
- Q-CYCLE-2 — Donnez 2 à 3 **semaines réelles consécutives** depuis votre vrai calendrier, avec dates réelles et l'équipe (ou les équipes) qui travaille(nt) chaque jour.
- Q-CYCLE-3 — **Ancre :** à une date réelle précise (ex. lun. 9 juin 2026), quelle(s) équipe(s) travaillai(en)t, en jour et en nuit ?
- Q-CYCLE-4 — Le cycle est-il strictement continu (aucune remise à zéro), ou peut-il être décalé (jour férié, arrêt d'usine) ?

## Réponses

_(à consigner ici)_
