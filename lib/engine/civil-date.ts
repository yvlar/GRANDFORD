// Arithmétique de date civile PURE — sans objet Date, sans fuseau horaire.
// WHY: un quart de nuit appartient à sa date de début (America/Toronto). Passer par
// `new Date()` exposerait le moteur aux décalages d'heure d'été (jours de 23 h / 25 h) et
// au fuseau du runtime. On compte donc les jours avec l'algorithme de Howard Hinnant
// (jours depuis l'époque 1970-01-01), entièrement déterministe et indépendant de l'horloge.

export interface CivilDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse strict d'une date civile 'YYYY-MM-DD'. Lève sur format ou valeur invalide. */
export function parseCivilDate(iso: string): CivilDate {
  const match = ISO_DATE.exec(iso);
  if (match === null) {
    throw new RangeError(`Date civile invalide (format attendu AAAA-MM-JJ) : ${iso}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // WHY: plancher à 1970 (l'époque du comptage de jours). Aucune planification d'usine n'est
  // antérieure, et l'inverse daysToCivil n'est démontré fiable que dans l'ère positive.
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Date civile hors domaine (≥ 1970) ou inexistante : ${iso}`);
  }
  return { year, month, day };
}

/** Formate une date civile en 'YYYY-MM-DD' (zéros de tête). */
export function formatCivilDate(date: CivilDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Jours depuis 1970-01-01 (algorithme days_from_civil de Hinnant). */
export function civilToDays({ year, month, day }: CivilDate): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Inverse de civilToDays (algorithme civil_from_days de Hinnant). */
export function daysToCivil(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: month <= 2 ? year + 1 : year, month, day };
}

/** Modulo MATHÉMATIQUE : résultat toujours dans [0, m). Gère les dates avant l'ancre. */
export function mathMod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Indice du jour de semaine (0 = dimanche … 6 = samedi) pour une date civile. */
export function weekdayIndex(date: CivilDate): number {
  // WHY: 1970-01-01 (jour 0) est un jeudi → décalage +4 pour ancrer dimanche = 0.
  return mathMod(civilToDays(date) + 4, 7);
}

function daysInMonth(year: number, month: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1] ?? 31;
}
