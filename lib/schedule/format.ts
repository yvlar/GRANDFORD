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
