"use client";

import { GRANDFORD_CYCLE, type Team, parseCivilDate, weekdayIndex } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import {
  type DayOverview,
  type ScheduleException,
  type SleepWindow,
  type WorkerStatus,
  addDays,
  firstOfMonth,
  lastOfMonth,
  monthGrid,
  nextDates,
  overviewRange,
  spouseStatus,
  todayInToronto,
} from "@/lib/schedule";
import { useEffect, useState } from "react";

// Vue « coup d'œil » (FR-2/FR-3). Composant CLIENT par nécessité (horloge, état) :
// l'horaire complet se calcule ICI, à partir du moteur pur — zéro réseau pour
// s'afficher (NFR-4). Seuls les écarts (props) viennent du serveur.
// Le gabarit est la constante validée GRANDFORD_CYCLE tant que l'app sert une seule
// usine ; il migrera vers `cycle_templates` avec FR-17 (décision Sprint 4).

/** Qui regarde : le travailleur (FR-2) ou la conjointe (FR-3, disponibilité seulement). */
export type ViewerRole = "worker" | "spouse";

export interface GlanceViewProps {
  readonly role: ViewerRole;
  readonly team: Team;
  readonly exceptions: readonly ScheduleException[];
  readonly sleepDefault: SleepWindow | null;
  /**
   * « Aujourd'hui » rendu par le serveur, recalé sur l'horloge du CLIENT au montage —
   * indispensable hors-ligne (page servie du cache) et au passage de minuit.
   */
  readonly initialToday: string;
}

const t = fr.horaire;

// Reconnaissance > rappel (NFR-12) : un statut = une couleur + un pictogramme + un mot.
const STATUS_STYLE: Record<WorkerStatus, { readonly color: string; readonly icon: string }> = {
  jour: { color: "bg-amber-400 text-amber-950", icon: "☀️" },
  nuit: { color: "bg-indigo-600 text-indigo-50", icon: "🌙" },
  conge: { color: "bg-emerald-500 text-emerald-950", icon: "🏠" },
  sommeil: { color: "bg-violet-600 text-violet-50", icon: "😴" },
};

function statusLabel(role: ViewerRole, status: WorkerStatus): string {
  if (role === "spouse") {
    const s = spouseStatus(status);
    if (s === "travaille") {
      return t.statutTravaille;
    }
    return s === "disponible" ? t.statutDisponible : t.statutSommeil;
  }
  switch (status) {
    case "jour":
      return t.statutJour;
    case "nuit":
      return t.statutNuit;
    case "sommeil":
      return t.statutSommeil;
    default:
      return t.statutConge;
  }
}

/** Heures à afficher sous la pastille : quart (gabarit) ou fenêtre de sommeil. */
function hoursLabel(day: DayOverview): string | null {
  if (day.status === "jour") {
    return `${GRANDFORD_CYCLE.dayHours.start} – ${GRANDFORD_CYCLE.dayHours.end}`;
  }
  if (day.status === "nuit") {
    return `${GRANDFORD_CYCLE.nightHours.start} – ${GRANDFORD_CYCLE.nightHours.end}`;
  }
  if (day.status === "sommeil" && day.sleepWindow !== null) {
    return `${day.sleepWindow.start} – ${day.sleepWindow.end}`;
  }
  return null;
}

function longDateLabel(date: string): string {
  const civil = parseCivilDate(date);
  const weekday = t.joursLongs[weekdayIndex(civil)] ?? "";
  const month = t.moisLongs[civil.month - 1] ?? "";
  return `${weekday} ${civil.day} ${month}`;
}

function legendEntries(
  role: ViewerRole,
): { readonly status: WorkerStatus; readonly label: string }[] {
  if (role === "spouse") {
    return [
      { status: "jour", label: t.legendeTravailleJour },
      { status: "nuit", label: t.legendeTravailleNuit },
      { status: "conge", label: t.legendeDisponible },
      { status: "sommeil", label: t.legendeSommeil },
    ];
  }
  return [
    { status: "jour", label: t.legendeJour },
    { status: "nuit", label: t.legendeNuit },
    { status: "conge", label: t.legendeConge },
    { status: "sommeil", label: t.legendeSommeil },
  ];
}

export function GlanceView({
  role,
  team,
  exceptions,
  sleepDefault,
  initialToday,
}: GlanceViewProps) {
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    setToday(todayInToronto(new Date()));
  }, []);

  // Fenêtre affichée : le mois courant + la bande de 7 jours (qui peut le déborder).
  const monthEnd = lastOfMonth(today);
  const weekEnd = addDays(today, 6);
  const days = new Map(
    overviewRange({
      team,
      from: firstOfMonth(today),
      to: weekEnd > monthEnd ? weekEnd : monthEnd,
      template: GRANDFORD_CYCLE,
      exceptions,
      sleepDefault,
    }).map((day) => [day.date, day]),
  );
  const todayOverview = days.get(today);
  if (todayOverview === undefined) {
    return null; // impossible : aujourd'hui est toujours dans la fenêtre calculée
  }
  const todayStyle = STATUS_STYLE[todayOverview.status];
  const todayHours = hoursLabel(todayOverview);
  const monthName = t.moisLongs[parseCivilDate(today).month - 1] ?? "";

  return (
    <div className="flex flex-col gap-6">
      {/* Pastille Aujourd'hui : l'information n° 1, lisible en < 2 s (NFR-1). */}
      <section aria-label={t.aujourdHui}>
        <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          {t.aujourdHui} — {longDateLabel(today)}
        </p>
        <div
          className={`mt-2 flex flex-col items-center gap-1 rounded-3xl px-6 py-10 ${todayStyle.color}`}
        >
          <span className="text-5xl" aria-hidden>
            {todayStyle.icon}
          </span>
          <span className="text-5xl font-black tracking-tight">
            {statusLabel(role, todayOverview.status)}
          </span>
          {todayHours !== null ? (
            <span className="text-xl font-semibold opacity-80">{todayHours}</span>
          ) : null}
          {todayOverview.hasException ? (
            <span className="mt-2 rounded-full bg-neutral-950/20 px-3 py-1 text-sm font-semibold">
              {t.ecart}
            </span>
          ) : null}
        </div>
      </section>

      <section aria-label={t.cetteSemaine} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          {t.cetteSemaine}
        </h2>
        <ul className="grid grid-cols-7 gap-1">
          {nextDates(today, 7).map((date) => {
            const day = days.get(date);
            if (day === undefined) {
              return null;
            }
            const civil = parseCivilDate(date);
            return (
              <li key={date} className="flex flex-col items-center gap-1">
                <span className="text-xs text-neutral-400">
                  {t.joursCourts[weekdayIndex(civil)]}
                </span>
                <span
                  aria-label={`${longDateLabel(date)} : ${statusLabel(role, day.status)}`}
                  className={`flex h-12 w-full flex-col items-center justify-center rounded-lg text-lg ${STATUS_STYLE[day.status].color}`}
                >
                  <span aria-hidden>{STATUS_STYLE[day.status].icon}</span>
                  <span className="text-xs font-bold">{civil.day}</span>
                </span>
                {day.hasException ? (
                  <span aria-hidden className="text-xs leading-none text-neutral-300">
                    •
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={t.ceMoisCi} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          {t.ceMoisCi} — {monthName}
        </h2>
        <div className="grid grid-cols-7 gap-1">
          {t.joursCourts.map((letter, i) => (
            <span
              // WHY index : « M » apparaît deux fois (mardi/mercredi), la lettre seule n'est pas unique.
              key={`entete-${i.toString()}`}
              className="text-center text-xs text-neutral-500"
            >
              {letter}
            </span>
          ))}
          {monthGrid(today)
            .flat()
            .map((date, i) => {
              if (date === null) {
                return <span key={`vide-${i.toString()}`} />;
              }
              const day = days.get(date);
              if (day === undefined) {
                return <span key={date} />;
              }
              return (
                <span
                  key={date}
                  aria-label={`${longDateLabel(date)} : ${statusLabel(role, day.status)}`}
                  className={`relative flex h-9 items-center justify-center rounded-md text-sm font-bold ${STATUS_STYLE[day.status].color} ${
                    date === today ? "ring-2 ring-white" : ""
                  }`}
                >
                  {parseCivilDate(date).day}
                  {day.hasException ? (
                    <span aria-hidden className="absolute right-0.5 top-0 text-xs">
                      •
                    </span>
                  ) : null}
                </span>
              );
            })}
        </div>
        <ul className="mt-1 flex flex-wrap gap-3">
          {legendEntries(role).map(({ status, label }) => (
            <li key={status} className="flex items-center gap-1 text-xs text-neutral-300">
              <span
                aria-hidden
                className={`inline-block h-3 w-3 rounded-sm ${STATUS_STYLE[status].color}`}
              />
              {label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
