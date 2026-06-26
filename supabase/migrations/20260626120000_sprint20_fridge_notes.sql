-- Sprint 20 — Note du frigo (tableau partagé, accusés de lecture live).
-- Tableau de notes LIBRES (PAS liées à une date civile, contrairement à public.notes / FR-8).
-- Les DEUX membres du foyer postent ; SEUL l'auteur retire. L'accusé de lecture
-- (read_at / read_by) est posé par l'AUTRE membre via le RPC SECURITY DEFINER ci-dessous
-- (pas d'UPDATE libre du corps).
--
-- R7 : le corps d'une note du frigo est une remarque de couple — JAMAIS un motif d'absence.
-- Aucune jointure vers exception_private ; rien de sensible dans les logs ou le payload push.
--
-- Forme de l'accusé (foyer à 2) : une seule paire read_at / read_by suffit — « l'autre »
-- est un individu unique. Pas de table d'accusés (sur-ingénierie pour un tenant à 2,
-- cf. la config mono-ligne de payday_settings, Sprint 17).

create table public.fridge_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  read_at timestamptz, -- posé par l'AUTRE membre (RPC marquer_note_frigo_lue)
  read_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cohérence : lu ⇔ on sait par qui (les deux ensemble, ou aucun des deux).
  constraint fridge_notes_read_coherent check ((read_at is null) = (read_by is null))
);

-- WHY index (household_id, created_at desc) : la RLS et la page filtrent par foyer et
-- affichent les notes les plus récentes d'abord.
create index idx_fridge_notes_household on public.fridge_notes (household_id, created_at desc);
-- WHY index partiel non-lues : le compteur « Nouveau » de l'accueil ne compte que les
-- notes non lues — un index ciblé garde ce count rapide sans alourdir les écritures.
create index idx_fridge_notes_unread on public.fridge_notes (household_id) where read_at is null;

create trigger trg_fridge_notes_updated before update on public.fridge_notes
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.fridge_notes to authenticated;

alter table public.fridge_notes enable row level security;

-- Policies SPLIT (PAS un seul `for all`) : le DELETE doit être réservé à l'auteur.
--   SELECT : membre du foyer — lecture PARTAGÉE (les deux conjoints voient le tableau).
create policy fridge_notes_select on public.fridge_notes for select to authenticated
  using (public.is_household_member(household_id));
--   INSERT : membre du foyer, et on s'attribue la note (author_id = soi). On INTERDIT de
--   poser un accusé de lecture à l'insertion (read_at/read_by null) : forger « l'autre a lu »
--   n'appartient qu'au RPC SECURITY DEFINER (qui, lui, bypasse la RLS). Symétrie avec le RPC
--   qui refuse l'auto-accusé — ici la voie d'insertion brute ne peut pas le contourner.
create policy fridge_notes_insert on public.fridge_notes for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and author_id = (select auth.uid())
    and read_at is null
    and read_by is null
  );
--   UPDATE : auteur seul (édition future du corps). L'accusé de lecture INTER-membre ne
--   passe PAS par ici — il passe par le RPC SECURITY DEFINER (un non-auteur ne peut donc
--   jamais réécrire le corps via une UPDATE directe).
create policy fridge_notes_update on public.fridge_notes for update to authenticated
  using (author_id = (select auth.uid()) and public.is_household_member(household_id))
  with check (author_id = (select auth.uid()) and public.is_household_member(household_id));
--   DELETE : auteur seul (défense en profondeur, en plus du .eq("author_id") applicatif).
create policy fridge_notes_delete on public.fridge_notes for delete to authenticated
  using (author_id = (select auth.uid()) and public.is_household_member(household_id));

-- Realtime : publier la table pour les changements live (INSERT → nouvelle note,
-- UPDATE → « Lu ✓ »). Les abonnés ne reçoivent QUE les lignes passant la RLS SELECT
-- ci-dessus (Realtime applique la RLS du rôle de la connexion).
-- WHY garde : la publication supabase_realtime est fournie par la plateforme Supabase
-- (Cloud) ; le Postgres LOCAL des tests d'isolation ne l'a pas. On n'ajoute la table que
-- si la publication existe ET ne la contient pas déjà — migration sûre dans les deux mondes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fridge_notes'
     )
  then
    alter publication supabase_realtime add table public.fridge_notes;
  end if;
end $$;

-- RPC d'accusé de lecture : laisse l'AUTRE membre poser read_at / read_by SANS pouvoir
-- toucher au corps (la RLS niveau colonne n'existe pas en Postgres → on isole l'écriture
-- privilégiée dans une fonction au périmètre minimal).
--
-- Autorisations vérifiées DANS la fonction (elle tourne en DEFINER = exempte de RLS) :
--   • l'appelant est membre du foyer de la note ;
--   • l'appelant n'est PAS l'auteur (on ne s'accuse pas sa propre note) ;
--   • read_at est encore nul (idempotent : 2ᵉ appel = no-op, pas d'écrasement d'horodatage).
-- Retourne true si une ligne a été marquée (la transition null→lu déclenche le push « lu »).
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
     and f.read_at is null
     and f.author_id <> v_uid
     and public.is_household_member(f.household_id); -- membre du foyer de CETTE note
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.marquer_note_frigo_lue(uuid) from public;
grant execute on function public.marquer_note_frigo_lue(uuid) to authenticated;
