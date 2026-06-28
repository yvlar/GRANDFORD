import { DemoEpicerie } from "@/app/demo/epicerie/demo-epicerie";
import { notFound } from "next/navigation";

// Démo des listes d'épicerie (Sprint 25) SANS authentification ni BD — preuve d'acceptation
// observable là où GoTrue/Realtime ne tournent pas (contrainte Docker documentée depuis le
// Sprint 2). N'expose aucune donnée réelle de foyer. Inaccessible sans GRANDFORD_DEMO=1.
//
//   /demo/epicerie → listes pilotables : créer une liste, ajouter un article (les deux
//                    membres), cocher/décocher, retirer un article, supprimer une liste.

export default function DemoEpiceriePage() {
  if (process.env.GRANDFORD_DEMO !== "1") {
    notFound();
  }
  return <DemoEpicerie />;
}
