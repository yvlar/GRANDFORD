import { fr } from "@/lib/i18n/fr";
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
  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;
  const detail = params.detail;
  const suivant = params.suivant ?? "";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-neutral-50">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="mt-2 max-w-prose text-neutral-300">{t.sousTitre}</p>
      </header>

      {erreur ? (
        <div className="max-w-sm">
          <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-red-200">
            {erreur}
          </p>
          {detail ? (
            <p className="mt-2 text-xs text-neutral-500">
              {t.detailTechnique} : <code className="text-neutral-400">{detail.slice(0, 120)}</code>
            </p>
          ) : null}
        </div>
      ) : null}
      {params.envoye ? (
        <output className="max-w-sm rounded-lg bg-emerald-950 px-4 py-3 text-emerald-200">
          {t.lienEnvoye}
        </output>
      ) : null}

      <form action={envoyerLienMagique} className="flex w-full max-w-sm flex-col gap-3">
        <input type="hidden" name="suivant" value={suivant} />
        <label htmlFor="courriel" className="text-sm font-medium text-neutral-300">
          {t.courrielLabel}
        </label>
        <input
          id="courriel"
          name="courriel"
          type="email"
          required
          autoComplete="email"
          placeholder={t.courrielPlaceholder}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg placeholder:text-neutral-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-500"
        >
          {t.envoyerLien}
        </button>
      </form>

      <p className="text-sm text-neutral-500">{t.ou}</p>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {(
          [
            [seConnecterAvecGoogle, t.continuerGoogle],
            [seConnecterAvecApple, t.continuerApple],
          ] as const
        ).map(([action, libelle]) => (
          <form key={libelle} action={action}>
            <input type="hidden" name="suivant" value={suivant} />
            <button
              type="submit"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg font-semibold hover:bg-neutral-800"
            >
              {libelle}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
