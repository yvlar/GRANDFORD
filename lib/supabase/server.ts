import type { Database } from "@/lib/database.types";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase SERVEUR (Server Components, Server Actions, Route Handlers).
// La session vit dans les cookies ; jamais de SUPABASE_SERVICE_ROLE ici — tout
// passe par le rôle authenticated, donc par la RLS (règle supabase-rls.md).
export async function createClient() {
  // WHY cookies() AVANT la config : à la prérendérisation (build), cookies() signale
  // à Next que la route est dynamique — la valider après éviterait ce signal et
  // ferait échouer le build sur un .env absent.
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublicConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // WHY: un Server Component ne peut pas écrire de cookies (API Next).
          // Le rafraîchissement de session est porté par le middleware.
        }
      },
    },
  });
}
