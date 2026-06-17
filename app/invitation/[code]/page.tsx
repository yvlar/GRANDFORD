import { fr } from "@/lib/i18n/fr";
import { uuidSchema } from "@/lib/validation";
import Link from "next/link";
import { accepterInvitation } from "./actions";

// Rachat d'une invitation (FR-12) : la conjointe arrive par le lien à usage unique.
// Le middleware exige une session — sans compte, elle passe d'abord par /connexion
// puis revient ici (paramètre `suivant`).
const ERREURS: Record<string, string> = {
  invalide: fr.invitation.erreurInvalide,
  "deja-utilisee": fr.invitation.erreurDejaUtilisee,
  expiree: fr.invitation.erreurExpiree,
  "deja-membre": fr.invitation.erreurDejaMembre,
  consentement: fr.invitation.erreurConsentement,
  generique: fr.invitation.erreurGenerique,
};

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const t = fr.invitation;
  const { code } = await params;
  const codeValide = uuidSchema.safeParse(code);
  const { erreur: cleErreur } = await searchParams;
  const erreur = codeValide.success
    ? cleErreur
      ? ERREURS[cleErreur]
      : undefined
    : t.erreurInvalide;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-neutral-950 p-6 text-neutral-50">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="mt-2 max-w-prose text-neutral-300">{t.sousTitre}</p>
      </header>

      {erreur ? (
        <p role="alert" className="max-w-sm rounded-lg bg-red-950 px-4 py-3 text-red-200">
          {erreur}
        </p>
      ) : null}

      {codeValide.success ? (
        <form
          action={accepterInvitation.bind(null, codeValide.data)}
          className="flex flex-col gap-4"
        >
          {/* Consentement éclairé — Loi 25 / PIPEDA (securite-secrets.md) */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-1 shrink-0 accent-emerald-500"
            />
            <span className="text-sm text-neutral-300">
              {t.consentementLabel}{" "}
              <Link
                href="/politique"
                target="_blank"
                className="text-emerald-400 underline hover:text-emerald-300"
              >
                {t.lirePolitique}
              </Link>
            </span>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-8 py-4 text-xl font-semibold hover:bg-emerald-500"
          >
            {t.accepter}
          </button>
        </form>
      ) : null}
    </main>
  );
}
