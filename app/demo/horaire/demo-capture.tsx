"use client";

import { VueCoupDoeil } from "@/components/horaire/vue-coup-doeil";
import { GRANDFORD_CYCLE, type Team } from "@/lib/engine";
import { fr } from "@/lib/i18n/fr";
import {
  type CaptureHandlers,
  type EtatCapture,
  type OwnException,
  type Tuile,
  capturePlan,
} from "@/lib/schedule/capture";
import { useState } from "react";

// Démo du flux de capture SANS BD (preuve d'acceptation du Sprint 5, sous
// GRANDFORD_DEMO=1) : mêmes composants (VueCoupDoeil + PanneauCapture) et même
// sémantique pure (capturePlan) que le flux réel — seule la persistance change
// (état local au lieu de la RPC atomique). Permet de COMPTER les taps à l'écran
// dans les environnements où GoTrue ne tourne pas (contrainte Sprints 2-4).

export function DemoCapture({ team, initialToday }: { team: Team; initialToday: string }) {
  const [ecarts, setEcarts] = useState<readonly OwnException[]>([]);
  // WHY une variable : `role` est une prop métier de VueCoupDoeil, pas un rôle ARIA —
  // la passer en littéral déclenche à tort lint/a11y/useValidAriaRole.
  const role = "worker" as const;

  const handlers: CaptureHandlers = {
    capturer: async (date: string, tuile: Tuile): Promise<EtatCapture> => {
      // Même règle qu'en BD (unique par jour, GF005) : un seul écart par jour.
      if (ecarts.some((e) => e.onDate === date)) {
        return { ok: false, erreur: fr.capture.erreurDoublon };
      }
      const plan = capturePlan(tuile, team);
      setEcarts((courants) => [
        ...courants,
        {
          id: crypto.randomUUID(),
          onDate: date,
          effect: plan.effect,
          shift: plan.shift,
          motif: plan.motif,
        },
      ]);
      return { ok: true, erreur: null };
    },
    supprimer: async (exceptionId: string): Promise<EtatCapture> => {
      setEcarts((courants) => courants.filter((e) => e.id !== exceptionId));
      return { ok: true, erreur: null };
    },
  };

  return (
    <VueCoupDoeil
      role={role}
      team={team}
      template={GRANDFORD_CYCLE}
      exceptions={ecarts}
      sleepDefault={null}
      initialToday={initialToday}
      clockFrozen
      capture={{ ownExceptions: ecarts, handlers }}
    />
  );
}
