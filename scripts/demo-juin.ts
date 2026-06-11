// Démonstration (preuve d'acceptation du Sprint 1) : imprime le calendrier de juin 2026.
// Les lignes du 1er au 14 doivent reproduire la table validée —
// docs/analyse/01-decouverte/02-cas-utilisation.md:68-85 (dont 11 juin = A/C au repos).
import {
  GRANDFORD_CYCLE,
  crewsForDate,
  parseCivilDate,
  scheduleRange,
  weekdayIndex,
} from "@/lib/engine";

const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] as const;

function weekdayShort(date: string): string {
  return WEEKDAYS[weekdayIndex(parseCivilDate(date))] ?? "?";
}

function pad(text: string, width: number): string {
  return text.padEnd(width, " ");
}

function main(): void {
  // scheduleRange sert ici d'énumérateur de dates (l'équipe est sans importance).
  const days = scheduleRange("A", "2026-06-01", "2026-06-30", GRANDFORD_CYCLE);

  console.log("Calendrier — juin 2026 (cycle Pitman 2-2-3, ancre 2026-06-03 = A/C)\n");
  console.log(
    `| ${pad("Date", 8)} | ${pad("Jour sem.", 9)} | ${pad("Jour 07-19", 10)} | ${pad("Nuit 19-07", 10)} | ${pad("Au repos", 8)} |`,
  );
  console.log(
    `|${"-".repeat(10)}|${"-".repeat(11)}|${"-".repeat(12)}|${"-".repeat(12)}|${"-".repeat(10)}|`,
  );

  for (const { date } of days) {
    const { dayTeam, nightTeam, restCrew } = crewsForDate(date, GRANDFORD_CYCLE);
    const rest = restCrew === "AC" ? "A/C" : "B/D";
    const label = `${parseCivilDate(date).day} juin`;
    console.log(
      `| ${pad(label, 8)} | ${pad(weekdayShort(date), 9)} | ${pad(dayTeam, 10)} | ${pad(nightTeam, 10)} | ${pad(rest, 8)} |`,
    );
  }
}

main();
