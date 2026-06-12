# Prompt réutilisable — Auditer et corriger la gouvernance Claude Code d'un projet

> Prompt d'embarquement pour une session Claude Code chargée d'**auditer puis de corriger**
> les fichiers que Claude utilise pour coder (CLAUDE.md, règles, prompts, carte de sprint,
> roadmap, settings). Indépendant du langage/stack — fonctionne sur tout projet qui suit
> le workflow carte → exécution → fin de sprint. Copier-coller le bloc ci-dessous dans
> une nouvelle conversation.

---

```
Tu audites puis corriges la GOUVERNANCE de ce projet : les fichiers que Claude
lit pour coder. Le code applicatif est HORS périmètre — il ne sert que de
preuve pour vérifier ce que la gouvernance affirme.

## Phase 0 — Inventaire (lecture seule)

Recense les fichiers de gouvernance réellement présents :
- CLAUDE.md (racine + éventuels CLAUDE.md imbriqués) ;
- .claude/rules/ (règles scopées), .claude/prompts/ (prompts réutilisables) ;
- la carte du sprint courant et la roadmap (+ archive de rotation si elle existe) ;
- .claude/settings.json / settings.local.json, hooks, skills éventuels.
Produis une table : fichier · rôle annoncé · taille · présent/manquant. Tout
fichier ANNONCÉ par un autre (pointeur) mais introuvable est un finding.

## Phase A — Audit (lecture seule, AUCUN correctif)

La loi anti-hallucination s'applique à l'audit lui-même : chaque constat porte
une preuve fichier:ligne obtenue par recherche réelle dans la session.
Vérifie ces 7 axes :

1. EXACTITUDE DES POINTEURS — toute référence fichier:ligne et toute capacité
   affirmée existante (« champ déjà là », « table X », « script Y ») est
   revérifiée contre le dépôt réel. Pointeur mort ou décalé = finding.
2. SOURCE UNIQUE DE VÉRITÉ — l'état courant (version, phase, sprint,
   compteurs) vit dans UN seul fichier ; partout ailleurs des pointeurs,
   jamais des copies. Toute duplication, surtout divergente, = finding.
3. COHÉRENCE INTERNE — aucune contradiction entre CLAUDE.md, les règles, les
   prompts et la carte ; les portées (globs) des règles correspondent à
   l'arborescence réelle ; les commandes citées comme gates existent vraiment
   (scripts du manifeste, CI).
4. COUVERTURE — chaque zone critique du dépôt est couverte par une règle
   applicable ; chaque promesse du workflow (rotation, archive, carte
   réécrite en fin de sprint…) a bien son artefact à jour. Trou = finding.
5. BUDGETS ET ROTATION — les limites annoncées (taille max, nombre de blocs
   détaillés…) sont respectées ; les rotations se font par couper-coller,
   jamais réécrites de mémoire.
6. SÉCURITÉ — aucun secret ni donnée personnelle dans les fichiers de
   gouvernance ; la liste des actions à confirmation préalable existe et est
   cohérente entre les fichiers qui la citent.
7. ACTIONNABILITÉ — chaque règle est vérifiable (on peut dire si elle est
   respectée ou non) ; signale le vague, la paraphrase, le bruit qui gonfle
   le contexte sans guider.

## Phase B — Rapport AVANT toute correction

Présente une table de findings : ID · sévérité (bloquant / majeur / mineur) ·
fichier:ligne · constat · correctif proposé. Sépare deux catégories :
- correctifs MÉCANIQUES (pointeur à rafraîchir, copie à remplacer par un
  pointeur, glob à ajuster…) → tu les appliqueras en Phase C ;
- correctifs qui exigent une DÉCISION PRODUIT ou changent une règle de fond →
  question à l'auteur, jamais de correction silencieuse.

## Phase C — Correction

- Applique les correctifs mécaniques par modifications MINIMALES : on répare
  la gouvernance, on ne la réécrit pas.
- N'invente jamais d'exigence : si une règle référence un document produit,
  c'est lui la source — pas ta mémoire.
- Jamais de réécriture d'archive ou d'historique de mémoire ; suppression de
  fichier existant → confirmation préalable.
- Après correction, revérifie chaque pointeur modifié (recherche réelle).

## Phase D — Livraison

- UN commit dédié à l'audit (aucun changement applicatif mêlé), message
  structuré : axes audités, findings corrigés, findings laissés en question.
- git push et PR : selon les règles de confirmation du projet.

## Garde-fous permanents

- Lecture seule jusqu'à la fin de la Phase B — l'audit ne corrige pas en
  marchant.
- Pas de dérive de périmètre vers le code applicatif : un bug de code
  découvert en chemin se SIGNALE dans le rapport, il ne se corrige pas ici.
- Un finding sans preuve fichier:ligne n'est pas un finding.
- En cas de doute entre deux sources contradictoires : c'est un finding à
  trancher par l'auteur, pas par toi.
```
