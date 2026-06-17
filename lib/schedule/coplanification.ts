// Types pour la co-planification conjointe (FR-8 notes, FR-9 requêtes, Sprint 9).
// R7 : ni Note.body ni Requete.body ne sont des motifs d'absence — ce sont des
// remarques du couple. Les motifs restent dans exception_private (travailleur seul).

export interface Note {
  readonly id: string;
  readonly onDate: string;
  readonly body: string;
  readonly authorId: string;
}

export type StatusRequete = "pending" | "approved" | "declined";

export interface Requete {
  readonly id: string;
  readonly onDate: string;
  readonly body: string;
  readonly status: StatusRequete;
  readonly requesterId: string;
  readonly targetProfileId: string;
}

export type EtatNote = { ok: boolean; erreur: string | null };
export type EtatRequete = { ok: boolean; erreur: string | null };

export interface NoteHandlers {
  readonly creer: (onDate: string, body: string) => Promise<EtatNote>;
  readonly supprimer: (noteId: string) => Promise<EtatNote>;
}

export interface RequeteHandlers {
  readonly approuver: (requestId: string, onDate: string, effet: string) => Promise<EtatRequete>;
  readonly refuser: (requestId: string) => Promise<EtatRequete>;
}
