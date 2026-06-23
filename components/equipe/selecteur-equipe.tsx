"use client";

import { definirEquipe } from "@/app/foyer/actions";
import type { Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import { useFormStatus } from "react-dom";

// Sélecteur d'équipe A/B/C/D (pré-requis de la vue « coup d'œil », Sprint 4).
// Reconnaissance > rappel (NFR-12) : 4 grosses tuiles, identité de quart visible
// (A,B = jour · C,D = nuit — identités fixes, lib/engine/types.ts).
// WHY client : les tuiles SONT les boutons de soumission ; `useFormStatus` (lu dans
// TuileEquipe, enfant du <form>) les désactive le temps de l'envoi — feedback de
// statut sans changer le geste (NFR-1).
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
  return (
    <form
      action={definirEquipe.bind(null, householdId, retour)}
      className="grid w-full max-w-sm grid-cols-2 gap-3"
    >
      {EQUIPES.map(({ team, quart }) => (
        <TuileEquipe key={team} team={team} quart={quart} actuelle={team === equipeActuelle} />
      ))}
    </form>
  );
}

function TuileEquipe({
  team,
  quart,
  actuelle,
}: {
  team: Team;
  quart: "jour" | "nuit";
  actuelle: boolean;
}) {
  const t = fr.equipe;
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="equipe"
      value={team}
      aria-pressed={actuelle}
      disabled={pending}
      className={`flex min-h-11 flex-col items-center gap-1 rounded-xl border px-4 py-5 text-center disabled:opacity-50 ${
        actuelle
          ? "border-emerald-400 bg-emerald-950 ring-2 ring-emerald-400"
          : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
      }`}
    >
      <span className="text-3xl font-black">{team}</span>
      <span className="text-sm text-neutral-300">
        <span aria-hidden="true">{quart === "jour" ? "☀️" : "🌙"}</span>{" "}
        {quart === "jour" ? t.quartJour : t.quartNuit}
      </span>
    </button>
  );
}
