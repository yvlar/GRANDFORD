"use server";

import {
  GROCERY_ITEM_COLUMNS,
  GROCERY_LIST_COLUMNS,
  parseGroceryItemRows,
  parseGroceryListRows,
} from "@/lib/epicerie/db-rows";
import type { EtatEpicerie, ResultatElement, ResultatListe } from "@/lib/epicerie/types";
import { fr } from "@/lib/i18n/fr";
import { declencherPushEpicerie } from "@/lib/notifications/notify-grocery-client";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Server actions de la liste d'épicerie (Sprint 25). La RLS grocery_lists_*/grocery_items_*
// (membre du foyer) garantit qu'on ne lit/écrit/retire que dans son propre foyer. La coche
// passe par le RPC cocher_element_epicerie (SECURITY DEFINER) — la RLS ne sait pas restreindre
// les colonnes. R7 : un libellé d'article ne transite jamais dans un payload push (groceryPayload).

const titleSchema = z.string().trim().min(1).max(100);
const labelSchema = z.string().trim().min(1).max(200);

export async function creerListeEpicerie(
  householdId: string,
  title: string,
): Promise<ResultatListe> {
  const hid = uuidSchema.safeParse(householdId);
  const titre = titleSchema.safeParse(title);
  if (!hid.success || !titre.success) {
    return { ok: false, erreur: fr.epicerie.erreurCreationListe, liste: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  const { data, error } = await supabase
    .from("grocery_lists")
    .insert({ household_id: hid.data, author_id: user.id, title: titre.data })
    .select(GROCERY_LIST_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, erreur: fr.epicerie.erreurCreationListe, liste: null };
  }

  // Best-effort : notifie l'autre membre (push device). Un échec n'invalide pas l'écriture —
  // Realtime délivre déjà la liste en direct dans l'app de l'autre.
  await declencherPushEpicerie(data.id, "nouvelle", user.id);

  // Pas de revalidate "/" : une nouvelle liste est vide → le compte « à acheter » de l'accueil
  // (articles non cochés) ne change pas.
  revalidatePath("/epicerie");
  return { ok: true, erreur: null, liste: parseGroceryListRows([data])[0] ?? null };
}

export async function supprimerListeEpicerie(listId: string): Promise<EtatEpicerie> {
  const id = uuidSchema.safeParse(listId);
  if (!id.success) {
    return { ok: false, erreur: fr.epicerie.erreurSuppressionListe };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // RLS grocery_lists_delete (membre du foyer) : les deux membres peuvent retirer une liste
  // partagée. Les éléments partent en cascade (on delete cascade). select id → 0 ligne détectable.
  const { data, error } = await supabase
    .from("grocery_lists")
    .delete()
    .eq("id", id.data)
    .select("id");

  if (error || data.length === 0) {
    return { ok: false, erreur: fr.epicerie.erreurSuppressionListe };
  }

  revalidatePath("/epicerie");
  revalidatePath("/"); // la pastille « à acheter » de l'accueil (les articles partent en cascade)
  return { ok: true, erreur: null };
}

export async function ajouterElementEpicerie(
  listId: string,
  label: string,
): Promise<ResultatElement> {
  const lid = uuidSchema.safeParse(listId);
  const texte = labelSchema.safeParse(label);
  if (!lid.success || !texte.success) {
    return { ok: false, erreur: fr.epicerie.erreurAjoutElement, element: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // On NE FAIT PAS confiance au client pour le foyer : on le dérive de la liste parente,
  // lue sous RLS (un non-membre ne voit pas la ligne → maybeSingle null → échec propre).
  // Le trigger enforce_grocery_item_household vérifie en plus la cohérence foyer↔liste.
  const { data: liste } = await supabase
    .from("grocery_lists")
    .select("household_id")
    .eq("id", lid.data)
    .maybeSingle();
  if (!liste) {
    return { ok: false, erreur: fr.epicerie.erreurAjoutElement, element: null };
  }

  const { data, error } = await supabase
    .from("grocery_items")
    .insert({
      list_id: lid.data,
      household_id: liste.household_id,
      author_id: user.id,
      label: texte.data,
    })
    .select(GROCERY_ITEM_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, erreur: fr.epicerie.erreurAjoutElement, element: null };
  }

  // Pas de push à l'ajout d'un élément (faible signal ; seuls « nouvelle liste » et « coche »
  // notifient). Realtime délivre l'élément en direct dans l'app de l'autre.
  revalidatePath("/epicerie");
  revalidatePath("/"); // la pastille « à acheter » de l'accueil (un article non coché de plus)
  return { ok: true, erreur: null, element: parseGroceryItemRows([data])[0] ?? null };
}

export async function retirerElementEpicerie(itemId: string): Promise<EtatEpicerie> {
  const id = uuidSchema.safeParse(itemId);
  if (!id.success) {
    return { ok: false, erreur: fr.epicerie.erreurRetraitElement };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // RLS grocery_items_delete (membre du foyer) : les deux membres gèrent la liste partagée.
  const { data, error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", id.data)
    .select("id");

  if (error || data.length === 0) {
    return { ok: false, erreur: fr.epicerie.erreurRetraitElement };
  }

  revalidatePath("/epicerie");
  revalidatePath("/"); // la pastille « à acheter » de l'accueil (un article retiré)
  return { ok: true, erreur: null };
}

export async function viderLesAchetesEpicerie(listId: string): Promise<EtatEpicerie> {
  const id = uuidSchema.safeParse(listId);
  if (!id.success) {
    return { ok: false, erreur: fr.epicerie.erreurViderLesAchetes };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // RLS grocery_items_delete (membre du foyer) : les deux membres gèrent la liste partagée.
  // list_id/is_checked ciblent UNIQUEMENT les articles cochés de CETTE liste — la RLS ne borne
  // que le foyer, pas ce sous-ensemble (voir test d'isolation dédié). 0 ligne n'est PAS une
  // erreur ici (contrairement aux actions sœurs) : le bouton n'est actionnable que si un article
  // coché existe côté client, mais une course avec l'autre membre (déjà vidé) est un no-op bénin.
  // Pas de push (comme ajouterElement) : vider des achetés est un rangement, signal faible ;
  // Realtime délivre déjà le retrait en direct à l'autre membre s'il est dans l'app.
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("list_id", id.data)
    .eq("is_checked", true);

  if (error) {
    return { ok: false, erreur: fr.epicerie.erreurViderLesAchetes };
  }

  // Pas de revalidate "/" : vider des articles COCHÉS ne change jamais le compte non-coché
  // qui alimente la pastille « à acheter » de l'accueil (même raisonnement que creerListeEpicerie).
  revalidatePath("/epicerie");
  return { ok: true, erreur: null };
}

export async function cocherElementEpicerie(
  itemId: string,
  checked: boolean,
): Promise<EtatEpicerie> {
  const id = uuidSchema.safeParse(itemId);
  const drapeau = z.boolean().safeParse(checked);
  if (!id.success || !drapeau.success) {
    return { ok: false, erreur: fr.epicerie.erreurCochage };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/connexion");
  }

  // On lit la liste de l'élément sous RLS (pour cibler le push à la bonne liste, et confirmer
  // la visibilité). Un non-membre ne voit pas la ligne → échec propre avant tout RPC.
  const { data: element } = await supabase
    .from("grocery_items")
    .select("list_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!element) {
    return { ok: false, erreur: fr.epicerie.erreurCochage };
  }

  // Le RPC (SECURITY DEFINER) vérifie « membre du foyer » et bascule is_checked sans
  // accorder d'UPDATE direct. Il retourne true UNIQUEMENT s'il faut pousser (cochage hors
  // fenêtre de cooldown de la liste — anti-spam : cocher 10 articles d'affilée = 1 push).
  const { data, error } = await supabase.rpc("cocher_element_epicerie", {
    item_id: id.data,
    checked: drapeau.data,
  });
  if (error) {
    return { ok: false, erreur: fr.epicerie.erreurCochage };
  }

  if (data === true) {
    await declencherPushEpicerie(element.list_id, "coche", user.id);
  }

  revalidatePath("/epicerie");
  revalidatePath("/"); // la pastille « à acheter » de l'accueil (cocher/décocher change le compte)
  return { ok: true, erreur: null };
}
