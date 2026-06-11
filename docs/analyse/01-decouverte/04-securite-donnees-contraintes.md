# Phase 1 — Découverte · Sections 4-5-6 : Sécurité · Données · Contraintes

> Statut : 🟡 Défauts proposés (propose-veto), en attente.
> Mode : défauts taillés pour un produit perso multi-foyers, faible budget, faible maintenance, deux utilisateurs TDAH.

## 🔒 Sécurité

| # | Défaut | Raison | Fork / veto |
|---|---|---|---|
| SEC1 | **Connexion sans mot de passe** : lien magique par courriel + option « continuer avec Google/Apple » | TDAH = mots de passe oubliés ; moins de friction, plus sûr | Veto = mot de passe classique |
| SEC2 | **Foyer = 1 travailleur (propriétaire) + 1 conjointe (invitée par lien/code)** | Modèle simple, conforme aux rôles | — |
| SEC3 | **Autorisations** : travailleur lecture/écriture + approuve requêtes ; conjointe lecture + notes + requêtes ; **motif d'absence jamais visible** | Co-planification + vie privée (D14) | — |
| SEC4 | **Chiffrement en transit (HTTPS) et au repos** ; hébergement région nord-américaine | Résidence des données ; hygiène de base | — |
| SEC5 | **2FA optionnelle, non imposée** | Le lien magique suffit ; éviter la friction | — |

**🕳️ Angle mort signalé — la séparation du couple.** Une app de couple a besoin d'un flux « retirer l'accès / quitter le foyer » (rupture, dispute). Qui garde les données ? Défaut proposé : le **travailleur** est propriétaire ; il peut révoquer l'accès de la conjointe à tout moment ; la conjointe peut quitter et effacer ses propres notes. À valider plus tard.

## 🗄️ Données

| # | Défaut | Raison | Fork / veto |
|---|---|---|---|
| DAT1 | **On stocke** : foyer, profils, config cycle (ancre/pattern/équipe/heures), exceptions (type/dates/visibilité), notes, requêtes, prefs notif, sommeil par défaut. **Pas** de motif détaillé, **pas** de paie/OT$ | Strict nécessaire ; minimise le risque | — |
| DAT2 | **Journal des changements** (qui/quoi/quand) visible dans le foyer | TDAH : « ah, c'est moi qui ai changé ça » ; confiance | Fork : transparence vs sensation de surveillance |
| DAT3 | **Rétention** : tout tant que le compte existe ; passé consultable ; suppression de compte = effacement | Droit à l'oubli ; simplicité | — |
| DAT4 | **Sauvegardes quotidiennes automatiques**, restauration possible | Une perte de données = perte de confiance | — |
| DAT5 | **Export iCal / PDF** de l'horaire (v1.1) | Portabilité, confiance | Peut passer en MVP si tu veux |

**🕳️ Angle mort — étanchéité du motif.** « Absent sans motif » n'est crédible que si la base **sépare structurellement** la disponibilité (partagée) du motif (privé), pour qu'aucun bug ni fuite ne révèle le motif à la conjointe. À porter jusqu'au modèle de données.

## ⚙️ Contraintes (hypothèses à corriger — ici j'ai besoin de ta réalité)

| # | Hypothèse par défaut | À confirmer / corriger |
|---|---|---|
| CON1 | **Budget très serré** : ~0–20 $/mois au début (tiers gratuits/managés) | Ton plafond mensuel réel ? |
| CON2 | **Pas d'échéance dure** : MVP pour ton foyer d'abord, puis on élargit | Une date en tête ? |
| CON3 | **Toi seul (avec mon aide) à la construction/maintenance** → stack managé, peu d'ops | Solo ? équipe ? c'est moi qui code ? |
| CON4 | **Monétisation plus tard** (gratuit d'abord, peut devenir SaaS payant si ça grandit) | Gratuit pour toujours, ou viser du payant ? |
| CON5 | **Échelle visée : dizaines→centaines de foyers**, pas des millions | Ordre de grandeur correct ? |

**🕳️ Angle mort majeur — dès que tu héberges les données d'AUTRES foyers, tu deviens responsable de renseignements personnels d'autrui.** Au Québec, ça t'expose à la **Loi 25** (et PIPEDA au fédéral) : politique de confidentialité, consentement, responsable des données, etc. Sans gravité pour ton seul foyer, mais à anticiper avant d'« élargir ». Je l'inscris comme contrainte non fonctionnelle.

## Réponses / vetos

_(à consigner ici)_
