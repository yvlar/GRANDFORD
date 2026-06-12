import { GlanceView, type ViewerRole } from "@/components/schedule/glance-view";
import { TeamPicker } from "@/components/schedule/team-picker";
import { fr } from "@/lib/i18n/fr";
import {
  type ScheduleException,
  type SleepWindow,
  addDays,
  exceptionEffectSchema,
  firstOfMonth,
  lastOfMonth,
  todayInToronto,
} from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { equipeSchema } from "@/lib/validation";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

// Accueil (Sprint 4) : porte d'entrée publique pour l'anonyme ; vue « coup d'œil »
// (FR-2/FR-3) pour l'usager connecté, selon son rôle. Le serveur ne fournit que les
// ÉCARTS et la fenêtre de sommeil — l'horaire de base se calcule côté client (NFR-4).

// Frontière BD → vue : les CHECK de la BD garantissent ces valeurs, Zod les fait
// entrer dans les types stricts (conventions-code-base.md).
const ecartsSchema = z.array(
  z.object({
    on_date: z.string(),
    effect: exceptionEffectSchema,
    shift: z.enum(["jour", "nuit"]).nullable(),
  }),
);

function PortePublique() {
  const t = fr.accueil;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
      <h1 className="text-4xl font-bold tracking-tight">{t.titre}</h1>
      <p className="max-w-prose text-lg text-neutral-300">{t.sousTitre}</p>
      <nav className="mt-4">
        <Link
          href="/connexion"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold hover:bg-emerald-500"
        >
          {t.seConnecter}
        </Link>
      </nav>
    </main>
  );
}

function Coquille({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-neutral-950 p-4 text-neutral-50">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{titre}</h1>
        <Link href="/foyer" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          {fr.horaire.monFoyer}
        </Link>
      </header>
      {children}
    </main>
  );
}

export default async function AccueilPage() {
  const t = fr.horaire;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <PortePublique />;
  }

  const { data: adhesion } = await supabase
    .from("memberships")
    .select("role, household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!adhesion) {
    redirect("/onboarding");
  }
  const role: ViewerRole = adhesion.role === "worker" ? "worker" : "spouse";

  // Travailleur observé : soi-même, ou LE travailleur du foyer pour la conjointe (FR-3).
  let workerId = user.id;
  let titre: string = t.titre;
  if (role === "spouse") {
    const { data: travailleur } = await supabase
      .from("memberships")
      .select("profile_id, profiles(full_name)")
      .eq("household_id", adhesion.household_id)
      .eq("role", "worker")
      .limit(1)
      .maybeSingle();
    if (!travailleur) {
      return (
        <Coquille titre={t.titre}>
          <p className="text-lg text-neutral-300">{t.aucunTravailleur}</p>
        </Coquille>
      );
    }
    workerId = travailleur.profile_id;
    titre = `${t.horaireDe} ${travailleur.profiles?.full_name ?? fr.foyer.sansNom}`;
  }

  // Fenêtre d'écarts : mois courant élargi (bande semaine, veille pour le sommeil,
  // dérive serveur/client autour de minuit). Le client recalcule l'horaire dedans.
  const aujourdhui = todayInToronto(new Date());
  const debut = addDays(firstOfMonth(aujourdhui), -7);
  const fin = addDays(lastOfMonth(aujourdhui), 14);

  // Les trois lectures sont indépendantes → en parallèle (au pire, écarts/sommeil
  // sont récupérés pour rien la seule fois où l'équipe n'est pas encore choisie).
  const [affectationRes, ecartsRes, sommeilRes] = await Promise.all([
    supabase
      .from("worker_assignments")
      .select("team")
      .eq("household_id", adhesion.household_id)
      .eq("profile_id", workerId)
      .maybeSingle(),
    supabase
      .from("exceptions")
      // R7 : colonnes explicites, jamais de jointure vers exception_private — le motif
      // ne transite JAMAIS vers ce rendu (ni payload, ni prop), pour aucun des deux rôles.
      .select("on_date, effect, shift")
      .eq("household_id", adhesion.household_id)
      .eq("profile_id", workerId)
      .gte("on_date", debut)
      .lte("on_date", fin),
    supabase
      .from("sleep_defaults")
      .select("start_time, end_time")
      .eq("household_id", adhesion.household_id)
      .eq("profile_id", workerId)
      .maybeSingle(),
  ]);
  // WHY échouer fort : la fiabilité des écarts EST la thèse produit — afficher un
  // horaire « normal » alors que la lecture des écarts a échoué serait un mensonge.
  const echec = affectationRes.error ?? ecartsRes.error ?? sommeilRes.error;
  if (echec) {
    throw new Error(`lecture de l'horaire impossible : ${echec.message}`);
  }

  const affectation = affectationRes.data;
  if (!affectation) {
    if (role === "spouse") {
      return (
        <Coquille titre={titre}>
          <p className="text-lg text-neutral-300">{t.equipeAttente}</p>
        </Coquille>
      );
    }
    return (
      <Coquille titre={t.titre}>
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">{t.choisirEquipe}</h2>
          <p className="text-sm text-neutral-400">{t.choisirEquipeAide}</p>
          <TeamPicker householdId={adhesion.household_id} currentTeam={null} />
        </section>
      </Coquille>
    );
  }
  const team = equipeSchema.parse(affectation.team);

  const exceptions: ScheduleException[] = ecartsSchema
    .parse(ecartsRes.data ?? [])
    .map((row) => ({ onDate: row.on_date, effect: row.effect, shift: row.shift }));
  // Postgres renvoie 'HH:MM:SS' ; l'affichage vit en 'HH:MM'.
  const sleepDefault: SleepWindow | null = sommeilRes.data
    ? { start: sommeilRes.data.start_time.slice(0, 5), end: sommeilRes.data.end_time.slice(0, 5) }
    : null;

  return (
    <Coquille titre={titre}>
      <GlanceView
        role={role}
        team={team}
        exceptions={exceptions}
        sleepDefault={sleepDefault}
        initialToday={aujourdhui}
      />
    </Coquille>
  );
}
