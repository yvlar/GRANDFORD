import { parseCivilDate } from "@/lib/engine";
import { z } from "zod";

// Schémas partagés des frontières (règle conventions-code-base.md).

// WHY: `suivant` revient dans une redirection — exiger un chemin relatif interne
// (jamais une URL absolue ni «//hôte») ferme la porte aux redirections ouvertes.
// Partagé entre l'action de connexion et le callback d'auth : une seule définition
// à durcir le jour venu.
export const cheminInterneSchema = z.string().regex(/^\/(?!\/)/);

export const uuidSchema = z.uuid();

// Équipe A/B/C/D : resserre le `text` de la BD (et l'entrée des formulaires) vers
// le type `Team` du moteur, à la frontière.
export const equipeSchema = z.enum(["A", "B", "C", "D"]);

// Date civile 'AAAA-MM-JJ' réellement valide (pas seulement la forme) : on délègue
// au parseur du moteur — même domaine que tout le reste du calcul d'horaire.
export const dateCivileSchema = z.string().refine((d) => {
  try {
    parseCivilDate(d);
    return true;
  } catch {
    return false;
  }
});
