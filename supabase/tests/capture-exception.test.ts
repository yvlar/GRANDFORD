import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asAdmin, asUser, closePool, queryAs, seed } from "./helpers";

// Tests d'isolation du NOUVEAU chemin d'écriture du Sprint 5 : la RPC
// `create_exception_with_motif` (capture atomique écart + motif) et la suppression
// en cascade. La règle supabase-rls.md l'exige : toute RPC qui touche aux données
// de foyer embarque ses tests d'isolation (R7).

const rlsAvailable = inject("rlsAvailable");

/** Appelle la RPC de capture en tant que `userId`, renvoie l'id de l'écart créé. */
async function captureAs(
  userId: string,
  householdId: string,
  onDate: string,
  effect: string,
  shift: string | null,
  motif: string,
): Promise<string> {
  const rows = await queryAs<{ id: string }>(
    userId,
    "select public.create_exception_with_motif($1, $2, $3, $4, $5) as id",
    [householdId, onDate, effect, motif, shift],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error("la RPC n'a pas renvoyé d'id");
  }
  return id;
}

describe.skipIf(!rlsAvailable)("Capture d'exception — RPC atomique (Sprint 5)", () => {
  beforeEach(seed);
  afterAll(closePool);

  describe("1. Capture par le travailleur (chemin nominal)", () => {
    it("un OT capturé écrit l'écart ET son motif, atomiquement", async () => {
      const id = await captureAs(
        FIX.workerA,
        FIX.householdA,
        "2026-06-20",
        "working_extra",
        "jour",
        "ot",
      );

      const ecart = await queryAs<{ effect: string; shift: string }>(
        FIX.workerA,
        "select effect, shift from public.exceptions where id = $1",
        [id],
      );
      expect(ecart[0]).toEqual({ effect: "working_extra", shift: "jour" });

      const motif = await queryAs<{ motif: string }>(
        FIX.workerA,
        "select motif from public.exception_private where exception_id = $1",
        [id],
      );
      expect(motif[0]?.motif).toBe("ot");
    });

    it("deux écarts le même jour → refus GF005 (un écart par travailleur/jour)", async () => {
      await captureAs(FIX.workerA, FIX.householdA, "2026-06-20", "working_extra", "jour", "ot");
      await expect(
        captureAs(FIX.workerA, FIX.householdA, "2026-06-20", "off", null, "maladie"),
      ).rejects.toMatchObject({ code: "GF005" });
    });

    it("un motif invalide annule TOUT (aucun écart orphelin) — atomicité", async () => {
      await expect(
        captureAs(FIX.workerA, FIX.householdA, "2026-06-21", "off", null, "pas-un-motif"),
      ).rejects.toThrow();
      // Rien ne doit avoir survécu, ni l'écart ni le motif (vérifié hors RLS).
      const rows = await asAdmin(async (client) => {
        const res = await client.query<{ n: number }>(
          "select count(*)::int as n from public.exceptions where on_date = '2026-06-21'",
        );
        return res.rows;
      });
      expect(rows[0]?.n).toBe(0);
    });
  });

  describe("2. Étanchéité du motif via le nouveau chemin (R7)", () => {
    it("après une capture, la conjointe voit l'écart mais JAMAIS le motif", async () => {
      const id = await captureAs(FIX.workerA, FIX.householdA, "2026-06-22", "off", null, "maladie");

      const ecart = await queryAs<{ effect: string }>(
        FIX.spouseA,
        "select effect from public.exceptions where id = $1",
        [id],
      );
      expect(ecart).toHaveLength(1);
      expect(ecart[0]?.effect).toBe("off");

      const motif = await queryAs(
        FIX.spouseA,
        "select motif from public.exception_private where exception_id = $1",
        [id],
      );
      expect(motif).toHaveLength(0);
    });

    it("la RPC saisit l'écart de l'APPELANT : la conjointe ne peut pas écrire un motif au nom du travailleur", async () => {
      // La conjointe appelle la RPC : l'écart créé est le SIEN (profile_id = elle),
      // jamais celui du travailleur — le motif reste donc le sien aussi.
      const id = await captureAs(FIX.spouseA, FIX.householdA, "2026-06-23", "off", null, "conge");
      const rows = await queryAs<{ profile_id: string }>(
        FIX.spouseA,
        "select profile_id from public.exceptions where id = $1",
        [id],
      );
      expect(rows[0]?.profile_id).toBe(FIX.spouseA);

      // Le motif de cette capture appartient à la conjointe ; le travailleur, pourtant
      // membre du même foyer, ne le lit pas (propriétaire seul).
      const motifTravailleur = await queryAs(
        FIX.workerA,
        "select motif from public.exception_private where exception_id = $1",
        [id],
      );
      expect(motifTravailleur).toHaveLength(0);
    });

    it("un non-membre du foyer ne peut rien capturer dans ce foyer", async () => {
      await expect(
        captureAs(FIX.workerB, FIX.householdA, "2026-06-24", "off", null, "conge"),
      ).rejects.toThrow();
      const rows = await asAdmin(async (client) => {
        const res = await client.query<{ n: number }>(
          "select count(*)::int as n from public.exceptions where on_date = '2026-06-24'",
        );
        return res.rows;
      });
      expect(rows[0]?.n).toBe(0);
    });
  });

  describe("3. Annulation d'un écart (suppression cascade)", () => {
    it("supprimer l'écart supprime AUSSI le motif (aucune ligne orpheline)", async () => {
      const id = await captureAs(
        FIX.workerA,
        FIX.householdA,
        "2026-06-25",
        "working_extra",
        "jour",
        "ot",
      );

      const deleted = await asUser(FIX.workerA, (client) =>
        client.query("delete from public.exceptions where id = $1 and profile_id = $2", [
          id,
          FIX.workerA,
        ]),
      );
      expect(deleted.rowCount).toBe(1);

      // Constat hors RLS : le motif n'a pas survécu à son écart (FK on delete cascade).
      const orphelins = await asAdmin(async (client) => {
        const res = await client.query<{ n: number }>(
          "select count(*)::int as n from public.exception_private where exception_id = $1",
          [id],
        );
        return res.rows;
      });
      expect(orphelins[0]?.n).toBe(0);
    });
  });
});
