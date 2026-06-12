import { choisirEquipe } from "@/app/foyer/actions";
import type { Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import { IDENTITY_SHIFT } from "@/lib/schedule";
import { equipeSchema } from "@/lib/validation";

// Sélecteur d'équipe A/B/C/D (pré-requis de la vue, carte Sprint 4) : 4 gros boutons,
// un tap suffit (NFR-1). Server Component : le choix part en server action, la RLS
// (membre du foyer) reste la barrière réelle.

const TEAMS: readonly Team[] = equipeSchema.options;

export function TeamPicker({
  householdId,
  currentTeam,
}: {
  readonly householdId: string;
  readonly currentTeam: Team | null;
}) {
  const t = fr.horaire;
  return (
    <form action={choisirEquipe.bind(null, householdId)} className="grid grid-cols-4 gap-2">
      {TEAMS.map((team) => {
        const selected = currentTeam === team;
        return (
          <button
            key={team}
            type="submit"
            name="equipe"
            value={team}
            aria-pressed={selected}
            className={`flex flex-col items-center rounded-xl border-2 px-2 py-4 ${
              selected
                ? "border-emerald-400 bg-emerald-600 text-white"
                : "border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800"
            }`}
          >
            <span className="text-3xl font-black">{team}</span>
            <span className="text-xs text-neutral-300">
              {IDENTITY_SHIFT[team] === "jour" ? t.legendeJour : t.legendeNuit}
            </span>
          </button>
        );
      })}
    </form>
  );
}
