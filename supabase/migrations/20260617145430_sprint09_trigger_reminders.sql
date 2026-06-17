-- Sprint 9 — Déplacer la génération des rappels de la RPC vers un trigger.
-- Motif : les écarts issus de requêtes approuvées (FR-9) doivent aussi générer
-- des rappels. Un trigger AFTER INSERT sur `exceptions` est le seul chemin unique
-- (note : trigger de revue Sprint 7, architecture.md:121).
--
-- Logique identique à l'INSERT retiré de create_exception_with_motif :
--   offsets fixes 30/7/1 j, heure 09:00 America/Toronto,
--   uniquement strictement futurs par rapport à la date civile locale au moment du INSERT.
--   profile_id NULL = tout le foyer (bidirectionnel, FR-10).
--   channel = 'push'.
--
-- SECURITY INVOKER : la policy reminders_all (membre du foyer) s'applique à
-- l'appelant. Le trigger hérite du rôle de la transaction appelante.

create or replace function public.generate_reminders_for_exception()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Toronto')::date;
begin
  insert into public.reminders (household_id, profile_id, exception_id, remind_at, lead, channel)
  select
    new.household_id,
    null,
    new.id,
    ((new.on_date - l.offset_days) + time '09:00') at time zone 'America/Toronto',
    l.lead,
    'push'
  from (values (30, 'month'), (7, 'week'), (1, 'day')) as l (offset_days, lead)
  where (new.on_date - l.offset_days) > v_today;

  return new;
end;
$$;

create trigger trg_generate_reminders
  after insert on public.exceptions
  for each row
  execute function public.generate_reminders_for_exception();

-- Mettre à jour create_exception_with_motif : retirer l'INSERT dans reminders
-- (le trigger s'en charge désormais). Le reste de la fonction est inchangé.
create or replace function public.create_exception_with_motif(
  p_household_id uuid,
  p_on_date date,
  p_effect text,
  p_motif text,
  p_shift text default null
) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_exception uuid := gen_random_uuid();
begin
  insert into public.exceptions (id, household_id, profile_id, on_date, effect, shift, created_by)
  values (v_exception, p_household_id, v_uid, p_on_date, p_effect, p_shift, v_uid);

  insert into public.exception_private (exception_id, household_id, owner_id, motif)
  values (v_exception, p_household_id, v_uid, p_motif);

  -- Les rappels sont maintenant générés par le trigger trg_generate_reminders
  -- sur la table exceptions (AFTER INSERT). Pas d'INSERT ici : 0 doublement garanti.

  return v_exception;
exception
  when unique_violation then
    raise exception 'écart déjà saisi ce jour-là' using errcode = 'GF005';
end;
$$;

-- (create or replace conserve les grants existants : authenticated + service_role.)
