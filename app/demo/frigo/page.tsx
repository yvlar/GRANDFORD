import { DemoFrigo } from "@/app/demo/frigo/demo-frigo";
import { notFound } from "next/navigation";

// Démo de la note du frigo (Sprint 20) SANS authentification ni BD — preuve d'acceptation
// observable là où GoTrue/Realtime ne tournent pas (contrainte Docker documentée depuis le
// Sprint 2). N'expose aucune donnée réelle de foyer. Inaccessible sans GRANDFORD_DEMO=1.
//
//   /demo/frigo → tableau pilotable : poser, retirer (auteur seul), badge « Nouveau »,
//                 bouton « Simuler la lecture par l'autre » → transition « Lu ✓ ».

export default function DemoFrigoPage() {
  if (process.env.GRANDFORD_DEMO !== "1") {
    notFound();
  }
  return <DemoFrigo />;
}
