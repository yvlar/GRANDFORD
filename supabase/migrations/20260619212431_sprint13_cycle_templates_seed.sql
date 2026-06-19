-- Sprint 13 — Ensemencement initial de cycle_templates (FR-17).
-- Insère le gabarit GRANDFORD_CYCLE pour tous les foyers qui n'en ont pas encore.
-- Idempotent : la contrainte PK + ON CONFLICT empêche les doublons.
--
-- Valeurs du gabarit validées (docs/analyse/01-decouverte/02-cas-utilisation.md:61-85) :
--   ancre : 2026-06-03 (mercredi = A/C) ; pattern 14 jours ; quart jour 07–19, nuit 19–07.
-- WHY INSERT … SELECT : gère n foyers en une seule instruction, sans connaître leurs IDs.

insert into public.cycle_templates (household_id, name, anchor_date, pattern, day_start, day_end, night_start, night_end, is_active)
select
  h.id,
  'Pitman 2-2-3',
  '2026-06-03'::date,
  '{true,true,false,false,false,true,true,false,false,true,true,true,false,false}'::boolean[],
  '07:00'::time,
  '19:00'::time,
  '19:00'::time,
  '07:00'::time,
  true
from public.households h
where not exists (
  select 1 from public.cycle_templates ct where ct.household_id = h.id
);
