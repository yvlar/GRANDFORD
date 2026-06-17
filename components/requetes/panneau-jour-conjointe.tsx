"use client";

import { NoteDuJour } from "@/components/notes/note-du-jour";
import { fr } from "@/lib/i18n/fr";
import type { Note, NoteHandlers, Requete } from "@/lib/schedule/coplanification";
import { FORMAT_JOUR_LONG, dateUTC } from "@/lib/schedule/format";
import { useState, useTransition } from "react";

// Panneau du jour pour la conjointe (FR-8 notes + FR-9 requêtes, Sprint 9).
// La conjointe voit les notes partagées et peut soumettre une demande de
// disponibilité. Elle voit le statut de ses demandes existantes.
// R7 : le body d'une requête n'est pas un motif d'absence — il ne transite
// jamais vers exception_private.

interface PanneauJourContrainteProps {
  readonly date: string;
  readonly notes: readonly Note[];
  readonly noteHandlers: NoteHandlers | null;
  readonly requetes: readonly Requete[];
  readonly soumettre: (
    onDate: string,
    body: string,
  ) => Promise<{ ok: boolean; erreur: string | null }>;
  readonly onClose: () => void;
}

export function PanneauJourConjointe({
  date,
  notes,
  noteHandlers,
  requetes,
  soumettre,
  onClose,
}: PanneauJourContrainteProps) {
  const t = fr.requetes;
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requetesJour = requetes.filter((r) => r.onDate === date);
  const dejaEnAttente = requetesJour.some((r) => r.status === "pending");

  const envoyer = () => {
    const texte = corps.trim();
    if (!texte) {
      return;
    }
    startTransition(async () => {
      const etat = await soumettre(date, texte);
      if (etat.ok) {
        setCorps("");
        setErreur(null);
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <dialog
        open
        aria-label={FORMAT_JOUR_LONG.format(dateUTC(date))}
        className="m-0 w-full max-w-md rounded-3xl border-0 bg-neutral-900 p-5 text-neutral-50 shadow-2xl"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-2xl font-bold capitalize">
            {FORMAT_JOUR_LONG.format(dateUTC(date))}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-semibold hover:bg-neutral-800"
          >
            {fr.capture.fermer}
          </button>
        </header>

        {/* Notes partagées (FR-8) */}
        {noteHandlers ? <NoteDuJour notes={notes} onDate={date} handlers={noteHandlers} /> : null}

        {/* Requêtes / demandes de disponibilité (FR-9) */}
        <section
          aria-label={t.titre}
          className="mt-4 flex flex-col gap-3 border-t border-neutral-800 pt-4"
        >
          <h3 className="text-lg font-bold">📋 {t.titre}</h3>

          {erreur ? (
            <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">
              {erreur}
            </p>
          ) : null}

          {requetesJour.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {requetesJour.map((req) => (
                <li
                  key={req.id}
                  className="flex items-start justify-between gap-3 rounded-lg bg-neutral-950 px-3 py-2"
                >
                  <span className="text-sm text-neutral-100">{req.body}</span>
                  <StatusBadge status={req.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">{t.aucune}</p>
          )}

          {!dejaEnAttente ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t.demander}</p>
              <textarea
                value={corps}
                onChange={(e) => setCorps(e.target.value)}
                placeholder={t.placeholder}
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
              />
              <button
                type="button"
                disabled={pending || !corps.trim()}
                onClick={envoyer}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
              >
                {t.envoyer}
              </button>
            </div>
          ) : null}
        </section>
      </dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = fr.requetes.statuts;
  const config: Record<string, { label: string; classes: string }> = {
    pending: { label: t.pending, classes: "bg-amber-900 text-amber-200" },
    approved: { label: t.approved, classes: "bg-emerald-900 text-emerald-200" },
    declined: { label: t.declined, classes: "bg-red-900 text-red-200" },
  };
  const c = config[status] ?? { label: status, classes: "bg-neutral-800 text-neutral-300" };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${c.classes}`}>
      {c.label}
    </span>
  );
}
