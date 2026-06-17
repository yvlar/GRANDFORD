// Génération iCal RFC 5545 — fonctions pures, zéro I/O (FR-14).
// R7 : AUCUN motif ne peut apparaître dans un fichier .ics, ni pour le travailleur ni pour la conjointe.
import { createHmac, timingSafeEqual } from "node:crypto";
import { scheduleRange } from "@/lib/engine";
import type { CycleTemplate, Team } from "@/lib/engine";

export type IcalRole = "worker" | "spouse";

export interface IcalException {
  on_date: string; // 'YYYY-MM-DD'
  effect: "off" | "working" | "working_extra" | "shift_swap";
  shift: "jour" | "nuit" | null;
}

// ────────────────────────── Tokens HMAC ──────────────────────────

/**
 * Signe un token iCal pour un foyer et un rôle.
 * Format : base64url(payload) + '.' + hmac_22chars
 * Le token est mis dans l'URL — pas de table requise (stateless).
 */
export function signIcalToken(householdId: string, role: IcalRole, secret: string): string {
  const payload = `${householdId}:${role}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 22);
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

/**
 * Vérifie un token iCal et retourne household_id + rôle, ou null si invalide.
 * Utilise une comparaison à durée constante (timing-safe).
 */
export function verifyIcalToken(
  token: string,
  secret: string,
): { householdId: string; role: IcalRole } | null {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx < 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const mac = token.slice(dotIdx + 1);

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf-8");
  } catch {
    return null;
  }

  const expectedMac = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 22);
  if (mac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return null;

  const colonIdx = payload.indexOf(":");
  if (colonIdx < 0) return null;
  const householdId = payload.slice(0, colonIdx);
  const role = payload.slice(colonIdx + 1);
  if (role !== "worker" && role !== "spouse") return null;
  return { householdId, role };
}

// ────────────────────────── Génération .ics ──────────────────────────

/** Échappe les caractères spéciaux d'une valeur iCal TEXT (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Formate une date YYYY-MM-DD en format iCal DATE : YYYYMMDD. */
function toIcalDate(date: string): string {
  return date.replace(/-/g, "");
}

/** Formate un VEVENT all-day à partir d'une date civile. */
function formatVevent(date: string, summary: string, uid: string): string {
  const dtStart = toIcalDate(date);
  // DTEND = lendemain pour un événement d'une journée (RFC 5545)
  const nextDay = new Date(`${date}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const dtEnd = nextDay.toISOString().slice(0, 10).replace(/-/g, "");
  // DTSTAMP = instant de génération (RFC 5545 §3.8.7.2) — permet aux clients de détecter les mises à jour.
  const dtstamp = `${new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15)}Z`;

  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}@grandford`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeText(summary)}`,
    "END:VEVENT",
  ].join("\r\n");
}

function buildVcalendar(calName: string, events: string): string {
  const parts = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GRANDFORD//GRANDFORD//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];
  // Ne pas insérer de ligne vide si aucun événement (RFC 5545 n'autorise pas de ligne vide dans VCALENDAR).
  if (events) parts.push(events);
  parts.push("END:VCALENDAR");
  return parts.join("\r\n");
}

/**
 * Génère le calendrier .ics du travailleur : quarts planifiés + écarts.
 * R7 : les résumés n'incluent JAMAIS le motif d'une absence.
 */
export function generateIcalWorker(
  team: Team,
  exceptions: IcalException[],
  template: CycleTemplate,
  from: string,
  to: string,
): string {
  const days = scheduleRange(team, from, to, template);
  const exMap = new Map(exceptions.map((e) => [e.on_date, e]));

  const events: string[] = [];
  for (const day of days) {
    const exc = exMap.get(day.date);

    let summary: string | null;
    if (exc) {
      switch (exc.effect) {
        case "off":
          // R7 : "Absent" uniquement — jamais le motif (maladie, congé, etc.)
          summary = "Absent";
          break;
        case "working":
          summary =
            exc.shift === "nuit"
              ? `En quart de nuit ${template.nightHours.start}–${template.nightHours.end}`
              : `En quart de jour ${template.dayHours.start}–${template.dayHours.end}`;
          break;
        case "working_extra":
          summary =
            exc.shift === "nuit"
              ? `Temps supplémentaire — nuit ${template.nightHours.start}–${template.nightHours.end}`
              : `Temps supplémentaire — jour ${template.dayHours.start}–${template.dayHours.end}`;
          break;
        case "shift_swap":
          summary = "Échange de quart";
          break;
        default:
          summary = null;
      }
    } else if (day.working) {
      summary =
        day.shift === "nuit"
          ? `Quart de nuit ${template.nightHours.start}–${template.nightHours.end}`
          : `Quart de jour ${template.dayHours.start}–${template.dayHours.end}`;
    } else {
      summary = null; // jour off sans écart → pas d'événement
    }

    if (summary !== null) {
      events.push(formatVevent(day.date, summary, `${day.date}-worker-${team}`));
    }
  }

  return buildVcalendar("GRANDFORD — Mon horaire", events.join("\r\n"));
}

/**
 * Génère le calendrier .ics de la conjointe : disponibilité du travailleur, sans motif (R7).
 * Libellés génériques — la conjointe ne sait jamais POURQUOI son partenaire est absent.
 */
export function generateIcalSpouse(
  team: Team,
  exceptions: IcalException[],
  template: CycleTemplate,
  from: string,
  to: string,
): string {
  const days = scheduleRange(team, from, to, template);
  const exMap = new Map(exceptions.map((e) => [e.on_date, e]));

  const events: string[] = [];
  for (const day of days) {
    const exc = exMap.get(day.date);

    let summary: string | null;
    if (exc) {
      switch (exc.effect) {
        case "off":
          // R7 : pas de motif — "Disponible" suffît (le travailleur est absent mais la raison est privée)
          summary = "Partenaire disponible";
          break;
        case "working":
        case "working_extra":
        case "shift_swap":
          summary =
            (exc.shift ?? day.shift) === "nuit"
              ? "Partenaire en quart (nuit)"
              : "Partenaire en quart (jour)";
          break;
        default:
          summary = null;
      }
    } else if (day.working) {
      summary = day.shift === "nuit" ? "Partenaire en quart (nuit)" : "Partenaire en quart (jour)";
    } else {
      summary = null; // jour off sans écart → pas d'événement (partenaire disponible implicitement)
    }

    if (summary !== null) {
      events.push(formatVevent(day.date, summary, `${day.date}-spouse-${team}`));
    }
  }

  return buildVcalendar("GRANDFORD — Horaire du partenaire", events.join("\r\n"));
}
