-- Sprint 2 — RLS « membre du foyer » sur TOUTE table + étanchéité du motif (R7).
-- Réf. : .claude/rules/supabase-rls.md ; architecture.md:110-111.
--
-- Modèle : chaque table de foyer porte household_id ; un usager n'accède qu'aux foyers
-- où il a une `membership`. Le MOTIF (exception_private) déroge : lecture/écriture =
-- travailleur propriétaire UNIQUEMENT. La conjointe lit `exceptions` (disponibilité),
-- jamais le motif — aucune policy ne le lui expose.

-- ───────────────────────────── Helpers d'autorisation ─────────────────────────────
-- SECURITY DEFINER : exécutées comme le propriétaire (postgres, exempt de RLS) afin
-- d'éviter la récursion — la policy de `memberships` appelle is_household_member, qui
-- lit `memberships`. search_path vidé + identifiants qualifiés (durcissement).

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.household_id = hid
      and m.profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.households h
    where h.id = hid
      and h.owner_id = (select auth.uid())
  );
$$;

-- Deux profils partagent-ils un foyer ? (sert la lecture de `profiles` entre conjoints.)
create or replace function public.shares_household_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships them on me.household_id = them.household_id
    where me.profile_id = (select auth.uid())
      and them.profile_id = other
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.shares_household_with(uuid) from public;
-- EXECUTE réservé à authenticated/service_role : anon n'évalue aucune policy (toutes
-- sont `to authenticated`) et n'a aucun accès aux tables — inutile d'exposer ces
-- fonctions DEFINER à un appelant anonyme.
grant execute on function public.is_household_member(uuid) to authenticated, service_role;
grant execute on function public.is_household_owner(uuid) to authenticated, service_role;
grant execute on function public.shares_household_with(uuid) to authenticated, service_role;

-- ───────────────────────────── Privilèges de table ─────────────────────────────
-- La RLS filtre les LIGNES, mais sans GRANT la table reste inaccessible. anon = aucun
-- accès aux données de foyer ; authenticated = CRUD filtré par RLS ; service_role = tout.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on
  public.profiles,
  public.households,
  public.memberships,
  public.cycle_templates,
  public.worker_assignments,
  public.exceptions,
  public.exception_private,
  public.sleep_defaults,
  public.notes,
  public.requests,
  public.reminders,
  public.push_subscriptions
  to authenticated;

-- audit_log : append-only pour authenticated (pas d'UPDATE/DELETE → journal immuable).
grant select, insert on public.audit_log to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;

-- Défense en profondeur : anon ne reçoit explicitement aucun privilège de table.
revoke all on all tables in schema public from anon;

-- ─────────────────────────────── Activation RLS ───────────────────────────────
-- Modèle d'application : la RLS s'évalue sur le rôle COURANT. Le client passe par
-- PostgREST en rôle `authenticated` (ni propriétaire, ni superutilisateur, ni BYPASSRLS)
-- → policies pleinement appliquées. Le serveur (Edge Functions) utilise `service_role`
-- (BYPASSRLS) volontairement. On n'active PAS `force row level security` : sur Supabase
-- le propriétaire `postgres` n'est pas superutilisateur, et FORCE soumettrait les helpers
-- SECURITY DEFINER à la RLS de `memberships` → récursion. Les tests impersonnent
-- `authenticated` (SET ROLE), donc la RLS y est réellement appliquée (vérifié).
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.cycle_templates enable row level security;
alter table public.worker_assignments enable row level security;
alter table public.exceptions enable row level security;
alter table public.exception_private enable row level security;
alter table public.sleep_defaults enable row level security;
alter table public.notes enable row level security;
alter table public.requests enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_log enable row level security;
alter table public.push_subscriptions enable row level security;

-- ─────────────────────────────────── Policies ───────────────────────────────────

-- profiles : on lit le sien et celui d'un co-membre ; on n'écrit que le sien.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_household_with(id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = (select auth.uid()));

-- households : visible aux membres ; créé par soi (devient propriétaire) ; modifié/supprimé
-- par le propriétaire.
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_insert on public.households for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy households_update on public.households for update to authenticated
  using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_owner(id));

-- memberships : visibles aux membres ; gérées par le propriétaire (invitation/révocation).
-- Un membre peut aussi supprimer SA propre adhésion (quitter le foyer).
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_household_member(household_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (public.is_household_owner(household_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_household_owner(household_id)) with check (public.is_household_owner(household_id));
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_household_owner(household_id) or profile_id = (select auth.uid()));

-- Tables de foyer « membre » : CRUD réservé aux membres du foyer.
create policy cycle_templates_all on public.cycle_templates for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy worker_assignments_all on public.worker_assignments for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy exceptions_all on public.exceptions for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy sleep_defaults_all on public.sleep_defaults for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy notes_all on public.notes for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy requests_all on public.requests for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy reminders_all on public.reminders for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- exception_private : LE MOTIF. Étanchéité stricte — SEUL le travailleur propriétaire.
-- Pas de clause « membre du foyer » : la conjointe (pourtant membre) obtient 0 ligne.
create policy exception_private_owner_only on public.exception_private for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- audit_log : journal en lecture pour les membres ; insertion par un membre ; jamais
-- de modification/suppression (pas de policy UPDATE/DELETE → append-only).
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_household_member(household_id));
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (public.is_household_member(household_id));

-- push_subscriptions : strictement personnels (ses propres appareils).
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
