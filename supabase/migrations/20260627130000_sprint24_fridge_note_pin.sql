-- Sprint 24 — Note du frigo : épingler une note de tête en haut du tableau.
-- Cas d'usage : une note permanente (liste d'épicerie) reste visible au-dessus du tri
-- récent-d'abord. Suite des Sprints 20-23.
--
-- Décisions produit (session) :
--   • Portée : AUTEUR SEUL — on n'épingle/détache que SA propre note.
--   • Quantité : UNE SEULE épingle par foyer — épingler une nouvelle note détache la précédente.
--   • Pas de notification push (action organisationnelle, faible signal).
--
-- R7 : is_pinned est un simple drapeau — aucune donnée sensible, aucun motif d'absence.
--
-- POURQUOI un RPC SECURITY DEFINER (et pas un simple UPDATE sous RLS) :
--   1) la policy fridge_notes_update durcie (Sprint 21) impose read_at/read_by NULS dans son
--      WITH CHECK ; un UPDATE direct de is_pinned sur une note DÉJÀ LUE (read_at non nul)
--      échouerait — ou forcerait un reset d'accusé erroné. Le RPC ne touche jamais read_at.
--   2) « une épingle par foyer » exige de détacher l'épingle de l'AUTRE membre ; la RLS
--      auteur-seul l'interdit. Le DEFINER (exempt de RLS) le fait, tout en vérifiant
--      DANS la fonction que l'appelant est bien l'AUTEUR de la note qu'il épingle.
-- Calque exact de marquer_note_frigo_lue (Sprint 20) : language plpgsql, search_path vide,
-- noms qualifiés, autorisations vérifiées dans le corps.

-- 1) Colonne drapeau. Défaut false : les notes existantes ne sont pas épinglées.
alter table public.fridge_notes add column is_pinned boolean not null default false;

-- 2) Invariant « épingle = note de tête seulement » au niveau données (un CHECK suffit :
--    is_pinned et parent_id sont sur la même ligne). Une réponse ne peut jamais être épinglée.
alter table public.fridge_notes
  add constraint fridge_notes_pin_head_only check (not (is_pinned and parent_id is not null));

-- 3) Invariant « une seule épingle par foyer » — index unique partiel = rempart BD tous
--    chemins confondus (même un UPDATE direct hors RPC ne peut pas créer une 2ᵉ épingle).
create unique index idx_fridge_notes_one_pin
  on public.fridge_notes (household_id) where is_pinned;

-- 4) RPC d'épinglage (auteur seul, une épingle/foyer). Ne touche NI body NI read_at :
--    le trigger set_fridge_notes_updated (Sprint 22) ne bumpe donc pas updated_at
--    (pas de faux « Édité ») et l'accusé de lecture n'est jamais réinitialisé.
create or replace function public.epingler_note_frigo(note_id uuid, pin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household uuid;
  v_author uuid;
  v_parent uuid;
begin
  select household_id, author_id, parent_id
    into v_household, v_author, v_parent
    from public.fridge_notes where id = note_id;
  if not found then
    raise exception 'note introuvable (%).', note_id;
  end if;
  -- Membre du foyer : parité avec marquer_note_frigo_lue. Un membre RÉVOQUÉ garde author_id
  -- sur ses anciennes notes ; sans cette garde, il pourrait encore les épingler (et, via le
  -- détachement cross-auteur, vider l'épingle du foyer) par un appel RPC direct, alors qu'il
  -- a perdu tout accès en lecture (RLS). Le DEFINER bypasse la RLS → on vérifie ici.
  if not public.is_household_member(v_household) then
    raise exception 'accès au foyer refusé.';
  end if;
  -- Auteur seul : on n'épingle/détache que sa propre note.
  if v_author <> v_uid then
    raise exception 'seul l''auteur peut épingler sa note.';
  end if;
  -- Tête seulement : une réponse ne s'épingle pas (cohérent avec le CHECK ci-dessus).
  if pin and v_parent is not null then
    raise exception 'une réponse ne peut pas être épinglée.';
  end if;

  if pin then
    -- Une seule épingle par foyer : détache d'abord l'épingle existante (y compris celle de
    -- l'AUTRE membre — le DEFINER le permet), puis épingle la cible. L'ordre garde l'index
    -- unique partiel satisfait à chaque instruction.
    update public.fridge_notes
       set is_pinned = false
     where household_id = v_household and is_pinned and id <> note_id;
    update public.fridge_notes set is_pinned = true where id = note_id;
  else
    update public.fridge_notes set is_pinned = false where id = note_id;
  end if;
end;
$$;

revoke all on function public.epingler_note_frigo(uuid, boolean) from public;
grant execute on function public.epingler_note_frigo(uuid, boolean) to authenticated;

-- Realtime : aucune action. fridge_notes est déjà dans la publication supabase_realtime
-- (Sprint 20) ; les UPDATE d'épingle circulent par le même filtre household_id, donc les
-- deux membres voient l'épingle bouger en direct.
