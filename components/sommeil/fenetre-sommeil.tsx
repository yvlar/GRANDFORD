import { definirFenetreSommeil } from "@/app/sommeil/actions";
import { fr } from "@/lib/i18n/fr";
import type { SleepWindow } from "@/lib/schedule/types";

// Configuration UNIQUE de la fenêtre de sommeil (FR-6, Sprint 6) — formulaire
// serveur simple (modèle : selecteur-equipe.tsx). Les valeurs proposées sont la
// fenêtre déjà configurée, sinon l'heuristique du gabarit : l'usager part toujours
// d'un réglage plausible (reconnaissance > rappel, NFR-12).
export function FenetreSommeil({
  householdId,
  fenetreActuelle,
  fenetreProposee,
}: {
  householdId: string;
  fenetreActuelle: SleepWindow | null;
  fenetreProposee: SleepWindow;
}) {
  const t = fr.sommeil;
  const fenetre = fenetreActuelle ?? fenetreProposee;
  return (
    <form
      action={definirFenetreSommeil.bind(null, householdId)}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      <p className="text-sm text-neutral-400">{t.consigne}</p>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t.debut}
          <input
            type="time"
            name="debut"
            required
            defaultValue={fenetre.start}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-lg text-neutral-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t.fin}
          <input
            type="time"
            name="fin"
            required
            defaultValue={fenetre.end}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-lg text-neutral-50"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500"
        >
          {t.enregistrer}
        </button>
      </div>
      {fenetreActuelle ? (
        <p className="text-sm text-emerald-300">
          😴 {fenetreActuelle.start} – {fenetreActuelle.end}
        </p>
      ) : null}
    </form>
  );
}
