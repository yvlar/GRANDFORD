import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { creerFoyer } from "./actions";

// 1re connexion (FR-12) : le profil existe déjà (trigger handle_new_user) ; il ne
// manque que le foyer. Qui en a déjà un passe tout droit.
const ERREURS: Record<string, string> = {
  nom: fr.onboarding.erreurNomRequis,
  creation: fr.onboarding.erreurCreation,
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const t = fr.onboarding;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion?suivant=%2Fonboarding");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) {
    redirect("/foyer");
  }

  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;

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

      <form action={creerFoyer} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="nom" className="text-sm font-medium text-neutral-300">
          {t.nomLabel}
        </label>
        <input
          id="nom"
          name="nom"
          type="text"
          required
          maxLength={80}
          placeholder={t.nomPlaceholder}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg placeholder:text-neutral-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-500"
        >
          {t.creer}
        </button>
      </form>
    </main>
  );
}
