import {
  ajouterElementEpicerie,
  cocherElementEpicerie,
  creerListeEpicerie,
  retirerElementEpicerie,
  supprimerListeEpicerie,
} from "@/app/epicerie/actions";
import {
  creerNoteFrigo,
  epinglerNoteFrigo,
  marquerNoteFrigoLue,
  modifierNoteFrigo,
  repondreNoteFrigo,
  supprimerNoteFrigo,
} from "@/app/frigo/actions";
import { ListesEpicerie } from "@/components/epicerie/listes-epicerie";
import { TableauFrigo } from "@/components/frigo/tableau-frigo";
import { TuileNav } from "@/components/ui/tuile-nav";
import {
  GROCERY_ITEM_COLUMNS,
  GROCERY_LIST_COLUMNS,
  parseGroceryItemRows,
  parseGroceryListRows,
} from "@/lib/epicerie/db-rows";
import type { EpicerieHandlers } from "@/lib/epicerie/types";
import { FRIGO_NOTE_COLUMNS, parseFrigoRows } from "@/lib/frigo/db-rows";
import type { FrigoHandlers } from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
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

  const [notesRes, membresRes, listesRes, itemsRes] = await Promise.all([
    supabase
      .from("fridge_notes")
      .select(FRIGO_NOTE_COLUMNS)
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase
      .from("memberships")
      .select("profile_id, profiles(full_name)")
      .eq("household_id", householdId),
    supabase
      .from("grocery_lists")
      .select(GROCERY_LIST_COLUMNS)
      .eq("household_id", householdId)
      .order("created_at", { ascending: false }),
    supabase
      .from("grocery_items")
      .select(GROCERY_ITEM_COLUMNS)
      .eq("household_id", householdId)
      .order("created_at", { ascending: true }),
  ]);
  if (notesRes.error) {
    throw notesRes.error;
  }
  if (membresRes.error) {
    throw membresRes.error;
  }
  if (listesRes.error) {
    throw listesRes.error;
  }
  if (itemsRes.error) {
    throw itemsRes.error;
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
    repondre: repondreNoteFrigo,
    modifier: modifierNoteFrigo,
    supprimer: supprimerNoteFrigo,
    marquerLue: marquerNoteFrigoLue,
    epingler: epinglerNoteFrigo,
  };

  const epicerieHandlers: EpicerieHandlers = {
    creerListe: creerListeEpicerie.bind(null, householdId),
    supprimerListe: supprimerListeEpicerie,
    ajouterElement: ajouterElementEpicerie,
    retirerElement: retirerElementEpicerie,
    cocherElement: cocherElementEpicerie,
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
      <ListesEpicerie
        householdId={householdId}
        currentUserId={user.id}
        authorNames={authorNames}
        initialLists={parseGroceryListRows(listesRes.data)}
        initialItems={parseGroceryItemRows(itemsRes.data)}
        handlers={epicerieHandlers}
      />
    </main>
  );
}
