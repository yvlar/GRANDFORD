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
  readonly readAt: string | null; // horodatage ISO de lecture par l'autre, ou null
  readonly readBy: string | null;
}

/** Statut d'accusé de lecture d'une note, du point de vue de `currentUserId`. */
export type StatutLecture = "lu" | "non-lu" | "non-applicable";

export type EtatFrigo = { ok: boolean; erreur: string | null };

/** Création : on renvoie la note posée pour un affichage OPTIMISTE immédiat côté client
 * (le live Realtime la délivrera aussi à l'autre membre ; le dédoublonnage se fait par id). */
export type ResultatCreation = EtatFrigo & { note: FrigoNote | null };

export interface FrigoHandlers {
  readonly creer: (body: string) => Promise<ResultatCreation>;
  readonly supprimer: (noteId: string) => Promise<EtatFrigo>;
  readonly marquerLue: (noteId: string) => Promise<EtatFrigo>;
}

/**
 * Accusé pertinent UNIQUEMENT sur mes propres notes (l'auteur veut savoir si l'autre
 * a lu). Sur la note de quelqu'un d'autre, l'accusé ne me regarde pas → « non-applicable ».
 */
export function statutLecture(note: FrigoNote, currentUserId: string): StatutLecture {
  if (note.authorId !== currentUserId) {
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
  return note.authorId !== currentUserId && note.readAt === null;
}
