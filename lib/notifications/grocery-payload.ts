// Contenu d'une notification de liste d'épicerie (Sprint 25) — fonction PURE, AUCUN import.
//
// WHY zéro import : ce module est consommé par l'Edge Function Deno
// (supabase/functions/notify-grocery) via un import relatif — l'alias `@/` et la chaîne
// i18n de l'app n'y existent pas. Le garder feuille garantit qu'il se bundle partout
// (Next, Deno) sans résolution spéciale. La copie miroir vit dans
// supabase/functions/_shared/grocery-payload.ts (garde de parité : grocery-payload-parity.test.ts).
//
// R7 structurel : `groceryPayload` ne REÇOIT QUE le type d'événement — JAMAIS un libellé
// d'article. Même si l'épicerie n'est pas une donnée sensible (les deux membres voient tout),
// la notif dit « une liste vous attend » / « des articles ont été cochés », jamais leur contenu.

/** Événements poussés de l'épicerie : nouvelle liste, ou des articles cochés (anti-spam côté RPC). */
export type GroceryEvent = "nouvelle" | "coche";

/** Ce que reçoit le service worker (event.data.json()) et le courriel de repli. */
export interface GroceryPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

/**
 * Repli du service worker quand le payload reçu est absent ou illisible : une notification
 * générique vaut mieux qu'une notification perdue en silence (R11). Sans contenu d'article.
 */
export const FALLBACK_GROCERY: GroceryPayload = {
  title: "GRANDFORD — épicerie",
  body: "Du nouveau dans une liste d'épicerie. Ouvrez l'app pour voir.",
  url: "/frigo",
};

const CORPS: Record<GroceryEvent, string> = {
  nouvelle: "Une nouvelle liste d'épicerie vous attend au frigo.",
  coche: "Des articles ont été cochés sur une liste d'épicerie.",
};

/**
 * Construit la notification d'un événement d'épicerie : le type d'événement, rien d'autre.
 * Le destinataire (l'autre membre du foyer) est résolu côté Edge Function — pas ici, qui
 * reste pur et sans contenu (R7).
 */
export function groceryPayload(event: GroceryEvent): GroceryPayload {
  return {
    title: "GRANDFORD — épicerie",
    body: CORPS[event],
    url: "/frigo",
  };
}
