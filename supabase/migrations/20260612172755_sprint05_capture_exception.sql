-- Sprint 5 — Capture d'exception ≤ 3 taps (FR-4, FR-5, FR-7).
-- Réf. : carte de sprint ; .claude/rules/supabase-rls.md (étanchéité du motif, R7).
--
-- Un seul apport : l'écriture ATOMIQUE d'un écart et de son motif. Deux inserts
-- client ne sont pas transactionnels — un échec du second laisserait un écart sans
-- motif (ou pire, l'inverse). Cette RPC est l'unique chemin d'écriture de la capture.
--
-- SECURITY INVOKER (défaut) : la RLS du Sprint 2 reste la barrière —
--   exceptions_all exige d'être membre du foyer ;
--   exception_private_owner_only exige owner_id = auth.uid() ;
--   les FK composites forcent owner_id = profile_id de l'exception parente.
-- La fonction n'ajoute QUE l'atomicité ; elle ne contourne aucun droit. Le motif
-- n'apparaît dans aucun message d'erreur (règle securite-secrets.md).

-- WHY p_shift en dernier avec défaut null : une absence (off) n'a pas de quart ; le
-- défaut SQL rend l'argument optionnel dans les types générés (pas de cast côté TS).
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
  -- WHY id pré-généré (même raison que create_household_with_membership, Sprint 3) :
  -- pas de dépendance à la visibilité de la ligne fraîchement insérée sous RLS.
  v_exception uuid := gen_random_uuid();
begin
  -- L'écart est TOUJOURS celui de l'appelant (profile_id = auth.uid()) : on ne peut
  -- pas saisir un écart au nom de quelqu'un d'autre par ce chemin.
  insert into public.exceptions (id, household_id, profile_id, on_date, effect, shift, created_by)
  values (v_exception, p_household_id, v_uid, p_on_date, p_effect, p_shift, v_uid);

  insert into public.exception_private (exception_id, household_id, owner_id, motif)
  values (v_exception, p_household_id, v_uid, p_motif);

  return v_exception;
exception
  -- WHY un ERRCODE maison (classe « GF », cf. redeem_invitation) : le client mappe
  -- par SQLSTATE stable, jamais par le texte. 23505 = unique (household_id,
  -- profile_id, on_date) — un seul écart par travailleur et par jour.
  when unique_violation then
    raise exception 'écart déjà saisi ce jour-là' using errcode = 'GF005';
end;
$$;

revoke all on function public.create_exception_with_motif(uuid, date, text, text, text)
  from public;
grant execute on function public.create_exception_with_motif(uuid, date, text, text, text)
  to authenticated, service_role;
