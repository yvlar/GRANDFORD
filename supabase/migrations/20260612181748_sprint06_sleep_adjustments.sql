-- Sprint 6 — Fenêtre de sommeil par défaut (FR-6) : l'ajustement AU CAS PAR CAS.
-- Réf. : carte de sprint (prémisse 3 tranchée : table dédiée) ; supabase-rls.md.
--
-- `sleep_defaults` (Sprint 2) porte la fenêtre configurée UNE fois ; cette table
-- porte les exceptions PAR DATE — même logique que le couple moteur/écarts : le
-- défaut se calcule, seul l'écart se persiste. Une ligne = « ce jour-là, la fenêtre
-- est celle-ci » ; la supprimer ramène le jour au défaut.
--
-- C'est de la DISPONIBILITÉ partageable (la conjointe sait quand ne pas déranger),
-- pas un motif : la policy « membre du foyer » est la bonne, comme sleep_defaults.

create table public.sleep_adjustments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  on_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un seul ajustement par travailleur et par jour ; son préfixe (household_id, …)
  -- couvre aussi les filtres RLS/vue — pas d'index simple en double (cf. schéma initial).
  unique (household_id, profile_id, on_date)
);

create trigger trg_sleep_adjustments_updated before update on public.sleep_adjustments
  for each row execute function public.set_updated_at();

-- Mêmes privilèges et même policy que les autres tables « membre du foyer »
-- (modèle : 20260611192623_rls_policies.sql).
grant select, insert, update, delete on public.sleep_adjustments to authenticated;
grant select, insert, update, delete on public.sleep_adjustments to service_role;
revoke all on public.sleep_adjustments from anon;

alter table public.sleep_adjustments enable row level security;
create policy sleep_adjustments_all on public.sleep_adjustments for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
