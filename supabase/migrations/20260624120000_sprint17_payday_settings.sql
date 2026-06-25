-- Sprint 17 — Jour de paye (worker-private, déterministe).
-- Config de paye d'un travailleur : ancre + fréquence. Le moteur (lib/schedule/payday.ts)
-- calcule les jours de paye à la volée — on ne stocke JAMAIS les dates, seulement la config.
--
-- Étanchéité (même classe que exception_private / R7) : la paye est PRIVÉE au travailleur.
-- La policy ci-dessous est « propriétaire seul » (profile_id = auth.uid()), SANS clause
-- « membre du foyer » → la conjointe (pourtant membre) obtient 0 ligne. La visibilité se
-- joue donc en BD, pas seulement dans l'UI.

create table public.payday_settings (
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade, -- le travailleur
  anchor_date date not null, -- une paye connue : l'ancre du cycle
  frequence text not null check (frequence in ('hebdomadaire', 'aux_2_semaines')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, profile_id) -- une seule config de paye par travailleur/foyer
);

-- WHY index sur profile_id : la policy filtre par profile_id = auth.uid() ; le préfixe de la
-- PK (household_id, profile_id) ne couvre pas profile_id seul → index dédié pour la RLS.
create index idx_payday_settings_profile on public.payday_settings (profile_id);

create trigger trg_payday_settings_updated before update on public.payday_settings
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.payday_settings to authenticated;

alter table public.payday_settings enable row level security;

-- Étanchéité stricte (R7) : SEUL le propriétaire de la ligne lit/écrit sa paye.
--   • using  : owner-only pur (profile_id = soi) — la conjointe, même membre, lit 0 ligne.
--   • check  : owner-only ET membre du foyer — empêche d'écrire une paye rattachée à un
--     household_id auquel on n'appartient pas (intégrité multi-tenant, supabase-rls.md :
--     « membre du foyer via household_id » est la base ; exception_private s'en passe car ses
--     FK composites lient structurellement le foyer, ce que payday_settings n'a pas).
create policy payday_settings_owner_only on public.payday_settings for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and public.is_household_member(household_id));
