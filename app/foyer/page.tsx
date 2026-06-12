import { TeamPicker } from "@/components/schedule/team-picker";
import { fr } from "@/lib/i18n/fr";
import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { equipeSchema } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";
import { annulerInvitation, creerInvitation, quitterFoyer, revoquerMembre } from "./actions";

// Gestion du foyer (FR-12) : membres, invitation à usage unique, révocation —
// et, depuis le Sprint 4, l'équipe du travailleur (modifiable ici).
// Tout ce que cette page voit passe par la RLS — les invitations, par exemple,
// ne reviennent que pour le propriétaire (0 ligne pour la conjointe).
const ERREURS: Record<string, string> = {
  invitation: fr.foyer.erreurInvitation,
  revocation: fr.foyer.erreurRevocation,
  equipe: fr.horaire.erreurEquipe,
};

export default async function FoyerPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const t = fr.foyer;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion?suivant=%2Ffoyer");
  }

  const { data: monAdhesion } = await supabase
    .from("memberships")
    .select("id, role, household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!monAdhesion) {
    redirect("/onboarding");
  }

  const [{ data: foyer }, { data: membres }, { data: invitations }, { data: affectation }] =
    await Promise.all([
      supabase
        .from("households")
        .select("id, name, owner_id")
        .eq("id", monAdhesion.household_id)
        .single(),
      supabase
        .from("memberships")
        .select("id, role, profile_id, profiles(full_name)")
        .eq("household_id", monAdhesion.household_id)
        .order("created_at"),
      supabase
        .from("invitations")
        .select("id, code")
        .eq("household_id", monAdhesion.household_id)
        .is("used_at", null)
        // Filtre d'affichage seulement (horloge du serveur Next) : l'expiration qui
        // fait foi est revérifiée en BD par redeem_invitation.
        .gt("expires_at", new Date().toISOString())
        .order("created_at"),
      supabase
        .from("worker_assignments")
        .select("team")
        .eq("household_id", monAdhesion.household_id)
        .eq("profile_id", user.id)
        .maybeSingle(),
    ]);
  if (!foyer) {
    redirect("/onboarding");
  }
  const monEquipe = equipeSchema.safeParse(affectation?.team).data ?? null;

  const estProprietaire = foyer.owner_id === user.id;
  const origin = await requestOrigin();
  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 bg-neutral-950 p-6 text-neutral-50">
      <Link href="/" className="text-sm text-neutral-400 underline hover:text-neutral-200">
        {t.monHoraire}
      </Link>
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{foyer.name}</h1>
        <form action="/auth/deconnexion" method="post">
          <button
            type="submit"
            className="text-sm text-neutral-400 underline hover:text-neutral-200"
          >
            {t.seDeconnecter}
          </button>
        </form>
      </header>

      {erreur ? (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-red-200">
          {erreur}
        </p>
      ) : null}

      {monAdhesion.role === "worker" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t.monEquipe}</h2>
          <TeamPicker householdId={foyer.id} currentTeam={monEquipe} />
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.membres}</h2>
        <ul className="flex flex-col gap-2">
          {(membres ?? []).map((membre) => (
            <li
              key={membre.id}
              className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
            >
              <span className="flex flex-col">
                <span className="text-lg font-medium">
                  {membre.profiles?.full_name ?? t.sansNom}{" "}
                  {membre.profile_id === user.id ? (
                    <span className="text-sm text-neutral-400">{t.vous}</span>
                  ) : null}
                </span>
                <span className="text-sm text-neutral-400">
                  {membre.role === "worker" ? t.roleWorker : t.roleSpouse}
                </span>
              </span>
              {estProprietaire && membre.profile_id !== user.id ? (
                <form action={revoquerMembre.bind(null, membre.id)}>
                  <button
                    type="submit"
                    className="rounded-lg bg-red-900 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-800"
                  >
                    {t.revoquer}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {estProprietaire ? (
        <section className="flex flex-col gap-3">
          <form action={creerInvitation.bind(null, foyer.id)}>
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-lg font-semibold hover:bg-emerald-500"
            >
              {t.inviter}
            </button>
          </form>

          {invitations && invitations.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">{t.invitationsEnAttente}</h2>
              <p className="text-sm text-neutral-400">{t.invitationConsigne}</p>
              <ul className="flex flex-col gap-2">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                  >
                    <span className="text-sm text-neutral-400">{t.copierLien}</span>
                    <code className="break-all text-sm text-emerald-300">
                      {`${origin}/invitation/${invitation.code}`}
                    </code>
                    <form action={annulerInvitation.bind(null, invitation.id)}>
                      <button
                        type="submit"
                        className="text-sm text-neutral-400 underline hover:text-neutral-200"
                      >
                        {t.annulerInvitation}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <section>
          <form action={quitterFoyer.bind(null, monAdhesion.id)}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-700 px-4 py-3 font-semibold text-neutral-300 hover:bg-neutral-900"
            >
              {t.quitterFoyer}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
