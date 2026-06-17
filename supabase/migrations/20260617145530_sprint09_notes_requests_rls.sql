-- Sprint 9 — Affiner la policy RLS sur requests (FR-9 : co-planification conjointe).
--
-- La policy initiale (rls_policies.sql) utilisait un `for all` permissif sur
-- requests : n'importe quel membre pouvait modifier le statut.
-- Correction : seul target_profile_id (le travailleur ciblé) peut UPDATE.
-- Les notes (notes_all) sont déjà correctes — pas de modification nécessaire.

-- Retirer la policy trop permissive.
drop policy if exists requests_all on public.requests;

-- Remplacer par des policies granulaires :
--   SELECT : tout membre du foyer voit les requêtes du foyer.
create policy requests_select on public.requests for select to authenticated
  using (public.is_household_member(household_id));

--   INSERT : tout membre peut soumettre une requête.
create policy requests_insert on public.requests for insert to authenticated
  with check (public.is_household_member(household_id));

--   UPDATE : le travailleur ciblé (target_profile_id) UNIQUEMENT peut changer le statut.
--   WHY : la conjointe ne doit jamais auto-approuver une requête qu'elle a soumise (R7 connexe).
create policy requests_update on public.requests for update to authenticated
  using ((select auth.uid()) = target_profile_id)
  with check ((select auth.uid()) = target_profile_id);

--   DELETE : tout membre du foyer peut supprimer une requête (ex. annuler une demande).
create policy requests_delete on public.requests for delete to authenticated
  using (public.is_household_member(household_id));
