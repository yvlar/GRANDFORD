import type { Shift, Team } from "@/lib/engine";
import type { ExceptionEffect, ScheduleException } from "@/lib/schedule/types";

// Capture d'exception (FR-4/FR-5/FR-7, Sprint 5) — la traduction PURE d'une tuile
// vers ce qui se persiste : l'effet partageable (`exceptions`) d'un côté, le motif
// privé (`exception_private`) de l'autre. Aucune I/O : l'écriture atomique vit dans
// la RPC `create_exception_with_motif`, pas ici.

/** Les 6 tuiles de capture — alignées sur le check `motif` de exception_private. */
export const TUILES = ["ot", "conge", "maladie", "echange", "formation", "vacances"] as const;
export type Tuile = (typeof TUILES)[number];

/** Ce qu'une tuile commande d'écrire : effet + quart (partageables) et motif (privé). */
export interface CapturePlan {
  readonly effect: ExceptionEffect;
  readonly shift: Shift | null;
  readonly motif: Tuile;
}

/** Quart d'identité d'une équipe (A,B = jour · C,D = nuit — lib/engine/types.ts). */
export function identityShift(team: Team): Shift {
  return team === "A" || team === "B" ? "jour" : "nuit";
}

/**
 * Sémantique tranchée au Sprint 5 :
 *  - OT : présence ajoutée sur un jour de repos, au quart d'identité (FR-7) ;
 *  - congé / maladie / formation / vacances : absence, sans quart (off ⇒ shift null) ;
 *  - échange : le travailleur prend le quart OPPOSÉ à son identité ce jour-là.
 * Le motif est la tuile elle-même — il ne transite que vers exception_private (R7).
 */
export function capturePlan(tuile: Tuile, team: Team): CapturePlan {
  switch (tuile) {
    case "ot":
      return { effect: "working_extra", shift: identityShift(team), motif: tuile };
    case "echange":
      return {
        effect: "shift_swap",
        shift: identityShift(team) === "jour" ? "nuit" : "jour",
        motif: tuile,
      };
    case "conge":
    case "maladie":
    case "formation":
    case "vacances":
      return { effect: "off", shift: null, motif: tuile };
  }
}

/** Résultat d'une capture/suppression, affichable par le panneau (erreur sans navigation). */
export interface EtatCapture {
  readonly ok: boolean;
  readonly erreur: string | null;
}

/** Les gestes du panneau de capture — actions serveur en réel, état local en démo. */
export interface CaptureHandlers {
  readonly capturer: (date: string, tuile: Tuile) => Promise<EtatCapture>;
  readonly supprimer: (exceptionId: string) => Promise<EtatCapture>;
}

/**
 * Écart vu par son PROPRIÉTAIRE : id (pour la suppression) + motif (badge/détail).
 * N'est hydraté que dans la branche travailleur de l'accueil — la conjointe ne
 * reçoit jamais ce type, et la RLS d'exception_private lui rendrait 0 ligne de
 * toute façon (R7 : défense en profondeur, pas une seule barrière).
 */
export interface OwnException extends ScheduleException {
  readonly id: string;
  readonly motif: Tuile | null;
}
