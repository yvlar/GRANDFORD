// Types et helpers PURS de la « liste d'épicerie » (Sprint 25) — listes partagées du foyer.
//
// Une liste appartient au foyer ; les DEUX membres y ajoutent, retirent et cochent des
// éléments. Distincte de la note du frigo : pas de réponses, pas d'accusé de lecture —
// une coche EST l'information (qui a acheté quoi). R7 : un libellé d'article n'est pas
// un motif d'absence ; il ne transite jamais vers exception_private ni dans un payload push.

export interface GroceryList {
  readonly id: string;
  readonly authorId: string;
  readonly title: string;
  readonly createdAt: string; // horodatage ISO (timestamptz)
}

export interface GroceryItem {
  readonly id: string;
  readonly listId: string;
  readonly authorId: string; // qui a ajouté l'élément
  readonly label: string;
  readonly isChecked: boolean;
  readonly checkedBy: string | null; // qui a coché (null si non coché)
  readonly checkedAt: string | null; // horodatage ISO de la coche, ou null
  readonly createdAt: string;
}

/** Une liste et ses éléments (regroupement de la liste plate, comme grouperEnFils du frigo). */
export interface ListeAvecElements {
  readonly liste: GroceryList;
  readonly elements: readonly GroceryItem[];
}

export type EtatEpicerie = { ok: boolean; erreur: string | null };

/** Création de liste/élément : on renvoie l'entité posée pour un affichage OPTIMISTE
 * immédiat (le live Realtime la redélivrera aussi ; dédoublonnage par id). */
export type ResultatListe = EtatEpicerie & { liste: GroceryList | null };
export type ResultatElement = EtatEpicerie & { element: GroceryItem | null };

export interface EpicerieHandlers {
  readonly creerListe: (title: string) => Promise<ResultatListe>;
  readonly supprimerListe: (listId: string) => Promise<EtatEpicerie>;
  readonly ajouterElement: (listId: string, label: string) => Promise<ResultatElement>;
  readonly retirerElement: (itemId: string) => Promise<EtatEpicerie>;
  readonly cocherElement: (itemId: string, checked: boolean) => Promise<EtatEpicerie>;
  readonly viderLesAchetes: (listId: string) => Promise<EtatEpicerie>;
}

/**
 * Regroupe une liste plate de listes + éléments (chargement et Realtime livrent à plat)
 * en listes-avec-éléments. Les listes sortent les plus RÉCENTES d'abord (convention du
 * frigo) ; les éléments d'une liste se lisent dans l'ordre CHRONOLOGIQUE d'ajout (on remplit
 * une liste du haut vers le bas).
 *
 * Robustesse : un élément orphelin (sa liste absente — filtrée par la RLS ou pas encore
 * arrivée) est ÉCARTÉ plutôt que rendu sans contexte (calque grouperEnFils du frigo).
 */
export function grouperListes(
  listes: readonly GroceryList[],
  elements: readonly GroceryItem[],
): ListeAvecElements[] {
  const elementsParListe = new Map<string, GroceryItem[]>();
  for (const element of elements) {
    const liste = elementsParListe.get(element.listId) ?? [];
    liste.push(element);
    elementsParListe.set(element.listId, liste);
  }
  return [...listes]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((liste) => ({
      liste,
      elements: (elementsParListe.get(liste.id) ?? []).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
    }));
}

/** Nombre d'éléments restant à acheter (non cochés) — porte le badge « X à acheter ». */
export function compteRestant(elements: readonly GroceryItem[]): number {
  return elements.reduce((n, element) => (element.isChecked ? n : n + 1), 0);
}
