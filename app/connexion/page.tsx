import { fr } from "@/lib/i18n/fr";
import Link from "next/link";
import { envoyerLienMagique, seConnecterAvecApple, seConnecterAvecGoogle } from "./actions";

// Connexion sans mot de passe (FR-11) : lien magique + OAuth Google/Apple.
// Server Component pur : formulaires HTML + Server Actions, zéro JS client requis.
const ERREURS: Record<string, string> = {
  courriel: fr.connexion.erreurCourrielInvalide,
  envoi: fr.connexion.erreurEnvoi,
  oauth: fr.connexion.erreurOAuth,
  callback: fr.connexion.erreurCallback,
};

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{
    erreur?: string;
    envoye?: string;
    suivant?: string;
    detail?: string;
  }>;
}) {
  const t = fr.connexion;
  const tl = fr.landing;
  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;
  const detail = params.detail;
  const suivant = params.suivant ?? "";

  return (
    <div className="min-h-dvh bg-white">
      <div className="flex min-h-dvh">
        {/* ─── Panneau gauche : identité de marque (md+) ──────────── */}
        <aside className="hidden flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-10 text-white md:flex md:w-5/12 lg:w-2/5">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-white transition-colors duration-200 hover:text-blue-100"
          >
            {tl.marque}
          </Link>

          <div>
            <p className="text-3xl font-bold leading-snug">{tl.hero.titre}</p>
            <ul className="mt-8 space-y-4">
              {(
                [
                  tl.fonctionnalites.capture.titre,
                  tl.fonctionnalites.rappels.titre,
                  tl.fonctionnalites.confidentialite.titre,
                ] as const
              ).map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 h-5 w-5 shrink-0 text-orange-400"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-lg text-blue-100">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-blue-300">{tl.footer.copyright}</p>
        </aside>

        {/* ─── Panneau droit : formulaire ────────────────────────── */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
          {/* Marque visible sur mobile seulement */}
          <Link
            href="/"
            className="mb-10 text-xl font-bold tracking-tight text-blue-600 transition-colors duration-200 hover:text-blue-700 md:hidden"
          >
            {tl.marque}
          </Link>

          <div className="w-full max-w-sm">
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">{t.titre}</h1>
              <p className="mt-2 leading-relaxed text-slate-600">{t.sousTitre}</p>
            </header>

            {/* ── État : lien envoyé ─────────────────────────────── */}
            {params.envoye ? (
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-5 py-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 text-emerald-600"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="font-semibold text-emerald-800">{t.lienEnvoye}</p>
                <Link
                  href={`/connexion${suivant ? `?suivant=${encodeURIComponent(suivant)}` : ""}`}
                  className="mt-3 inline-block text-sm text-emerald-700 underline transition-colors duration-200 hover:text-emerald-900"
                >
                  {t.reessayer}
                </Link>
              </div>
            ) : (
              <>
                {/* ── Erreur ─────────────────────────────────────── */}
                {erreur ? (
                  <div
                    role="alert"
                    className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 px-5 py-4"
                  >
                    <p className="font-semibold text-red-800">{erreur}</p>
                    {detail ? (
                      <p className="mt-1 text-xs text-red-500">
                        {t.detailTechnique} :{" "}
                        <code className="text-red-400">{detail.slice(0, 120)}</code>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* ── Formulaire lien magique ─────────────────────── */}
                <form action={envoyerLienMagique} className="flex flex-col gap-3">
                  <input type="hidden" name="suivant" value={suivant} />
                  <label htmlFor="courriel" className="text-sm font-medium text-slate-700">
                    {t.courrielLabel}
                  </label>
                  <input
                    id="courriel"
                    name="courriel"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder={t.courrielPlaceholder}
                    className="rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg bg-orange-500 px-4 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-orange-600"
                  >
                    {t.envoyerLien}
                  </button>
                </form>

                {/* ── Séparateur ─────────────────────────────────── */}
                <div className="my-6 flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-sm text-slate-400">{t.ou}</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                {/* ── OAuth ──────────────────────────────────────── */}
                <div className="flex flex-col gap-3">
                  <form action={seConnecterAvecGoogle}>
                    <input type="hidden" name="suivant" value={suivant} />
                    <button
                      type="submit"
                      className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {/* Google G — couleurs officielles */}
                      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      {t.continuerGoogle}
                    </button>
                  </form>

                  <form action={seConnecterAvecApple}>
                    <input type="hidden" name="suivant" value={suivant} />
                    <button
                      type="submit"
                      className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {/* Apple logo */}
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
                      </svg>
                      {t.continuerApple}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
