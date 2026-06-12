// Démonstration (preuve d'acceptation du Sprint 4) : la vue « coup d'œil » calculée
// SANS AUCUN réseau ni BD — exactement le chemin du client hors-ligne (NFR-4).
// Points réels validés : 11 juin 2026 = équipe A en CONGÉ ; 25 déc. 2026 = A de JOUR.
import { GRANDFORD_CYCLE } from "@/lib/engine";
import {
  type DayOverview,
  type ScheduleException,
  firstOfMonth,
  lastOfMonth,
  overviewRange,
  spouseStatus,
} from "@/lib/schedule";

const ICONS = {
  jour: "☀️ JOUR   ",
  nuit: "🌙 NUIT   ",
  conge: "🏠 CONGÉ  ",
  sommeil: "😴 SOMMEIL",
} as const;

function pastille(
  team: "A" | "B" | "C" | "D",
  date: string,
  exceptions: ScheduleException[] = [],
): DayOverview {
  const day = overviewRange({
    team,
    from: date,
    to: date,
    template: GRANDFORD_CYCLE,
    exceptions,
    sleepDefault: null,
  })[0];
  if (!day) {
    throw new Error(`aucun jour calculé pour ${date}`);
  }
  return day;
}

function main(): void {
  console.log("— Preuve 1 : pastille du jour sur les points réels validés (équipe A) —");
  for (const date of ["2026-06-11", "2026-12-25"]) {
    const day = pastille("A", date);
    console.log(`  ${date} → ${ICONS[day.status]}`);
  }

  console.log(
    "\n— Preuve 2 : écart « off » le 12 juin 2026 (jour normalement travaillé, équipe A) —",
  );
  const ecart: ScheduleException[] = [{ onDate: "2026-06-12", effect: "off", shift: null }];
  const jourTravailleur = pastille("A", "2026-06-12", ecart);
  console.log(
    `  Vue travailleur : ${ICONS[jourTravailleur.status]} (écart marqué : ${jourTravailleur.hasException})`,
  );
  console.log(`  Vue conjointe   : ${spouseStatus(jourTravailleur.status).toUpperCase()}`);
  console.log(`  Données qui transitent vers la conjointe : ${JSON.stringify(ecart[0])}`);
  console.log("  → aucun champ motif n'existe dans ce type (R7 : il ne peut même pas transiter).");

  console.log("\n— Preuve 3 : mois de juin 2026 complet, calculé sans réseau (équipe A) —");
  const mois = overviewRange({
    team: "A",
    from: firstOfMonth("2026-06-01"),
    to: lastOfMonth("2026-06-01"),
    template: GRANDFORD_CYCLE,
    exceptions: [],
    sleepDefault: null,
  });
  for (const day of mois) {
    console.log(`  ${day.date}  ${ICONS[day.status]}`);
  }
}

main();
