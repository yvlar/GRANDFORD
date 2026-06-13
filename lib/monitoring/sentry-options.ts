// Options communes aux trois `Sentry.init` (client / serveur / edge). Centralisées
// ici pour qu'une seule source porte les garde-fous R7.
//
// WHY DSN vide = inerte : tant qu'aucun DSN réel n'est posé (go-live, Sprint 8),
// `enabled` est faux → le SDK n'émet rien. Le scaffolding est donc sans effet en
// dev/CI ; on branche le DSN au déploiement sans retoucher le code.
import type { ErrorEvent } from "@sentry/nextjs";
import { scrubSentryEvent } from "./scrub";

// Le DSN n'est pas un secret (clé publique d'ingestion) ; on accepte la variante
// publique (client) ou serveur. Absent → chaîne vide → SDK désactivé.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "";

/**
 * Dernier rempart R7 avant l'envoi : retire identité, données et motif. Le scrubber
 * nettoie aussi `tags`, `transaction` et `threads` — des champs que portent AUSSI
 * les événements d'erreur, pas seulement les transactions.
 *
 * NOTE tracing : `beforeSend` ne couvre QUE les erreurs. Le tracing est désactivé
 * (tracesSampleRate 0) ; si on l'active un jour, brancher `beforeSendTransaction`
 * sur `scrubSentryEvent` (le type `TransactionEvent` n'est pas ré-exporté par
 * `@sentry/nextjs` — le typer alors via la signature de l'option dans le `init`).
 */
function nettoyerEvenement(event: ErrorEvent): ErrorEvent {
  scrubSentryEvent(event);
  return event;
}

export const optionsCommunes = {
  enabled: SENTRY_DSN.length > 0,
  // R7 / Loi 25 : jamais d'IP, de cookies ni de corps de requête attachés d'office.
  sendDefaultPii: false,
  // Pas de tracing tant que ce n'est pas décidé (volume + risque de données de requête).
  tracesSampleRate: 0,
  beforeSend: nettoyerEvenement,
} as const;
