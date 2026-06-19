"use client";

import { PanneauCapture } from "@/components/capture/panneau-capture";
import { PanneauJourConjointe } from "@/components/requetes/panneau-jour-conjointe";
import type { CycleTemplate, Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import type { CaptureHandlers, OwnException } from "@/lib/schedule/capture";
import type { Note, NoteHandlers, Requete, RequeteHandlers } from "@/lib/schedule/coplanification";
import { FORMAT_JOUR_LONG, dateUTC } from "@/lib/schedule/format";
import type { SommeilHandlers } from "@/lib/schedule/sommeil";
import { addDays, availabilityFor, dayStatuses, statusForDate } from "@/lib/schedule/status";
import { todayCivil } from "@/lib/schedule/today";
import type {
  Availability,
  DayStatus,
  DayStatusKind,
  ScheduleException,
  SleepAdjustment,
  SleepWindow,
} from "@/lib/schedule/types";
import Link from "next/link";
import { useEffect, useState } from "react";

// Vue « coup d'œil » (FR-2/FR-3) — composant CLIENT par nécessité : le moteur pur
// tourne dans le navigateur, l'horaire ne dépend donc JAMAIS du réseau (NFR-4).
// Le serveur ne fournit que l'équipe, les écarts et la fenêtre de sommeil.
// R7 : les props ne contiennent aucun motif — ScheduleException n'a pas de champ
// pour lui, la frontière est typée.

type Role = "worker" | "spouse";

interface Affichage {
  readonly emoji: string;
  readonly etiquette: string;
  readonly classes: string;
}

// Reconnaissance > rappel (NFR-12) : une couleur + un pictogramme par état, forts
// contrastes, étiquettes courtes.
const AFFICHAGE_TRAVAILLEUR: Record<DayStatusKind, Affichage> = {
  jour: { emoji: "☀️", etiquette: fr.horaire.jour, classes: "bg-amber-400 text-amber-950" },
  nuit: { emoji: "🌙", etiquette: fr.horaire.nuit, classes: "bg-indigo-500 text-indigo-50" },
  conge: { emoji: "✅", etiquette: fr.horaire.conge, classes: "bg-emerald-500 text-emerald-950" },
  sommeil: { emoji: "😴", etiquette: fr.horaire.sommeil, classes: "bg-sky-500 text-sky-950" },
};

const AFFICHAGE_CONJOINTE: Record<Availability, Affichage> = {
  travaille: { emoji: "🏭", etiquette: fr.horaire.travaille, classes: "bg-rose-500 text-rose-50" },
  disponible: {
    emoji: "✅",
    etiquette: fr.horaire.disponible,
    classes: "bg-emerald-500 text-emerald-950",
  },
  sommeil: { emoji: "😴", etiquette: fr.horaire.sommeil, classes: "bg-sky-500 text-sky-950" },
};

// Dates affichées : les chaînes civiles 'YYYY-MM-DD' sont formatées en UTC pour ne
// pas glisser d'un jour selon le fuseau du navigateur (la date civile est la vérité).
const FORMAT_LETTRE_JOUR = new Intl.DateTimeFormat("fr-CA", {
  weekday: "narrow",
  timeZone: "UTC",
});

export interface VueCoupDoeilProps {
  readonly role: Role;
  readonly team: Team;
  readonly template: CycleTemplate;
  readonly exceptions: readonly ScheduleException[];
  readonly sleepDefault: SleepWindow | null;
  /** Ajustements par date (FR-6) — disponibilité partagée, visibles des deux rôles. */
  readonly sleepAdjustments?: readonly SleepAdjustment[];
  /** Date du rendu serveur ; resynchronisée sur l'horloge du client au montage. */
  readonly initialToday: string;
  /** Nom du travailleur (vue conjointe seulement). */
  readonly workerName?: string | null;
  /**
   * Intervalle couvert par les écarts fournis. Hors de cet intervalle, la grille
   * n'affiche que l'horaire de base — on l'annonce honnêtement (R1 : la confiance
   * repose sur la fiabilité des écarts, jamais les taire en silence).
   */
  readonly exceptionsRange?: { readonly from: string; readonly to: string } | null;
  /** Démo/preuve : fige « aujourd'hui » sur initialToday (jamais en usage réel). */
  readonly clockFrozen?: boolean;
  /**
   * Capture d'écart (Sprint 5) — branche TRAVAILLEUR seulement : ses propres écarts
   * (id + motif) et les gestes d'écriture. La conjointe ne reçoit jamais cette prop,
   * son payload reste sans motif (R7).
   */
  readonly capture?: {
    readonly ownExceptions: readonly OwnException[];
    readonly handlers: CaptureHandlers;
    /** Gestes d'ajustement du sommeil (FR-6) — proposés quand le jour tapé en est un. */
    readonly sommeil?: SommeilHandlers | null;
    /** Requêtes en attente (FR-9, Sprint 9) — le travailleur approuve / refuse. */
    readonly requetes?: readonly Requete[];
    readonly requeteHandlers?: RequeteHandlers | null;
  } | null;
  /** Notes du foyer (FR-8, Sprint 9) — partagées, visibles des deux rôles. */
  readonly notes?: readonly Note[];
  readonly noteHandlers?: NoteHandlers | null;
  /**
   * Co-planification conjointe (FR-9, Sprint 9) — branche CONJOINTE seulement :
   * ses requêtes soumises + handler pour en créer. Le travailleur n'a pas cette prop.
   */
  readonly coplanification?: {
    readonly requetes: readonly Requete[];
    readonly soumettre: (
      onDate: string,
      body: string,
    ) => Promise<{ ok: boolean; erreur: string | null }>;
  } | null;
}

export function VueCoupDoeil({
  role,
  team,
  template,
  exceptions,
  sleepDefault,
  sleepAdjustments = [],
  initialToday,
  workerName = null,
  exceptionsRange = null,
  clockFrozen = false,
  capture = null,
  notes = [],
  noteHandlers = null,
  coplanification = null,
}: VueCoupDoeilProps) {
  const t = fr.horaire;
  const [today, setToday] = useState(initialToday);
  // Jour ciblé par le panneau (capture pour le travailleur, jour pour la conjointe).
  // null = panneau fermé. La clé du panneau est ce jour.
  const [captureDate, setCaptureDate] = useState<string | null>(null);
  useEffect(() => {
    // WHY: l'accueil peut être servi depuis le cache PWA (hors-ligne) avec un
    // « aujourd'hui » périmé — l'horloge du client fait foi après hydratation.
    if (!clockFrozen) {
      setToday(todayCivil());
    }
  }, [clockFrozen]);

  const affichagePour = (status: DayStatus): Affichage =>
    role === "worker"
      ? AFFICHAGE_TRAVAILLEUR[status.kind]
      : AFFICHAGE_CONJOINTE[availabilityFor(status)];

  const sousTitrePour = (status: DayStatus): string | null => {
    if (status.kind === "jour") {
      return `${template.dayHours.start} – ${template.dayHours.end}`;
    }
    if (status.kind === "nuit") {
      return `${template.nightHours.start} – ${template.nightHours.end}`;
    }
    if (status.kind === "sommeil" && status.sleep) {
      return `${status.sleep.start} – ${status.sleep.end}`;
    }
    return null;
  };

  const interactif = capture != null || coplanification != null;

  const todayStatus = statusForDate(
    team,
    today,
    template,
    exceptions,
    sleepDefault,
    sleepAdjustments,
  );
  const week = dayStatuses(
    team,
    today,
    addDays(today, 6),
    template,
    exceptions,
    sleepDefault,
    sleepAdjustments,
  );
  const pastille = affichagePour(todayStatus);
  const sousTitre = sousTitrePour(todayStatus);

  // Première exception dans le futur : alerte douce sans motif (R7).
  const prochainEcart =
    [...exceptions]
      .filter((e) => e.onDate > today)
      .sort((a, b) => a.onDate.localeCompare(b.onDate))[0] ?? null;

  // Bloc d'ajustement du sommeil (FR-6) : proposé seulement si le jour tapé est une
  // journée de SOMMEIL et que les gestes sont câblés (branche travailleur connectée).
  const sommeilPourJour = (date: string) => {
    const handlers = capture?.sommeil;
    if (!handlers) {
      return null;
    }
    const status = statusForDate(team, date, template, exceptions, sleepDefault, sleepAdjustments);
    if (status.kind !== "sommeil" || status.sleep === null) {
      return null;
    }
    return {
      window: status.sleep,
      ajuste: sleepAdjustments.some((a) => a.onDate === date),
      handlers,
    };
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 bg-slate-950 p-4 pb-24 text-slate-50">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-blue-400">GRANDFORD</p>
          {workerName ? (
            <p className="text-base font-semibold text-slate-50">{t.horaireDe(workerName)}</p>
          ) : null}
        </div>
        <Link
          href="/foyer"
          className="flex items-center gap-1.5 rounded-full border border-slate-800 px-3 py-1.5 text-sm font-medium text-slate-400 transition-colors duration-200 hover:border-slate-700 hover:text-slate-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {t.monFoyer}
        </Link>
      </header>

      {/* Pastille « Aujourd'hui » — héroïque : occupe la moitié de l'écran.
          Lisible en < 2 s sans chercher (NFR-1) ; couleur + emoji + label = triple
          encodage de l'état (NFR-12 : reconnaissance > rappel). */}
      <section
        aria-label={t.aujourdhui}
        className={`flex min-h-[52vh] flex-col items-center justify-center gap-2 rounded-3xl text-center ${pastille.classes}`}
      >
        <p className="text-xs font-bold uppercase tracking-widest opacity-60">
          {FORMAT_JOUR_LONG.format(dateUTC(today))}
        </p>
        <p className="text-8xl" aria-hidden="true">
          {pastille.emoji}
        </p>
        <p className="text-6xl font-black uppercase tracking-tight">{pastille.etiquette}</p>
        {sousTitre ? <p className="text-3xl font-semibold opacity-80">{sousTitre}</p> : null}
        {todayStatus.fromException ? (
          <span className="mt-3 rounded-full bg-black/25 px-4 py-1.5 text-sm font-bold uppercase tracking-wide">
            {t.ecart}
          </span>
        ) : null}
      </section>

      {/* Bande semaine : aujourd'hui + 6 jours.
          Tappable quand le rôle est interactif — remplace la grille mensuelle pour
          accéder à un jour précis (la grille vit dans l'onglet Cycle, pas ici). */}
      <section aria-label={t.semaine}>
        <ul className="grid grid-cols-7 gap-1.5">
          {week.map((day) => {
            const aff = affichagePour(day);
            const cellClasses = `flex w-full flex-col items-center gap-0.5 rounded-2xl py-2.5 ${aff.classes} ${
              day.date === today ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
            }`;
            const titre = `${FORMAT_JOUR_LONG.format(dateUTC(day.date))} : ${aff.etiquette}`;
            return (
              <li key={day.date}>
                {interactif ? (
                  <button
                    type="button"
                    title={titre}
                    onClick={() => setCaptureDate(day.date)}
                    className={`${cellClasses} cursor-pointer`}
                  >
                    <span className="text-xs font-bold uppercase">
                      {FORMAT_LETTRE_JOUR.format(dateUTC(day.date))}
                    </span>
                    <span className="text-lg font-black">{Number(day.date.slice(8))}</span>
                    <span className="text-base" aria-hidden="true">
                      {aff.emoji}
                    </span>
                  </button>
                ) : (
                  <div title={titre} className={cellClasses}>
                    <span className="text-xs font-bold uppercase">
                      {FORMAT_LETTRE_JOUR.format(dateUTC(day.date))}
                    </span>
                    <span className="text-lg font-black">{Number(day.date.slice(8))}</span>
                    <span className="text-base" aria-hidden="true">
                      {aff.emoji}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Carte « Prochain écart » — conditionnelle, jamais un motif (R7).
          Signal proactif : l'utilisateur n'a pas à scanner la semaine pour savoir
          si quelque chose arrive. Tappable pour ouvrir le panneau du jour concerné. */}
      {prochainEcart ? (
        <section aria-label={t.prochainEcart}>
          {interactif ? (
            <button
              type="button"
              onClick={() => setCaptureDate(prochainEcart.onDate)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-left transition-colors duration-200 hover:border-slate-700 hover:bg-slate-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-400"
                  aria-hidden="true"
                >
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {t.prochainEcart}
                </p>
                <p className="font-semibold text-slate-50">
                  {FORMAT_JOUR_LONG.format(dateUTC(prochainEcart.onDate))}
                </p>
              </div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto h-4 w-4 text-slate-500"
                aria-hidden="true"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-orange-400"
                  aria-hidden="true"
                >
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {t.prochainEcart}
                </p>
                <p className="font-semibold text-slate-50">
                  {FORMAT_JOUR_LONG.format(dateUTC(prochainEcart.onDate))}
                </p>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* FAB de capture (FR-4) — fixe, toujours visible même en scroll.
          Tap 1 du budget ≤ 3 taps (NFR-1) : ouvre la capture pour aujourd'hui. */}
      {capture ? (
        <button
          type="button"
          onClick={() => setCaptureDate(today)}
          aria-label={fr.capture.saisirEcart}
          className="fixed bottom-6 right-6 z-10 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-orange-500 shadow-xl shadow-orange-500/25 transition-all duration-200 hover:bg-orange-400 active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7 text-white"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      ) : null}

      {capture && captureDate ? (
        <PanneauCapture
          key={captureDate}
          date={captureDate}
          ownException={capture.ownExceptions.find((e) => e.onDate === captureDate) ?? null}
          handlers={capture.handlers}
          sommeil={sommeilPourJour(captureDate)}
          notes={notes}
          noteHandlers={noteHandlers}
          pendingRequete={
            capture.requetes?.find((r) => r.onDate === captureDate && r.status === "pending") ??
            null
          }
          requeteHandlers={capture.requeteHandlers ?? null}
          onClose={() => setCaptureDate(null)}
        />
      ) : null}

      {coplanification && captureDate && role === "spouse" ? (
        <PanneauJourConjointe
          key={captureDate}
          date={captureDate}
          notes={notes}
          noteHandlers={noteHandlers}
          requetes={coplanification.requetes}
          soumettre={coplanification.soumettre}
          onClose={() => setCaptureDate(null)}
        />
      ) : null}
    </main>
  );
}
