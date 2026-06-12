import type { EtatCapture } from "@/lib/schedule/capture";

// Fenêtre de sommeil (FR-6, Sprint 6) — les GESTES d'ajustement au cas par cas,
// branchés sur le panneau (actions serveur en réel, état local en démo). La fenêtre
// est de la disponibilité PARTAGEABLE : rien ici ne touche un motif (R7).

/** Ajuster la fenêtre d'UN jour ('HH:MM'), ou retirer l'ajustement (retour au défaut). */
export interface SommeilHandlers {
  readonly ajuster: (date: string, debut: string, fin: string) => Promise<EtatCapture>;
  readonly retirer: (date: string) => Promise<EtatCapture>;
}
