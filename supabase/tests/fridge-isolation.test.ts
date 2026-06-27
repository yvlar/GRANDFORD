import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { FIX, asAdmin, asUser, closePool, queryAs, seed } from "./helpers";

// Isolation RLS de la note du frigo (Sprint 20) — livrable de 1re classe (R7).
// Contrairement à la paye (worker-private), le tableau du frigo est PARTAGÉ dans le foyer :
//   • SELECT/INSERT : membre du foyer (les deux conjoints voient et écrivent) ;
//   • UPDATE        : auteur SEUL (édition du corps, Sprint 21 ; réinitialise l'accusé) ;
//   • DELETE        : auteur SEUL ;
//   • accusé de lecture : posé par l'AUTRE membre via le RPC marquer_note_frigo_lue
//     (SECURITY DEFINER), jamais par un UPDATE direct du non-auteur.
// Exécuté contre un VRAI Postgres ; ignoré sans BD (globalSetup).

const rlsAvailable = inject("rlsAvailable");

const noteA = "c1111111-1111-4111-8111-111111111111";

describe.skipIf(!rlsAvailable)("Isolation RLS de la note du frigo (Postgres réel)", () => {
  beforeAll(seed);
  beforeEach(seed);
  afterAll(closePool);

  // Le travailleur A colle une note au frigo du foyer A (author_id = lui-même).
  const insertNoteA = () =>
    asUser(FIX.workerA, (client) =>
      client.query(
        "insert into public.fridge_notes (id, household_id, author_id, body) values ($1, $2, $3, 'Acheter du lait')",
        [noteA, FIX.householdA, FIX.workerA],
      ),
    );

  const marquerLue = (userId: string) =>
    asUser(userId, async (client) => {
      const res = await client.query<{ ok: boolean }>(
        "select public.marquer_note_frigo_lue($1) as ok",
        [noteA],
      );
      return res.rows[0]?.ok;
    });

  it("la conjointe LIT la note du frigo du foyer (lecture partagée)", async () => {
    await insertNoteA();
    const rows = await queryAs<{ body: string }>(
      FIX.spouseA,
      "select body from public.fridge_notes where household_id = $1",
      [FIX.householdA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.body).toBe("Acheter du lait");
  });

  it("la conjointe peut elle aussi coller une note (les deux membres écrivent)", async () => {
    await asUser(FIX.spouseA, (client) =>
      client.query(
        "insert into public.fridge_notes (household_id, author_id, body) values ($1, $2, 'Rappel rendez-vous')",
        [FIX.householdA, FIX.spouseA],
      ),
    );
    const rows = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.fridge_notes where household_id = $1",
      [FIX.householdA],
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("un membre d'un autre foyer ne lit JAMAIS les notes du foyer A", async () => {
    await insertNoteA();
    const rows = await queryAs(
      FIX.workerB,
      "select id from public.fridge_notes where household_id = $1",
      [FIX.householdA],
    );
    expect(rows).toHaveLength(0);
  });

  it("un non-membre ne peut pas coller une note dans le foyer A (with check membre)", async () => {
    await expect(
      asUser(FIX.workerB, (client) =>
        client.query(
          "insert into public.fridge_notes (household_id, author_id, body) values ($1, $2, 'intrusion')",
          [FIX.householdA, FIX.workerB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("on ne peut pas coller une note sous l'identité d'un autre (author_id = soi)", async () => {
    // with check (author_id = auth.uid()) : la conjointe ne peut écrire qu'EN SON nom ;
    // forger author_id = workerA est refusé.
    await expect(
      asUser(FIX.spouseA, (client) =>
        client.query(
          "insert into public.fridge_notes (household_id, author_id, body) values ($1, $2, 'usurpation')",
          [FIX.householdA, FIX.workerA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("on ne peut pas FORGER un accusé de lecture à l'insertion (read_at/read_by interdits)", async () => {
    // with check (read_at is null and read_by is null) : poser un accusé n'appartient qu'au
    // RPC SECURITY DEFINER ; la voie d'insertion brute ne peut pas le contourner.
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query(
          "insert into public.fridge_notes (household_id, author_id, body, read_at, read_by) values ($1, $2, 'faux accusé', now(), $3)",
          [FIX.householdA, FIX.workerA, FIX.spouseA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("la conjointe ne peut PAS retirer la note de l'autre (0 ligne, note intacte)", async () => {
    await insertNoteA();
    const rowCount = await asUser(FIX.spouseA, async (client) => {
      const res = await client.query("delete from public.fridge_notes where id = $1", [noteA]);
      return res.rowCount;
    });
    expect(rowCount).toBe(0);

    const reste = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(reste[0]?.n).toBe(1);
  });

  it("l'auteur retire SA propre note (1 ligne supprimée)", async () => {
    await insertNoteA();
    const rowCount = await asUser(FIX.workerA, async (client) => {
      const res = await client.query("delete from public.fridge_notes where id = $1", [noteA]);
      return res.rowCount;
    });
    expect(rowCount).toBe(1);
  });

  it("la conjointe (non-auteure) marque la note lue via le RPC → true, accusé posé", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.spouseA)).toBe(true);

    const rows = await queryAs<{ read_by: string | null }>(
      FIX.workerA,
      "select read_by from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.read_by).toBe(FIX.spouseA);
  });

  it("l'AUTEUR ne peut pas s'accuser sa propre note (RPC → false, read_at nul)", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.workerA)).toBe(false);

    const rows = await queryAs<{ read_at: string | null }>(
      FIX.workerA,
      "select read_at from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.read_at).toBeNull();
  });

  it("un non-membre ne peut pas marquer la note lue (RPC → false)", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.workerB)).toBe(false);
  });

  it("le RPC est idempotent : un 2ᵉ accusé ne réécrit pas l'horodatage (→ false)", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.spouseA)).toBe(true);
    // ::text : pg renvoie un `timestamptz` en objet Date — deux requêtes donnent deux
    // instances ≠ par référence ; on compare la chaîne pour vérifier la NON-réécriture.
    const premier = await queryAs<{ read_at: string }>(
      FIX.workerA,
      "select read_at::text as read_at from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(await marquerLue(FIX.spouseA)).toBe(false);
    const second = await queryAs<{ read_at: string }>(
      FIX.workerA,
      "select read_at::text as read_at from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(second[0]?.read_at).toBe(premier[0]?.read_at);
  });

  // ── Édition du corps (Sprint 21) : UPDATE auteur seul (fridge_notes_update) ──────────
  it("l'auteur modifie le corps de SA note (1 ligne, corps reflété pour les deux)", async () => {
    await insertNoteA();
    const rowCount = await asUser(FIX.workerA, async (client) => {
      const res = await client.query(
        "update public.fridge_notes set body = 'Acheter du lait ET du pain' where id = $1",
        [noteA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(1);
    const rows = await queryAs<{ body: string }>(
      FIX.spouseA,
      "select body from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.body).toBe("Acheter du lait ET du pain");
  });

  it("la conjointe (non-auteure) ne peut PAS modifier le corps (0 ligne, corps intact)", async () => {
    await insertNoteA();
    const rowCount = await asUser(FIX.spouseA, async (client) => {
      const res = await client.query(
        "update public.fridge_notes set body = 'détournement' where id = $1",
        [noteA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(0);
    const rows = await queryAs<{ body: string }>(
      FIX.workerA,
      "select body from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.body).toBe("Acheter du lait");
  });

  it("l'auteur réinitialise l'accusé en éditant sa note déjà lue (corps changé, read_* nuls)", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.spouseA)).toBe(true); // la note devient « lue »
    const rowCount = await asUser(FIX.workerA, async (client) => {
      const res = await client.query(
        "update public.fridge_notes set body = 'Corrigé', read_at = null, read_by = null where id = $1",
        [noteA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(1);
    const rows = await queryAs<{ body: string; read_at: string | null; read_by: string | null }>(
      FIX.workerA,
      "select body, read_at::text as read_at, read_by from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.body).toBe("Corrigé");
    expect(rows[0]?.read_at).toBeNull();
    expect(rows[0]?.read_by).toBeNull();
  });

  it("l'auteur ne peut pas FORGER un accusé non-nul par UPDATE direct (with check)", async () => {
    // Durcissement Sprint 21 : poser un accusé n'appartient qu'au RPC (SECURITY DEFINER).
    // L'auteur qui tenterait de se forger un « Lu ✓ » par UPDATE viole le with check.
    await insertNoteA();
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query("update public.fridge_notes set read_at = now(), read_by = $2 where id = $1", [
          noteA,
          FIX.spouseA,
        ]),
      ),
    ).rejects.toThrow();
    const rows = await queryAs<{ read_at: string | null }>(
      FIX.workerA,
      "select read_at from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.read_at).toBeNull();
  });

  it("un non-auteur ne peut pas réinitialiser l'accusé par UPDATE direct (0 ligne, accusé intact)", async () => {
    await insertNoteA();
    expect(await marquerLue(FIX.spouseA)).toBe(true);
    const rowCount = await asUser(FIX.spouseA, async (client) => {
      const res = await client.query(
        "update public.fridge_notes set read_at = null, read_by = null where id = $1",
        [noteA],
      );
      return res.rowCount;
    });
    expect(rowCount).toBe(0);
    const rows = await queryAs<{ read_by: string | null }>(
      FIX.workerA,
      "select read_by from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.read_by).toBe(FIX.spouseA);
  });

  it("l'édition refuse un corps vide (CHECK longueur 1–500, body intact)", async () => {
    await insertNoteA();
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query("update public.fridge_notes set body = '   ' where id = $1", [noteA]),
      ),
    ).rejects.toThrow();
    const rows = await queryAs<{ body: string }>(
      FIX.workerA,
      "select body from public.fridge_notes where id = $1",
      [noteA],
    );
    expect(rows[0]?.body).toBe("Acheter du lait");
  });

  // ── Indicateur « Édité » (Sprint 22) : updated_at ne bouge QUE sur un vrai changement de
  // corps (trigger set_fridge_notes_updated). C'est ce qui rend « updatedAt > createdAt »
  // fiable côté UI : une simple LECTURE ne doit pas faire passer la note pour « éditée ».
  const estEditeeEnBd = (userId: string) =>
    queryAs<{ edite: boolean }>(
      userId,
      "select (updated_at > created_at) as edite from public.fridge_notes where id = $1",
      [noteA],
    );

  it("une lecture (accusé via RPC) NE bumpe PAS updated_at (lire ≠ éditer)", async () => {
    await insertNoteA();
    // À l'insertion, now() est stable dans la transaction → updated_at == created_at.
    expect((await estEditeeEnBd(FIX.workerA))[0]?.edite).toBe(false);
    expect(await marquerLue(FIX.spouseA)).toBe(true); // UPDATE de read_at/read_by, corps inchangé
    expect((await estEditeeEnBd(FIX.workerA))[0]?.edite).toBe(false); // updated_at intact
  });

  it("une édition du corps par l'auteur AVANCE updated_at au-delà de created_at", async () => {
    await insertNoteA();
    await asUser(FIX.workerA, (client) =>
      client.query(
        "update public.fridge_notes set body = 'Acheter du lait ET du pain' where id = $1",
        [noteA],
      ),
    );
    expect((await estEditeeEnBd(FIX.workerA))[0]?.edite).toBe(true);
  });

  it("un membre RÉVOQUÉ perd tout accès (lecture 0, RPC → false)", async () => {
    await insertNoteA();
    // Révocation : on retire l'appartenance de la conjointe au foyer A (comme un retrait
    // d'invitation). En tant que postgres (exempt de RLS), à l'image d'une opération admin.
    await asAdmin((client) =>
      client.query("delete from public.memberships where household_id = $1 and profile_id = $2", [
        FIX.householdA,
        FIX.spouseA,
      ]),
    );
    const rows = await queryAs(FIX.spouseA, "select id from public.fridge_notes");
    expect(rows).toHaveLength(0);
    expect(await marquerLue(FIX.spouseA)).toBe(false);
  });

  // ── Réponses (Sprint 23) : fil à UN SEUL niveau, héritage de l'isolation de foyer ──────
  const reponseA = "c2222222-2222-4222-8222-222222222222";

  const insertReponse = (
    auteur: string,
    opts: { id?: string; parent?: string; household?: string } = {},
  ) =>
    asUser(auteur, (client) =>
      client.query(
        "insert into public.fridge_notes (id, household_id, author_id, body, parent_id) values ($1, $2, $3, 'Réponse', $4)",
        [opts.id ?? reponseA, opts.household ?? FIX.householdA, auteur, opts.parent ?? noteA],
      ),
    );

  it("la conjointe répond à la note de l'autre ; les deux membres lisent la réponse", async () => {
    await insertNoteA();
    await insertReponse(FIX.spouseA);
    const rows = await queryAs<{ body: string; parent_id: string }>(
      FIX.workerA,
      "select body, parent_id from public.fridge_notes where parent_id = $1",
      [noteA],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.parent_id).toBe(noteA);
  });

  it("un membre d'un autre foyer ne peut PAS répondre à une note du foyer A", async () => {
    await insertNoteA();
    // workerB tente une réponse dans le foyer A : la RLS INSERT (with check membre) la refuse.
    await expect(insertReponse(FIX.workerB, { household: FIX.householdA })).rejects.toThrow();
  });

  it("un seul niveau : on ne peut pas répondre à une réponse (trigger)", async () => {
    await insertNoteA();
    await insertReponse(FIX.spouseA); // réponse de 1er niveau
    // Tenter de répondre à la réponse (parent = reponseA) → le trigger refuse.
    await expect(
      insertReponse(FIX.workerA, {
        id: "c3333333-3333-4333-8333-333333333333",
        parent: reponseA,
      }),
    ).rejects.toThrow();
  });

  it("un seul niveau (UPDATE) : une note ayant des réponses ne peut pas devenir une réponse (trigger)", async () => {
    await insertNoteA();
    await insertReponse(FIX.spouseA); // noteA a maintenant une réponse
    // L'auteur de noteA crée une 2e note de tête, puis tente de re-parenter noteA dessous
    // (Q→noteA→reponseA = deux niveaux). Le trigger doit refuser (sinon reponseA orpheline).
    const noteQ = "c4444444-4444-4444-8444-444444444444";
    await asUser(FIX.workerA, (client) =>
      client.query(
        "insert into public.fridge_notes (id, household_id, author_id, body) values ($1, $2, $3, 'Autre note')",
        [noteQ, FIX.householdA, FIX.workerA],
      ),
    );
    await expect(
      asUser(FIX.workerA, (client) =>
        client.query("update public.fridge_notes set parent_id = $2 where id = $1", [noteA, noteQ]),
      ),
    ).rejects.toThrow();
  });

  it("une réponse doit appartenir au foyer de sa note parente (trigger, défense en profondeur)", async () => {
    await insertNoteA();
    // En admin (exempt de RLS) : on force un foyer ≠ celui du parent → seul le trigger garde.
    await expect(
      asAdmin((client) =>
        client.query(
          "insert into public.fridge_notes (id, household_id, author_id, body, parent_id) values ($1, $2, $3, 'incohérente', $4)",
          [reponseA, FIX.householdB, FIX.workerB, noteA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("retirer une note de tête retire ses réponses (on delete cascade)", async () => {
    await insertNoteA();
    await insertReponse(FIX.spouseA);
    await asUser(FIX.workerA, (client) =>
      client.query("delete from public.fridge_notes where id = $1", [noteA]),
    );
    const reste = await queryAs<{ n: number }>(
      FIX.workerA,
      "select count(*)::int as n from public.fridge_notes where id = $1",
      [reponseA],
    );
    expect(reste[0]?.n).toBe(0);
  });

  it("D1 : le RPC d'accusé REFUSE une réponse (pas d'accusé de lecture sur une réponse)", async () => {
    await insertNoteA();
    await insertReponse(FIX.spouseA); // réponse écrite par la conjointe
    // Le travailleur (non-auteur de la réponse) tente de l'accuser → false (parent_id non nul).
    const ok = await asUser(FIX.workerA, async (client) => {
      const res = await client.query<{ ok: boolean }>(
        "select public.marquer_note_frigo_lue($1) as ok",
        [reponseA],
      );
      return res.rows[0]?.ok;
    });
    expect(ok).toBe(false);
    const rows = await queryAs<{ read_at: string | null }>(
      FIX.workerA,
      "select read_at from public.fridge_notes where id = $1",
      [reponseA],
    );
    expect(rows[0]?.read_at).toBeNull();
  });
});
