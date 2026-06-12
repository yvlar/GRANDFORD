import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asUser, closePool, queryAs, seed } from "./helpers";

// Tests d'isolation RLS — livrable de 1re classe (R7, .claude/rules/supabase-rls.md).
// Exécutés contre un VRAI Postgres (les policies sont appliquées par le moteur, pas
// simulées). Ignorés proprement si aucune BD n'est disponible (cf. globalSetup).

const rlsAvailable = inject("rlsAvailable");

describe.skipIf(!rlsAvailable)("Isolation RLS (Postgres réel)", () => {
  beforeAll(seed);
  beforeEach(seed);
  afterAll(closePool);

  describe("1. Isolation entre foyers", () => {
    it("un membre du foyer A ne lit jamais les exceptions du foyer B", async () => {
      const rows = await queryAs(
        FIX.workerA,
        "select id from public.exceptions where household_id = $1",
        [FIX.householdB],
      );
      expect(rows).toHaveLength(0);
    });

    it("un membre du foyer A ne voit que son propre foyer", async () => {
      const rows = await queryAs<{ id: string }>(FIX.workerA, "select id from public.households");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(FIX.householdA);
    });

    it("la conjointe du foyer B ne lit jamais les exceptions du foyer A", async () => {
      const rows = await queryAs(
        FIX.spouseB,
        "select id from public.exceptions where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("2. Étanchéité du motif (R7)", () => {
    it("le travailleur propriétaire lit SON propre motif", async () => {
      const rows = await queryAs<{ motif: string }>(
        FIX.workerA,
        "select motif from public.exception_private where exception_id = $1",
        [FIX.exceptionA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.motif).toBe("maladie");
    });

    it("la conjointe voit l'exception (disponibilité) mais JAMAIS le motif", async () => {
      // La disponibilité (présent/absent) est partagée…
      const availability = await queryAs<{ effect: string }>(
        FIX.spouseA,
        "select effect from public.exceptions where id = $1",
        [FIX.exceptionA],
      );
      expect(availability).toHaveLength(1);
      expect(availability[0]?.effect).toBe("off");

      // …mais le motif reste invisible (0 ligne).
      const motif = await queryAs(
        FIX.spouseA,
        "select motif from public.exception_private where exception_id = $1",
        [FIX.exceptionA],
      );
      expect(motif).toHaveLength(0);
    });

    it("la conjointe ne lit AUCUNE ligne de exception_private", async () => {
      const rows = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.exception_private",
      );
      expect(rows[0]?.n).toBe(0);
    });

    it("la conjointe ne peut pas s'attribuer le motif du travailleur (écriture refusée)", async () => {
      // On retire d'abord le motif (en tant que propriétaire) pour isoler la contrainte
      // d'écriture d'un simple conflit de clé primaire.
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.exception_private where exception_id = $1", [
          FIX.exceptionA,
        ]),
      );
      // La conjointe tente de créer un motif à SON nom sur l'exception du travailleur :
      // refusé structurellement (owner_id doit être le travailleur de l'exception parente).
      await expect(
        asUser(FIX.spouseA, (client) =>
          client.query(
            "insert into public.exception_private (exception_id, household_id, owner_id, motif) values ($1, $2, $3, 'maladie')",
            [FIX.exceptionA, FIX.householdA, FIX.spouseA],
          ),
        ),
      ).rejects.toThrow();
    });
  });

  describe("3. Révocation immédiate", () => {
    it("le propriétaire révoque la conjointe, qui perd aussitôt tout accès", async () => {
      // Avant : la conjointe lit bien les exceptions de son foyer.
      const before = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.exceptions",
      );
      expect(before[0]?.n).toBeGreaterThan(0);

      // Le propriétaire (travailleur A) supprime l'adhésion de la conjointe.
      const deleted = await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          FIX.spouseA,
        ]),
      );
      expect(deleted.rowCount).toBe(1);

      // Après : plus aucune exception ni aucun foyer visibles.
      const afterExceptions = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.exceptions",
      );
      expect(afterExceptions[0]?.n).toBe(0);

      const afterHouseholds = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.households",
      );
      expect(afterHouseholds[0]?.n).toBe(0);
    });
  });

  describe("4. Données de la vue « coup d'œil » (Sprint 4)", () => {
    it("la conjointe lit l'équipe du travailleur de SON foyer (vue conjointe, FR-3)", async () => {
      const rows = await queryAs<{ team: string }>(
        FIX.spouseA,
        "select team from public.worker_assignments where household_id = $1 and profile_id = $2",
        [FIX.householdA, FIX.workerA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.team).toBe("A");
    });

    it("un membre d'un autre foyer ne lit jamais l'affectation d'équipe du foyer A", async () => {
      const rows = await queryAs(
        FIX.workerB,
        "select team from public.worker_assignments where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(0);
    });

    it("le travailleur change sa propre équipe (upsert sous RLS)", async () => {
      await asUser(FIX.workerA, (client) =>
        client.query(
          `insert into public.worker_assignments (household_id, profile_id, team)
           values ($1, $2, 'B')
           on conflict (household_id, profile_id) do update set team = excluded.team`,
          [FIX.householdA, FIX.workerA],
        ),
      );
      const rows = await queryAs<{ team: string }>(
        FIX.workerA,
        "select team from public.worker_assignments where household_id = $1 and profile_id = $2",
        [FIX.householdA, FIX.workerA],
      );
      expect(rows[0]?.team).toBe("B");
    });

    it("la conjointe lit la fenêtre de sommeil du travailleur (disponibilité, pas un motif)", async () => {
      await asUser(FIX.workerA, (client) =>
        client.query(
          "insert into public.sleep_defaults (household_id, profile_id, start_time, end_time) values ($1, $2, '07:30', '15:30')",
          [FIX.householdA, FIX.workerA],
        ),
      );
      const rows = await queryAs<{ start_time: string }>(
        FIX.spouseA,
        "select start_time from public.sleep_defaults where household_id = $1 and profile_id = $2",
        [FIX.householdA, FIX.workerA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.start_time).toBe("07:30:00");
    });
  });

  describe("5. Ajustement de sommeil au cas par cas (Sprint 6, FR-6)", () => {
    const insertAdjustment = () =>
      asUser(FIX.workerA, (client) =>
        client.query(
          "insert into public.sleep_adjustments (household_id, profile_id, on_date, start_time, end_time) values ($1, $2, '2026-06-05', '09:00', '13:00')",
          [FIX.householdA, FIX.workerA],
        ),
      );

    it("le travailleur ajuste UN jour (upsert sous RLS) et la conjointe le lit (disponibilité)", async () => {
      await insertAdjustment();
      // Upsert : réajuster le même jour remplace, sans doublon.
      await asUser(FIX.workerA, (client) =>
        client.query(
          `insert into public.sleep_adjustments (household_id, profile_id, on_date, start_time, end_time)
           values ($1, $2, '2026-06-05', '10:00', '14:00')
           on conflict (household_id, profile_id, on_date)
           do update set start_time = excluded.start_time, end_time = excluded.end_time`,
          [FIX.householdA, FIX.workerA],
        ),
      );
      const rows = await queryAs<{ start_time: string }>(
        FIX.spouseA,
        "select start_time from public.sleep_adjustments where household_id = $1 and profile_id = $2 and on_date = '2026-06-05'",
        [FIX.householdA, FIX.workerA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.start_time).toBe("10:00:00");
    });

    it("un membre d'un autre foyer ne lit jamais les ajustements du foyer A", async () => {
      await insertAdjustment();
      const rows = await queryAs(
        FIX.workerB,
        "select id from public.sleep_adjustments where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(0);
    });

    it("un membre révoqué perd aussitôt l'accès aux ajustements", async () => {
      await insertAdjustment();
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          FIX.spouseA,
        ]),
      );
      const rows = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.sleep_adjustments",
      );
      expect(rows[0]?.n).toBe(0);
    });
  });
});
