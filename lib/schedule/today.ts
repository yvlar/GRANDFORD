// L'horloge vit À LA FRONTIÈRE, jamais dans le moteur ni dans la logique de
// superposition (règle moteur-pitman.md : la date est toujours un paramètre).

/** Fuseau de référence du produit : date civile locale de l'usine (R7, NFR). */
export const PRODUCT_TIME_ZONE = "America/Toronto";

// Réutilisé entre les appels : la construction d'un Intl.DateTimeFormat n'est pas
// gratuite et la config ne change jamais.
const FORMAT_CIVIL_TORONTO = new Intl.DateTimeFormat("fr-CA", {
  timeZone: PRODUCT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Date civile du jour 'YYYY-MM-DD' en America/Toronto, peu importe le fuseau du
 * runtime (serveur Vercel en UTC, navigateur du couple, etc.). `fr-CA` formate
 * nativement en AAAA-MM-JJ.
 */
export function todayCivil(now: Date = new Date()): string {
  return FORMAT_CIVIL_TORONTO.format(now);
}
