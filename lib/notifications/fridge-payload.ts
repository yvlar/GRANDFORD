// Contenu d'une notification de note du frigo (Sprint 20) — fonction PURE, AUCUN import.
//
// WHY zéro import : ce module est consommé par l'Edge Function Deno
// (supabase/functions/notify-fridge) via un import relatif — l'alias `@/` et la chaîne
// i18n de l'app n'y existent pas. Le garder feuille garantit qu'il se bundle partout
// (Next, Deno) sans résolution spéciale. La copie miroir vit dans
// supabase/functions/_shared/fridge-payload.ts (garde de parité : fridge-payload-parity.test.ts).
//
// R7 structurel : `fridgePayload` ne REÇOIT QUE le type d'événement — JAMAIS le corps de
// la note. Il est donc impossible qu'un texte de note fuie dans une notification, un
// courriel ou un log construit ici. La notif dit « une note vous attend », jamais son contenu.

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
