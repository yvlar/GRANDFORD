-- Sprint 19 — Interrupteur de la Fenêtre de sommeil (FR-6).
-- Réf. : sleep_defaults (schéma initial 20260611192620_initial_schema.sql:138).
--
-- Le travailleur peut désormais DÉSACTIVER l'affichage de sa fenêtre de sommeil :
-- désactivée, les jours de récupération après une nuit redeviennent de simples
-- jours « congé / disponible » (sans 😴 ni plage). On conserve start_time/end_time
-- pour qu'une réactivation retrouve la fenêtre sans ressaisie.
--
-- `enabled` est de la DISPONIBILITÉ partageable (comme la fenêtre elle-même) :
-- la policy « membre du foyer » sleep_defaults_all (20260611192623_rls_policies.sql:162)
-- reste la bonne — la conjointe le lit, aucun motif n'est en jeu (R7 intact).
-- Défaut `true` : aucune régression pour les lignes existantes ni les foyers sans réglage.

alter table public.sleep_defaults
  add column enabled boolean not null default true;
