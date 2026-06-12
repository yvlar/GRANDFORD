import { headers } from "next/headers";

/**
 * Origine absolue de la requête courante (Server Action / Server Component).
 * Sert à construire les liens qui repassent par l'app : callback d'auth,
 * lien d'invitation. Derrière Vercel, l'hôte vit dans x-forwarded-host.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Origine introuvable : en-têtes Host absents.");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
