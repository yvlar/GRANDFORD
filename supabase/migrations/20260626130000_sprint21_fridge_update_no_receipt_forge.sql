-- Sprint 21 — durcissement de la policy UPDATE de fridge_notes (issu de la revue indépendante).
--
-- WHY : la policy fridge_notes_update (Sprint 20) autorisait l'auteur à écrire N'IMPORTE
-- quelle valeur de read_at/read_by sur sa PROPRE ligne — un auteur pouvait donc FORGER un
-- accusé de lecture (« l'autre a lu ma note ») par un UPDATE direct, alors que la policy
-- INSERT, elle, l'interdit déjà (read_at/read_by forcés nuls). On referme cette asymétrie.
--
-- Invariant net après ce durcissement :
--   • un accusé non-nul n'est posé QUE par le RPC marquer_note_frigo_lue
--     (SECURITY DEFINER, exempt de RLS) — jamais par un UPDATE sous RLS ;
--   • une édition du corps par l'auteur (Sprint 21) RÉINITIALISE toujours l'accusé
--     → la nouvelle ligne doit avoir read_at/read_by nuls (with check ci-dessous).
-- Le RPC n'est pas affecté (il contourne la RLS) ; modifierNoteFrigo non plus (il pose null).

drop policy if exists fridge_notes_update on public.fridge_notes;
create policy fridge_notes_update on public.fridge_notes for update to authenticated
  using (author_id = (select auth.uid()) and public.is_household_member(household_id))
  with check (
    author_id = (select auth.uid())
    and public.is_household_member(household_id)
    and read_at is null
    and read_by is null
  );
