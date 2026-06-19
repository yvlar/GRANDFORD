-- Sprint 14 — Affinage des policies RLS de cycle_templates (FR-17 fin).
-- La policy générique cycle_templates_all accordait l'écriture (UPDATE) à TOUS les
-- membres du foyer, incluant la conjointe. On remplace par deux policies fines :
--   • SELECT : tous les membres du foyer (la conjointe lit le gabarit pour afficher son horaire).
--   • UPDATE : propriétaire du foyer uniquement (seul le travailleur change le gabarit).
-- INSERT / DELETE : non exposés par l'UI (seed via migration service_role, bypass RLS) ;
-- aucune policy ne les couvre délibérément → rejet par défaut sauf service_role.

drop policy if exists cycle_templates_all on public.cycle_templates;

create policy cycle_templates_select on public.cycle_templates
  for select to authenticated
  using (public.is_household_member(household_id));

create policy cycle_templates_update on public.cycle_templates
  for update to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));
