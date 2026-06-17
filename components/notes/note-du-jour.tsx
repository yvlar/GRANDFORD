"use client";

import { fr } from "@/lib/i18n/fr";
import type { Note, NoteHandlers } from "@/lib/schedule/coplanification";
import { useState, useTransition } from "react";

// Notes du jour (FR-8, Sprint 9) — visible des deux membres du foyer.
// Budget NFR-1 : la note est accessible depuis le panneau du jour (tap 2 ou 3),
// pas depuis la pastille principale (le « coup d'œil » reste < 2 s, NFR-12).
// R7 : une note n'est pas un motif d'absence — elle ne transite pas vers exception_private.

interface NoteDuJourProps {
  readonly notes: readonly Note[];
  readonly onDate: string;
  readonly handlers: NoteHandlers;
}

export function NoteDuJour({ notes, onDate, handlers }: NoteDuJourProps) {
  const t = fr.notes;
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const notesJour = notes.filter((n) => n.onDate === onDate);

  const creer = () => {
    const texte = corps.trim();
    if (!texte) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.creer(onDate, texte);
      if (etat.ok) {
        setCorps("");
        setErreur(null);
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const supprimer = (noteId: string) => {
    startTransition(async () => {
      const etat = await handlers.supprimer(noteId);
      if (!etat.ok) {
        setErreur(etat.erreur);
      }
    });
  };

  return (
    <section
      aria-label={t.titre}
      className="flex flex-col gap-3 border-t border-neutral-800 pt-4 mt-4"
    >
      <h3 className="text-lg font-bold">📝 {t.titre}</h3>

      {erreur ? (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">
          {erreur}
        </p>
      ) : null}

      {notesJour.length === 0 ? (
        <p className="text-sm text-neutral-400">{t.vide}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notesJour.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-neutral-950 px-3 py-2"
            >
              <span className="text-sm text-neutral-100">{note.body}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => supprimer(note.id)}
                className="shrink-0 text-xs text-neutral-500 underline hover:text-red-400 disabled:opacity-50"
              >
                {t.supprimer}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder={t.placeholder}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              creer();
            }
          }}
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
        />
        <button
          type="button"
          disabled={pending || !corps.trim()}
          onClick={creer}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50"
        >
          {t.enregistrer}
        </button>
      </div>
    </section>
  );
}
