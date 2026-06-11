#!/usr/bin/env bash
# Démarre un Postgres 16 LOCAL pour les tests d'isolation RLS, SANS Docker.
#
# WHY: le chemin normal de dev est `supabase start` (stack Docker). Dans certains
# environnements (CI/conteneurs à egress restreint), le CDN d'images Supabase est
# bloqué — `supabase start` échoue alors au pull. Ce script fournit un Postgres réel
# de repli pour exécuter migrations + tests d'isolation contre une vraie BD.
# Il ne remplace PAS Supabase en prod ; il sert uniquement à tester localement.
#
# Idempotent : ré-exécutable. Démarre le cluster s'il est arrêté.
set -euo pipefail

PG_MAJOR=16
PGBIN="/usr/lib/postgresql/${PG_MAJOR}/bin"
DATA_DIR="${GRANDFORD_PGDATA:-/var/lib/postgresql/grandford-data}"
PORT="${GRANDFORD_PGPORT:-54322}"
SOCKET_DIR="/tmp"
LOG="/tmp/grandford-pg.log"
PG_USER="postgres" # rôle superutilisateur du cluster (créé par initdb)

run_as_pg() { sudo -u postgres "$@"; }

if [ ! -d "${PGBIN}" ]; then
  echo "ERREUR: binaires Postgres ${PG_MAJOR} introuvables dans ${PGBIN}" >&2
  exit 1
fi

# 1) Cluster : initdb si absent (doit tourner sous un utilisateur non-root).
if [ ! -s "${DATA_DIR}/PG_VERSION" ]; then
  echo "initdb -> ${DATA_DIR}"
  sudo mkdir -p "${DATA_DIR}"
  sudo chown -R postgres:postgres "${DATA_DIR}"
  run_as_pg "${PGBIN}/initdb" -D "${DATA_DIR}" -U "${PG_USER}" --auth=trust >/tmp/grandford-initdb.log 2>&1
fi

# 2) Démarrage si pas déjà en cours.
if run_as_pg "${PGBIN}/pg_ctl" -D "${DATA_DIR}" status >/dev/null 2>&1; then
  echo "Postgres déjà démarré (port ${PORT})."
else
  echo "Démarrage Postgres sur 127.0.0.1:${PORT}"
  sudo chown -R postgres:postgres "${DATA_DIR}"
  run_as_pg "${PGBIN}/pg_ctl" -D "${DATA_DIR}" \
    -o "-p ${PORT} -c listen_addresses=127.0.0.1 -k ${SOCKET_DIR}" \
    -l "${LOG}" start
fi

# 3) Attendre la disponibilité.
for _ in $(seq 1 30); do
  if "${PGBIN}/pg_isready" -h 127.0.0.1 -p "${PORT}" -U "${PG_USER}" >/dev/null 2>&1; then
    echo "PRÊT: postgresql://${PG_USER}@127.0.0.1:${PORT}/postgres"
    exit 0
  fi
  sleep 1
done

echo "ERREUR: Postgres n'a pas répondu sur le port ${PORT}." >&2
tail -20 "${LOG}" 2>/dev/null || true
exit 1
