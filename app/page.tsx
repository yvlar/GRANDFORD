import { capturerEcart, supprimerEcart } from "@/app/ecarts/actions";
import { creerNote, supprimerNote } from "@/app/notes/actions";
import { approuverRequete, refuserRequete, soumettreRequete } from "@/app/requetes/actions";
import { ajusterSommeil, retirerAjustementSommeil } from "@/app/sommeil/actions";
import { SelecteurEquipe } from "@/components/equipe/selecteur-equipe";
import { VueCoupDoeil, type VueCoupDoeilProps } from "@/components/horaire/vue-coup-doeil";
import { GRANDFORD_CYCLE, type Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import {
  parseExceptionRows,
  parseNoteRows,
  parseOwnExceptionRows,
  parseRequeteRows,
  parseSleepAdjustmentRows,
  parseSleepRow,
} from "@/lib/schedule/db-rows";
import { addDays } from "@/lib/schedule/status";
import { todayCivil } from "@/lib/schedule/today";
import { createClient } from "@/lib/supabase/server";
import { equipeSchema } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";

// Accueil (Sprint 4) : porte d'entrée pour l'anonyme ; vue « coup d'œil » selon le
// rôle pour l'usager connecté (FR-2 travailleur, FR-3 conjointe).
//
// Décision Sprint 4 (carte, prémisse cycle_templates) : le gabarit consommé est la
// constante validée GRANDFORD_CYCLE, côté client — l'horaire doit se calculer sans
// réseau (NFR-4) et l'usine est unique pour l'instant. La lecture du gabarit depuis
// `cycle_templates` arrive avec le multi-usines (FR-17).

export default async function AccueilPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <LandingPage />;
  }

  // WHY des `throw` sur les erreurs de requête : un échec silencieux afficherait un
  // horaire FAUX (écarts manquants) — la thèse du produit est la fiabilité des
  // écarts (R1), mieux vaut échouer fort que mentir doucement.
  const membershipRes = await supabase
    .from("memberships")
    .select("household_id, role")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipRes.error) {
    throw membershipRes.error;
  }
  const membership = membershipRes.data;
  if (!membership) {
    redirect("/onboarding");
  }

  const householdId = membership.household_id;
  let team: Team;
  let workerId: string;
  let workerName: string | null = null;

  if (membership.role === "worker") {
    const assignmentRes = await supabase
      .from("worker_assignments")
      .select("team")
      .eq("household_id", householdId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (assignmentRes.error) {
      throw assignmentRes.error;
    }
    if (!assignmentRes.data) {
      const params = await searchParams;
      return <ChoisirEquipe householdId={householdId} enErreur={params.erreur === "equipe"} />;
    }
    team = equipeSchema.parse(assignmentRes.data.team);
    workerId = user.id;
  } else {
    // Vue conjointe : l'horaire suivi est celui du travailleur du foyer (l'autre membre).
    const assignmentsRes = await supabase
      .from("worker_assignments")
      .select("profile_id, team, profiles(full_name)")
      .eq("household_id", householdId)
      .neq("profile_id", user.id)
      .limit(1);
    if (assignmentsRes.error) {
      throw assignmentsRes.error;
    }
    const assignment = assignmentsRes.data[0];
    if (!assignment) {
      return <AttenteTravailleur />;
    }
    team = equipeSchema.parse(assignment.team);
    workerId = assignment.profile_id;
    workerName = assignment.profiles?.full_name ?? null;
  }

  const today = todayCivil();
  // Fenêtre ±62 jours pour les données calendaires.
  const ecartsDu = addDays(today, -62);
  const ecartsAu = addDays(today, 62);

  // R7 : colonnes PARTAGEABLES uniquement (on_date, effect, shift) — jamais de
  // jointure vers exception_private, ni ici ni dans le payload hydraté au client.
  const [exceptionsRes, sleepRes, sleepAdjustmentsRes, notesRes, requetesRes] = await Promise.all([
    supabase
      .from("exceptions")
      .select("id, on_date, effect, shift")
      .eq("household_id", householdId)
      .eq("profile_id", workerId)
      .gte("on_date", ecartsDu)
      .lte("on_date", ecartsAu)
      .order("on_date"),
    supabase
      .from("sleep_defaults")
      .select("start_time, end_time")
      .eq("household_id", householdId)
      .eq("profile_id", workerId)
      .maybeSingle(),
    // Ajustements de sommeil (FR-6) : disponibilité partagée, deux rôles (jamais un motif, R7).
    supabase
      .from("sleep_adjustments")
      .select("on_date, start_time, end_time")
      .eq("household_id", householdId)
      .eq("profile_id", workerId)
      .gte("on_date", ecartsDu)
      .lte("on_date", ecartsAu)
      .order("on_date"),
    // Notes (FR-8, Sprint 9) : partagées dans le foyer, même fenêtre ±62 j.
    supabase
      .from("notes")
      .select("id, on_date, body, author_id")
      .eq("household_id", householdId)
      .gte("on_date", ecartsDu)
      .lte("on_date", ecartsAu)
      .order("on_date"),
    // Requêtes (FR-9, Sprint 9) : visibles des deux rôles. Fenêtre ±62 j.
    // R7 : body = demande de la conjointe, pas un motif d'absence.
    supabase
      .from("requests")
      .select("id, on_date, body, status, requester_id, target_profile_id")
      .eq("household_id", householdId)
      .gte("on_date", ecartsDu)
      .lte("on_date", ecartsAu)
      .order("on_date"),
  ]);
  if (exceptionsRes.error) {
    throw exceptionsRes.error;
  }
  if (sleepRes.error) {
    throw sleepRes.error;
  }
  if (sleepAdjustmentsRes.error) {
    throw sleepAdjustmentsRes.error;
  }
  if (notesRes.error) {
    throw notesRes.error;
  }
  if (requetesRes.error) {
    throw requetesRes.error;
  }

  const notes = parseNoteRows(notesRes.data);
  const requetes = parseRequeteRows(requetesRes.data);
  const noteHandlers: VueCoupDoeilProps["noteHandlers"] = {
    creer: creerNote.bind(null, householdId),
    supprimer: supprimerNote,
  };

  // Branche TRAVAILLEUR : capture d'écart (Sprint 5) + ses propres motifs (badge du
  // détail). La RLS d'exception_private (propriétaire seul) garantit que cette
  // requête ne renvoie que les siens ; la conjointe ne passe jamais par ici.
  let capture: VueCoupDoeilProps["capture"] = null;
  let coplanification: VueCoupDoeilProps["coplanification"] = null;
  if (membership.role === "worker") {
    // Borné aux écarts déjà chargés (exception_private n'a pas de date propre) :
    // sans ce filtre, la requête rapporterait TOUS les motifs depuis toujours.
    const motifsRes = await supabase
      .from("exception_private")
      .select("exception_id, motif")
      .in(
        "exception_id",
        exceptionsRes.data.map((row) => row.id),
      );
    if (motifsRes.error) {
      throw motifsRes.error;
    }
    capture = {
      ownExceptions: parseOwnExceptionRows(exceptionsRes.data, motifsRes.data),
      handlers: {
        capturer: capturerEcart.bind(null, householdId),
        supprimer: supprimerEcart,
      },
      sommeil: {
        ajuster: ajusterSommeil.bind(null, householdId),
        retirer: retirerAjustementSommeil.bind(null, householdId),
      },
      // FR-9 (Sprint 9) : le travailleur voit les requêtes en attente et peut les traiter.
      requetes,
      requeteHandlers: {
        approuver: approuverRequete.bind(null, householdId),
        refuser: refuserRequete,
      },
    };
  } else {
    // Branche CONJOINTE : peut soumettre des requêtes (FR-9).
    coplanification = {
      requetes,
      soumettre: soumettreRequete.bind(null, householdId, workerId),
    };
  }

  return (
    <VueCoupDoeil
      role={membership.role === "worker" ? "worker" : "spouse"}
      team={team}
      template={GRANDFORD_CYCLE}
      exceptions={parseExceptionRows(exceptionsRes.data)}
      sleepDefault={parseSleepRow(sleepRes.data)}
      sleepAdjustments={parseSleepAdjustmentRows(sleepAdjustmentsRes.data)}
      initialToday={today}
      workerName={workerName}
      exceptionsRange={{ from: ecartsDu, to: ecartsAu }}
      capture={capture}
      notes={notes}
      noteHandlers={noteHandlers}
      coplanification={coplanification}
    />
  );
}

/** Landing page publique — présente GRANDFORD aux nouveaux visiteurs (NFR-4 : statique, hors-ligne). */
function LandingPage() {
  const t = fr.landing;
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-50 antialiased">
      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-bold tracking-tight text-blue-400">{t.marque}</span>
          <Link
            href="/connexion"
            className="cursor-pointer rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-400"
          >
            {t.nav.seConnecter}
          </Link>
        </div>
      </header>

      {/* ─── Hero — gradient bleu, formes géométriques ────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-20 text-white sm:px-6 sm:py-32">
        {/* Accents décoratifs — purs, pas d'impact layout */}
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/25"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-indigo-400/20"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="mb-6 inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-blue-100 ring-1 ring-inset ring-white/20">
            {t.hero.badge}
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {t.hero.titre}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-blue-100">
            {t.hero.sous}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/connexion"
              className="cursor-pointer rounded-lg bg-orange-500 px-8 py-4 text-lg font-semibold text-white transition-colors duration-200 hover:bg-orange-400"
            >
              {t.hero.cta}
            </Link>
            <Link
              href="/demo/horaire"
              className="cursor-pointer rounded-lg border-2 border-white/30 bg-white/10 px-8 py-4 text-lg font-semibold text-white transition-colors duration-200 hover:bg-white/20"
            >
              {t.hero.demo}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats bar — scannable en < 2 s (NFR-12 TDAH) ──────── */}
      <section className="border-b border-slate-800 bg-slate-900/50 py-6">
        <div className="mx-auto grid max-w-4xl grid-cols-3 gap-4 px-4 text-center sm:px-6">
          <div>
            <span className="block text-3xl font-bold text-blue-400">≤ 3</span>
            <span className="mt-1 block text-sm leading-tight text-slate-400">{t.stats.taps}</span>
          </div>
          <div>
            <span className="block text-3xl font-bold text-blue-400">Pitman</span>
            <span className="mt-1 block text-sm leading-tight text-slate-400">{t.stats.cycle}</span>
          </div>
          <div>
            <span className="block text-3xl font-bold text-blue-400">0 %</span>
            <span className="mt-1 block text-sm leading-tight text-slate-400">
              {t.stats.motifs}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Problème ────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold text-slate-50 sm:text-3xl">{t.probleme.titre}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-400">
            {t.probleme.corps}
          </p>
        </div>
      </section>

      {/* ─── Bento Grid Fonctionnalités ──────────────────────────── */}
      <section className="bg-slate-900/50 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-50 sm:text-3xl">
            {t.fonctionnalites.titre}
          </h2>
          {/*
           * Bento : carte bleue featured (span 2 rangées) à gauche,
           * deux cartes empilées à droite — layout Apple-style.
           */}
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Capture — carte featured (2 rangées) */}
            <div className="flex flex-col rounded-2xl bg-blue-600 p-7 text-white transition-colors duration-200 hover:bg-blue-700 sm:row-span-2">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">{t.fonctionnalites.capture.titre}</h3>
              <p className="mt-3 flex-1 text-lg leading-relaxed text-blue-100">
                {t.fonctionnalites.capture.corps}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {t.fonctionnalites.capture.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Rappels */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-7 transition-colors duration-200 hover:border-blue-700 hover:bg-blue-950/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-50">{t.fonctionnalites.rappels.titre}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">
                {t.fonctionnalites.rappels.corps}
              </p>
            </div>

            {/* Confidentialité */}
            <div className="rounded-2xl border border-orange-900/50 bg-orange-950/30 p-7 transition-colors duration-200 hover:border-orange-800 hover:bg-orange-950/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-50">
                {t.fonctionnalites.confidentialite.titre}
              </h3>
              <p className="mt-2 leading-relaxed text-slate-300">
                {t.fonctionnalites.confidentialite.corps}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pour qui — deux personas côte à côte ────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="mb-4 text-center text-2xl font-bold text-slate-50 sm:text-3xl">
            {t.pourQui.titre}
          </h2>
          <p className="mx-auto mb-10 max-w-xl text-center text-lg leading-relaxed text-slate-400">
            {t.pourQui.corps}
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Travailleur */}
            <div className="rounded-2xl bg-blue-600 p-8 text-white">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">{t.pourQui.travailleur}</h3>
              <p className="mt-3 text-lg leading-relaxed text-blue-100">
                {t.pourQui.corpsTravailleur}
              </p>
            </div>
            {/* Conjoint(e) */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 text-white">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7"
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">{t.pourQui.conjointe}</h3>
              <p className="mt-3 text-lg leading-relaxed text-slate-300">
                {t.pourQui.corpsConjointe}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA final ───────────────────────────────────────────── */}
      <section className="bg-blue-600 py-20 text-white sm:py-32">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">{t.ctaFinal.titre}</h2>
          <p className="mt-4 text-lg text-blue-100">{t.ctaFinal.sous}</p>
          <div className="mt-8">
            <Link
              href="/connexion"
              className="cursor-pointer rounded-lg bg-orange-500 px-8 py-4 text-xl font-bold text-white transition-colors duration-200 hover:bg-orange-400"
            >
              {t.ctaFinal.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <span className="text-sm font-bold text-blue-400">{t.marque}</span>
          <span className="text-sm text-slate-500">{t.footer.copyright}</span>
          <div className="flex gap-4">
            <Link
              href="/politique"
              className="cursor-pointer text-sm text-slate-400 underline transition-colors duration-200 hover:text-slate-200"
            >
              {t.footer.politique}
            </Link>
            <span className="text-sm text-slate-500">{t.footer.loi25}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Premier passage du travailleur : choisir son équipe (pré-requis de la vue). */
function ChoisirEquipe({ householdId, enErreur }: { householdId: string; enErreur: boolean }) {
  const t = fr.equipe;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-50">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="mt-2 max-w-prose text-slate-300">{t.consigne}</p>
      </header>
      {enErreur ? (
        <p role="alert" className="max-w-sm rounded-lg bg-red-950 px-4 py-3 text-red-200">
          {t.erreur}
        </p>
      ) : null}
      <SelecteurEquipe householdId={householdId} retour="/" equipeActuelle={null} />
    </main>
  );
}

/** Conjointe dont le travailleur n'a pas encore choisi d'équipe. */
function AttenteTravailleur() {
  const t = fr.equipe;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-slate-50">
      <h1 className="text-3xl font-bold tracking-tight">{fr.accueil.titre}</h1>
      <p className="max-w-prose text-lg text-slate-300">{t.attenteTravailleur}</p>
      <Link href="/foyer" className="text-sm text-slate-400 underline hover:text-slate-200">
        {fr.accueil.monFoyer}
      </Link>
    </main>
  );
}
