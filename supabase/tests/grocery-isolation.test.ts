import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asAdmin, asUser, closePool, queryAs, seed } from "./helpers";

// Isolation RLS de la liste d'épicerie (Sprint 25) — livrable de 1re classe (R7).
// La liste est PARTAGÉE dans le foyer (les deux membres gèrent) :
//   • listes  : SELECT/INSERT/DELETE = membre du foyer ;
//   • éléments: SELECT/INSERT/DELETE = membre ; PAS d'UPDATE direct ;
//   • coche   : posée par n'importe quel membre via le RPC cocher_element_epicerie
//     (SECURITY DEFINER), jamais par un UPDATE direct ; push anti-spam (cooldown/liste).
// Exécuté contre un VRAI Postgres ; ignoré sans BD (globalSetup).

const rlsAvailable = inject("rlsAvailable");

const listeA = "d1111111-1111-4111-8111-111111111111";
const item1 = "d2222222-2222-4222-8222-222222222222";
const item2 = "d3333333-3333-4333-8333-333333333333";

describe.skipIf(!rlsAvailable)("Isolation RLS de la liste d'épicerie (Postgres réel)", () => {
  beforeAll(seed);
  beforeEach(seed);
  afterAll(closePool);

  // Le travailleur A crée une liste dans le foyer A ; on y ajoute deux éléments.
  // id paramétrable (défaut listeA) : réutilisé pour créer une 2e liste (isolation inter-listes).
  const insertListeA = (auteur = FIX.workerA, id = listeA) =>
    asUser(auteur, (client) =>
      client.query(
        "insert into public.grocery_lists (id, household_id, author_id, title) values ($1, $2, $3, 'Épicerie de la semaine')",
        [id, FIX.householdA, auteur],
      ),
    );

  const insertItem = (auteur: string, id: string, label: string, listId = listeA) =>
    asUser(auteur, (client) =>
      client.query(
        "insert into public.grocery_items (id, list_id, household_id, author_id, label) values ($1, $2, $3, $4, $5)",
        [id, listId, FIX.householdA, auteur, label],
      ),
    );

  const cocher = (userId: string, itemId: string, checked: boolean) =>
    asUser(userId, async (client) => {
      const res = await client.query<{ push: boolean }>(
        "select public.cocher_element_epicerie($1, $2) as push",
        [itemId, checked],
      );
      return res.rows[0]?.push;
    });

  const etatItem = (itemId: string) =>
    queryAs<{ is_checked: boolean; checked_by: string | null }>(
      FIX.workerA,
      "select is_checked, checked_by from public.grocery_items where id = $1",
      [itemId],
    );

  it("la conjointe LIT la liste du foyer (lecture partagée)", async () => {
    await insertListeA();
    const rows = await queryAs<{ title: string }>(
      FIX.spouseA,
      "select title from public.grocery_lists where household_id = $1",
      [FIX.householdA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Épicerie de la semaine");
  });

  it("la conjointe peut elle aussi créer une liste (les deux membres écrivent)", async () => {
    await asUser(FIX.spouseA, (client) =>
      client.query(
        "insert into public.grocery_lists (household_id, author_id, title) values ($1, $2, 'Quincaillerie')",
        [FIX.householdA, FIX.spouseA],
      ),
    );
    const rows = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_lists where household_id = $1",
      [FIX.householdA],
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("un membre d'un autre foyer ne lit JAMAIS les listes du foyer A", async () => {
    await insertListeA();
    const rows = await queryAs(
      FIX.workerB,
      "select id from public.grocery_lists where household_id = $1",
      [FIX.householdA],
    );
    expect(rows).toHaveLength(0);
  });

  it("un non-membre ne peut pas créer une liste dans le foyer A (with check membre)", async () => {
    await expect(
      asUser(FIX.workerB, (client) =>
        client.query(
          "insert into public.grocery_lists (household_id, author_id, title) values ($1, $2, 'intrusion')",
          [FIX.householdA, FIX.workerB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("on ne peut pas créer une liste sous l'identité d'un autre (author_id = soi)", async () => {
    await expect(
      asUser(FIX.spouseA, (client) =>
        client.query(
          "insert into public.grocery_lists (household_id, author_id, title) values ($1, $2, 'usurpation')",
          [FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("les DEUX membres ajoutent un élément à la liste partagée", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    await insertItem(FIX.spouseA, item2, "Pain");
    const rows = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_items where list_id = $1",
      [listeA],
    );
    expect(rows[0]?.n).toBe(2);
  });

  it("on ne peut pas FORGER une coche à l'insertion d'un élément (is_checked/checked_* interdits)", async () => {
    await insertListeA();
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query(
          "insert into public.grocery_items (list_id, household_id, author_id, label, is_checked, checked_at, checked_by) values ($1, $2, $3, 'faux', true, now(), $3)",
          [listeA, FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("un élément doit appartenir au foyer de sa liste (trigger, défense en profondeur)", async () => {
    await insertListeA();
    // En admin (exempt de RLS) : on force un foyer ≠ celui de la liste → seul le trigger garde.
    await expect(
      asAdmin((client) =>
        client.query(
          "insert into public.grocery_items (list_id, household_id, author_id, label) values ($1, $2, $3, 'incohérent')",
          [listeA, FIX.householdB, FIX.workerB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("la coche est incohérente si on ne pose qu'une partie des champs (CHECK)", async () => {
    await insertListeA();
    // is_checked true mais checked_at null → viole grocery_items_check_coherent.
    await expect(
      asAdmin((client) =>
        client.query(
          "insert into public.grocery_items (list_id, household_id, author_id, label, is_checked) values ($1, $2, $3, 'bancal', true)",
          [listeA, FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("les DEUX membres cochent un élément via le RPC (coche posée, checked_by = l'acteur)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    // La conjointe (non-auteure de l'élément) peut le cocher : liste partagée.
    expect(await cocher(FIX.spouseA, item1, true)).toBe(true);
    const rows = await etatItem(item1);
    expect(rows[0]?.is_checked).toBe(true);
    expect(rows[0]?.checked_by).toBe(FIX.spouseA);
  });

  it("un UPDATE direct de is_checked est refusé (aucun grant/policy UPDATE) — seul le RPC bascule", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query("update public.grocery_items set is_checked = true where id = $1", [item1]),
      ),
    ).rejects.toThrow();
    expect((await etatItem(item1))[0]?.is_checked).toBe(false);
  });

  it("décocher remet l'élément à l'état neuf (checked_* nuls) et ne pousse jamais", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    expect(await cocher(FIX.workerA, item1, true)).toBe(true);
    // Décochage : pas de push (false), coche effacée.
    expect(await cocher(FIX.spouseA, item1, false)).toBe(false);
    const rows = await etatItem(item1);
    expect(rows[0]?.is_checked).toBe(false);
    expect(rows[0]?.checked_by).toBeNull();
  });

  it("le RPC est idempotent : recocher un élément déjà coché → false (pas de double push)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    expect(await cocher(FIX.workerA, item1, true)).toBe(true);
    expect(await cocher(FIX.spouseA, item1, true)).toBe(false);
  });

  it("anti-spam : un 2ᵉ cochage rapproché (même liste) ne re-pousse pas (cooldown)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    await insertItem(FIX.spouseA, item2, "Pain");
    // 1er cochage de la liste → push.
    expect(await cocher(FIX.workerA, item1, true)).toBe(true);
    // 2ᵉ cochage (autre élément, même liste, dans la fenêtre) → PAS de push, malgré l'état changé.
    expect(await cocher(FIX.spouseA, item2, true)).toBe(false);
    expect((await etatItem(item2))[0]?.is_checked).toBe(true); // l'état change quand même
  });

  it("anti-spam : après la fenêtre de cooldown, un nouveau cochage re-pousse", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    expect(await cocher(FIX.workerA, item1, true)).toBe(true);
    expect(await cocher(FIX.spouseA, item1, false)).toBe(false); // décoche (pas de push)
    // On recule artificiellement le dernier push au-delà du cooldown (2 min).
    await asAdmin((client) =>
      client.query(
        "update public.grocery_lists set last_check_notified_at = now() - interval '10 minutes' where id = $1",
        [listeA],
      ),
    );
    expect(await cocher(FIX.workerA, item1, true)).toBe(true); // hors fenêtre → re-pousse
  });

  it("un membre RÉVOQUÉ ne peut plus cocher (RPC → false, état intact)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    // Révocation : on retire l'appartenance de la conjointe au foyer A.
    await asAdmin((client) =>
      client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
        FIX.householdA,
        FIX.spouseA,
      ]),
    );
    expect(await cocher(FIX.spouseA, item1, true)).toBe(false);
    expect((await etatItem(item1))[0]?.is_checked).toBe(false);
  });

  it("un non-membre ne peut pas retirer un élément du foyer A (0 ligne, élément intact)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    const rowCount = await asUser(FIX.workerB, async (client) => {
      const res = await client.query("delete from public.grocery_items where id = $1", [item1]);
      return res.rowCount;
    });
    expect(rowCount).toBe(0);
    const reste = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_items where id = $1",
      [item1],
    );
    expect(reste[0]?.n).toBe(1);
  });

  it("supprimer une liste retire ses éléments (on delete cascade)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    await insertItem(FIX.spouseA, item2, "Pain");
    await asUser(FIX.spouseA, (client) =>
      client.query("delete from public.grocery_lists where id = $1", [listeA]),
    );
    const reste = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_items where list_id = $1",
      [listeA],
    );
    expect(reste[0]?.n).toBe(0);
  });

  it("vider les achetés retire UNIQUEMENT les éléments cochés de CETTE liste (non cochés et autres intacts)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait"); // restera non coché
    await insertItem(FIX.spouseA, item2, "Pain");
    expect(await cocher(FIX.workerA, item2, true)).toBe(true);

    // Deuxième liste + élément coché du même foyer, pour prouver l'isolation inter-listes.
    const listeAutre = "d4444444-4444-4444-8444-444444444444";
    const itemAutre = "d5555555-5555-4555-8555-555555555555";
    await insertListeA(FIX.workerA, listeAutre);
    await insertItem(FIX.workerA, itemAutre, "Fromage", listeAutre);
    expect(await cocher(FIX.workerA, itemAutre, true)).toBe(true);

    // La conjointe (membre, pas auteure de l'élément) vide les achetés de la liste A seulement.
    const rowCount = await asUser(FIX.spouseA, async (client) => {
      const res = await client.query(
        "delete from public.grocery_items where list_id = $1 and is_checked = true",
        [listeA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(1); // seul Pain (item2) part

    const resteA = await queryAs<{ id: string }>(
      FIX.workerA,
      "select id from public.grocery_items where list_id = $1",
      [listeA],
    );
    expect(resteA.map((r) => r.id)).toEqual([item1]); // Lait (non coché) intact

    const resteAutre = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_items where list_id = $1",
      [listeAutre],
    );
    expect(resteAutre[0]?.n).toBe(1); // Fromage (autre liste, coché) intact
  });

  it("un non-membre ne peut pas vider les achetés du foyer A (0 ligne, élément intact)", async () => {
    await insertListeA();
    await insertItem(FIX.workerA, item1, "Lait");
    expect(await cocher(FIX.workerA, item1, true)).toBe(true);

    const rowCount = await asUser(FIX.workerB, async (client) => {
      const res = await client.query(
        "delete from public.grocery_items where list_id = $1 and is_checked = true",
        [listeA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(0);

    const reste = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.grocery_items where list_id = $1 and is_checked = true",
      [listeA],
    );
    expect(reste[0]?.n).toBe(1);
  });
});
