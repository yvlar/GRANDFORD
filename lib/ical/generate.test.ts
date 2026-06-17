import { createHmac } from "node:crypto";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import { describe, expect, it } from "vitest";
import {
  type IcalException,
  generateIcalSpouse,
  generateIcalWorker,
  signIcalToken,
  verifyIcalToken,
} from "./generate";

const SECRET = "test-secret-ical-32-chars-minimum!";

// ────────────────────────── Tokens HMAC ──────────────────────────

describe("signIcalToken / verifyIcalToken", () => {
  it("signe et vérifie un token worker", () => {
    const token = signIcalToken("hh-uuid-123", "worker", SECRET);
    const result = verifyIcalToken(token, SECRET);
    expect(result).toEqual({ householdId: "hh-uuid-123", role: "worker" });
  });

  it("signe et vérifie un token spouse", () => {
    const token = signIcalToken("hh-uuid-456", "spouse", SECRET);
    const result = verifyIcalToken(token, SECRET);
    expect(result).toEqual({ householdId: "hh-uuid-456", role: "spouse" });
  });

  it("rejette un token trafiqué (payload modifié)", () => {
    const token = signIcalToken("hh-uuid-123", "worker", SECRET);
    // Modifier le payload (avant le dernier '.')
    const dotIdx = token.lastIndexOf(".");
    const tampered = `${Buffer.from("hh-uuid-999:worker").toString("base64url")}.${token.slice(dotIdx + 1)}`;
    expect(verifyIcalToken(tampered, SECRET)).toBeNull();
  });

  it("rejette un token trafiqué (mac modifié)", () => {
    const token = signIcalToken("hh-uuid-123", "worker", SECRET);
    const dotIdx = token.lastIndexOf(".");
    const tampered = `${token.slice(0, dotIdx)}.AAAAAAAAAAAAAAAAAAAAAA`;
    expect(verifyIcalToken(tampered, SECRET)).toBeNull();
  });

  it("rejette un token sans point", () => {
    expect(verifyIcalToken("notavalidtoken", SECRET)).toBeNull();
  });

  it("rejette un rôle inconnu encodé dans le token", () => {
    // Forger un payload avec un rôle invalide mais un bon MAC
    const payload = "hh-uuid-123:admin";
    const mac = createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 22);
    const forged = `${Buffer.from(payload).toString("base64url")}.${mac}`;
    expect(verifyIcalToken(forged, SECRET)).toBeNull();
  });
});

// ────────────────────────── Golden — moteur ──────────────────────────

describe("generateIcalWorker — golden moteur", () => {
  it("le 3 juin 2026, l'équipe A a un quart de jour (golden intouchable)", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("20260603");
    expect(ics).toContain("Quart de jour");
  });

  it("le 5 juin 2026, l'équipe A n'est PAS en quart (B/D travaille)", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-06-05", "2026-06-05");
    // Pas d'événement pour un jour off sans écart
    expect(ics).not.toContain("SUMMARY");
  });

  it("le 3 juin 2026 avec exception 'off' → 'Absent', JAMAIS le motif (R7)", () => {
    // June 3 = A travaille normalement (golden). Avec un écart 'off', on affiche "Absent" uniquement.
    const exc: IcalException[] = [{ on_date: "2026-06-03", effect: "off", shift: null }];
    const ics = generateIcalWorker("A", exc, GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("Absent");
    expect(ics).not.toContain("congé");
    expect(ics).not.toContain("conge");
    expect(ics).not.toContain("maladie");
  });

  it("le 25 décembre 2026, l'équipe A travaille de jour (golden intouchable)", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-12-25", "2026-12-25");
    expect(ics).toContain("20261225");
    expect(ics).toContain("Quart de jour");
  });
});

// ────────────────────────── R7 — zéro motif ──────────────────────────

describe("R7 — aucun motif dans les fichiers .ics", () => {
  const MOTIFS = ["maladie", "conge", "congé", "formation", "vacances", "echange", "ot"];
  const exceptions: IcalException[] = [
    { on_date: "2026-06-03", effect: "off", shift: null },
    { on_date: "2026-06-04", effect: "working_extra", shift: "jour" },
    { on_date: "2026-06-07", effect: "shift_swap", shift: "nuit" },
  ];

  it("le .ics travailleur ne contient aucun motif", () => {
    const ics = generateIcalWorker("A", exceptions, GRANDFORD_CYCLE, "2026-06-03", "2026-06-10");
    for (const motif of MOTIFS) {
      expect(ics.toLowerCase()).not.toContain(motif);
    }
  });

  it("le .ics conjointe ne contient aucun motif", () => {
    const ics = generateIcalSpouse("A", exceptions, GRANDFORD_CYCLE, "2026-06-03", "2026-06-10");
    for (const motif of MOTIFS) {
      expect(ics.toLowerCase()).not.toContain(motif);
    }
  });
});

// ────────────────────────── Conjointe — libellés génériques ──────────────────────────

describe("generateIcalSpouse", () => {
  it("un jour de quart normal → libellé générique 'Partenaire en quart'", () => {
    const ics = generateIcalSpouse("A", [], GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("Partenaire en quart");
    // Jamais le détail privé du travailleur (nom d'équipe, motif)
    expect(ics).not.toContain("SUMMARY:Quart");
  });

  it("un jour off avec écart 'off' → 'Partenaire disponible' (jamais le motif, R7)", () => {
    const exc: IcalException[] = [{ on_date: "2026-06-03", effect: "off", shift: null }];
    const ics = generateIcalSpouse("A", exc, GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("Partenaire disponible");
  });

  it("un jour off sans écart → aucun événement (disponibilité implicite)", () => {
    const ics = generateIcalSpouse("A", [], GRANDFORD_CYCLE, "2026-06-05", "2026-06-05");
    expect(ics).not.toContain("SUMMARY");
  });
});

// ────────────────────────── Format RFC 5545 ──────────────────────────

describe("format RFC 5545", () => {
  it("le fichier commence par BEGIN:VCALENDAR et finit par END:VCALENDAR", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("les lignes sont séparées par CRLF (RFC 5545)", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("\r\n");
  });

  it("chaque VEVENT contient UID, DTSTART, DTEND, SUMMARY", () => {
    const ics = generateIcalWorker("A", [], GRANDFORD_CYCLE, "2026-06-03", "2026-06-03");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:");
    expect(ics).toContain("DTSTART;VALUE=DATE:");
    expect(ics).toContain("DTEND;VALUE=DATE:");
    expect(ics).toContain("SUMMARY:");
    expect(ics).toContain("END:VEVENT");
  });
});
