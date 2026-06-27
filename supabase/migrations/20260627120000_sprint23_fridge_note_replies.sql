-- Sprint 23 — Note du frigo : réponses (fil à UN SEUL niveau).
-- Un membre peut RÉPONDRE à une note du frigo ; une réponse ne se répond pas elle-même
-- (pas de fil profond — décision produit en session). Suite des Sprints 20-22.
--
-- Modèle : parent_id auto-référent NULLABLE sur public.fridge_notes.
--   • note de tête (top-level) : parent_id null ;
--   • réponse : parent_id = id d'une note de tête du MÊME foyer.
-- Réutilise la table existante (pas de table séparée) : une réponse EST une note du frigo —
-- mêmes colonnes, même RLS de foyer, même Realtime, même édition/retrait auteur-seul.
--
-- R7 : le corps d'une réponse est une remarque de couple, JAMAIS un motif d'absence —
-- exactement comme une note de tête. Aucune donnée sensible ; parent_id est un simple id.
--
-- D1 (décision produit, session) : PAS d'accusé de lecture sur les réponses. Une réponse
-- EST l'accusé de la note parente. Les lignes de réponse gardent read_at/read_by null —
-- les policies INSERT/UPDATE durcies (Sprints 20/21 : read_* doivent rester nuls) le
-- garantissent déjà ; on ferme en plus la voie du RPC (il refusera une ligne de réponse).

-- 1) Colonne auto-référente. on delete cascade : retirer une note de tête retire ses
--    réponses (cohérent avec les cascades households/profiles déjà sur cette table).
alter table public.fridge_notes
  add column parent_id uuid references public.fridge_notes (id) on delete cascade;

-- WHY index partiel sur parent_id : on regroupe les réponses par parent à l'affichage ;
-- seules les lignes de réponse portent un parent_id (calque idx_fridge_notes_unread).
create index idx_fridge_notes_parent on public.fridge_notes (parent_id)
  where parent_id is not null;

-- 2) Invariant « un seul niveau » + même foyer que le parent. Un CHECK ne peut pas lire
--    une AUTRE ligne (le parent) → on l'impose par trigger (style set_fridge_notes_updated,
--    Sprint 22 : language plpgsql, search_path vide, noms qualifiés). Défense en profondeur
--    SOUS la RLS : même si une policy laissait passer, ce garde tient l'invariant de données.
create or replace function public.enforce_fridge_note_single_level()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.fridge_notes%rowtype;
begin
  if new.parent_id is null then
    return new; -- note de tête : rien à vérifier.
  end if;
  select * into v_parent from public.fridge_notes where id = new.parent_id;
  if not found then
    raise exception 'note parente introuvable (%).', new.parent_id;
  end if;
  -- Un seul niveau : le parent doit être lui-même une note de tête.
  if v_parent.parent_id is not null then
    raise exception 'une réponse ne peut pas répondre à une réponse (fil à un seul niveau).';
  end if;
  -- Un seul niveau, autre sens (UPDATE de re-parentage) : une note QUI A des réponses ne
  -- peut pas devenir elle-même une réponse — sinon Q→P→C, une chaîne à deux niveaux, et les
  -- réponses de P deviendraient orphelines. La RLS UPDATE laisse l'auteur changer parent_id ;
  -- cette garde tient donc l'invariant au niveau données (et pas seulement dans la vue).
  if exists (select 1 from public.fridge_notes c where c.parent_id = new.id) then
    raise exception 'une note ayant des réponses ne peut pas devenir une réponse (fil à un seul niveau).';
  end if;
  -- Cohérence de foyer : une réponse vit dans le foyer de sa note parente.
  if v_parent.household_id <> new.household_id then
    raise exception 'une réponse doit appartenir au foyer de sa note parente.';
  end if;
  return new;
end;
$$;

create trigger trg_fridge_notes_single_level before insert or update on public.fridge_notes
  for each row execute function public.enforce_fridge_note_single_level();

-- 3) RPC d'accusé de lecture : refuse une ligne de réponse (D1 : pas d'accusé sur réponse).
--    On ajoute `and f.parent_id is null` au prédicat — la transition null→lu ne se pose que
--    sur une note de tête. Idempotent/inoffensif sur une réponse (0 ligne → retourne false).
--    Le reste de la fonction est INCHANGÉ (cf. Sprint 20).
create or replace function public.marquer_note_frigo_lue(note_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_updated int;
begin
  update public.fridge_notes f
     set read_at = now(),
         read_by = v_uid
   where f.id = note_id
     and f.parent_id is null -- D1 : pas d'accusé de lecture sur une réponse
     and f.read_at is null
     and f.author_id <> v_uid
     and public.is_household_member(f.household_id);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.marquer_note_frigo_lue(uuid) from public;
grant execute on function public.marquer_note_frigo_lue(uuid) to authenticated;

-- Realtime : aucune action. fridge_notes est déjà dans la publication supabase_realtime
-- (Sprint 20) ; les lignes de réponse circulent par le même filtre household_id.
