import {
  creerNoteFrigo,
  epinglerNoteFrigo,
  marquerNoteFrigoLue,
  modifierNoteFrigo,
  repondreNoteFrigo,
  supprimerNoteFrigo,
} from "@/app/frigo/actions";
import { TableauFrigo } from "@/components/frigo/tableau-frigo";
import { TuileNav } from "@/components/ui/tuile-nav";
import { parseAuthorNames } from "@/lib/foyer/author-names";
import { FRIGO_NOTE_COLUMNS, parseFrigoRows } from "@/lib/frigo/db-rows";
import type { FrigoHandlers } from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Page de la « note du frigo » (Sprint 20) : tableau partagé du foyer, hors calendrier.
// Server Component : résout l'usager + le foyer, charge les notes sous RLS, puis confie
// l'interactivité (Realtime, accusés live) au composant client TableauFrigo.

export default async function FrigoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const membershipRes = await supabase
    .from("memberships")
    .select("household_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipRes.error) {
    throw membershipRes.error;
  }
  if (!membershipRes.data) {
    redirect("/onboarding");
  }
  const householdId = membershipRes.data.household_id;

  const [notesRes, membresRes] = await Promise.all([
    supabase
      .from("fridge_notes")
      .select(FRIGO_NOTE_COLUMNS)
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase
      .from("memberships")
      .select("profile_id, profiles(full_name)")
      .eq("household_id", householdId),
  ]);
  if (notesRes.error) {
    throw notesRes.error;
  }
  if (membresRes.error) {
    throw membresRes.error;
  }

  const authorNames = parseAuthorNames(membresRes.data);

  const handlers: FrigoHandlers = {
    creer: creerNoteFrigo.bind(null, householdId),
    repondre: repondreNoteFrigo,
    modifier: modifierNoteFrigo,
    supprimer: supprimerNoteFrigo,
    marquerLue: marquerNoteFrigoLue,
    epingler: epinglerNoteFrigo,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 bg-neutral-950 p-4 text-neutral-50">
      {/* Retour vers l'accueil (NFR-12) : tuile contrastée, alignée à gauche (self-start sur le
          nav, qui rétrécit au contenu) pour ne pas l'étirer sur toute la largeur du <main>. */}
      <nav className="self-start">
        <TuileNav href="/" icone="📅" libelle={fr.commun.retour} />
      </nav>
      <TableauFrigo
        householdId={householdId}
        currentUserId={user.id}
        authorNames={authorNames}
        initialNotes={parseFrigoRows(notesRes.data)}
        handlers={handlers}
      />
    </main>
  );
}
