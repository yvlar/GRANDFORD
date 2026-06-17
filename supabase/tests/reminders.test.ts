import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { reminderSchedule } from "../../lib/notifications/echeances";
import { addDays } from "../../lib/schedule/status";
import { FIX, asAdmin, asUser, closePool, queryAs, seed } from "./helpers";

// Sprint 7 (FR-10) — le pipeline de rappels au niveau BD :
//  1. la RPC de capture matérialise les échéances (parité stricte avec la couche
//     pure lib/notifications/echeances.ts) ;
//  2. la suppression de l'écart emporte ses rappels (cascade, 0 orphelin) ;
//  3. isolation RLS : rappels = foyer entier (bidirectionnel), jamais l'autre
//     foyer ; push_subscriptions = appareils strictement personnels.
// Les dates sont relatives à AUJOURD'HUI (la règle d'échéance dépend de now()) —
// jamais de date en dur ici, sinon la suite pourrirait avec le calendrier.

const rlsAvailable = inject("rlsAvailable");

/** Le « aujourd'hui » EXACT de la RPC : date civile America/Toronto, lue en BD. */
async function todayToronto(): Promise<string> {
  const rows = await asAdmin(async (client) => {
    const res = await client.query<{ today: string }>(
      "select to_char(now() at time zone 'America/Toronto', 'YYYY-MM-DD') as today",
    );
    return res.rows;
  });
  const today = rows[0]?.today;
  if (!today) {
    throw new Error("date du jour introuvable");
  }
  return today;
}

/** Capture un écart « off » via la RPC en tant que workerA, renvoie son id. */
async function captureAt(onDate: string): Promise<string> {
  const rows = await queryAs<{ id: string }>(
    FIX.workerA,
    "select public.create_exception_with_motif($1, $2, 'off', 'conge') as id",
    [FIX.householdA, onDate],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("la RPC n'a pas renvoyé d'id");
  }
  return id;
}

interface ReminderRow {
  lead: string;
  channel: string;
  profile_id: string | null;
  sent_at: string | null;
  local_at: string;
}

/** Les rappels d'un écart, vus par `userId`, à l'heure locale du foyer. */
async function remindersOf(userId: string, exceptionId: string): Promise<ReminderRow[]> {
  return queryAs<ReminderRow>(
    userId,
    `select lead, channel, profile_id, sent_at,
            to_char(remind_at at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') as local_at
     from public.reminders where exception_id = $1 order by remind_at`,
    [exceptionId],
  );
}

describe.skipIf(!rlsAvailable)("Rappels — génération à la capture (Sprint 7)", () => {
  beforeEach(async () => {
    await seed();
    // L'écart ensemencé de workerA est à une date FIXE (2026-06-15) alors que nos
    // captures sont relatives à aujourd'hui : selon le jour d'exécution, n'importe
    // quel J+n pourrait le percuter (unique par travailleur/jour → GF005). On
    // libère le terrain — ces tests ne dépendent pas de cette fixture.
    await asAdmin((client) =>
      client.query("delete from public.exceptions where id = $1", [FIX.exceptionA]),
    );
  });
  afterAll(closePool);

  it("un écart à J+40 génère 3 rappels (mois/semaine/veille) à 09:00 locale, aux dates de la couche pure", async () => {
    const today = await todayToronto();
    const onDate = addDays(today, 40);
    const id = await captureAt(onDate);

    const rows = await remindersOf(FIX.workerA, id);
    expect(rows.map((r) => ({ lead: r.lead, date: r.local_at.slice(0, 10) }))).toEqual([
      ...reminderSchedule(onDate, today),
    ]);
    for (const row of rows) {
      expect(row.local_at.slice(11)).toBe("09:00");
      expect(row.profile_id).toBeNull(); // destinataire = tout le foyer (bidirectionnel)
      expect(row.channel).toBe("push");
      expect(row.sent_at).toBeNull();
    }
    expect(rows.map((r) => r.lead)).toEqual(["month", "week", "day"]);
  });

  it("un écart à J+3 ne génère que la veille (les échéances déjà passées sont omises)", async () => {
    const today = await todayToronto();
    const id = await captureAt(addDays(today, 3));
    const rows = await remindersOf(FIX.workerA, id);
    expect(rows.map((r) => r.lead)).toEqual(["day"]);
    expect(rows[0]?.local_at).toBe(`${addDays(today, 2)} 09:00`);
  });

  it("un écart demain ou aujourd'hui ne génère aucun rappel (rien de strictement futur)", async () => {
    const today = await todayToronto();
    expect(await remindersOf(FIX.workerA, await captureAt(addDays(today, 1)))).toHaveLength(0);
    expect(await remindersOf(FIX.workerA, await captureAt(today))).toHaveLength(0);
  });

  it("parité SQL ↔ TS sur le balayage des bords (J+0 à J+9, J+29 à J+32)", async () => {
    const today = await todayToronto();
    const horizons = [...Array.from({ length: 10 }, (_, i) => i), 29, 30, 31, 32];
    for (const n of horizons) {
      const onDate = addDays(today, n);
      const rows = await remindersOf(FIX.workerA, await captureAt(onDate));
      expect(rows.map((r) => ({ lead: r.lead, date: r.local_at.slice(0, 10) }))).toEqual([
        ...reminderSchedule(onDate, today),
      ]);
    }
  });

  it("supprimer l'écart supprime ses rappels (cascade, 0 orphelin)", async () => {
    const today = await todayToronto();
    const id = await captureAt(addDays(today, 40));
    expect(await remindersOf(FIX.workerA, id)).toHaveLength(3);

    await asUser(FIX.workerA, (client) =>
      client.query("delete from public.exceptions where id = $1 and profile_id = $2", [
        id,
        FIX.workerA,
      ]),
    );

    const orphelins = await asAdmin(async (client) => {
      const res = await client.query<{ n: number }>(
        "select count(*)::int as n from public.reminders where exception_id = $1",
        [id],
      );
      return res.rows;
    });
    expect(orphelins[0]?.n).toBe(0);
  });

  describe("isolation RLS des rappels", () => {
    it("la conjointe du foyer voit les rappels (le rappel est bidirectionnel, FR-10)", async () => {
      const today = await todayToronto();
      const id = await captureAt(addDays(today, 40));
      expect(await remindersOf(FIX.spouseA, id)).toHaveLength(3);
    });

    it("un membre d'un autre foyer ne voit jamais les rappels du foyer A", async () => {
      const today = await todayToronto();
      const id = await captureAt(addDays(today, 40));
      expect(await remindersOf(FIX.workerB, id)).toHaveLength(0);
    });

    it("un membre révoqué perd aussitôt l'accès aux rappels", async () => {
      const today = await todayToronto();
      const id = await captureAt(addDays(today, 40));
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          FIX.spouseA,
        ]),
      );
      expect(await remindersOf(FIX.spouseA, id)).toHaveLength(0);
    });

    it("les rappels ne portent structurellement aucun motif (pas de colonne, pas de jointure possible)", async () => {
      // La table n'a pas de colonne motif ; et même en tentant la jointure vers
      // exception_private, la conjointe obtient 0 ligne (policy propriétaire seul).
      const today = await todayToronto();
      const id = await captureAt(addDays(today, 40));
      const fuite = await queryAs(
        FIX.spouseA,
        `select p.motif from public.reminders r
         join public.exception_private p on p.exception_id = r.exception_id
         where r.exception_id = $1`,
        [id],
      );
      expect(fuite).toHaveLength(0);
    });
  });
});

describe.skipIf(!rlsAvailable)("Rappels — génération via trigger (Sprint 9)", () => {
  beforeEach(async () => {
    await seed();
    // Libérer l'exception seed de workerA (date fixe 2026-06-15) pour les tests relatifs.
    await asAdmin((client) =>
      client.query("delete from public.exceptions where id = $1", [FIX.exceptionA]),
    );
  });
  afterAll(closePool);

  it("INSERT direct dans exceptions à J+40 génère 3 rappels via trigger (sans passer par la RPC)", async () => {
    const today = await todayToronto();
    const onDate = addDays(today, 40);
    const exId = "e9999999-9999-4999-8999-999999999901";

    await asUser(FIX.workerA, (client) =>
      client.query(
        "insert into public.exceptions (id, household_id, profile_id, on_date, effect, created_by) values ($1, $2, $3, $4, 'off', $3)",
        [exId, FIX.householdA, FIX.workerA, onDate],
      ),
    );

    const rows = await remindersOf(FIX.workerA, exId);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.lead)).toEqual(["month", "week", "day"]);
    // Parité avec la couche pure.
    expect(rows.map((r) => ({ lead: r.lead, date: r.local_at.slice(0, 10) }))).toEqual([
      ...reminderSchedule(onDate, today),
    ]);
  });

  it("INSERT direct dans exceptions à J-1 ne génère aucun rappel (trigger respecte la borne future)", async () => {
    const today = await todayToronto();
    const onDate = addDays(today, -1);
    const exId = "e9999999-9999-4999-8999-999999999902";

    await asAdmin((client) =>
      client.query(
        "insert into public.exceptions (id, household_id, profile_id, on_date, effect, created_by) values ($1, $2, $3, $4, 'off', $3)",
        [exId, FIX.householdA, FIX.workerA, onDate],
      ),
    );

    const rows = await remindersOf(FIX.workerA, exId);
    expect(rows).toHaveLength(0);
  });

  it("via RPC à J+40 : exactement 3 rappels (pas 6 — 0 doublement RPC + trigger)", async () => {
    const today = await todayToronto();
    const onDate = addDays(today, 40);
    const id = await captureAt(onDate);

    const rows = await remindersOf(FIX.workerA, id);
    expect(rows).toHaveLength(3);
    // Vérifier qu'il n'y a aucun doublon de lead.
    const leads = rows.map((r) => r.lead);
    expect(new Set(leads).size).toBe(leads.length);
  });
});

describe.skipIf(!rlsAvailable)("push_subscriptions — appareils strictement personnels", () => {
  beforeEach(seed);
  afterAll(closePool);

  const ENDPOINT = "https://push.example/abo-worker-a";

  async function subscribeWorkerA(): Promise<void> {
    await asUser(FIX.workerA, (client) =>
      client.query(
        `insert into public.push_subscriptions (household_id, profile_id, endpoint, p256dh, auth_key)
         values ($1, $2, $3, 'p256dh-factice', 'auth-factice')`,
        [FIX.householdA, FIX.workerA, ENDPOINT],
      ),
    );
  }

  it("chacun gère ses propres appareils : le propriétaire lit son abonnement, personne d'autre", async () => {
    await subscribeWorkerA();
    expect(await queryAs(FIX.workerA, "select id from public.push_subscriptions")).toHaveLength(1);
    // Même la conjointe du MÊME foyer ne voit pas les appareils du travailleur.
    expect(await queryAs(FIX.spouseA, "select id from public.push_subscriptions")).toHaveLength(0);
    expect(await queryAs(FIX.workerB, "select id from public.push_subscriptions")).toHaveLength(0);
  });

  it("impossible d'abonner un appareil au nom d'un autre (with check profile_id = soi)", async () => {
    await expect(
      asUser(FIX.spouseA, (client) =>
        client.query(
          `insert into public.push_subscriptions (household_id, profile_id, endpoint, p256dh, auth_key)
           values ($1, $2, 'https://push.example/usurpe', 'x', 'y')`,
          [FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("ré-abonner le même endpoint remplace les clés (upsert, pas de doublon)", async () => {
    await subscribeWorkerA();
    await asUser(FIX.workerA, (client) =>
      client.query(
        `insert into public.push_subscriptions (household_id, profile_id, endpoint, p256dh, auth_key)
         values ($1, $2, $3, 'p256dh-tournee', 'auth-tournee')
         on conflict (endpoint) do update set p256dh = excluded.p256dh, auth_key = excluded.auth_key`,
        [FIX.householdA, FIX.workerA, ENDPOINT],
      ),
    );
    const rows = await queryAs<{ p256dh: string }>(
      FIX.workerA,
      "select p256dh from public.push_subscriptions where endpoint = $1",
      [ENDPOINT],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.p256dh).toBe("p256dh-tournee");
  });

  it("un membre révoqué garde la main sur SES abonnements mais plus rien du foyer", async () => {
    // L'abonnement est personnel (profile_id = soi) : la révocation du foyer ne doit
    // pas l'orpheliner silencieusement — l'usager peut toujours le supprimer.
    await asUser(FIX.spouseA, (client) =>
      client.query(
        `insert into public.push_subscriptions (household_id, profile_id, endpoint, p256dh, auth_key)
         values ($1, $2, 'https://push.example/abo-spouse-a', 'p', 'a')`,
        [FIX.householdA, FIX.spouseA],
      ),
    );
    await asUser(FIX.workerA, (client) =>
      client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
        FIX.householdA,
        FIX.spouseA,
      ]),
    );
    const suppression = await asUser(FIX.spouseA, (client) =>
      client.query("delete from public.push_subscriptions where profile_id = $1", [FIX.spouseA]),
    );
    expect(suppression.rowCount).toBe(1);
  });
});
