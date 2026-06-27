-- Sprint 22 — Note du frigo : indicateur « Édité ».
-- Objectif : pouvoir distinguer une note RÉÉDITÉE d'une note neuve, via updated_at.
--
-- PROBLÈME du trigger partagé set_updated_at() (initial_schema.sql) : il bumpe updated_at
-- à CHAQUE update. Or l'accusé de lecture inter-membre passe par le RPC
-- marquer_note_frigo_lue (UPDATE de read_at/read_by) — donc une note simplement LUE verrait
-- updated_at > created_at et serait faussement étiquetée « Édité ». La comparaison ne
-- distinguerait pas « lue » de « éditée ».
--
-- CORRECTION : un trigger PROPRE à fridge_notes qui ne bumpe updated_at QUE si le corps
-- (body) change réellement. now() étant stable dans une transaction, une note fraîche a
-- updated_at == created_at exactement ; une lecture (corps inchangé) laisse updated_at
-- intact ; seule une vraie édition du corps avance updated_at. « updatedAt > createdAt »
-- redevient un signal fiable de « ce corps a été modifié ».
--
-- Aucun nouveau champ : updated_at existe déjà (Sprint 20). Pas de motif, pas de donnée
-- sensible (R7) — updated_at est un simple horodatage.
create or replace function public.set_fridge_notes_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `is distinct from` gère les nulls ; ici body est non-null, mais on reste défensif.
  if new.body is distinct from old.body then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Remplace le trigger partagé par le trigger spécifique au frigo (le RPC d'accusé de
-- lecture ne bumpera donc plus updated_at).
drop trigger if exists trg_fridge_notes_updated on public.fridge_notes;
create trigger trg_fridge_notes_updated before update on public.fridge_notes
  for each row execute function public.set_fridge_notes_updated();
