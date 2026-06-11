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

## Réponses (1re passe — 2026-06-11)

- **B7** Cycle = **2-2-3 (Pitman)**, 14 jours, week-ends alternés.
- **B9 / ancre** Mer 3 juin 2026 = A (jour) + C (nuit) · Jeu 4 juin = A + C · Ven 5 juin = B (jour) + D (nuit).
- **B10 (sommeil)** Le travailleur **active** la fenêtre de sommeil et **sélectionne sa période** (manuel, opt-in — pas de calcul automatique).
- **B11 (OT)** **Choisi** par le travailleur (volontaire, pas imposé).
- _Non répondu : priorisation des UC / « cas le plus vital » (reporté), anatomie des changements autres que l'OT (échange, formation)._

## 🔧 Spécification du moteur de cycle (dérivée — à confirmer)

**Découverte clé : le système à 4 équipes se réduit à un binaire.** Chaque date appartient à un seul des deux « super-quarts » :

- **A/C** = équipe A de jour (07–19) **+** équipe C de nuit (19–07), les **mêmes** jours.
- **B/D** = équipe B de jour **+** équipe D de nuit, les jours **complémentaires**.
- Chaque jour, exactement **un** super-quart travaille (jour+nuit couverts), l'autre est au repos.

**Identités fixes (à confirmer) :** A,B = toujours jour ; C,D = toujours nuit. Pas de rotation jour↔nuit.

**Algorithme :**
1. Ancre = **mer. 3 juin 2026 = A/C**.
2. Pattern A/C sur 14 jours depuis l'ancre (idx 0 = 3 juin) :
   `[ON, ON, OFF, OFF, OFF, ON, ON, OFF, OFF, ON, ON, ON, OFF, OFF]`
   → blocs 2 on · 3 off · 2 on · 2 off · 3 on · 2 off = lecture 2-2-3 décalée. 7 jours travaillés / 14. ✓
3. Pour une date D : `i = (D − ancre) mod 14`. Si `pattern[i] = ON` → **A/C** travaille, sinon **B/D**.
4. Vue du travailleur : `équipe → (super-quart, quart)` — A→(A/C, jour), C→(A/C, nuit), B→(B/D, jour), D→(B/D, nuit).

**Paramétrable :** ancre + pattern + heures de quart stockés en config **par usine** → multi-tenant + branchement Dayforce futur sans refonte.

**Calendrier reconstruit — juin 2026 (1 cycle complet) :**

| Date | Jour sem. | Jour 07–19 | Nuit 19–07 | Au repos |
|---|---|---|---|---|
| 1 juin | Lun | B | D | A/C |
| 2 juin | Mar | B | D | A/C |
| 3 juin | Mer | **A** | **C** | B/D |
| 4 juin | Jeu | **A** | **C** | B/D |
| 5 juin | Ven | **B** | **D** | A/C |
| 6 juin | Sam | B | D | A/C |
| 7 juin | Dim | B | D | A/C |
| 8 juin | Lun | A | C | B/D |
| 9 juin | Mar | A | C | B/D |
| 10 juin | Mer | B | D | A/C |
| 11 juin | Jeu | B | D | A/C |
| 12 juin | Ven | A | C | B/D |
| 13 juin | Sam | A | C | B/D |
| 14 juin | Dim | A | C | B/D |

Week-ends : A/C off le 6–7, travaille le 13–14 → **alternance confirmée**. Les 3 points d'ancrage réels concordent. Vérif. lointaine : **ven. 25 déc. 2026 = A/C** (équipe A travaille Noël).

## 💡 Opportunités / angles morts relevés

- **Sommeil manuel = piège TDAH.** B10 rend la fenêtre de sommeil manuelle à chaque fois → sera oubliée. Proposition : une fenêtre de sommeil **par défaut**, configurée une fois, auto-appliquée à chaque bloc de nuit (modifiable au cas par cas). À valider.
- **OT volontaire (B11)** → l'OT est un *ajout* à un jour de repos, donc un cas de saisie fréquent : il doit être le geste le plus rapide de l'app.
- **Priorisation MVP encore ouverte** : quel UC est le cœur irremplaçable ?
