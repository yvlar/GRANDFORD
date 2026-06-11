# Phase 2 — Analyse

> Synthèse de la découverte (sections 1 à 6). Aucune décision technologique ici : c'est le cahier qui contraindra la Phase 3.
> Produit : **GRANDFORD** — prothèse de mémoire partagée pour un travailleur d'usine en rotation 12 h (Pitman 2-2-3) et sa conjointe.

## 0. Thèse produit (rappel)

Pas un calendrier de plus : un **cerveau externe partagé** pour deux personnes TDAH, qui élimine les ratés de communication autour des **changements** d'horaire. La valeur n'est pas dans l'horaire normal (calculable) mais dans la **fiabilité des écarts** et leur **diffusion automatique** à la conjointe.

---

## 1. Besoins fonctionnels

### Moteur & horaire
- **FR-1** Générer l'horaire de façon déterministe (Pitman 2-2-3 : ancre + pattern 14 j ; `équipe → super-quart A/C ou B/D → quart jour/nuit`). Calcul à la volée, sans stocker chaque jour.
- **FR-2** Vue travailleur « coup d'œil » : aujourd'hui, semaine, mois ; statut CONGÉ / JOUR / NUIT / SOMMEIL.
- **FR-3** Vue conjointe : **disponibilité familiale** (travaille / disponible / sommeil), jamais le motif.

### Exceptions (cœur de la valeur)
- **FR-4** Saisir une exception en ≤ 3 taps : OT, congé, maladie, échange de quart, formation, vacances.
- **FR-5** Visibilité : exception affichée comme **« absent » / « présent »**, le **motif reste privé**.
- **FR-6** **Fenêtre de sommeil par défaut** configurée une fois, auto-appliquée à chaque quart de nuit, ajustable au cas par cas.
- **FR-7** OT = ajout volontaire sur un jour de repos (geste le plus rapide de l'app).

### Co-planification
- **FR-8** Conjointe : attacher **notes / mémos / questions** à une date (« notes du frigo » numériques).
- **FR-9** Conjointe : soumettre une **requête** sur une date → travailleur **approuve / refuse**.
- **FR-10** **Notifications bidirectionnelles** aux échéances **1 mois / 1 semaine / 1 jour** (push), sur tout changement et toute requête.

### Compte & foyer
- **FR-11** Connexion **sans mot de passe** (lien magique + Google/Apple).
- **FR-12** Foyer = 1 travailleur (propriétaire) + 1 conjointe **invitée** (lien/code) ; propriétaire peut **révoquer**.
- **FR-13** **Journal des changements** (qui / quoi / quand) visible dans le foyer.
- **FR-14** **Export iCal / PDF** de l'horaire (v1.1).

### Différé (post-MVP, mais à ne pas hypothéquer)
- **FR-15** Intégration **Dayforce** comme source pouvant alimenter/écraser la saisie manuelle.
- **FR-16** **Facturation SaaS** (plans payants, multi-foyers).
- **FR-17** Multi-usines : chaque usine = **gabarit de cycle** paramétrable.

### Découpage de livraison
- **MVP** : FR-1→FR-7, FR-10, FR-11, FR-12. (Générer + capturer + notifier + foyer.)
- **v1.1** : FR-8, FR-9 (co-planification conjointe), FR-13, FR-14.
- **v2+** : FR-15, FR-16, FR-17.

---

## 2. Besoins non fonctionnels

- **NFR-1 Friction minimale** : capture ≤ 3 taps, accueil lisible en < 2 s. *Critère de survie* (mauvaise UX = abandon).
- **NFR-2 Fiabilité du moteur** : déterministe, couvert par tests (déjà validé sur 6 points réels).
- **NFR-3 Fraîcheur des données** : mécanismes pour qu'une exception non saisie ne ruine pas la confiance (sans rituel hebdomadaire, refusé).
- **NFR-4 Hors-ligne** : PWA consultable sans réseau ; synchro au retour.
- **NFR-5 Sécurité** : HTTPS, chiffrement au repos, **étanchéité structurelle du motif**, révocation d'accès.
- **NFR-6 Vie privée / conformité** : **Loi 25 (Qc) + PIPEDA** dès l'hébergement de tiers (politique, consentement, responsable des données).
- **NFR-7 Coût** : **0 $/mois au lancement** → paliers gratuits ; coûts (courriels, push, BD) maîtrisés à l'échelle.
- **NFR-8 Maintenabilité solo** : socle géré, peu d'ops, peu de surface à entretenir.
- **NFR-9 Multi-tenant dès le jour 1** (objectif SaaS), sans sur-ingénierie.
- **NFR-10 Scalabilité** : dizaines → centaines de foyers d'abord, chemin vers milliers.
- **NFR-11 Sauvegardes** quotidiennes + restauration testée.
- **NFR-12 Accessibilité TDAH** : fort contraste, peu de texte, reconnaissance > rappel.
- **NFR-13 i18n** : **français (Québec) d'abord**, bilingue possible.
- **NFR-14 Portabilité** : export, pas de verrou ; indépendance vis-à-vis de Dayforce.

---

## 3. Risques

| # | Risque | Gravité | Piste de mitigation |
|---|---|---|---|
| **R1** | **Paradoxe de fraîcheur** : exception oubliée → fausse info → perte de confiance → abandon | 🔴 Critique | Capture ultra-rapide ; requête-conjointe comme déclencheur ; nudges contextuels doux |
| R2 | Discipline de saisie de deux TDAH | 🔴 | Rappels, valeurs par défaut, délégation à la conjointe |
| R3 | Non-adoption de la conjointe (retour aux textos) | 🟠 | Valeur immédiate à l'ouverture ; vue dispo claire |
| R4 | 0 $ vs SaaS : limites des paliers gratuits (courriels du lien magique, push, lignes BD) | 🟠 | Choisir un socle à palier gratuit large ; plafonner les envois |
| R5 | Mainteneur solo non-spécialiste → dette/abandon technique | 🟠 | Stack simple, gérée, bien documentée |
| R6 | Conformité légale dès l'élargissement (Loi 25) | 🟠 | Politique + registre dès le 2ᵉ foyer ; minimisation des données |
| R7 | Fuite du motif privé dans le couple | 🟠 | Séparation structurelle dispo/motif ; tests |
| R8 | Rupture du couple (accès, données sensibles) | 🟡 | Révocation ; la conjointe peut quitter/effacer ses notes |
| R9 | Dépendance future à Dayforce (l'employeur peut bloquer) | 🟡 | Autonomie totale conservée ; Dayforce = bonus, jamais requis |
| R10 | Autres usines = autres patterns | 🟡 | Moteur paramétrable (gabarits de cycle) |
| R11 | **Push PWA sur iOS** (installation requise, fiabilité historique) | 🟠 | Tester tôt sur l'iPhone réel ; repli courriel pour les échéances importantes |

---

## 4. Hypothèses (à confirmer un jour, non bloquantes pour le MVP)

- **H-A** Le cycle est strictement continu (jamais remis à zéro aux fériés/arrêts d'usine).
- **H-B** Heures de quart fixes (07–19 / 19–07), sans variation saisonnière.
- **H-C** MVP = une seule usine, un seul pattern.
- **H-D** Un foyer = 1 travailleur + 1 conjointe.
- **H-E** Les exceptions sont rares relativement aux jours normaux.
- **H-F** Chacun possède un smartphone compatible PWA + push, et une adresse courriel.

---

## 5. Zones d'incertitude

- **U-1** Volumétrie réelle des exceptions/mois (dimensionne la friction et les notifs).
- **U-2** Comportement du cycle aux arrêts d'usine / fériés (remise à zéro ?).
- **U-3** Anatomie complète des changements (échange, formation : imposé vs choisi) — partiellement inconnue.
- **U-4** Valeurs concrètes de la fenêtre de sommeil par défaut (heures).
- **U-5** Modèle de monétisation SaaS (prix, par foyer, freemium ?).
- **U-6** Degré de généralisation du moteur à d'autres patterns d'usine.
- **U-7** Fiabilité réelle du push sur l'iPhone de l'utilisateur.

---

## 6. Opportunités de valeur ajoutée

- **O-1** ⭐ **Requête-conjointe = mécanisme de fraîcheur.** « Tu travailles le 24 ? » → réponse en 1 tap = mise à jour. Transforme le besoin d'info en filet anti-oubli (répond à R1 sans le rituel refusé).
- **O-2** **Vue « disponibilité familiale »** (sommeil inclus) plutôt que « shifts » : le vrai langage du couple. Différenciateur fort vs agenda générique.
- **O-3** **Nudge intelligent** : si un OT était attendu mais l'horaire n'a pas bougé, rappel doux et ciblé (pas de checklist hebdo).
- **O-4** **Créneaux communs** : surligner quand les **deux** sont disponibles (planifier sorties/rendez-vous).
- **O-5** **Flux iCal en lecture seule** : faible effort, grande valeur ; l'horaire apparaît dans Google/Apple Agenda, réduit la dépendance à l'app.
- **O-6** **Gabarits de cycle multi-usines** : la voie directe vers un vrai SaaS (chaque usine = un template Pitman/Continental/DuPont).
- **O-7** **Partage en lecture étendu** (gardienne, ado) : le modèle de rôles le permet déjà ; valeur famille élargie plus tard.
- **O-8** **Moteur déterministe = coût quasi nul** : tout généré à la volée → tient à 0 $ et passe à l'échelle sans douleur.

---

## Verdict

Information **suffisante pour concevoir une architecture solide.** La découverte est close. Les contraintes dominantes (0 $ → SaaS payant, solo, multi-tenant, PWA + push, moteur déterministe, conformité Loi 25 à l'échelle) pointent déjà fortement vers un **socle géré BaaS**. → **Phase 3.**
