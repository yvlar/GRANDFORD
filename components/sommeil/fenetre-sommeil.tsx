import { definirFenetreSommeil } from "@/app/sommeil/actions";
import { BoutonSoumettre } from "@/components/ui/bouton-soumettre";
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
  active,
}: {
  householdId: string;
  fenetreActuelle: SleepWindow | null;
  fenetreProposee: SleepWindow;
  /** Interrupteur de la fonction (Sprint 19) : true = fenêtre affichée. */
  active: boolean;
}) {
  const t = fr.sommeil;
  const fenetre = fenetreActuelle ?? fenetreProposee;
  return (
    <form
      action={definirFenetreSommeil.bind(null, householdId)}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      <p className="text-sm text-neutral-400">{t.consigne}</p>
      {/* Interrupteur : décoché, la soumission n'envoie pas `active` → désactivé.
          Case + libellé, jamais la couleur seule (NFR-12) ; cible tactile ≥ 44 px. */}
      <label className="flex min-h-11 items-center gap-3 text-sm text-neutral-200">
        <input
          type="checkbox"
          name="active"
          defaultChecked={active}
          className="h-5 w-5 rounded border-neutral-700 bg-neutral-950 accent-emerald-600"
        />
        <span className="flex flex-col">
          <span className="font-semibold">{t.afficher}</span>
          <span className="text-neutral-400">{t.afficherConsigne}</span>
        </span>
      </label>
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
        <BoutonSoumettre variant="primaire">{t.enregistrer}</BoutonSoumettre>
      </div>
      {fenetreActuelle &&
        (active ? (
          <p className="text-sm text-emerald-300">
            😴 {fenetreActuelle.start} – {fenetreActuelle.end}
          </p>
        ) : (
          <p className="text-sm text-neutral-400">{t.masquee}</p>
        ))}
    </form>
  );
}
