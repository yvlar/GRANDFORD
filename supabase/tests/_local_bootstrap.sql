-- LOCAL / TESTS UNIQUEMENT — NE JAMAIS DÉPLOYER.
-- Reproduit le strict minimum que Supabase Cloud fournit déjà : le schéma `auth`
-- (auth.users + auth.uid()/role()/jwt()) et les rôles anon/authenticated/service_role.
-- Permet d'exécuter les migrations + les tests d'isolation RLS contre un Postgres nu,
-- quand la stack Docker Supabase est indisponible (CDN d'images bloqué par l'egress).
-- Sur Supabase, ces objets existent nativement : ce fichier n'y est jamais joué.

create extension if not exists pgcrypto;

-- Rôles Supabase (référencés par les GRANT/policies des migrations).
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login;
  end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
-- WHY: les tests basculent de rôle (SET ROLE) depuis la connexion postgres pour simuler
-- ce que PostgREST fait (rôle `authenticated` + claims JWT).
grant anon, authenticated, service_role to postgres;

create schema if not exists auth;

-- auth.users minimal : seules les colonnes utilisées par le schéma applicatif (FK profiles).
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

-- Réplique fidèle des helpers Supabase : lisent les claims JWT injectés par PostgREST
-- dans le GUC `request.jwt.claims`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

grant usage on schema auth to anon, authenticated, service_role;
