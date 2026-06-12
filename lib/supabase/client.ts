import type { Database } from "@/lib/database.types";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

// Client Supabase NAVIGATEUR, typé par le schéma généré (lib/database.types.ts).
// À n'utiliser que dans des composants 'use client'.
export function createClient() {
  const { url, anonKey } = supabasePublicConfig();
  return createBrowserClient<Database>(url, anonKey);
}
