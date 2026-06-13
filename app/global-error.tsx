"use client";

// Frontière d'erreur racine (App Router) : remplace tout l'arbre quand le rendu
// échoue jusqu'à la racine. WHY ce fichier : Sentry recommande un global-error pour
// capturer les erreurs de rendu React côté serveur ET client (sinon elles échappent
// au SDK). R7 : on rapporte l'exception à Sentry (nettoyée par beforeSend) mais on
// n'affiche AUCUN détail technique — juste un message court et une action (NFR-12).
import { fr } from "@/lib/i18n/fr";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const t = fr.erreurGlobale;
  return (
    <html lang="fr-CA">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="max-w-prose text-lg text-neutral-300">{t.consigne}</p>
        <nav className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold hover:bg-emerald-500"
          >
            {t.reessayer}
          </button>
          <a
            href="/"
            className="rounded-lg border border-neutral-700 px-6 py-3 text-lg font-semibold text-neutral-300 hover:bg-neutral-900"
          >
            {t.accueil}
          </a>
        </nav>
      </body>
    </html>
  );
}
