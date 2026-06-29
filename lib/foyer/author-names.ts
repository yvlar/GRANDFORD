import { z } from "zod";

// Noms d'affichage des membres d'un foyer (jointure memberships→profiles). Partagé par les
// pages qui étiquettent un auteur (note du frigo, épicerie) : une seule frontière Zod pour la
// forme (full_name nullable) et un unique repli "—", afin que les deux vues affichent
// exactement le même libellé pour un même membre (Sprint 27 : factorisé à l'extraction de /epicerie).
const membreRowSchema = z.object({
  profile_id: z.uuid(),
  profiles: z.object({ full_name: z.string().nullable() }).nullable(),
});

/** Construit la table { profile_id → nom affichable } à partir des lignes memberships(profiles). */
export function parseAuthorNames(rows: readonly unknown[]): Record<string, string> {
  const authorNames: Record<string, string> = {};
  for (const row of rows) {
    const parsed = membreRowSchema.safeParse(row);
    if (parsed.success) {
      authorNames[parsed.data.profile_id] = parsed.data.profiles?.full_name ?? "—";
    }
  }
  return authorNames;
}
