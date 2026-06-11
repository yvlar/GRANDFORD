import pg from "pg";
import { inject } from "vitest";
import { GRANDFORD_CYCLE } from "../../lib/engine";

// Outils des tests d'isolation RLS. On parle au Postgres réel via `pg`, en imitant
// EXACTEMENT ce que fait PostgREST en production : rôle `authenticated` + claims JWT
// injectés dans le GUC `request.jwt.claims` (lu par auth.uid()). C'est la voie
// d'application réelle de la RLS — pas un contournement.

// Identifiants déterministes (lisibles : a = foyer A, b = foyer B).
export const FIX = {
  householdA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  householdB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  workerA: "a0000000-0000-4000-8000-000000000001",
  spouseA: "a0000000-0000-4000-8000-000000000002",
  workerB: "b0000000-0000-4000-8000-000000000001",
  spouseB: "b0000000-0000-4000-8000-000000000002",
  exceptionA: "a1111111-1111-4111-8111-111111111111",
  exceptionB: "b1111111-1111-4111-8111-111111111111",
} as const;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: inject("rlsDbUrl"), max: 4 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Exécute `run` dans une transaction ; libère toujours la connexion, annule sur erreur. */
async function withTransaction<T>(run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined); // ne pas masquer l'erreur d'origine
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Exécute `run` en se faisant passer pour `userId` (rôle `authenticated` + claim `sub`),
 * exactement comme PostgREST. La RLS s'applique donc pleinement.
 */
export async function asUser<T>(
  userId: string,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(async (client) => {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    return run(client);
  });
}

/** Raccourci : requête en tant qu'usager, renvoie les lignes typées. */
export async function queryAs<T extends pg.QueryResultRow>(
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return asUser(userId, async (client) => {
    const result = await client.query<T>(sql, params);
    return result.rows;
  });
}

/**
 * Réinitialise et réensemence la base : deux foyers (A et B), chacun avec un
 * travailleur, une conjointe, une exception et son motif privé. Joué en tant que
 * postgres (propriétaire des tables → exempt de RLS), comme le ferait un seed admin.
 */
export async function seed(): Promise<void> {
  await withTransaction(async (client) => {
    // truncate en cascade depuis auth.users : vide tout le graphe applicatif.
    await client.query("truncate auth.users restart identity cascade");

    await client.query(
      `insert into auth.users (id, email) values
        ($1,'workerA@test'),($2,'spouseA@test'),($3,'workerB@test'),($4,'spouseB@test')`,
      [FIX.workerA, FIX.spouseA, FIX.workerB, FIX.spouseB],
    );
    await client.query(
      `insert into public.profiles (id, full_name) values
        ($1,'Travailleur A'),($2,'Conjointe A'),($3,'Travailleur B'),($4,'Conjointe B')`,
      [FIX.workerA, FIX.spouseA, FIX.workerB, FIX.spouseB],
    );
    await client.query(
      `insert into public.households (id, name, owner_id) values ($1,'Foyer A',$2),($3,'Foyer B',$4)`,
      [FIX.householdA, FIX.workerA, FIX.householdB, FIX.workerB],
    );
    await client.query(
      `insert into public.memberships (household_id, profile_id, role) values
        ($1,$2,'worker'),($1,$3,'spouse'),($4,$5,'worker'),($4,$6,'spouse')`,
      [FIX.householdA, FIX.workerA, FIX.spouseA, FIX.householdB, FIX.workerB, FIX.spouseB],
    );
    await client.query(
      `insert into public.worker_assignments (household_id, profile_id, team) values
        ($1,$2,'A'),($3,$4,'C')`,
      [FIX.householdA, FIX.workerA, FIX.householdB, FIX.workerB],
    );
    // cycle_templates ensemencé depuis le gabarit VALIDÉ du moteur (cohérence moteur↔BD) :
    // mêmes valeurs pour les deux foyers, seul household_id change.
    await client.query(
      `insert into public.cycle_templates
        (household_id, name, anchor_date, pattern, day_start, day_end, night_start, night_end) values
        ($1,'Pitman 2-2-3',$3,$4::boolean[],$5,$6,$7,$8),
        ($2,'Pitman 2-2-3',$3,$4::boolean[],$5,$6,$7,$8)`,
      [
        FIX.householdA,
        FIX.householdB,
        GRANDFORD_CYCLE.anchorDate,
        [...GRANDFORD_CYCLE.pattern],
        GRANDFORD_CYCLE.dayHours.start,
        GRANDFORD_CYCLE.dayHours.end,
        GRANDFORD_CYCLE.nightHours.start,
        GRANDFORD_CYCLE.nightHours.end,
      ],
    );
    // Une exception (absence) par foyer + son motif privé.
    await client.query(
      `insert into public.exceptions (id, household_id, profile_id, on_date, effect, created_by) values
        ($1,$2,$3,'2026-06-15','off',$3),($4,$5,$6,'2026-06-16','off',$6)`,
      [FIX.exceptionA, FIX.householdA, FIX.workerA, FIX.exceptionB, FIX.householdB, FIX.workerB],
    );
    await client.query(
      `insert into public.exception_private (exception_id, household_id, owner_id, motif, note) values
        ($1,$2,$3,'maladie','rendez-vous médical'),($4,$5,$6,'conge',null)`,
      [FIX.exceptionA, FIX.householdA, FIX.workerA, FIX.exceptionB, FIX.householdB, FIX.workerB],
    );
  });
}
