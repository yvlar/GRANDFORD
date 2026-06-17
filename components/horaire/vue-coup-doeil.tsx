"use client";

import { PanneauCapture } from "@/components/capture/panneau-capture";
import { PanneauJourConjointe } from "@/components/requetes/panneau-jour-conjointe";
import type { CycleTemplate, Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import type { CaptureHandlers, OwnException } from "@/lib/schedule/capture";
import type { Note, NoteHandlers, Requete, RequeteHandlers } from "@/lib/schedule/coplanification";
import { FORMAT_JOUR_LONG, dateUTC } from "@/lib/schedule/format";
import type { SommeilHandlers } from "@/lib/schedule/sommeil";
import {
  addDays,
  availabilityFor,
  dayStatuses,
  monthGrid,
  shiftMonth,
  statusForDate,
} from "@/lib/schedule/status";
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
const FORMAT_MOIS = new Intl.DateTimeFormat("fr-CA", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const FORMAT_LETTRE_JOUR = new Intl.DateTimeFormat("fr-CA", {
  weekday: "narrow",
  timeZone: "UTC",
});

/** Point « écart à l'horaire » d'une case de la grille (même rendu pour les deux rôles). */
function MarqueurEcart() {
  return (
    <span
      aria-label={fr.horaire.ecart}
      className="absolute right-1 top-1 h-2 w-2 rounded-full bg-black/60"
    />
  );
}

// Lettres D L M M J V S : dérivées d'une semaine réelle commençant un dimanche
// (2023-01-01), pour rester alignées sur la locale plutôt que codées en dur.
const LETTRES_SEMAINE = Array.from({ length: 7 }, (_, i) =>
  FORMAT_LETTRE_JOUR.format(dateUTC("2023-01-01").getTime() + i * 86_400_000),
);

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
  const [monthAnchor, setMonthAnchor] = useState(initialToday);
  // Jour ciblé par le panneau (capture pour le travailleur, jour pour la conjointe).
  // null = panneau fermé. La clé du panneau est ce jour.
  const [captureDate, setCaptureDate] = useState<string | null>(null);
  useEffect(() => {
    // WHY: l'accueil peut être servi depuis le cache PWA (hors-ligne) avec un
    // « aujourd'hui » périmé — l'horloge du client fait foi après hydratation.
    if (!clockFrozen) {
      const clientToday = todayCivil();
      setToday(clientToday);
      setMonthAnchor(clientToday);
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
  const grid = monthGrid(team, monthAnchor, template, exceptions, sleepDefault, sleepAdjustments);
  const pastille = affichagePour(todayStatus);
  const sousTitre = sousTitrePour(todayStatus);
  const legende = role === "worker" ? AFFICHAGE_TRAVAILLEUR : AFFICHAGE_CONJOINTE;

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

  const premierDuMois = `${grid.year}-${String(grid.month).padStart(2, "0")}-01`;
  const dernierDuMois = addDays(shiftMonth(premierDuMois, 1), -1);
  const etiquetteMois = FORMAT_MOIS.format(dateUTC(premierDuMois));
  const ecartsIncomplets =
    exceptionsRange !== null &&
    (premierDuMois < exceptionsRange.from || dernierDuMois > exceptionsRange.to);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-neutral-950 p-4 text-neutral-50">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold tracking-widest text-neutral-400">GRANDFORD</p>
          {workerName ? <p className="text-lg font-semibold">{t.horaireDe(workerName)}</p> : null}
        </div>
        <Link href="/foyer" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          {t.monFoyer}
        </Link>
      </header>

      {/* Pastille « Aujourd'hui » : l'état du jour, lisible en < 2 s (NFR-1). */}
      <section
        aria-label={t.aujourdhui}
        className={`flex flex-col items-center gap-1 rounded-3xl px-6 py-8 text-center ${pastille.classes}`}
      >
        <p className="text-sm font-bold uppercase tracking-wide opacity-80">
          {t.aujourdhui} · {FORMAT_JOUR_LONG.format(dateUTC(today))}
        </p>
        <p className="text-6xl" aria-hidden="true">
          {pastille.emoji}
        </p>
        <p className="text-5xl font-black uppercase tracking-tight">{pastille.etiquette}</p>
        {sousTitre ? <p className="text-2xl font-semibold">{sousTitre}</p> : null}
        {todayStatus.fromException ? (
          <p className="mt-2 rounded-full bg-black/25 px-3 py-1 text-sm font-semibold">{t.ecart}</p>
        ) : null}
      </section>

      {/* Capture d'écart (FR-4) : LE geste central — tap 1 du budget ≤ 3 taps. */}
      {capture ? (
        <button
          type="button"
          onClick={() => setCaptureDate(today)}
          className="rounded-2xl bg-emerald-600 px-6 py-4 text-xl font-bold hover:bg-emerald-500"
        >
          ➕ {fr.capture.saisirEcart}
        </button>
      ) : null}

      {/* Bande semaine : aujourd'hui + 6 jours. */}
      <section aria-label={t.semaine}>
        <ul className="grid grid-cols-7 gap-1">
          {week.map((day) => {
            const aff = affichagePour(day);
            return (
              <li key={day.date}>
                <div
                  title={`${FORMAT_JOUR_LONG.format(dateUTC(day.date))} : ${aff.etiquette}`}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2 ${aff.classes} ${
                    day.date === today ? "ring-2 ring-white" : ""
                  }`}
                >
                  <span className="text-xs font-bold uppercase">
                    {FORMAT_LETTRE_JOUR.format(dateUTC(day.date))}
                  </span>
                  <span className="text-lg font-black">{Number(day.date.slice(8))}</span>
                  <span className="text-base" aria-hidden="true">
                    {aff.emoji}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Grille mois, navigable hors-ligne (tout est calculé côté client). */}
      <section aria-label={etiquetteMois}>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label={t.moisPrecedent}
            onClick={() => setMonthAnchor(shiftMonth(monthAnchor, -1))}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-xl leading-none hover:bg-neutral-800"
          >
            ‹
          </button>
          <h2 className="text-xl font-bold capitalize">{etiquetteMois}</h2>
          <button
            type="button"
            aria-label={t.moisSuivant}
            onClick={() => setMonthAnchor(shiftMonth(monthAnchor, 1))}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-xl leading-none hover:bg-neutral-800"
          >
            ›
          </button>
        </div>
        {ecartsIncomplets ? (
          <p className="mb-2 rounded-lg bg-amber-950 px-3 py-2 text-sm text-amber-200">
            {t.ecartsNonCharges}
          </p>
        ) : null}
        <div className="grid grid-cols-7 gap-1">
          {LETTRES_SEMAINE.map((lettre, i) => (
            <span
              // WHY index en clé : deux « M » (mardi/mercredi) rendent la lettre non unique.
              key={`entete-${i.toString()}`}
              className="py-1 text-center text-xs font-bold uppercase text-neutral-400"
            >
              {lettre}
            </span>
          ))}
          {Array.from({ length: grid.leadingBlanks }, (_, i) => (
            <span key={`vide-${i.toString()}`} aria-hidden="true" />
          ))}
          {grid.days.map((day) => {
            const aff = affichagePour(day);
            const titre = `${FORMAT_JOUR_LONG.format(dateUTC(day.date))} : ${aff.etiquette}`;
            const classes = `relative flex h-10 items-center justify-center rounded-lg text-base font-bold ${aff.classes} ${
              day.date === today ? "ring-2 ring-white" : ""
            }`;
            // Travailleur et conjointe (si coplanification câblée) : tap sur un jour
            // ouvre le panneau correspondant au rôle.
            const interactif = capture != null || coplanification != null;
            return interactif ? (
              <button
                key={day.date}
                type="button"
                title={titre}
                onClick={() => setCaptureDate(day.date)}
                className={classes}
              >
                {Number(day.date.slice(8))}
                {day.fromException ? <MarqueurEcart /> : null}
              </button>
            ) : (
              <div key={day.date} title={titre} className={classes}>
                {Number(day.date.slice(8))}
                {day.fromException ? <MarqueurEcart /> : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* Légende : mêmes couleurs/pictos que les cases (reconnaissance, NFR-12). */}
      <section className="flex flex-wrap gap-2">
        {Object.values(legende).map((aff) => (
          <span
            key={aff.etiquette}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${aff.classes}`}
          >
            {aff.emoji} {aff.etiquette}
          </span>
        ))}
      </section>

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
