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

  describe("6. Notes (Sprint 9, FR-8)", () => {
    const insertNoteA = () =>
      asUser(FIX.workerA, (client) =>
        client.query(
          "insert into public.notes (household_id, author_id, on_date, body) values ($1, $2, '2026-07-01', 'réunion famille')",
          [FIX.householdA, FIX.workerA],
        ),
      );

    it("le membre foyer A voit ses propres notes", async () => {
      await insertNoteA();
      const rows = await queryAs<{ n: number }>(
        FIX.workerA,
        "select count(*)::int as n from public.notes where household_id = $1",
        [FIX.householdA],
      );
      expect(rows[0]?.n).toBe(1);
    });

    it("la conjointe du même foyer voit aussi la note (partagée dans le foyer)", async () => {
      await insertNoteA();
      const rows = await queryAs<{ body: string }>(
        FIX.spouseA,
        "select body from public.notes where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.body).toBe("réunion famille");
    });

    it("un membre du foyer B ne lit jamais les notes du foyer A", async () => {
      await insertNoteA();
      const rows = await queryAs(
        FIX.workerB,
        "select id from public.notes where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe("7. Gabarits de cycle (Sprint 13, FR-17)", () => {
    it("un membre du foyer A ne lit jamais le gabarit du foyer B", async () => {
      const rows = await queryAs(
        FIX.workerA,
        "select id from public.cycle_templates where household_id = $1",
        [FIX.householdB],
      );
      expect(rows).toHaveLength(0);
    });

    it("un membre du foyer A voit son propre gabarit (anchor_date correcte)", async () => {
      // WHY ::text : pg sérialise les colonnes `date` en Date JS ; on compare en texte.
      const rows = await queryAs<{ anchor_date: string }>(
        FIX.workerA,
        "select anchor_date::text from public.cycle_templates where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.anchor_date).toBe("2026-06-03");
    });

    it("la conjointe voit le gabarit de son foyer (template partagé dans le foyer)", async () => {
      const rows = await queryAs<{ anchor_date: string }>(
        FIX.spouseA,
        "select anchor_date from public.cycle_templates where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(1);
    });

    it("un membre révoqué perd aussitôt l'accès au gabarit", async () => {
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          FIX.spouseA,
        ]),
      );
      const rows = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.cycle_templates",
      );
      expect(rows[0]?.n).toBe(0);
    });
  });

  describe("8. Requêtes (Sprint 9, FR-9)", () => {
    const insertRequestA = () =>
      asUser(FIX.spouseA, (client) =>
        client.query(
          "insert into public.requests (household_id, requester_id, target_profile_id, on_date, body) values ($1, $2, $3, '2026-07-01', 'es-tu libre ?')",
          [FIX.householdA, FIX.spouseA, FIX.workerA],
        ),
      );

    it("les membres du foyer A voient les requêtes du foyer A", async () => {
      await insertRequestA();
      const rows = await queryAs<{ n: number }>(
        FIX.workerA,
        "select count(*)::int as n from public.requests where household_id = $1",
        [FIX.householdA],
      );
      expect(rows[0]?.n).toBe(1);
    });

    it("un membre du foyer B ne lit jamais les requêtes du foyer A", async () => {
      await insertRequestA();
      const rows = await queryAs(
        FIX.workerB,
        "select id from public.requests where household_id = $1",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(0);
    });

    it("la conjointe ne peut pas modifier le statut d'une requête (UPDATE réservé au travailleur cible)", async () => {
      await insertRequestA();
      const reqRows = await queryAs<{ id: string }>(
        FIX.workerA,
        "select id from public.requests where household_id = $1",
        [FIX.householdA],
      );
      const reqId = reqRows[0]?.id;
      expect(reqId).toBeTruthy();

      // La conjointe tente de s'auto-approuver : doit être refusé (0 lignes modifiées).
      const result = await asUser(FIX.spouseA, async (client) => {
        const res = await client.query(
          "update public.requests set status = 'approved' where id = $1",
          [reqId],
        );
        return res.rowCount;
      });
      expect(result).toBe(0);

      // Vérifier que le statut est resté 'pending'.
      const check = await queryAs<{ status: string }>(
        FIX.workerA,
        "select status from public.requests where id = $1",
        [reqId],
      );
      expect(check[0]?.status).toBe("pending");
    });

    it("le travailleur cible peut approuver la requête", async () => {
      await insertRequestA();
      const reqRows = await queryAs<{ id: string }>(
        FIX.workerA,
        "select id from public.requests where household_id = $1",
        [FIX.householdA],
      );
      const reqId = reqRows[0]?.id;
      await asUser(FIX.workerA, (client) =>
        client.query("update public.requests set status = 'approved' where id = $1", [reqId]),
      );
      const check = await queryAs<{ status: string }>(
        FIX.workerA,
        "select status from public.requests where id = $1",
        [reqId],
      );
      expect(check[0]?.status).toBe("approved");
    });
  });

  describe("9. Gabarit — contrôle propriétaire (Sprint 14, FR-17)", () => {
    it("la conjointe ne peut pas modifier le gabarit du foyer (0 lignes modifiées)", async () => {
      const rowCount = await asUser(FIX.spouseA, async (client) => {
        const res = await client.query(
          "update public.cycle_templates set name = 'Hacked' where household_id = $1 and is_active = true",
          [FIX.householdA],
        );
        return res.rowCount;
      });
      expect(rowCount).toBe(0);

      // Le nom est resté inchangé — la RLS a protégé la ligne.
      const check = await queryAs<{ name: string }>(
        FIX.workerA,
        "select name from public.cycle_templates where household_id = $1 and is_active = true",
        [FIX.householdA],
      );
      expect(check[0]?.name).toBe("Pitman 2-2-3");
    });

    it("le propriétaire peut modifier le gabarit (UPDATE sous RLS owner)", async () => {
      await asUser(FIX.workerA, (client) =>
        client.query(
          "update public.cycle_templates set name = 'Pitman 2-2-3 (alt.)' where household_id = $1 and is_active = true",
          [FIX.householdA],
        ),
      );
      const check = await queryAs<{ name: string }>(
        FIX.workerA,
        "select name from public.cycle_templates where household_id = $1 and is_active = true",
        [FIX.householdA],
      );
      expect(check[0]?.name).toBe("Pitman 2-2-3 (alt.)");
    });

    it("la conjointe lit toujours le gabarit après l'affinage RLS", async () => {
      const rows = await queryAs<{ name: string }>(
        FIX.spouseA,
        "select name from public.cycle_templates where household_id = $1 and is_active = true",
        [FIX.householdA],
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("8. audit_log (Sprint 12, FR-13)", () => {
    const insertAuditEntry = (userId: string, householdId: string) =>
      asUser(userId, (client) =>
        client.query(
          `insert into public.audit_log (household_id, actor_id, action, entity, entity_id, metadata)
           values ($1, $2, 'exception_created', 'exception', 'test-id',
                   jsonb_build_object('on_date', '2026-07-15', 'effect', 'off', 'shift', null))`,
          [householdId, userId],
        ),
      );

    it("un membre du foyer A lit SES entrées audit_log et 0 entrée du foyer B", async () => {
      await insertAuditEntry(FIX.workerA, FIX.householdA);
      await insertAuditEntry(FIX.workerB, FIX.householdB);

      const rows = await queryAs<{ n: number }>(
        FIX.workerA,
        "select count(*)::int as n from public.audit_log where household_id = $1",
        [FIX.householdA],
      );
      expect(rows[0]?.n).toBeGreaterThan(0);

      // Aucune entrée du foyer B ne filtre vers le foyer A.
      const fuite = await queryAs(
        FIX.workerA,
        "select id from public.audit_log where household_id = $1",
        [FIX.householdB],
      );
      expect(fuite).toHaveLength(0);
    });

    it("la metadata d'une entrée audit_log ne contient aucun champ motif (R7)", async () => {
      await insertAuditEntry(FIX.workerA, FIX.householdA);

      const rows = await queryAs<{ metadata: Record<string, unknown> }>(
        FIX.workerA,
        "select metadata from public.audit_log where household_id = $1 limit 10",
        [FIX.householdA],
      );
      for (const row of rows) {
        const keys = Object.keys(row.metadata);
        expect(keys).not.toContain("motif");
        expect(keys).not.toContain("reason");
        expect(keys).not.toContain("maladie");
        expect(keys).not.toContain("note_privee");
      }
    });

    it("supprimer une exception (authentifié) déclenche le trigger et crée une entrée avec actor_id correct", async () => {
      // Intégration trigger : chemin réel authenticated → DELETE exceptions → trigger → audit_log.
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.exceptions where id = $1 and profile_id = $2", [
          FIX.exceptionA,
          FIX.workerA,
        ]),
      );

      const rows = await queryAs<{
        action: string;
        actor_id: string;
        metadata: Record<string, unknown>;
      }>(
        FIX.workerA,
        "select action, actor_id::text, metadata from public.audit_log where household_id = $1 and entity_id = $2 order by created_at desc limit 1",
        [FIX.householdA, FIX.exceptionA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.action).toBe("exception_deleted");
      expect(rows[0]?.actor_id).toBe(FIX.workerA);
      // R7 : aucun motif dans la metadata même dans le chemin trigger.
      expect(Object.keys(rows[0]?.metadata ?? {})).not.toContain("motif");
    });

    it("un membre révoqué obtient 0 entrée audit_log", async () => {
      await insertAuditEntry(FIX.workerA, FIX.householdA);

      // Révocation de la conjointe.
      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          FIX.spouseA,
        ]),
      );

      const rows = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.audit_log",
      );
      expect(rows[0]?.n).toBe(0);
    });
  });
});
