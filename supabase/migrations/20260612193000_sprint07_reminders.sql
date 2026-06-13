-- Sprint 7 — Notifications (FR-10) : matérialisation des rappels à la capture.
-- Réf. : carte de sprint ; docs/analyse/03-architecture/architecture.md:121 ;
-- .claude/rules/supabase-rls.md (R7 : la table reminders ne porte AUCUN motif).
--
-- La RPC du Sprint 5 reste l'UNIQUE chemin d'écriture de la capture ; on y ajoute
-- l'insertion des échéances 1 mois / 1 semaine / 1 jour dans la MÊME transaction :
-- un écart sans rappels (ou l'inverse) est impossible. La suppression suit déjà
-- par cascade (reminders.exception_id → exceptions, on delete cascade).
--
-- Échéances — parité STRICTE avec lib/notifications/echeances.ts (testée dans
-- supabase/tests/reminders.test.ts) :
--   « mois » = 30 jours, « semaine » = 7, « veille » = 1. Offsets fixes en jours,
--   jamais interval '1 month' (28-31 j : TS et SQL divergeraient silencieusement).
--   Une échéance n'est créée que si sa date civile (America/Toronto) est
--   STRICTEMENT future au moment de la saisie : un rappel le jour même de la
--   capture ne rappelle rien — on vient de la saisir.
--   Heure d'envoi : 09:00 America/Toronto — pg_cron est horaire (architecture.md:121)
--   et 9 h locale est visible au réveil sans sonner la nuit.
--
-- Destinataire : profile_id NULL = TOUS les membres du foyer. FR-10 est
-- bidirectionnel (le travailleur ET la conjointe sont rappelés) mais l'écart n'a
-- qu'UNE série d'échéances : l'Edge Function send-reminders fait l'éventail vers
-- les appareils (push_subscriptions) de chaque membre au moment de l'envoi.
-- channel = 'push' : canal primaire ; le repli courriel se décide à l'envoi.

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
  -- Date civile locale du foyer : le « aujourd'hui » de la règle d'échéance.
  v_today date := (now() at time zone 'America/Toronto')::date;
begin
  -- L'écart est TOUJOURS celui de l'appelant (profile_id = auth.uid()) : on ne peut
  -- pas saisir un écart au nom de quelqu'un d'autre par ce chemin.
  insert into public.exceptions (id, household_id, profile_id, on_date, effect, shift, created_by)
  values (v_exception, p_household_id, v_uid, p_on_date, p_effect, p_shift, v_uid);

  insert into public.exception_private (exception_id, household_id, owner_id, motif)
  values (v_exception, p_household_id, v_uid, p_motif);

  -- Rappels (Sprint 7) : SECURITY INVOKER comme le reste — la policy reminders_all
  -- (membre du foyer) s'applique à l'appelant, déjà validé par l'insert ci-dessus.
  insert into public.reminders (household_id, profile_id, exception_id, remind_at, lead, channel)
  select
    p_household_id,
    null,
    v_exception,
    ((p_on_date - l.offset_days) + time '09:00') at time zone 'America/Toronto',
    l.lead,
    'push'
  from (values (30, 'month'), (7, 'week'), (1, 'day')) as l (offset_days, lead)
  where (p_on_date - l.offset_days) > v_today;

  return v_exception;
exception
  -- WHY un ERRCODE maison (classe « GF », cf. redeem_invitation) : le client mappe
  -- par SQLSTATE stable, jamais par le texte. 23505 = unique (household_id,
  -- profile_id, on_date) — un seul écart par travailleur et par jour.
  when unique_violation then
    raise exception 'écart déjà saisi ce jour-là' using errcode = 'GF005';
end;
$$;

-- (create or replace conserve les grants du Sprint 5 : authenticated + service_role.)
