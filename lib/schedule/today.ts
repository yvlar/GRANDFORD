// Frontière HORLOGE de la vue « coup d'œil ». Le moteur n'a pas d'horloge (règle
// moteur-pitman.md) ; c'est ici, et seulement ici, qu'un instant réel devient une
// date civile locale. Raisonner en America/Toronto (conventions-frontend.md).

/** Fuseau de référence du produit : l'usine et le foyer vivent à l'heure de Toronto. */
export const APP_TIME_ZONE = "America/Toronto";

/**
 * Date civile 'YYYY-MM-DD' d'un instant dans un fuseau donné. `now` est un paramètre :
 * la fonction reste testable et le rendu serveur/client peut injecter son horloge.
 * WHY en-CA : cette locale formate nativement en AAAA-MM-JJ (aucun découpage manuel).
 */
export function civilDateIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** La date civile « aujourd'hui » du produit (America/Toronto). */
export function todayInToronto(now: Date): string {
  return civilDateIn(APP_TIME_ZONE, now);
}
