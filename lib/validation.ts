import { z } from "zod";

// Schémas partagés des frontières (règle conventions-code-base.md).

// WHY: `suivant` revient dans une redirection — exiger un chemin relatif interne
// (jamais une URL absolue ni «//hôte») ferme la porte aux redirections ouvertes.
// Partagé entre l'action de connexion et le callback d'auth : une seule définition
// à durcir le jour venu.
export const cheminInterneSchema = z.string().regex(/^\/(?!\/)/);

export const uuidSchema = z.uuid();
