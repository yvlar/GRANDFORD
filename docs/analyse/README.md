# GRANDFORD — Dossier d'analyse

Application web pour travailleurs d'usine sur horaires rotatifs 12 h (équipes A/B/C/D) et leur conjoint(e), visant à éliminer les ratés de communication autour des changements d'horaire (vacances, congés, maladie, overtime, changements de quart, formations).

## Démarche

Le projet suit une démarche d'analyse professionnelle en 3 phases. Aucune conception technique n'est faite avant la fin de la phase 2.

| Phase | Contenu | Statut |
|---|---|---|
| **1. Découverte** | Entrevues structurées : Utilisateurs → Cas d'utilisation → UX → Sécurité/Données/Contraintes | ✅ Close |
| **2. Analyse** | Besoins fonctionnels et non fonctionnels, risques, hypothèses, zones d'incertitude, opportunités de valeur ajoutée | ✅ Rédigée → `02-analyse/analyse.md` |
| **3. Architecture** | Scénarios d'architecture comparés, recommandation cible (frontend, backend, BD, auth, notifications, déploiement, monitoring, sauvegardes) | 🟡 Prête à démarrer |

## Acquis clés de la découverte

- **Thèse** : prothèse de mémoire partagée pour un couple TDAH ; la valeur est dans la fiabilité des **écarts** d'horaire, pas l'horaire normal.
- **Moteur validé** : Pitman 2-2-3 réduit à un binaire A/C vs B/D ; déterministe (ancre 3 juin 2026 + pattern 14 j). Confirmé sur 6 points réels.
- **MVP** : générer + capturer une exception en 3 taps + notifier. Co-planification conjointe en v1.1.
- **Contraintes dominantes** : 0 $ au lancement → SaaS payant visé, mainteneur solo, multi-tenant, PWA + push, conformité Loi 25 à l'échelle.

## Contraintes connues d'entrée de jeu

- L'usine utilise Dayforce, mais **aucune intégration** n'est envisagée : l'application doit fonctionner de manière autonome (saisie manuelle des écarts par rapport au cycle généré).
- Le cycle de travail est prédéterminé et se répète (4 équipes : A et B de jour 07h–19h, C et D de nuit 19h–07h).

## Structure du dossier

- `01-decouverte/` — questionnaires et réponses par section
- `02-analyse/` — synthèse des besoins, risques, hypothèses (à venir)
- `03-architecture/` — scénarios et recommandation (à venir)
