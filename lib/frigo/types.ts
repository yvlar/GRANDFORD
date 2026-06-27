// Types et helpers PURS de la « note du frigo » (Sprint 20) — tableau partagé du foyer.
//
// R7 : le corps d'une note du frigo est une remarque de couple — JAMAIS un motif
// d'absence. Comme les notes FR-8, il ne transite pas vers exception_private.
//
// L'accusé de lecture se lit du point de vue de l'AUTEUR : « est-ce que l'AUTRE a lu
// ma note ? ». Il n'est donc affiché que sur mes propres notes ; sur les notes de
// l'autre, c'est plutôt l'état « non lue par moi » (badge « Nouveau ») qui compte.

export interface FrigoNote {
  readonly id: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string; // horodatage ISO (timestamptz)
  readonly updatedAt: string; // horodatage ISO ; n'avance au-delà de createdAt QUE si le corps a été édité (trigger set_fridge_notes_updated, Sprint 22)
  readonly readAt: string | null; // horodatage ISO de lecture par l'autre, ou null
  readonly readBy: string | null;
  readonly parentId: string | null; // null = note de tête ; sinon = réponse à cette note (Sprint 23, fil à un seul niveau)
}

/** Une note de tête et ses réponses (fil à un seul niveau, Sprint 23). */
export interface FilFrigo {
  readonly parent: FrigoNote;
  readonly reponses: readonly FrigoNote[];
}

/** Statut d'accusé de lecture d'une note, du point de vue de `currentUserId`. */
export type StatutLecture = "lu" | "non-lu" | "non-applicable";

export type EtatFrigo = { ok: boolean; erreur: string | null };

/** Création : on renvoie la note posée pour un affichage OPTIMISTE immédiat côté client
 * (le live Realtime la délivrera aussi à l'autre membre ; le dédoublonnage se fait par id). */
export type ResultatCreation = EtatFrigo & { note: FrigoNote | null };

export interface FrigoHandlers {
  readonly creer: (body: string) => Promise<ResultatCreation>;
  readonly repondre: (parentId: string, body: string) => Promise<ResultatCreation>;
  readonly modifier: (noteId: string, body: string) => Promise<ResultatCreation>;
  readonly supprimer: (noteId: string) => Promise<EtatFrigo>;
  readonly marquerLue: (noteId: string) => Promise<EtatFrigo>;
}

/**
 * Accusé pertinent UNIQUEMENT sur mes propres notes (l'auteur veut savoir si l'autre
 * a lu). Sur la note de quelqu'un d'autre, l'accusé ne me regarde pas → « non-applicable ».
 */
export function statutLecture(note: FrigoNote, currentUserId: string): StatutLecture {
  // D1 (Sprint 23) : une réponse n'a PAS d'accusé de lecture — la règle vit ici (helper),
  // pas seulement dans la vue, pour que TOUT consommateur (badge, auto-marquage) la respecte.
  if (note.parentId !== null || note.authorId !== currentUserId) {
    return "non-applicable";
  }
  return note.readAt !== null ? "lu" : "non-lu";
}

/**
 * Une note est « nouvelle pour moi » si l'AUTRE l'a écrite et que je ne l'ai pas encore
 * lue (read_at nul). C'est ce qui porte le badge « Nouveau » dans le tableau. L'accueil
 * compte SA pastille directement en SQL (count exact, app/page.tsx) pour ne charger aucun corps.
 */
export function estNouvellePourMoi(note: FrigoNote, currentUserId: string): boolean {
  // D1 (Sprint 23) : une réponse ne porte jamais « Nouveau » ni d'auto-accusé (pas de RPC
  // inutile sur les réponses) — on exclut donc les réponses (parentId non nul) à la source.
  return note.parentId === null && note.authorId !== currentUserId && note.readAt === null;
}

/**
 * Une note est « éditée » si son corps a été modifié après sa création. Le trigger BD
 * (set_fridge_notes_updated, Sprint 22) ne fait avancer updatedAt au-delà de createdAt
 * QUE sur un vrai changement de corps — une simple lecture (accusé) ne compte pas.
 * Comparaison en temps epoch (et non lexicographique) pour rester robuste au format de
 * sérialisation timestamptz (offset de fuseau).
 */
export function estEditee(note: FrigoNote): boolean {
  return new Date(note.updatedAt).getTime() > new Date(note.createdAt).getTime();
}

/**
 * Regroupe une liste plate de notes (chargement + Realtime livrent à plat) en fils :
 * chaque note de tête (parentId null) avec ses réponses. Les notes de tête sortent les
 * plus récentes d'abord (convention du tableau) ; les réponses d'un fil se lisent dans
 * l'ordre CHRONOLOGIQUE (plus anciennes d'abord) — un échange se lit du haut vers le bas.
 *
 * Robustesse : une réponse orpheline (son parent absent de la liste, p. ex. filtré par la
 * RLS ou pas encore arrivé) est ÉCARTÉE plutôt que rendue sans contexte.
 */
export function grouperEnFils(notes: readonly FrigoNote[]): FilFrigo[] {
  const tetes = notes.filter((n) => n.parentId === null);
  const reponsesParParent = new Map<string, FrigoNote[]>();
  for (const note of notes) {
    if (note.parentId === null) {
      continue;
    }
    const liste = reponsesParParent.get(note.parentId) ?? [];
    liste.push(note);
    reponsesParParent.set(note.parentId, liste);
  }
  const tetesTriees = [...tetes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return tetesTriees.map((parent) => ({
    parent,
    reponses: (reponsesParParent.get(parent.id) ?? []).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    ),
  }));
}
