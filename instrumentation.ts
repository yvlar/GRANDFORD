// Point d'entrée d'instrumentation Next.js : charge l'init Sentry du bon runtime.
// WHY import dynamique par runtime : le SDK serveur et le SDK edge sont distincts ;
// on n'évalue que celui du contexte courant. Inerte sans DSN (Sprint 8).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture des erreurs de rendu serveur (App Router) — passe par le même beforeSend R7.
export const onRequestError = Sentry.captureRequestError;
