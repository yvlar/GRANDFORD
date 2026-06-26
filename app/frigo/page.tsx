import {
  creerNoteFrigo,
  marquerNoteFrigoLue,
  modifierNoteFrigo,
  supprimerNoteFrigo,
} from "@/app/frigo/actions";
import { TableauFrigo } from "@/components/frigo/tableau-frigo";
import { parseFrigoRows } from "@/lib/frigo/db-rows";
import type { FrigoHandlers } from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

// Page de la « note du frigo » (Sprint 20) : tableau partagé du foyer, hors calendrier.
// Server Component : résout l'usager + le foyer, charge les notes sous RLS, puis confie
// l'interactivité (Realtime, accusés live) au composant client TableauFrigo.

// Les noms des membres viennent d'une jointure memberships→profiles ; on resserre la forme
// à la frontière (le full_name peut être nul).
const membreRowSchema = z.object({
  profile_id: z.uuid(),
  profiles: z.object({ full_name: z.string().nullable() }).nullable(),
});

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
      .select("id, author_id, body, read_at, read_by, created_at, updated_at")
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

  const authorNames: Record<string, string> = {};
  for (const row of membresRes.data) {
    const parsed = membreRowSchema.safeParse(row);
    if (parsed.success) {
      authorNames[parsed.data.profile_id] = parsed.data.profiles?.full_name ?? "—";
    }
  }

  const handlers: FrigoHandlers = {
    creer: creerNoteFrigo.bind(null, householdId),
    modifier: modifierNoteFrigo,
    supprimer: supprimerNoteFrigo,
    marquerLue: marquerNoteFrigoLue,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 bg-neutral-950 p-4 text-neutral-50">
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center text-sm text-neutral-400 underline hover:text-neutral-200"
      >
        ← {fr.commun.retour}
      </Link>
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
