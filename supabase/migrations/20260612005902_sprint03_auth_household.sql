-- Sprint 3 — Auth sans mot de passe + cycle de vie du foyer (FR-11, FR-12).
-- Réf. : docs/analyse/03-architecture/architecture.md:114-117 ; carte de sprint.
--
-- Trois apports :
--   1. Pont inscription → profil : trigger `handle_new_user` sur auth.users.
--   2. Création atomique foyer + membership(worker) à la 1re connexion (RPC).
--   3. Invitations à usage unique → membership(role='spouse') (table + RPC de rachat).
-- La révocation existe déjà (policy memberships_delete du Sprint 2) : rien à recréer.

-- ───────────────────── 1. Pont auth.users → public.profiles ─────────────────────
-- WHY SECURITY DEFINER : le trigger s'exécute lors d'un INSERT fait par GoTrue
-- (supabase_auth_admin), qui n'a aucun privilège sur public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing; -- WHY: idempotent si le profil a déjà été créé côté app
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── 2. Foyer à la 1re connexion : création atomique ─────────────
-- SECURITY INVOKER (défaut) : la RLS du Sprint 2 s'applique pleinement —
-- households_insert exige owner_id = auth.uid(), memberships_insert exige
-- is_household_owner. La fonction n'ajoute que l'atomicité (foyer sans
-- membership = état incohérent impossible).
create or replace function public.create_household_with_membership(p_name text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  -- WHY id pré-généré (pas de RETURNING) : la policy SELECT de households exige une
  -- membership, créée seulement à l'instruction suivante — un INSERT … RETURNING
  -- échouerait car la ligne neuve est encore invisible à son propre créateur.
  v_household uuid := gen_random_uuid();
  v_uid uuid := (select auth.uid());
  v_name text := btrim(p_name);
begin
  if v_name is null or v_name = '' then
    raise exception 'nom de foyer requis';
  end if;

  insert into public.households (id, name, owner_id)
  values (v_household, v_name, v_uid);

  insert into public.memberships (household_id, profile_id, role)
  values (v_household, v_uid, 'worker');

  return v_household;
end;
$$;

revoke all on function public.create_household_with_membership(text) from public;
grant execute on function public.create_household_with_membership(text) to authenticated, service_role;

-- ──────────────── 3. Invitations à usage unique (conjointe) ────────────────
-- Porte household_id comme toute table de foyer (règle supabase-rls.md). Le code
-- (uuid aléatoire) EST le secret du lien d'invitation ; il n'est lisible que par
-- le propriétaire (la conjointe rachète via la RPC SECURITY DEFINER, sans SELECT).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code uuid not null unique default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  -- WHY 7 jours : une invitation qui traîne est un secret qui traîne (SEC5).
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_invitations_household on public.invitations (household_id);

alter table public.invitations enable row level security;

-- Propriétaire seul : créer, lister, annuler (DELETE) ses invitations.
-- Pas de policy UPDATE pour authenticated : le marquage « utilisée » passe
-- exclusivement par redeem_invitation (SECURITY DEFINER) — la conjointe ne
-- touche jamais la table directement.
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_household_owner(household_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.is_household_owner(household_id));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.is_household_owner(household_id));

grant select, insert, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.invitations to service_role;

-- ───────────────────────── 4. Rachat d'une invitation ─────────────────────────
-- WHY SECURITY DEFINER : la future conjointe n'est PAS encore membre — la RLS lui
-- interdit (à juste titre) de lire l'invitation et d'insérer sa membership. Cette
-- fonction est l'unique passage : elle valide le code (existant, non utilisé, non
-- expiré), crée la membership(role='spouse') et brûle le code, atomiquement.
create or replace function public.redeem_invitation(p_code uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations%rowtype;
begin
  if v_uid is null then
    raise exception 'authentification requise';
  end if;

  -- FOR UPDATE : deux rachats simultanés du même code → un seul gagne.
  select * into v_invitation
  from public.invitations
  where code = p_code
  for update;

  -- WHY des ERRCODE maison (classe « GF ») : le client mappe l'erreur vers un message
  -- UI par code SQLSTATE stable — jamais par le texte, qui peut être reformulé/traduit.
  if not found then
    raise exception 'invitation invalide' using errcode = 'GF001';
  end if;
  if v_invitation.used_at is not null then
    raise exception 'invitation déjà utilisée' using errcode = 'GF002';
  end if;
  if v_invitation.expires_at < now() then
    raise exception 'invitation expirée' using errcode = 'GF003';
  end if;
  if exists (
    select 1 from public.memberships m
    where m.household_id = v_invitation.household_id and m.profile_id = v_uid
  ) then
    raise exception 'déjà membre de ce foyer' using errcode = 'GF004';
  end if;

  -- Filet : le profil existe normalement (trigger handle_new_user) ; on ne
  -- laisse pas un rachat échouer sur une course inscription/invitation.
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  insert into public.memberships (household_id, profile_id, role)
  values (v_invitation.household_id, v_uid, 'spouse');

  update public.invitations
  set used_at = now(), used_by = v_uid
  where id = v_invitation.id;

  return v_invitation.household_id;
end;
$$;

revoke all on function public.redeem_invitation(uuid) from public;
grant execute on function public.redeem_invitation(uuid) to authenticated, service_role;
