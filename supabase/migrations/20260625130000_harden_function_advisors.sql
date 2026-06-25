-- Durcissement issu des advisors sécurité Supabase (niveau WARN). Rejoue à
-- l'identique ce qui a été appliqué sur le Cloud via le MCP (parité dépôt ↔ prod,
-- règle supabase-rls.md : toute modif Cloud est rejouée en migration versionnée).

-- 1) search_path fixe sur set_updated_at (function_search_path_mutable).
-- La fonction n'utilise que now() (pg_catalog, toujours résolu) → '' est sûr.
alter function public.set_updated_at() set search_path = '';

-- 2) Retirer le droit EXECUTE par défaut (PUBLIC → anon/authenticated) sur
-- rls_auto_enable : helper d'infra SECURITY DEFINER jamais appelé par l'app ;
-- le propriétaire conserve l'accès.
-- GARDÉ par un test d'existence : cette fonction est présente sur le Cloud mais
-- ABSENTE du dépôt (Cloud-only). Sans la garde, le rejeu de cette migration sur
-- une BD locale vierge (supabase/tests/global-setup.ts) échouerait — la garde la
-- rend simplement no-op là où la fonction n'existe pas.
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace
  ) then
    revoke execute on function public.rls_auto_enable() from anon, public;
  end if;
end $$;
