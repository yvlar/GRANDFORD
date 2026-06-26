// Copie partagée de lib/notifications/fridge-payload.ts pour les Edge Functions Deno.
// WHY dossier _shared : Deno/Supabase bundlent uniquement les fichiers sous
// supabase/functions/ — l'import relatif hors de ce dossier est refusé au déploiement
// MCP et fragile avec le CLI. La source de vérité reste lib/notifications/fridge-payload.ts
// (app Next.js + tests) ; cette copie sert exclusivement à l'exécution Edge. Toute
// évolution du type ou du format doit toucher LES DEUX fichiers (garde : fridge-payload-parity.test.ts).
//
// R7 structurel : `fridgePayload` ne REÇOIT QUE le type d'événement — JAMAIS le corps de
// la note. Il est donc impossible qu'un texte de note fuie dans une notification ou un log ici.

/** Événements poussés du frigo : une nouvelle note, ou « votre note a été lue ». */
export type FridgeEvent = "nouvelle" | "lue";

/** Ce que reçoit le service worker (event.data.json()) et le courriel de repli. */
export interface FridgePayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

/**
 * Repli du service worker quand le payload reçu est absent ou illisible : une notification
 * générique vaut mieux qu'une notification perdue en silence (R11). Sans contenu de note.
 */
export const FALLBACK_FRIDGE: FridgePayload = {
  title: "GRANDFORD — note du frigo",
  body: "Du nouveau au frigo. Ouvrez l'app pour voir.",
  url: "/frigo",
};

const CORPS: Record<FridgeEvent, string> = {
  nouvelle: "Une nouvelle note vous attend au frigo.",
  lue: "Votre note du frigo a été lue.",
};

/**
 * Construit la notification d'un événement du frigo : le type d'événement, rien d'autre.
 * Le destinataire (l'autre membre pour « nouvelle », l'auteur pour « lue ») est résolu
 * côté Edge Function — pas ici, qui reste pur et sans contenu (R7).
 */
export function fridgePayload(event: FridgeEvent): FridgePayload {
  return {
    title: "GRANDFORD — note du frigo",
    body: CORPS[event],
    url: "/frigo",
  };
}
