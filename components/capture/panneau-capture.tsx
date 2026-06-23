"use client";

import { NoteDuJour } from "@/components/notes/note-du-jour";
import { fr } from "@/lib/i18n/fr";
import {
  type CaptureHandlers,
  type OwnException,
  TUILES,
  type Tuile,
} from "@/lib/schedule/capture";
import type { Note, NoteHandlers, Requete, RequeteHandlers } from "@/lib/schedule/coplanification";
import { FORMAT_JOUR_LONG, dateUTC } from "@/lib/schedule/format";
import type { SommeilHandlers } from "@/lib/schedule/sommeil";
import type { SleepWindow } from "@/lib/schedule/types";
import { useState, useTransition } from "react";

// Panneau de capture d'un écart (FR-4/FR-7, Sprint 5) — le cœur de la thèse produit.
// Budget de taps (NFR-1), bouton « Saisir un écart » compris :
//   OT     : bouton → tuile OT = ENREGISTRÉ (2 taps — le geste le plus rapide, FR-7) ;
//   autres : bouton → tuile → Confirmer (3 taps).
// Le jour par défaut (aujourd'hui ou jour tapé dans la grille) est déjà choisi : en
// changer est possible mais hors du chemin nominal. R7 : le motif saisi part vers la
// RPC atomique et ne revient au client QUE pour son propriétaire (badge du détail).

// Reconnaissance > rappel (NFR-12) : un pictogramme par tuile, étiquettes courtes.
const PICTO_TUILE: Record<Tuile, string> = {
  ot: "⚡",
  conge: "🛋️",
  maladie: "🤒",
  echange: "🔄",
  formation: "🎓",
  vacances: "🏖️",
};

export interface PanneauCaptureProps {
  /** Jour ciblé à l'ouverture (aujourd'hui, ou le jour tapé dans la grille). */
  readonly date: string;
  /** Écart existant ce jour-là → mode détail (motif + suppression), sinon capture. */
  readonly ownException: OwnException | null;
  readonly handlers: CaptureHandlers;
  /**
   * Présent quand le jour tapé est une journée de SOMMEIL (FR-6, Sprint 6) :
   * fenêtre affichée ce jour-là + gestes d'ajustement au cas par cas. Bloc ajouté
   * SOUS la capture — le budget ≤ 3 taps d'un écart reste intact (NFR-1).
   */
  readonly sommeil?: {
    readonly window: SleepWindow;
    readonly ajuste: boolean;
    readonly handlers: SommeilHandlers;
  } | null;
  /** Notes du foyer (FR-8, Sprint 9) — partagées, affichées sous la capture. */
  readonly notes?: readonly Note[];
  readonly noteHandlers?: NoteHandlers | null;
  /** Requête en attente pour ce jour (FR-9, Sprint 9) — approuver / refuser. */
  readonly pendingRequete?: Requete | null;
  readonly requeteHandlers?: RequeteHandlers | null;
  readonly onClose: () => void;
}

export function PanneauCapture({
  date,
  ownException,
  handlers,
  sommeil = null,
  notes = [],
  noteHandlers = null,
  pendingRequete = null,
  requeteHandlers = null,
  onClose,
}: PanneauCaptureProps) {
  const t = fr.capture;
  const [jour, setJour] = useState(date);
  const [tuileChoisie, setTuileChoisie] = useState<Tuile | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const soumettre = (tuile: Tuile) => {
    startTransition(async () => {
      const etat = await handlers.capturer(jour, tuile);
      if (etat.ok) {
        onClose();
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const choisirTuile = (tuile: Tuile) => {
    setErreur(null);
    // FR-7 : l'OT s'enregistre dès le tap de sa tuile — aucun écran de plus.
    if (tuile === "ot") {
      soumettre(tuile);
    } else {
      setTuileChoisie(tuile);
    }
  };

  const supprimer = (exceptionId: string) => {
    startTransition(async () => {
      const etat = await handlers.supprimer(exceptionId);
      if (etat.ok) {
        onClose();
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <dialog
        open
        aria-label={ownException ? t.detailTitre : t.titre}
        className="m-0 w-full max-w-md rounded-3xl border-0 bg-neutral-900 p-5 text-neutral-50 shadow-2xl"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{ownException ? t.detailTitre : t.titre}</h2>
            <p className="text-lg capitalize text-neutral-300">
              {FORMAT_JOUR_LONG.format(dateUTC(jour))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-neutral-700 px-3 text-sm font-semibold hover:bg-neutral-800"
          >
            {t.fermer}
          </button>
        </header>

        {erreur ? (
          <p role="alert" className="mb-3 rounded-lg bg-red-950 px-3 py-2 text-red-200">
            {erreur}
          </p>
        ) : null}

        {ownException ? (
          <DetailEcart ecart={ownException} pending={pending} onSupprimer={supprimer} />
        ) : (
          <>
            <label className="mb-4 flex items-center justify-between gap-3 text-sm text-neutral-300">
              {t.jourLabel}
              <input
                type="date"
                value={jour}
                onChange={(e) => {
                  if (e.target.value) {
                    setJour(e.target.value);
                  }
                }}
                className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base text-neutral-50"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TUILES.map((tuile) => (
                <button
                  key={tuile}
                  type="button"
                  disabled={pending}
                  onClick={() => choisirTuile(tuile)}
                  aria-pressed={tuile === tuileChoisie}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-5 disabled:opacity-50 ${
                    tuile === tuileChoisie
                      ? "border-emerald-400 bg-emerald-950 ring-2 ring-emerald-400"
                      : "border-neutral-700 bg-neutral-950 hover:bg-neutral-800"
                  }`}
                >
                  <span className="text-3xl" aria-hidden="true">
                    {PICTO_TUILE[tuile]}
                  </span>
                  <span className="text-lg font-bold">{t.tuiles[tuile]}</span>
                  {tuile === "ot" ? (
                    <span className="text-xs text-neutral-400">{t.otInstantane}</span>
                  ) : null}
                </button>
              ))}
            </div>
            {tuileChoisie ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => soumettre(tuileChoisie)}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-6 py-4 text-xl font-bold hover:bg-emerald-500 disabled:opacity-50"
              >
                {t.confirmer} — {t.tuiles[tuileChoisie]}
              </button>
            ) : null}
          </>
        )}

        {/* WHY jour === date : le bloc sommeil décrit le jour TAPÉ ; si l'usager
            change la date de capture, la fenêtre affichée ne le concernerait plus. */}
        {sommeil && jour === date ? (
          <AjusterSommeil
            date={date}
            sommeil={sommeil}
            pending={pending}
            onErreur={setErreur}
            onSoumettre={(action) => {
              setErreur(null);
              startTransition(async () => {
                const etat = await action();
                if (etat.ok) {
                  onClose();
                } else {
                  setErreur(etat.erreur);
                }
              });
            }}
          />
        ) : null}

        {/* Notes partagées (FR-8, Sprint 9) */}
        {noteHandlers ? <NoteDuJour notes={notes} onDate={date} handlers={noteHandlers} /> : null}

        {/* Requête en attente (FR-9, Sprint 9) — approuver / refuser */}
        {pendingRequete && requeteHandlers ? (
          <SectionRequete
            requete={pendingRequete}
            handlers={requeteHandlers}
            pending={pending}
            onErreur={setErreur}
            startTransition={startTransition}
            onClose={onClose}
          />
        ) : null}
      </dialog>
    </div>
  );
}

/** Ajustement de la fenêtre de sommeil d'UN jour (FR-6) — les autres jours gardent le défaut. */
function AjusterSommeil({
  date,
  sommeil,
  pending,
  onErreur,
  onSoumettre,
}: {
  date: string;
  sommeil: { window: SleepWindow; ajuste: boolean; handlers: SommeilHandlers };
  pending: boolean;
  onErreur: (erreur: string | null) => void;
  onSoumettre: (action: () => ReturnType<SommeilHandlers["ajuster"]>) => void;
}) {
  const t = fr.sommeil;
  const [debut, setDebut] = useState(sommeil.window.start);
  const [fin, setFin] = useState(sommeil.window.end);

  return (
    <section
      aria-label={t.ajusterTitre}
      className="mt-5 flex flex-col gap-3 border-t border-neutral-800 pt-4"
    >
      <h3 className="text-lg font-bold">
        😴 {t.ajusterTitre} {sommeil.ajuste ? t.ajuste : ""}
      </h3>
      <p className="text-sm text-neutral-400">{t.ajusterConsigne}</p>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t.debut}
          <input
            type="time"
            value={debut}
            onChange={(e) => {
              onErreur(null);
              setDebut(e.target.value);
            }}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base text-neutral-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t.fin}
          <input
            type="time"
            value={fin}
            onChange={(e) => {
              onErreur(null);
              setFin(e.target.value);
            }}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base text-neutral-50"
          />
        </label>
        <button
          type="button"
          disabled={pending || debut === "" || fin === ""}
          onClick={() => onSoumettre(() => sommeil.handlers.ajuster(date, debut, fin))}
          className="min-h-11 rounded-lg bg-sky-600 px-4 py-3 font-semibold hover:bg-sky-500 disabled:opacity-50"
        >
          {t.ajuster}
        </button>
      </div>
      {sommeil.ajuste ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onSoumettre(() => sommeil.handlers.retirer(date))}
          className="inline-flex min-h-11 items-center self-start text-sm text-neutral-400 underline hover:text-neutral-200 disabled:opacity-50"
        >
          {t.retirer}
        </button>
      ) : null}
    </section>
  );
}

/** Requête en attente à approuver/refuser (FR-9, Sprint 9). */
function SectionRequete({
  requete,
  handlers,
  pending,
  onErreur,
  startTransition,
  onClose,
}: {
  requete: Requete;
  handlers: RequeteHandlers;
  pending: boolean;
  onErreur: (e: string | null) => void;
  startTransition: ReturnType<typeof useTransition>[1];
  onClose: () => void;
}) {
  const t = fr.requetes;

  const agir = (action: () => Promise<{ ok: boolean; erreur: string | null }>) => {
    startTransition(async () => {
      const etat = await action();
      if (etat.ok) {
        onClose();
      } else {
        onErreur(etat.erreur);
      }
    });
  };

  return (
    <section
      aria-label={t.titre}
      className="mt-4 flex flex-col gap-3 border-t border-neutral-800 pt-4"
    >
      <h3 className="text-lg font-bold">📋 {t.titre}</h3>
      <p className="rounded-lg bg-neutral-950 px-3 py-2 text-sm text-neutral-100">{requete.body}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => agir(() => handlers.approuver(requete.id, requete.onDate, "off"))}
          className="min-h-11 flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500 disabled:opacity-50"
        >
          <span aria-hidden="true">✅</span> {t.approuver}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => agir(() => handlers.refuser(requete.id))}
          className="min-h-11 flex-1 rounded-xl bg-red-700 px-4 py-3 font-bold hover:bg-red-600 disabled:opacity-50"
        >
          <span aria-hidden="true">✗</span> {t.refuser}
        </button>
      </div>
    </section>
  );
}

/** Détail d'un écart existant : effet partagé, motif privé, suppression (cascade). */
function DetailEcart({
  ecart,
  pending,
  onSupprimer,
}: {
  ecart: OwnException;
  pending: boolean;
  onSupprimer: (exceptionId: string) => void;
}) {
  const t = fr.capture;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xl font-bold">
        {ecart.motif ? `${PICTO_TUILE[ecart.motif]} ` : ""}
        {t.effets[ecart.effect]}
        {ecart.shift ? ` · ${fr.horaire[ecart.shift]}` : ""}
      </p>
      <p className="rounded-lg bg-neutral-950 px-3 py-2 text-sm text-neutral-300">
        {t.motifPrive} : {ecart.motif ? t.tuiles[ecart.motif] : t.sansMotif}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => onSupprimer(ecart.id)}
        className="w-full rounded-xl bg-red-700 px-6 py-4 text-xl font-bold hover:bg-red-600 disabled:opacity-50"
      >
        {t.supprimer}
      </button>
    </div>
  );
}
