import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asUser, closePool, queryAs, seed } from "./helpers";

// Isolation RLS du jour de paye (Sprint 17) — livrable de 1re classe (R7).
// La paye est PRIVÉE au travailleur, comme le motif : la policy payday_settings_owner_only
// (profile_id = auth.uid()) n'a aucune clause « membre du foyer », donc la conjointe — bien
// que membre — obtient 0 ligne. Exécuté contre un VRAI Postgres ; ignoré sans BD (globalSetup).

const rlsAvailable = inject("rlsAvailable");

describe.skipIf(!rlsAvailable)("Isolation RLS du jour de paye (Postgres réel)", () => {
  beforeAll(seed);
  beforeEach(seed);
  afterAll(closePool);

  const insertPaydayA = () =>
    asUser(FIX.workerA, (client) =>
      client.query(
        "insert into public.payday_settings (household_id, profile_id, anchor_date, frequence) values ($1, $2, '2026-06-04', 'aux_2_semaines')",
        [FIX.householdA, FIX.workerA],
      ),
    );

  it("le travailleur propriétaire lit SA propre config de paye", async () => {
    await insertPaydayA();
    const rows = await queryAs<{ frequence: string }>(
      FIX.workerA,
      "select frequence from public.payday_settings where household_id = $1 and profile_id = $2",
      [FIX.householdA, FIX.workerA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.frequence).toBe("aux_2_semaines");
  });

  it("la conjointe ne lit AUCUNE ligne de payday_settings (étanchéité R7)", async () => {
    await insertPaydayA();
    const rows = await queryAs<{ n: number }>(
      FIX.spouseA,
      "select count(*)::int as n from public.payday_settings",
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("la conjointe ne peut pas s'attribuer une config de paye (écriture refusée)", async () => {
    // with check (profile_id = auth.uid()) : la conjointe ne peut écrire que pour elle-même ;
    // tenter d'écrire sous le profil du travailleur est refusé.
    await expect(
      asUser(FIX.spouseA, (client) =>
        client.query(
          "insert into public.payday_settings (household_id, profile_id, anchor_date, frequence) values ($1, $2, '2026-06-04', 'hebdomadaire')",
          [FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("un non-membre ne peut pas écrire une config de paye dans le foyer A (with check membre)", async () => {
    // workerB écrit pour LUI-MÊME (profile_id = soi) mais vers householdA dont il n'est pas
    // membre : le `with check (… and is_household_member)` refuse — intégrité multi-tenant.
    await expect(
      asUser(FIX.workerB, (client) =>
        client.query(
          "insert into public.payday_settings (household_id, profile_id, anchor_date, frequence) values ($1, $2, '2026-06-04', 'hebdomadaire')",
          [FIX.householdA, FIX.workerB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("un membre d'un autre foyer ne lit jamais la config de paye du foyer A", async () => {
    await insertPaydayA();
    const rows = await queryAs(
      FIX.workerB,
      "select anchor_date from public.payday_settings where household_id = $1",
      [FIX.householdA],
    );
    expect(rows).toHaveLength(0);
  });

  it("la conjointe ne peut pas modifier la config de paye du travailleur (0 lignes modifiées)", async () => {
    // La conjointe est MEMBRE du foyer, mais la policy est owner-only-by-profile (pas
    // « membre du foyer ») : son UPDATE ne voit aucune ligne (using) → 0 modifiée, et la
    // valeur d'origine reste intacte. Preuve que la révocation n'est pas le seul rempart :
    // l'étanchéité tient même pour un membre courant.
    await insertPaydayA();
    const rowCount = await asUser(FIX.spouseA, async (client) => {
      const res = await client.query(
        "update public.payday_settings set frequence = 'hebdomadaire' where household_id = $1 and profile_id = $2",
        [FIX.householdA, FIX.workerA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(0);

    const check = await queryAs<{ frequence: string }>(
      FIX.workerA,
      "select frequence from public.payday_settings where household_id = $1 and profile_id = $2",
      [FIX.householdA, FIX.workerA],
    );
    expect(check[0]?.frequence).toBe("aux_2_semaines");
  });
});
