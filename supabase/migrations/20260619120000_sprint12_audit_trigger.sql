-- Sprint 12 — Alimenter audit_log à chaque changement sur exceptions (FR-13).
-- Objectif : traçabilité partagée dans le couple — chaque écart saisi, modifié
-- ou supprimé laisse une entrée lisible dans audit_log.
--
-- Design :
--   - SECURITY INVOKER : hérite du rôle de la transaction appelante (authenticated
--     pour les actions utilisateur, service_role pour les Edge Functions → BYPASSRLS).
--   - metadata ne contient JAMAIS le motif (R7) — seuls on_date, effect, shift.
--   - actor_id = auth.uid() ; NULL si la transaction n'est pas une session GoTrue
--     (colonne nullable par design : on delete set null dans le schéma initial).
--   - Pas de conflit avec trg_generate_reminders (Sprint 9) : celui-ci s'exécute
--     sur AFTER INSERT seulement ; notre trigger couvre INSERT/UPDATE/DELETE.

create or replace function public.log_exception_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action       text;
  v_on_date      date;
  v_effect       text;
  v_shift        text;
  v_entity_id    text;
  v_household_id uuid;
  v_actor_id     uuid;
begin
  -- auth.uid() lit le GUC request.jwt.claims ; hors session GoTrue (seed, admin) ce GUC
  -- est vide et ::json échoue. On l'évalue prudemment et on retombe sur NULL.
  begin
    v_actor_id := auth.uid();
  exception when others then
    v_actor_id := null;
  end;
  if TG_OP = 'DELETE' then
    v_action       := 'exception_deleted';
    v_on_date      := OLD.on_date;
    v_effect       := OLD.effect;
    v_shift        := OLD.shift;
    v_entity_id    := OLD.id::text;
    v_household_id := OLD.household_id;
  elsif TG_OP = 'INSERT' then
    v_action       := 'exception_created';
    v_on_date      := NEW.on_date;
    v_effect       := NEW.effect;
    v_shift        := NEW.shift;
    v_entity_id    := NEW.id::text;
    v_household_id := NEW.household_id;
  else
    v_action       := 'exception_updated';
    v_on_date      := NEW.on_date;
    v_effect       := NEW.effect;
    v_shift        := NEW.shift;
    v_entity_id    := NEW.id::text;
    v_household_id := NEW.household_id;
  end if;

  -- Lors d'une suppression en cascade du foyer, le foyer est déjà retiré de la table
  -- avant que ce trigger s'exécute → le FK audit_log→households échouerait. Dans ce
  -- cas, on saute simplement le log : le foyer entier disparaît de toute façon (Loi 25).
  if exists (select 1 from public.households where id = v_household_id) then
    insert into public.audit_log (household_id, actor_id, action, entity, entity_id, metadata)
    values (
      v_household_id,
      v_actor_id,
      v_action,
      'exception',
      v_entity_id,
      jsonb_build_object('on_date', v_on_date, 'effect', v_effect, 'shift', v_shift)
    );
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

create trigger trg_audit_exception
  after insert or update or delete on public.exceptions
  for each row
  execute function public.log_exception_change();

-- Resserrement de la policy INSERT sur audit_log : un membre du foyer ne peut insérer
-- que des lignes où actor_id = soi-même (ou NULL pour les chemins hors-session GoTrue).
-- Sans cette contrainte, un membre pourrait usurper l'identité de l'autre dans le journal.
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (actor_id = (select auth.uid()) or actor_id is null)
  );
