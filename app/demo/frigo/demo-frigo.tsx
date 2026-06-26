"use client";

import { TableauFrigo } from "@/components/frigo/tableau-frigo";
import type { FrigoHandlers, FrigoNote } from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { useMemo } from "react";

// Démo de la note du frigo SANS BD/Realtime/auth (preuve d'acceptation du Sprint 20, sous
// GRANDFORD_DEMO=1) : on monte le VRAI tableau (TableauFrigo) avec realtimeActif={false} et
// des handlers en mémoire — aucune divergence avec la production. Le seed couvre tous les
// états observables : note de l'autre non lue (badge « Nouveau », effacé par l'auto-marquage),
// ma note déjà lue (« Lu ✓ »), ma note pas encore lue (« Pas encore lu »), retrait auteur-seul.

const MOI = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

const SEED: FrigoNote[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    authorId: AUTRE,
    body: "N'oublie pas le rendez-vous chez le dentiste jeudi !",
    createdAt: "2026-06-26T11:00:00Z",
    readAt: null, // non lue par moi → badge « Nouveau » (effacé par l'auto-marquage)
    readBy: null,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    authorId: MOI,
    body: "J'ai pris du lait et des œufs.",
    createdAt: "2026-06-26T10:00:00Z",
    readAt: "2026-06-26T10:30:00Z", // ma note, lue par l'autre → « Lu ✓ »
    readBy: AUTRE,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    authorId: MOI,
    body: "On soupe chez tes parents dimanche ?",
    createdAt: "2026-06-26T09:00:00Z",
    readAt: null, // ma note, pas encore lue → « Pas encore lu »
    readBy: null,
  },
];

// Conserve l'horodatage d'origine des notes du seed : en prod, l'UPDATE ne touche pas
// created_at (seul updated_at est bumpé) → la note éditée garde sa place. La démo doit
// refléter ce comportement (pas de saut en tête de liste).
const CREATED_AT_PAR_ID = new Map(SEED.map((n) => [n.id, n.createdAt]));

export function DemoFrigo() {
  const t = fr.frigo;

  // Handlers en mémoire : TableauFrigo gère son propre état (affichage optimiste sur
  // creer/supprimer, effacement du badge sur marquerLue) — on renvoie juste des succès.
  const handlers = useMemo<FrigoHandlers>(
    () => ({
      creer: async (body: string) => ({
        ok: true,
        erreur: null,
        note: {
          id: crypto.randomUUID(),
          authorId: MOI,
          body,
          createdAt: new Date().toISOString(),
          readAt: null,
          readBy: null,
        },
      }),
      // Édition : on renvoie la note au corps modifié, accusé RÉINITIALISÉ (readAt/readBy
      // null) — comme en prod, une note rééditée redevient « non lue ».
      modifier: async (noteId: string, body: string) => ({
        ok: true,
        erreur: null,
        note: {
          id: noteId,
          authorId: MOI,
          body,
          createdAt: CREATED_AT_PAR_ID.get(noteId) ?? new Date().toISOString(),
          readAt: null,
          readBy: null,
        },
      }),
      supprimer: async () => ({ ok: true, erreur: null }),
      marquerLue: async () => ({ ok: true, erreur: null }),
    }),
    [],
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 bg-neutral-950 p-4 text-neutral-50">
      <p className="text-sm text-neutral-400">{t.demo.intro}</p>
      <TableauFrigo
        householdId="demo"
        currentUserId={MOI}
        authorNames={{ [AUTRE]: t.demo.conjoint }}
        initialNotes={SEED}
        handlers={handlers}
        realtimeActif={false}
      />
    </main>
  );
}
