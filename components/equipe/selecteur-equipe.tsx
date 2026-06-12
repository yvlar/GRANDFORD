import { definirEquipe } from "@/app/foyer/actions";
import type { Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";

// Sélecteur d'équipe A/B/C/D (pré-requis de la vue « coup d'œil », Sprint 4).
// Reconnaissance > rappel (NFR-12) : 4 grosses tuiles, identité de quart visible
// (A,B = jour · C,D = nuit — identités fixes, lib/engine/types.ts).
const EQUIPES: readonly { team: Team; quart: "jour" | "nuit" }[] = [
  { team: "A", quart: "jour" },
  { team: "B", quart: "jour" },
  { team: "C", quart: "nuit" },
  { team: "D", quart: "nuit" },
];

export function SelecteurEquipe({
  householdId,
  retour,
  equipeActuelle,
}: {
  householdId: string;
  retour: string;
  equipeActuelle: Team | null;
}) {
  const t = fr.equipe;
  return (
    <form
      action={definirEquipe.bind(null, householdId, retour)}
      className="grid w-full max-w-sm grid-cols-2 gap-3"
    >
      {EQUIPES.map(({ team, quart }) => {
        const actuelle = team === equipeActuelle;
        return (
          <button
            key={team}
            type="submit"
            name="equipe"
            value={team}
            aria-pressed={actuelle}
            className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-5 text-center ${
              actuelle
                ? "border-emerald-400 bg-emerald-950 ring-2 ring-emerald-400"
                : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
            }`}
          >
            <span className="text-3xl font-black">{team}</span>
            <span className="text-sm text-neutral-300">
              {quart === "jour" ? `☀️ ${t.quartJour}` : `🌙 ${t.quartNuit}`}
            </span>
          </button>
        );
      })}
    </form>
  );
}
