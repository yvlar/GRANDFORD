import type { Database } from "@/lib/database.types";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Routes qui exigent une session (les vues publiques — accueil, connexion — restent
// consultables hors connexion ; l'horaire lui-même arrive au Sprint 4).
const PROTECTED_PREFIXES = ["/onboarding", "/foyer", "/invitation"];

/**
 * Rafraîchit la session Supabase à chaque requête (les jetons expirent) et
 * redirige vers /connexion si une route protégée est visitée sans session.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublicConfig();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // WHY getUser (et non getSession) : getUser revalide le jeton auprès du serveur
  // d'auth — getSession se fie au cookie, falsifiable côté client.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/connexion";
    redirectUrl.search = "";
    // WHY: revenir à la page demandée après connexion (ex. lien d'invitation).
    redirectUrl.searchParams.set("suivant", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
