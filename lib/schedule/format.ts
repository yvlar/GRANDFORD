// Formatage des dates civiles 'YYYY-MM-DD' pour l'affichage (fr-CA). Les chaînes
// civiles sont interprétées en UTC pour ne JAMAIS glisser d'un jour selon le fuseau
// du navigateur — la date civile est la vérité (règle conventions-frontend.md).

export function dateUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * « jeudi 11 juin » — l'en-tête de la pastille, des infobulles et du panneau de capture.
 * MIROIR ASSUMÉ dans lib/notifications/payload.ts (contrainte zéro-import du bundle
 * Deno) : toute évolution du format doit toucher LES DEUX fichiers.
 */
export const FORMAT_JOUR_LONG = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** « 3 juin 2026 » — utilisé dans l'historique des écarts du foyer (FR-13). */
export const FORMAT_DATE_COURTE = new Intl.DateTimeFormat("fr-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * « 3 juin, 14:05 » — horodatage d'une note du frigo (Sprint 20). À la différence des
 * formateurs ci-dessus (chaîne civile 'AAAA-MM-JJ' interprétée en UTC), il formate un
 * `timestamptz` réel : on raisonne en heure civile locale America/Toronto (règle
 * conventions-frontend.md) pour que l'heure affichée colle à celle du foyer.
 */
export const FORMAT_HORODATAGE = new Intl.DateTimeFormat("fr-CA", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Toronto",
});
