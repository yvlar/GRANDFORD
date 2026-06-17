import { afterAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asAdmin, asUser, closePool, queryAs, seed } from "./helpers";

// Sprint 3 — cycle de vie du foyer (FR-11/FR-12) au niveau BD, contre un VRAI Postgres.
// GoTrue (lien magique, OAuth) est une frontière d'intégration : son seul effet en BD
// est un INSERT dans auth.users — c'est ce que ces tests simulent. Tout le reste
// (trigger profil, RPC foyer, invitation, rachat, révocation) est le code réel.

const rlsAvailable = inject("rlsAvailable");

// Nouvel usager « fraîchement inscrit » : aucun foyer, aucune membership.
const NEW_USER = "c0000000-0000-4000-8000-000000000001";
const OTHER_USER = "c0000000-0000-4000-8000-000000000002";

async function signUp(id: string, email: string, fullName?: string): Promise<void> {
  // Simule l'effet BD d'une inscription GoTrue (lien magique ou OAuth).
  await asAdmin((client) =>
    client.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      email,
      fullName ? { full_name: fullName } : {},
    ]),
  );
}

/** Le propriétaire du foyer A émet une invitation et en retourne le code. */
async function inviteFromA(): Promise<string> {
  const rows = await queryAs<{ code: string }>(
    FIX.workerA,
    "insert into public.invitations (household_id, created_by) values ($1, $2) returning code",
    [FIX.householdA, FIX.workerA],
  );
  const code = rows[0]?.code;
  if (!code) throw new Error("invitation non créée");
  return code;
}

describe.skipIf(!rlsAvailable)("Cycle de vie du foyer (Postgres réel)", () => {
  beforeEach(seed);
  afterAll(closePool);

  describe("1. Inscription → profil (trigger handle_new_user)", () => {
    it("l'inscription crée automatiquement le profil avec le nom des métadonnées", async () => {
      await signUp(NEW_USER, "nouveau@test", "Nouveau Travailleur");
      const rows = await queryAs<{ full_name: string | null; locale: string }>(
        NEW_USER,
        "select full_name, locale from public.profiles where id = $1",
        [NEW_USER],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.full_name).toBe("Nouveau Travailleur");
      expect(rows[0]?.locale).toBe("fr-CA");
    });

    it("l'inscription sans métadonnées crée un profil au nom vide", async () => {
      await signUp(NEW_USER, "anonyme@test");
      const rows = await queryAs<{ full_name: string | null }>(
        NEW_USER,
        "select full_name from public.profiles where id = $1",
        [NEW_USER],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.full_name).toBeNull();
    });
  });

  describe("2. Première connexion → foyer + membership(worker)", () => {
    it("create_household_with_membership crée le foyer (owner = soi) et la membership worker", async () => {
      await signUp(NEW_USER, "nouveau@test", "Nouveau Travailleur");
      const created = await queryAs<{ id: string }>(
        NEW_USER,
        "select public.create_household_with_membership('Foyer Nouveau') as id",
      );
      const householdId = created[0]?.id;
      expect(householdId).toBeTruthy();

      const households = await queryAs<{ owner_id: string }>(
        NEW_USER,
        "select owner_id from public.households where id = $1",
        [householdId],
      );
      expect(households[0]?.owner_id).toBe(NEW_USER);

      const memberships = await queryAs<{ role: string }>(
        NEW_USER,
        "select role from public.memberships where household_id = $1 and profile_id = $2",
        [householdId, NEW_USER],
      );
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe("worker");
    });

    it("un nom de foyer vide est refusé", async () => {
      await signUp(NEW_USER, "nouveau@test");
      await expect(
        queryAs(NEW_USER, "select public.create_household_with_membership('   ')"),
      ).rejects.toThrow(/nom de foyer requis/);
    });
  });

  describe("3. Invitation de la conjointe (lien/code à usage unique)", () => {
    it("le propriétaire crée une invitation ; la nouvelle conjointe la rachète → membership spouse", async () => {
      const code = await inviteFromA();
      await signUp(NEW_USER, "conjointe2@test", "Nouvelle Conjointe");

      const redeemed = await queryAs<{ household_id: string }>(
        NEW_USER,
        "select public.redeem_invitation($1) as household_id",
        [code],
      );
      expect(redeemed[0]?.household_id).toBe(FIX.householdA);

      const memberships = await queryAs<{ role: string }>(
        NEW_USER,
        "select role from public.memberships where household_id = $1 and profile_id = $2",
        [FIX.householdA, NEW_USER],
      );
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe("spouse");
    });

    it("la conjointe invitée lit la disponibilité du foyer mais 0 ligne du motif (R7)", async () => {
      const code = await inviteFromA();
      await signUp(NEW_USER, "conjointe2@test");
      await queryAs(NEW_USER, "select public.redeem_invitation($1)", [code]);

      const availability = await queryAs<{ effect: string }>(
        NEW_USER,
        "select effect from public.exceptions where household_id = $1",
        [FIX.householdA],
      );
      expect(availability).toHaveLength(1);
      expect(availability[0]?.effect).toBe("off");

      const motifs = await queryAs<{ n: number }>(
        NEW_USER,
        "select count(*)::int as n from public.exception_private",
      );
      expect(motifs[0]?.n).toBe(0);
    });

    it("une invitation est à usage unique : un second rachat est refusé", async () => {
      const code = await inviteFromA();
      await signUp(NEW_USER, "conjointe2@test");
      await signUp(OTHER_USER, "intrus@test");
      await queryAs(NEW_USER, "select public.redeem_invitation($1)", [code]);

      await expect(
        queryAs(OTHER_USER, "select public.redeem_invitation($1)", [code]),
      ).rejects.toThrow(/déjà utilisée/);
    });

    it("une invitation expirée est refusée", async () => {
      await signUp(NEW_USER, "conjointe2@test");
      const rows = await asAdmin(async (client) => {
        const result = await client.query<{ code: string }>(
          `insert into public.invitations (household_id, created_by, expires_at)
           values ($1, $2, now() - interval '1 hour') returning code`,
          [FIX.householdA, FIX.workerA],
        );
        return result.rows;
      });
      const code = rows[0]?.code;
      if (!code) throw new Error("invitation expirée non créée");
      await expect(
        queryAs(NEW_USER, "select public.redeem_invitation($1)", [code]),
      ).rejects.toThrow(/expirée/);
    });

    it("un code inexistant est refusé sans fuite d'information", async () => {
      await signUp(NEW_USER, "conjointe2@test");
      await expect(
        queryAs(NEW_USER, "select public.redeem_invitation(gen_random_uuid())"),
      ).rejects.toThrow(/invitation invalide/);
    });

    it("un membre existant ne peut pas racheter une invitation de son propre foyer", async () => {
      const code = await inviteFromA();
      await expect(
        queryAs(FIX.spouseA, "select public.redeem_invitation($1)", [code]),
      ).rejects.toThrow(/déjà membre/);
    });

    it("la conjointe (non-propriétaire) ne peut pas créer d'invitation", async () => {
      await expect(
        queryAs(
          FIX.spouseA,
          "insert into public.invitations (household_id, created_by) values ($1, $2)",
          [FIX.householdA, FIX.spouseA],
        ),
      ).rejects.toThrow();
    });

    it("les invitations d'un foyer sont invisibles aux non-propriétaires (isolation)", async () => {
      await inviteFromA();
      for (const user of [FIX.spouseA, FIX.workerB]) {
        const rows = await queryAs<{ n: number }>(
          user,
          "select count(*)::int as n from public.invitations",
        );
        expect(rows[0]?.n).toBe(0);
      }
    });
  });

  describe("4. Révocation (préservée du Sprint 2)", () => {
    it("après révocation, la conjointe fraîchement invitée perd tout accès", async () => {
      const code = await inviteFromA();
      await signUp(NEW_USER, "conjointe2@test");
      await queryAs(NEW_USER, "select public.redeem_invitation($1)", [code]);

      await asUser(FIX.workerA, (client) =>
        client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
          FIX.householdA,
          NEW_USER,
        ]),
      );

      const after = await queryAs<{ n: number }>(
        NEW_USER,
        "select count(*)::int as n from public.exceptions",
      );
      expect(after[0]?.n).toBe(0);
    });
  });

  describe("5. Suppression de compte — cascade (Loi 25 / droit à l'oubli)", () => {
    it("supprimer la conjointe (non-propriétaire) efface sa membership en cascade", async () => {
      const before = await queryAs<{ n: number }>(
        FIX.spouseA,
        "select count(*)::int as n from public.memberships where profile_id = $1",
        [FIX.spouseA],
      );
      expect(before[0]?.n).toBe(1);

      // Suppression via auth.users (CASCADE → profiles → memberships)
      await asAdmin((client) =>
        client.query("delete from auth.users where id = $1", [FIX.spouseA]),
      );

      const after = await asAdmin(async (client) => {
        const r = await client.query<{ n: number }>(
          "select count(*)::int as n from public.memberships where profile_id = $1",
          [FIX.spouseA],
        );
        return r.rows;
      });
      expect(after[0]?.n).toBe(0);
    });

    it("supprimer un foyer efface en cascade exceptions, motifs, notes, reminders, memberships", async () => {
      // Garantir qu'il y a au moins une exception avant la suppression
      const beforeExc = await asAdmin(async (client) => {
        const r = await client.query<{ n: number }>(
          "select count(*)::int as n from public.exceptions where household_id = $1",
          [FIX.householdA],
        );
        return r.rows[0]?.n ?? 0;
      });
      expect(beforeExc).toBeGreaterThan(0);

      // Suppression du foyer (propriétaire doit faire ça avant de supprimer son compte)
      await asAdmin((client) =>
        client.query("delete from public.households where id = $1", [FIX.householdA]),
      );

      // 0 données résiduelles pour toutes les tables de foyer
      const tables = [
        "public.exceptions",
        "public.exception_private",
        "public.memberships",
        "public.reminders",
        "public.notes",
        "public.requests",
      ];
      for (const table of tables) {
        const after = await asAdmin(async (client) => {
          const r = await client.query<{ n: number }>(
            `select count(*)::int as n from ${table} where household_id = $1`,
            [FIX.householdA],
          );
          return r.rows[0]?.n ?? -1;
        });
        expect(after, `${table} doit être vide après suppression du foyer`).toBe(0);
      }
    });
  });
});
