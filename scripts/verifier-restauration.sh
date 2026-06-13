#!/usr/bin/env bash
# Vérifie le couple pg_dump -> pg_restore sur le schéma RÉEL du projet (NFR-11 :
# « restauration essayée une fois »). Réexécutable. Cible le Postgres LOCAL de test
# (scripts/local-db.sh), JAMAIS une base Cloud — il crée et détruit des bases jetables.
#
#   1) construit une base SOURCE depuis _local_bootstrap.sql + supabase/migrations/*
#   2) y insère un jeu de données représentatif (cœur du produit : exception + motif + rappel)
#   3) pg_dump --format=custom (exactement les options de .github/workflows/backup.yml)
#   4) pg_restore dans une base CIBLE vierge
#   5) compare SOURCE vs CIBLE : objets publics, DÉFINITIONS des policies et des
#      privilèges (GRANT — la RLS en dépend), et LIGNES de données du cœur ; écart = échec
#
# C'est la preuve hors-ligne que la sauvegarde du workflow est restaurable AVEC ses
# droits et ses données. La sauvegarde du VRAI Cloud est vérifiée à la mise en ligne
# (docs/mise-en-ligne.md).
set -euo pipefail

ADMIN_URL="${GRANDFORD_TEST_ADMIN_URL:-postgresql://postgres@127.0.0.1:54322/postgres}"
SRC_DB="${GRANDFORD_BACKUP_SRC_DB:-grandford_backup_src}"
DST_DB="${GRANDFORD_BACKUP_DST_DB:-grandford_backup_dst}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
BOOTSTRAP="$ROOT/supabase/tests/_local_bootstrap.sql"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
DUMP="$(mktemp -t grandford-restore-XXXXXX.dump)"
trap 'rm -f "$DUMP"' EXIT

# Remplace le nom de base à la fin de l'URL admin (postgresql://…/postgres -> …/<db>).
url_pour() { echo "${ADMIN_URL%/*}/$1"; }
SRC_URL="$(url_pour "$SRC_DB")"
DST_URL="$(url_pour "$DST_DB")"

echo "→ Recréation des bases jetables ($SRC_DB, $DST_DB)…"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qX \
  -c "drop database if exists $SRC_DB with (force)" -c "create database $SRC_DB" \
  -c "drop database if exists $DST_DB with (force)" -c "create database $DST_DB"

echo "→ Application du bootstrap + migrations dans SOURCE…"
psql "$SRC_URL" -v ON_ERROR_STOP=1 -qX -f "$BOOTSTRAP"
for f in "$MIGRATIONS_DIR"/*.sql; do
  psql "$SRC_URL" -v ON_ERROR_STOP=1 -qX -f "$f"
done

# Jeu de données minimal mais représentatif : le cœur du produit (un foyer, un
# travailleur, une exception, SON motif privé, un rappel). Le profil naît du trigger
# handle_new_user à l'insertion dans auth.users — comme une vraie inscription. UUID
# passés en variables psql (:'uid' …) : une valeur, une seule fois, FK auto-évidentes.
# But : prouver que les DONNÉES (pas seulement le schéma) survivent au round-trip.
echo "→ Insertion d'un jeu de données représentatif dans SOURCE…"
psql "$SRC_URL" -v ON_ERROR_STOP=1 -qX \
  -v uid="a0000000-0000-4000-8000-000000000001" \
  -v hh="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" \
  -v exc="a1111111-1111-4111-8111-111111111111" <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  (:'uid', 'sauvegarde-test@local', '{"full_name":"Test Sauvegarde"}');
insert into public.households (id, name, owner_id) values
  (:'hh', 'Foyer Test', :'uid');
insert into public.memberships (household_id, profile_id, role) values
  (:'hh', :'uid', 'worker');
insert into public.exceptions (id, household_id, profile_id, on_date, effect, created_by) values
  (:'exc', :'hh', :'uid', '2026-07-15', 'off', :'uid');
insert into public.exception_private (exception_id, household_id, owner_id, motif, note) values
  (:'exc', :'hh', :'uid', 'maladie', 'donnée sensible — round-trip seulement');
insert into public.reminders (household_id, profile_id, exception_id, remind_at, lead, channel) values
  (:'hh', :'uid', :'exc', '2026-07-14T13:00:00Z', 'day', 'push');
SQL

echo "→ pg_dump (format custom, compressé — mêmes options que backup.yml)…"
pg_dump "$SRC_URL" --format=custom --compress=9 --no-owner --file="$DUMP"

# pg_restore peut émettre des avertissements bénins (objets globaux déjà présents au
# niveau du cluster) ; on ne s'arrête pas dessus — la VRAIE porte est la parité ci-dessous.
echo "→ pg_restore dans CIBLE vierge…"
pg_restore --no-owner --dbname="$DST_URL" "$DUMP" || true

compter() { psql "$1" -tAX -c "$2" | tr -d '[:space:]'; }

# Comptes simples pour les objets et les données du cœur…
Q_TABLES="select count(*) from pg_tables where schemaname='public'"
Q_FONCTIONS="select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"
Q_EXCEPTIONS="select count(*) from public.exceptions"
# On COMPTE exception_private, jamais on ne LIT le motif (R7 tient jusque dans la vérif).
Q_MOTIFS="select count(*) from public.exception_private"
Q_RAPPELS="select count(*) from public.reminders"
# …mais EMPREINTE des définitions pour les joyaux RLS/R7 (policies + privilèges) : la
# levée de --no-privileges devait préserver les GRANT exacts (bon rôle, bon privilège) ;
# comparer les définitions, pas juste le compte, attrape une policy trafiquée ou un
# GRANT déplacé. md5(NULL) si zéro ligne -> chaîne vide -> échec (rien restauré).
Q_POLICIES="select md5(string_agg(tablename||'|'||policyname||'|'||cmd||'|'||array_to_string(roles,',')||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by tablename, policyname)) from pg_policies where schemaname='public'"
Q_PRIVS="select md5(string_agg(table_name||'|'||grantee||'|'||privilege_type, E'\n' order by table_name, grantee, privilege_type)) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role')"

# Tableaux parallèles (libellé/requête) : pas de séparateur à parser, ordre stable.
libelles=("tables" "fonctions" "policies (définitions)" "privilèges (définitions)" \
  "lignes exceptions" "lignes motifs" "lignes rappels")
requetes=("$Q_TABLES" "$Q_FONCTIONS" "$Q_POLICIES" "$Q_PRIVS" \
  "$Q_EXCEPTIONS" "$Q_MOTIFS" "$Q_RAPPELS")

echo "→ Comparaison SOURCE vs CIBLE (objets, définitions RLS/privilèges, données)…"
echec=0
for i in "${!libelles[@]}"; do
  libelle="${libelles[$i]}"
  src="$(compter "$SRC_URL" "${requetes[$i]}")"
  dst="$(compter "$DST_URL" "${requetes[$i]}")"
  # Vide (rien restauré / agrégat NULL) ou '0' (objet absent) ou écart SOURCE≠CIBLE => échec.
  if [ -n "$src" ] && [ "$src" != "0" ] && [ "$src" = "$dst" ]; then
    if [ "${#src}" -le 6 ]; then
      echo "   ✓ $libelle : $src = $dst"
    else
      echo "   ✓ $libelle : empreinte concordante"
    fi
  else
    echo "   ✗ $libelle : SOURCE=$src CIBLE=$dst"
    echec=1
  fi
done

# Nettoyage des bases jetables (le dump part avec le trap).
psql "$ADMIN_URL" -qX \
  -c "drop database if exists $SRC_DB with (force)" \
  -c "drop database if exists $DST_DB with (force)" >/dev/null

if [ "$echec" -ne 0 ]; then
  echo "ÉCHEC : la restauration ne reproduit pas le schéma, les droits ou les données source." >&2
  exit 1
fi
echo "SUCCÈS : sauvegarde restaurée à l'identique (objets, définitions RLS/privilèges, données du cœur)."
