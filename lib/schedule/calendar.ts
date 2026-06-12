import {
  civilToDays,
  daysToCivil,
  formatCivilDate,
  parseCivilDate,
  weekdayIndex,
} from "@/lib/engine";

// Aide-calendrier PURE pour la vue « coup d'œil » : décalages de jours, bornes de mois,
// grille mensuelle alignée dimanche → samedi. Réutilise l'arithmétique civile du moteur
// (consommée, jamais modifiée) — donc aucun objet Date, aucun fuseau implicite.

/** Date civile décalée de `n` jours (n négatif accepté). */
export function addDays(date: string, n: number): string {
  return formatCivilDate(daysToCivil(civilToDays(parseCivilDate(date)) + n));
}

/** Premier jour du mois de `date`. */
export function firstOfMonth(date: string): string {
  const civil = parseCivilDate(date);
  return formatCivilDate({ year: civil.year, month: civil.month, day: 1 });
}

/** Dernier jour du mois de `date` (1er du mois suivant − 1, fiable années bissextiles). */
export function lastOfMonth(date: string): string {
  const civil = parseCivilDate(date);
  const firstOfNext =
    civil.month === 12
      ? { year: civil.year + 1, month: 1, day: 1 }
      : { year: civil.year, month: civil.month + 1, day: 1 };
  return addDays(formatCivilDate(firstOfNext), -1);
}

/** Les `count` dates à partir de `from` inclus (bande « semaine »). */
export function nextDates(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/**
 * Grille du mois de `date` : semaines de 7 cellules (dimanche en premier),
 * `null` pour les cellules hors mois — prête à rendre telle quelle.
 */
export function monthGrid(date: string): (string | null)[][] {
  const first = firstOfMonth(date);
  const last = lastOfMonth(date);
  const leading = weekdayIndex(parseCivilDate(first));
  const dayCount = civilToDays(parseCivilDate(last)) - civilToDays(parseCivilDate(first)) + 1;

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: dayCount }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
