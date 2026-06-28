// Copie partagée de lib/notifications/grocery-payload.ts pour les Edge Functions Deno.
// WHY dossier _shared : Deno/Supabase bundlent uniquement les fichiers sous
// supabase/functions/ — l'import relatif hors de ce dossier est refusé au déploiement
// MCP et fragile avec le CLI. La source de vérité reste lib/notifications/grocery-payload.ts
// (app Next.js + tests) ; cette copie sert exclusivement à l'exécution Edge. Toute
// évolution du type ou du format doit toucher LES DEUX fichiers (garde : grocery-payload-parity.test.ts).
//
// R7 structurel : `groceryPayload` ne REÇOIT QUE le type d'événement — JAMAIS un libellé
// d'article. Il est donc impossible qu'un contenu d'épicerie fuie dans une notification ou un log ici.

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
