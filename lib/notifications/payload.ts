// Contenu d'une notification de rappel (FR-10) — fonction PURE, AUCUN import.
//
// WHY zéro import : ce module est consommé par l'Edge Function Deno
// (supabase/functions/send-reminders) via un import relatif — l'alias `@/` et la
// chaîne i18n de l'app n'y existent pas. Le garder feuille garantit qu'il se bundle
// partout (Next, service worker, Deno) sans résolution spéciale.
//
// R7 structurel : la signature ne REÇOIT pas de motif — il est donc impossible
// qu'un motif fuie dans une notification, un courriel ou un log construit ici.
// Le payload dit « écart le DATE », jamais pourquoi.

/** Échéances de rappel (FR-10) : 1 mois / 1 semaine / la veille. */
export type ReminderLead = "month" | "week" | "day";

/** Ce que reçoit le service worker (event.data.json()) et le courriel de repli. */
export interface ReminderPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
}

// WHY UTC : la chaîne civile 'AAAA-MM-JJ' est la vérité ; l'interpréter en UTC
// l'empêche de glisser d'un jour selon le fuseau du runtime. MIROIR ASSUMÉ de
// FORMAT_JOUR_LONG (lib/schedule/format.ts) — la contrainte zéro-import interdit
// de l'importer ici : toute évolution du format doit toucher LES DEUX fichiers.
const FORMAT_JOUR = new Intl.DateTimeFormat("fr-CA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * Repli du service worker quand le payload reçu est absent ou illisible : pour
 * une prothèse de mémoire, une notification générique vaut infiniment mieux
 * qu'un rappel perdu en silence (R11). Toujours sans motif, comme tout ici.
 */
export const FALLBACK_REMINDER: ReminderPayload = {
  title: "GRANDFORD — rappel",
  body: "Un écart à l'horaire approche. Ouvrez l'app pour le voir.",
  url: "/",
};

const HORIZON: Record<ReminderLead, string> = {
  month: "dans 1 mois",
  week: "dans 1 semaine",
  day: "demain",
};

/**
 * Construit la notification d'un rappel : la date de l'écart et son horizon,
 * rien d'autre. La conjointe et le travailleur reçoivent le même texte (FR-10
 * bidirectionnel) — la disponibilité est partagée, le motif jamais (R7).
 */
export function reminderPayload(onDate: string, lead: ReminderLead): ReminderPayload {
  const jour = FORMAT_JOUR.format(new Date(`${onDate}T00:00:00Z`));
  return {
    title: "GRANDFORD — rappel",
    body: `Écart à l'horaire ${jour} (${HORIZON[lead]}).`,
    url: "/",
  };
}
