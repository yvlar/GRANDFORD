-- Sprint 2 — Schéma du domaine GRANDFORD.
-- Réf. : docs/analyse/03-architecture/architecture.md:107-112 (tables clés, toutes porteuses
-- de household_id ; étanchéité du motif via exception_private).
--
-- Principe d'isolation : chaque table de données de foyer porte `household_id`. La RLS
-- (migration suivante) restreint l'accès aux membres du foyer. Le MOTIF d'une absence
-- vit SEUL dans `exception_private` (lecture = travailleur propriétaire uniquement, R7).
--
-- Note plateforme : sur Supabase Cloud, le schéma `auth` (dont `auth.users`) et les rôles
-- `anon`/`authenticated`/`service_role` préexistent. Ces migrations s'appuient dessus sans
-- les créer. En local sans la stack Docker, supabase/tests/_local_bootstrap.sql fournit
-- l'équivalent minimal pour exécuter migrations + tests.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ───────────────────────── Horodatage automatique ─────────────────────────
-- WHY: garder updated_at fiable côté BD (ne pas dépendre du client).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────────────────────── Identité & foyer ─────────────────────────────

-- profiles : identité d'un usager (1:1 avec auth.users). PAS de household_id : un profil
-- existe avant de rejoindre un foyer ; l'appartenance vit dans `memberships`.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  locale text not null default 'fr-CA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- households : le foyer (un couple). owner_id = le propriétaire (le travailleur qui invite
-- la conjointe et peut la révoquer — architecture.md:116).
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- memberships : pont profil ↔ foyer avec rôle. Ancre de l'isolation multi-tenant.
-- La révocation = suppression de la ligne (perte d'accès immédiate, R7/SEC5).
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('worker', 'spouse')),
  created_at timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- ─────────────────────────── Moteur & affectations ───────────────────────────

-- cycle_templates : gabarit du moteur Pitman, paramétrable par foyer/usine (FR-17).
-- Aligné sur lib/engine/types.ts (CycleTemplate) : ancre, pattern de 14 bits, heures.
create table public.cycle_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  anchor_date date not null,
  pattern boolean[] not null check (array_length(pattern, 1) = 14),
  day_start time not null,
  day_end time not null,
  night_start time not null,
  night_end time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- worker_assignments : relie un travailleur à son équipe A/B/C/D dans un foyer.
create table public.worker_assignments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  team text not null check (team in ('A', 'B', 'C', 'D')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- ─────────────────────────────── Écarts (cœur) ───────────────────────────────

-- exceptions : l'écart d'horaire PARTAGEABLE. Effet sur la disponibilité seulement
-- (présent/absent/quart) — JAMAIS le motif. La conjointe lit cette table (R7).
create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade, -- travailleur concerné
  on_date date not null,
  -- Effet non sensible : off = absent ; working = présent (jour normalement off) ;
  -- working_extra = temps supplémentaire (OT) ; shift_swap = échange de quart.
  effect text not null check (effect in ('off', 'working', 'working_extra', 'shift_swap')),
  shift text check (shift in ('jour', 'nuit')), -- quart résultant si présent, sinon null
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cohérence : une absence ne porte aucun quart (sémantiques échange/OT précisées
  -- au sprint de capture, FR-4 — on n'enferme pas le modèle trop tôt).
  check (effect <> 'off' or shift is null),
  unique (household_id, profile_id, on_date), -- un écart par travailleur/jour, dans un foyer
  -- WHY: cibles des FK composites de exception_private — ancrent le motif au bon
  -- travailleur ET au bon foyer (étanchéité structurelle du motif, R7).
  unique (id, profile_id),
  unique (id, household_id)
);

-- exception_private : LE MOTIF. Table séparée, étanche. Lecture/écriture réservées au
-- travailleur propriétaire (owner_id) par la RLS — la conjointe ne peut jamais le lire.
-- C'est la vie privée STRUCTURELLE (architecture.md:111, R7, NFR-5).
create table public.exception_private (
  exception_id uuid primary key,
  household_id uuid not null,
  owner_id uuid not null, -- seul lecteur autorisé ; forcé = le travailleur de l'exception parente
  -- Les 6 motifs des tuiles de capture (Sprint 5) : OT, congé, maladie, échange, formation, vacances.
  motif text not null check (motif in ('ot', 'conge', 'maladie', 'echange', 'formation', 'vacances')),
  note text, -- précision libre, strictement privée
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Étanchéité STRUCTURELLE (R7) : par ces FK composites, owner_id EST forcément le
  -- travailleur (profile_id) de l'exception parente, et household_id celui du parent.
  -- Impossible d'attribuer un motif à la conjointe ou de le rattacher à un autre foyer.
  foreign key (exception_id, owner_id) references public.exceptions (id, profile_id) on delete cascade,
  foreign key (exception_id, household_id) references public.exceptions (id, household_id) on delete cascade
);

-- sleep_defaults : fenêtre de sommeil par défaut d'un travailleur (FR-6). Partageable
-- (la conjointe sait quand ne pas déranger — c'est de la disponibilité, pas un motif).
create table public.sleep_defaults (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- ─────────────────────── Co-planification & notifications ───────────────────────

-- notes : co-planification du couple (FR-8, v1.1). Partagée dans le foyer.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  on_date date,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- requests : requêtes de la conjointe avec statut (FR-9, v1.1).
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  requester_id uuid references public.profiles (id) on delete set null,
  target_profile_id uuid references public.profiles (id) on delete set null,
  on_date date,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- reminders : planification des rappels 1 mois / 1 sem. / 1 jour (FR-10, architecture.md:121).
-- AUCUN motif : un rappel référence l'écart (disponibilité), jamais la raison (R7).
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade, -- destinataire
  exception_id uuid references public.exceptions (id) on delete cascade,
  remind_at timestamptz not null,
  lead text not null check (lead in ('month', 'week', 'day')),
  channel text not null check (channel in ('push', 'email')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- audit_log : journal des changements (FR-13, v1.1). Append-only. metadata SANS motif (R7).
create table public.audit_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- push_subscriptions : abonnements Web Push (FR-10). PERSONNELS — chaque usager gère
-- ses propres appareils (la RLS restreint à profile_id = soi).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────── Index (RLS/accès) ───────────────────────────────
-- WHY: la RLS filtre par household_id ; indexer les FK porteuses évite les seq scans.
-- memberships/worker_assignments/sleep_defaults : le préfixe de leur unique
-- (household_id, profile_id) couvre déjà household_id — pas d'index simple en double.
create index idx_memberships_profile on public.memberships (profile_id);
create index idx_cycle_templates_household on public.cycle_templates (household_id);
create index idx_exceptions_household_date on public.exceptions (household_id, on_date);
create index idx_exceptions_profile on public.exceptions (profile_id);
create index idx_exception_private_owner on public.exception_private (owner_id);
create index idx_notes_household on public.notes (household_id);
create index idx_requests_household on public.requests (household_id);
create index idx_reminders_household on public.reminders (household_id);
create index idx_reminders_due on public.reminders (remind_at) where sent_at is null;
create index idx_audit_log_household on public.audit_log (household_id);
create index idx_push_subscriptions_profile on public.push_subscriptions (profile_id);

-- ─────────────────────── Déclencheurs updated_at ───────────────────────
-- (reminders, audit_log, push_subscriptions n'ont pas de updated_at : append-only / journal.)
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_households_updated before update on public.households
  for each row execute function public.set_updated_at();
create trigger trg_cycle_templates_updated before update on public.cycle_templates
  for each row execute function public.set_updated_at();
create trigger trg_worker_assignments_updated before update on public.worker_assignments
  for each row execute function public.set_updated_at();
create trigger trg_exceptions_updated before update on public.exceptions
  for each row execute function public.set_updated_at();
create trigger trg_exception_private_updated before update on public.exception_private
  for each row execute function public.set_updated_at();
create trigger trg_sleep_defaults_updated before update on public.sleep_defaults
  for each row execute function public.set_updated_at();
create trigger trg_notes_updated before update on public.notes
  for each row execute function public.set_updated_at();
create trigger trg_requests_updated before update on public.requests
  for each row execute function public.set_updated_at();
