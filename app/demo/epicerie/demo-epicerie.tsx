"use client";

import { ListesEpicerie } from "@/components/epicerie/listes-epicerie";
import type { EpicerieHandlers, GroceryItem, GroceryList } from "@/lib/epicerie/types";
import { fr } from "@/lib/i18n/fr";
import { useMemo } from "react";

// Démo des listes d'épicerie SANS BD/Realtime/auth (preuve d'acceptation du Sprint 25, sous
// GRANDFORD_DEMO=1) : on monte le VRAI composant (ListesEpicerie) avec realtimeActif={false}
// et des handlers en mémoire — aucune divergence avec la production. Le seed couvre une liste
// partagée avec des articles ajoutés par les DEUX membres, dont un déjà coché par l'autre.

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";
const LISTE = "d0000000-0000-4000-8000-000000000001";

const SEED_LISTS: GroceryList[] = [
  {
    id: LISTE,
    authorId: MOI,
    title: "Épicerie de la semaine",
    createdAt: "2026-06-28T10:00:00Z",
  },
];

const SEED_ITEMS: GroceryItem[] = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    listId: LISTE,
    authorId: MOI,
    label: "Lait",
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    createdAt: "2026-06-28T10:01:00Z",
  },
  {
    // Article ajouté par l'AUTRE membre, déjà coché par l'AUTRE (« coché par Conjoint(e) »).
    id: "e0000000-0000-4000-8000-000000000002",
    listId: LISTE,
    authorId: AUTRE,
    label: "Pain",
    isChecked: true,
    checkedBy: AUTRE,
    checkedAt: "2026-06-28T10:30:00Z",
    createdAt: "2026-06-28T10:02:00Z",
  },
  {
    id: "e0000000-0000-4000-8000-000000000003",
    listId: LISTE,
    authorId: AUTRE,
    label: "Café",
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    createdAt: "2026-06-28T10:03:00Z",
  },
];

export function DemoEpicerie() {
  const t = fr.epicerie;

  // Handlers en mémoire : ListesEpicerie gère son propre état (affichage optimiste sur
  // créer/ajouter/cocher/retirer/supprimer) — on renvoie juste des succès et l'entité posée.
  const handlers = useMemo<EpicerieHandlers>(
    () => ({
      creerListe: async (title: string) => ({
        ok: true,
        erreur: null,
        liste: {
          id: crypto.randomUUID(),
          authorId: MOI,
          title,
          createdAt: new Date().toISOString(),
        },
      }),
      supprimerListe: async () => ({ ok: true, erreur: null }),
      ajouterElement: async (listId: string, label: string) => ({
        ok: true,
        erreur: null,
        element: {
          id: crypto.randomUUID(),
          listId,
          authorId: MOI,
          label,
          isChecked: false,
          checkedBy: null,
          checkedAt: null,
          createdAt: new Date().toISOString(),
        },
      }),
      retirerElement: async () => ({ ok: true, erreur: null }),
      // Cochage : ListesEpicerie applique l'effet optimiste — on renvoie juste un succès.
      cocherElement: async () => ({ ok: true, erreur: null }),
    }),
    [],
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 bg-neutral-950 p-4 text-neutral-50">
      <p className="text-sm text-neutral-400">{t.demo.intro}</p>
      <ListesEpicerie
        householdId="demo"
        currentUserId={MOI}
        authorNames={{ [AUTRE]: t.demo.conjoint }}
        initialLists={SEED_LISTS}
        initialItems={SEED_ITEMS}
        handlers={handlers}
        realtimeActif={false}
      />
    </main>
  );
}
