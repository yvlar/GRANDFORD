import { SelecteurEquipe } from "@/components/equipe/selecteur-equipe";
import { VueCoupDoeil } from "@/components/horaire/vue-coup-doeil";
import { GRANDFORD_CYCLE, type Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import { parseExceptionRows, parseSleepRow } from "@/lib/schedule/db-rows";
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
    return <PorteEntree />;
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
  // Écarts : fenêtre de ±62 jours — couvre la grille du mois et sa navigation
  // proche (au-delà, la vue annonce « écarts non chargés »). R7 : colonnes
  // PARTAGEABLES uniquement (on_date, effect, shift) — jamais de jointure vers
  // exception_private, ni ici ni dans le payload hydraté au client.
  const ecartsDu = addDays(today, -62);
  const ecartsAu = addDays(today, 62);
  const [exceptionsRes, sleepRes] = await Promise.all([
    supabase
      .from("exceptions")
      .select("on_date, effect, shift")
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
  ]);
  if (exceptionsRes.error) {
    throw exceptionsRes.error;
  }
  if (sleepRes.error) {
    throw sleepRes.error;
  }

  return (
    <VueCoupDoeil
      role={membership.role === "worker" ? "worker" : "spouse"}
      team={team}
      template={GRANDFORD_CYCLE}
      exceptions={parseExceptionRows(exceptionsRes.data)}
      sleepDefault={parseSleepRow(sleepRes.data)}
      initialToday={today}
      workerName={workerName}
      exceptionsRange={{ from: ecartsDu, to: ecartsAu }}
    />
  );
}

/** Porte d'entrée anonyme : statique, consultable hors-ligne (NFR-4). */
function PorteEntree() {
  const t = fr.accueil;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
      <h1 className="text-4xl font-bold tracking-tight">{t.titre}</h1>
      <p className="max-w-prose text-lg text-neutral-300">{t.sousTitre}</p>
      <p className="max-w-prose text-sm text-neutral-500">{t.appel}</p>
      <nav className="mt-4 flex gap-3">
        <Link
          href="/connexion"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold hover:bg-emerald-500"
        >
          {t.seConnecter}
        </Link>
        <Link
          href="/foyer"
          className="rounded-lg border border-neutral-700 px-6 py-3 text-lg font-semibold text-neutral-300 hover:bg-neutral-900"
        >
          {t.monFoyer}
        </Link>
      </nav>
    </main>
  );
}

/** Premier passage du travailleur : choisir son équipe (pré-requis de la vue). */
function ChoisirEquipe({ householdId, enErreur }: { householdId: string; enErreur: boolean }) {
  const t = fr.equipe;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 p-6 text-neutral-50">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="mt-2 max-w-prose text-neutral-300">{t.consigne}</p>
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
      <h1 className="text-3xl font-bold tracking-tight">{fr.accueil.titre}</h1>
      <p className="max-w-prose text-lg text-neutral-300">{t.attenteTravailleur}</p>
      <Link href="/foyer" className="text-sm text-neutral-400 underline hover:text-neutral-200">
        {fr.accueil.monFoyer}
      </Link>
    </main>
  );
}
