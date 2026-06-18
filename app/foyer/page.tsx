import { SelecteurEquipe } from "@/components/equipe/selecteur-equipe";
import { ActiverRappels } from "@/components/notifications/activer-rappels";
import { FenetreSommeil } from "@/components/sommeil/fenetre-sommeil";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import { signIcalToken } from "@/lib/ical/generate";
import { requestOrigin } from "@/lib/request-origin";
import { parseSleepRow } from "@/lib/schedule/db-rows";
import { defaultSleepWindow } from "@/lib/schedule/status";
import { createClient } from "@/lib/supabase/server";
import { equipeSchema } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  annulerInvitation,
  creerInvitation,
  mettreAJourNom,
  quitterFoyer,
  revoquerMembre,
} from "./actions";

// Gestion du foyer (FR-12) : membres, invitation à usage unique, révocation.
// Tout ce que cette page voit passe par la RLS — les invitations, par exemple,
// ne reviennent que pour le propriétaire (0 ligne pour la conjointe).
const ERREURS: Record<string, string> = {
  invitation: fr.foyer.erreurInvitation,
  revocation: fr.foyer.erreurRevocation,
  equipe: fr.equipe.erreur,
  sommeil: fr.sommeil.erreurEnregistrement,
  nom: fr.foyer.erreurNom,
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
    .select("id, household_id, role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!monAdhesion) {
    redirect("/onboarding");
  }

  const affectationQuery =
    monAdhesion.role === "worker"
      ? supabase
          .from("worker_assignments")
          .select("team")
          .eq("household_id", monAdhesion.household_id)
          .eq("profile_id", user.id)
          .maybeSingle()
      : null;
  const sommeilQuery =
    monAdhesion.role === "worker"
      ? supabase
          .from("sleep_defaults")
          .select("start_time, end_time")
          .eq("household_id", monAdhesion.household_id)
          .eq("profile_id", user.id)
          .maybeSingle()
      : null;

  const [{ data: foyer }, { data: membres }, { data: invitations }, affectationRes, sommeilRes] =
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
      affectationQuery,
      sommeilQuery,
    ]);
  if (!foyer) {
    redirect("/onboarding");
  }
  if (affectationRes?.error) {
    throw affectationRes.error;
  }
  if (sommeilRes?.error) {
    throw sommeilRes.error;
  }
  const monAffectation = affectationRes?.data ?? null;
  const maFenetre = parseSleepRow(sommeilRes?.data ?? null);

  const estProprietaire = foyer.owner_id === user.id;
  const monMembre = (membres ?? []).find((m) => m.profile_id === user.id);
  const monNom = monMembre?.profiles?.full_name ?? null;
  const nomTravailleur =
    (membres ?? []).find((m) => m.role === "worker")?.profiles?.full_name ?? null;
  const origin = await requestOrigin();
  const params = await searchParams;
  const erreur = params.erreur ? ERREURS[params.erreur] : undefined;

  const icalSecret = process.env.ICAL_SECRET ?? null;
  const icalToken = icalSecret
    ? signIcalToken(monAdhesion.household_id, monAdhesion.role as "worker" | "spouse", icalSecret)
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-0 bg-slate-950 text-slate-50">
      {/* ─── En-tête sticky ──────────────────────────────────────── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-400 transition-colors duration-200 hover:text-blue-300"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t.monHoraire}
        </Link>
        <h1 className="text-base font-bold tracking-tight text-slate-50">{foyer.name}</h1>
        <form action="/auth/deconnexion" method="post">
          <button
            type="submit"
            className="cursor-pointer text-sm text-slate-500 transition-colors duration-200 hover:text-slate-300"
          >
            {t.seDeconnecter}
          </button>
        </form>
      </header>

      <div className="flex flex-col gap-px bg-slate-800">
        {/* ─── Erreur globale ──────────────────────────────────────── */}
        {erreur ? (
          <div className="bg-slate-950 px-4 py-3">
            <p
              role="alert"
              className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200"
            >
              {erreur}
            </p>
          </div>
        ) : null}

        {/* ─── Membres ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            {t.membres}
          </h2>
          <ul className="flex flex-col gap-2">
            {(membres ?? []).map((membre) => (
              <li
                key={membre.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-slate-50">
                    {membre.profiles?.full_name ?? t.sansNom}{" "}
                    {membre.profile_id === user.id ? (
                      <span className="text-sm font-normal text-slate-500">{t.vous}</span>
                    ) : null}
                  </span>
                  <span className="text-sm text-slate-400">
                    {membre.role === "worker" ? t.roleWorker : t.roleSpouse}
                  </span>
                </span>
                {estProprietaire && membre.profile_id !== user.id ? (
                  <form action={revoquerMembre.bind(null, membre.id)}>
                    <button
                      type="submit"
                      className="cursor-pointer rounded-lg border border-red-800 px-3 py-1.5 text-sm font-semibold text-red-400 transition-colors duration-200 hover:bg-red-950"
                    >
                      {t.revoquer}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Rappels ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {fr.rappels.titre}
          </h2>
          <ActiverRappels
            householdId={monAdhesion.household_id}
            clePubliqueVapid={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
          />
        </section>

        {/* ─── Export iCal ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {fr.ical.titre}
          </h2>
          <p className="text-sm text-slate-400">{fr.ical.consigne}</p>
          {icalToken ? (
            <a
              href={`/api/ical/${icalToken}`}
              download="grandford.ics"
              className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-900"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              {monAdhesion.role === "worker"
                ? fr.ical.telechargerTravailleur
                : fr.ical.telechargerConjointe}
            </a>
          ) : (
            <p className="text-sm text-slate-500">{fr.rappels.nonConfigure}</p>
          )}
        </section>

        {/* ─── Travailleur (nom) ───────────────────────────────────── */}
        <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t.roleWorker}
          </h2>
          {monAdhesion.role === "worker" ? (
            <form action={mettreAJourNom} className="flex flex-col gap-2">
              <input
                name="nom"
                type="text"
                defaultValue={monNom ?? ""}
                placeholder={t.nomPlaceholder}
                maxLength={120}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-slate-50 placeholder:text-slate-600 transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="submit"
                className="cursor-pointer self-start rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-900"
              >
                {t.enregistrerNom}
              </button>
            </form>
          ) : (
            <p className="text-lg font-semibold text-blue-300">{nomTravailleur ?? t.sansNom}</p>
          )}
        </section>

        {/* ─── Équipe + Sommeil (travailleur seulement) ────────────── */}
        {monAdhesion.role === "worker" ? (
          <>
            <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {fr.equipe.actuelle}
              </h2>
              <SelecteurEquipe
                householdId={monAdhesion.household_id}
                retour="/foyer"
                equipeActuelle={monAffectation ? equipeSchema.parse(monAffectation.team) : null}
              />
            </section>
            <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M17 18a5 5 0 00-10 0" />
                  <line x1="12" y1="2" x2="12" y2="9" />
                  <line x1="4.22" y1="10.22" x2="5.64" y2="11.64" />
                  <line x1="1" y1="18" x2="3" y2="18" />
                  <line x1="21" y1="18" x2="23" y2="18" />
                  <line x1="18.36" y1="11.64" x2="19.78" y2="10.22" />
                </svg>
                {fr.sommeil.titre}
              </h2>
              <FenetreSommeil
                householdId={monAdhesion.household_id}
                fenetreActuelle={maFenetre}
                fenetreProposee={defaultSleepWindow(GRANDFORD_CYCLE)}
              />
            </section>
          </>
        ) : null}

        {/* ─── Invitation / Quitter ────────────────────────────────── */}
        <section className="flex flex-col gap-4 bg-slate-950 px-4 py-5">
          {estProprietaire ? (
            <>
              <form action={creerInvitation.bind(null, foyer.id)}>
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-2xl bg-blue-600 px-4 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-blue-500"
                >
                  {t.inviter}
                </button>
              </form>

              {invitations && invitations.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {t.invitationsEnAttente}
                  </h2>
                  <p className="text-sm text-slate-400">{t.invitationConsigne}</p>
                  <ul className="flex flex-col gap-2">
                    {invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4"
                      >
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                          {t.copierLien}
                        </span>
                        <code className="break-all text-sm text-blue-300">
                          {`${origin}/invitation/${invitation.code}`}
                        </code>
                        <form action={annulerInvitation.bind(null, invitation.id)}>
                          <button
                            type="submit"
                            className="cursor-pointer text-sm text-slate-500 underline transition-colors duration-200 hover:text-slate-300"
                          >
                            {t.annulerInvitation}
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <form action={quitterFoyer.bind(null, monAdhesion.id)}>
              <button
                type="submit"
                className="cursor-pointer rounded-2xl border border-slate-700 px-4 py-3 font-semibold text-slate-300 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-900"
              >
                {t.quitterFoyer}
              </button>
            </form>
          )}
        </section>

        {/* Espace de respiration en bas */}
        <div className="h-8 bg-slate-950" />
      </div>
    </main>
  );
}
