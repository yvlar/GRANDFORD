-- Sprint 25 — Listes d'épicerie dans l'espace du frigo.
-- Une liste partagée du foyer : un membre la crée ; les DEUX membres ajoutent, retirent
-- et cochent/décochent les éléments à acheter. Suite des Sprints 20-24 (canal du frigo),
-- mais une entité DISTINCTE des notes (pas de réponses, pas d'accusé de lecture).
--
-- Décisions produit (session) :
--   • Gestion des éléments : LES DEUX membres (ajouter, retirer, cocher).
--   • Placement : section dédiée « Épicerie » dans la page /frigo.
--   • Push : à la création d'une nouvelle liste, et au COCHAGE — mais ANTI-SPAM
--     (au plus un push par fenêtre de cooldown et par liste : cocher 10 articles
--     d'affilée = 1 push, pas 10). Le décochage ne notifie jamais.
--
-- R7 : un libellé d'article (« lait », « pain ») n'est PAS une donnée sensible (info
-- d'épicerie partagée, les deux membres voient tout) — mais par cohérence et minimisation,
-- le payload push ne porte JAMAIS de libellé, seulement le type d'événement (cf. groceryPayload).
--
-- POURQUOI l'état de coche passe par un RPC SECURITY DEFINER (et pas un UPDATE sous RLS) :
--   la RLS ne sait pas restreindre QUELLES colonnes changent. Pour que les deux membres
--   puissent cocher SANS pouvoir forger les colonnes de coche ni le débounce, on n'accorde
--   AUCUN UPDATE direct au client et on isole la bascule dans une fonction au périmètre
--   minimal — exactement la raison d'être de marquer_note_frigo_lue / epingler_note_frigo.

-- ── Table des listes ────────────────────────────────────────────────────────────────
create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  -- Débounce du push de cochage : posé UNIQUEMENT par le RPC (DEFINER). Jamais exposé au
  -- client (ni colonne sélectionnée, ni grant UPDATE) → impossible à forger ou à lire.
  last_check_notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- WHY index (household_id, created_at desc) : la RLS et la page filtrent par foyer et
-- affichent les listes les plus récentes d'abord.
create index idx_grocery_lists_household on public.grocery_lists (household_id, created_at desc);

-- ── Table des éléments ──────────────────────────────────────────────────────────────
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.grocery_lists (id) on delete cascade,
  -- household_id DÉNORMALISÉ : porte la RLS et le filtre Realtime au niveau de l'élément
  -- (sans jointure), comme household_id sur fridge_notes. Cohérence garantie par trigger.
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 200),
  is_checked boolean not null default false,
  checked_by uuid references public.profiles (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  -- Cohérence : coché ⇔ on sait quand et par qui (les trois ensemble, ou aucun).
  constraint grocery_items_check_coherent check (
    (checked_at is null) = (checked_by is null)
    and is_checked = (checked_at is not null)
  )
);

-- WHY index (list_id, created_at) : on charge et regroupe les éléments par liste, dans
-- l'ordre chronologique (l'ordre d'ajout reflète la façon dont on remplit une liste).
create index idx_grocery_items_list on public.grocery_items (list_id, created_at);

-- Cohérence foyer : un élément appartient TOUJOURS au foyer de sa liste (défense en
-- profondeur contre une injection cross-foyer, calque enforce_fridge_note_single_level).
create or replace function public.enforce_grocery_item_household()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_list_household uuid;
begin
  select household_id into v_list_household from public.grocery_lists where id = new.list_id;
  if v_list_household is null then
    raise exception 'liste d''épicerie introuvable (%).', new.list_id;
  end if;
  if new.household_id <> v_list_household then
    raise exception 'un élément doit appartenir au foyer de sa liste.';
  end if;
  return new;
end;
$$;

create trigger trg_grocery_items_household before insert or update on public.grocery_items
  for each row execute function public.enforce_grocery_item_household();

-- ── Droits & RLS ────────────────────────────────────────────────────────────────────
-- AUCUN grant UPDATE au client : la seule mutation après création (la coche) passe par le
-- RPC DEFINER. Listes : on peut créer/lire/supprimer (liste partagée, suppression par les
-- deux membres) ; le titre se fixe à la création (renommage hors périmètre).
grant select, insert, delete on public.grocery_lists to authenticated;
grant select, insert, delete on public.grocery_items to authenticated;

alter table public.grocery_lists enable row level security;
alter table public.grocery_items enable row level security;

--   Listes : SELECT/INSERT/DELETE = membre du foyer (les deux membres gèrent).
create policy grocery_lists_select on public.grocery_lists for select to authenticated
  using (public.is_household_member(household_id));
create policy grocery_lists_insert on public.grocery_lists for insert to authenticated
  with check (public.is_household_member(household_id) and author_id = (select auth.uid()));
create policy grocery_lists_delete on public.grocery_lists for delete to authenticated
  using (public.is_household_member(household_id));

--   Éléments : SELECT/DELETE = membre. INSERT = membre + on s'attribue l'ajout
--   (author_id = soi) ET on interdit de poser une coche à l'insertion (la coche
--   n'appartient qu'au RPC DEFINER — symétrie avec fridge_notes_insert).
create policy grocery_items_select on public.grocery_items for select to authenticated
  using (public.is_household_member(household_id));
create policy grocery_items_insert on public.grocery_items for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and author_id = (select auth.uid())
    and is_checked = false
    and checked_at is null
    and checked_by is null
  );
create policy grocery_items_delete on public.grocery_items for delete to authenticated
  using (public.is_household_member(household_id));

-- ── Realtime ────────────────────────────────────────────────────────────────────────
-- Publier les deux tables pour le live (nouvelle liste / nouvel élément / coche / retrait).
-- Même garde que fridge_notes (Sprint 20) : la publication supabase_realtime existe sur
-- Cloud mais pas sur le Postgres local des tests — on n'ajoute que si présente et absente.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grocery_lists'
    ) then
      alter publication supabase_realtime add table public.grocery_lists;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grocery_items'
    ) then
      alter publication supabase_realtime add table public.grocery_items;
    end if;
  end if;
end $$;

-- ── RPC de cochage (les deux membres ; anti-spam au push) ────────────────────────────
-- Bascule is_checked d'un élément SANS accorder d'UPDATE direct (la RLS ne restreint pas
-- les colonnes ; on isole donc la coche ici). Vérifie DANS la fonction (exempte de RLS) :
--   • l'appelant est membre du foyer de l'élément (un membre RÉVOQUÉ garde author_id mais
--     perd l'accès — sans cette garde il pourrait cocher par appel RPC direct) ;
--   • idempotent : si l'état demandé == état courant, no-op (et surtout pas de push).
-- Retourne true UNIQUEMENT s'il faut pousser une notif (cochage + hors fenêtre de cooldown
-- de la liste) — le décochage et les cochages rapprochés retournent false (anti-spam).
create or replace function public.cocher_element_epicerie(item_id uuid, checked boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_household uuid;
  v_list uuid;
  v_current boolean;
  v_last timestamptz;
  -- Fenêtre anti-spam : un seul push de cochage par liste et par tranche de 2 minutes.
  v_cooldown constant interval := interval '2 minutes';
  v_should_push boolean := false;
begin
  select household_id, list_id, is_checked
    into v_household, v_list, v_current
    from public.grocery_items where id = item_id;
  if not found then
    return false;
  end if;
  if not public.is_household_member(v_household) then
    return false;
  end if;
  -- Idempotent : aucun changement d'état → rien à écrire, aucun push.
  if v_current = checked then
    return false;
  end if;

  update public.grocery_items
     set is_checked = checked,
         checked_at = case when checked then now() else null end,
         checked_by = case when checked then v_uid else null end
   where id = item_id;

  -- Push anti-spam : au COCHAGE seulement, et au plus une fois par fenêtre de cooldown
  -- (par liste). now() est stable dans la transaction → comparaison fiable.
  if checked then
    select last_check_notified_at into v_last
      from public.grocery_lists where id = v_list;
    if v_last is null or now() - v_last > v_cooldown then
      update public.grocery_lists set last_check_notified_at = now() where id = v_list;
      v_should_push := true;
    end if;
  end if;

  return v_should_push;
end;
$$;

revoke all on function public.cocher_element_epicerie(uuid, boolean) from public;
grant execute on function public.cocher_element_epicerie(uuid, boolean) to authenticated;
