import {
  ajouterElementEpicerie,
  cocherElementEpicerie,
  creerListeEpicerie,
  retirerElementEpicerie,
  supprimerListeEpicerie,
} from "@/app/epicerie/actions";
import { ListesEpicerie } from "@/components/epicerie/listes-epicerie";
import { TuileNav } from "@/components/ui/tuile-nav";
import {
  GROCERY_ITEM_COLUMNS,
  GROCERY_LIST_COLUMNS,
  parseGroceryItemRows,
  parseGroceryListRows,
} from "@/lib/epicerie/db-rows";
import type { EpicerieHandlers } from "@/lib/epicerie/types";
import { parseAuthorNames } from "@/lib/foyer/author-names";
import { fr } from "@/lib/i18n/fr";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Page des listes d'épicerie (Sprint 27) : extraite de /frigo vers sa propre route, atteinte
// par la tuile « Épicerie » de l'accueil. Server Component : résout l'usager + le foyer, charge
// listes et articles sous RLS (membre du foyer), puis confie l'interactivité (Realtime, cochage)
// au composant client ListesEpicerie. Les deux membres gèrent la liste partagée.

export default async function EpiceriePage() {
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

  const [membresRes, listesRes, itemsRes] = await Promise.all([
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
  if (membresRes.error) {
    throw membresRes.error;
  }
  if (listesRes.error) {
    throw listesRes.error;
  }
  if (itemsRes.error) {
    throw itemsRes.error;
  }

  const authorNames = parseAuthorNames(membresRes.data);

  const handlers: EpicerieHandlers = {
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
      <ListesEpicerie
        householdId={householdId}
        currentUserId={user.id}
        authorNames={authorNames}
        initialLists={parseGroceryListRows(listesRes.data)}
        initialItems={parseGroceryItemRows(itemsRes.data)}
        handlers={handlers}
      />
    </main>
  );
}
