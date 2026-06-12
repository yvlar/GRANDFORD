// Clés publiques par design : la sécurité repose sur la RLS, pas sur leur secret
// (règle securite-secrets.md). Validées ici pour échouer tôt et clairement.

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export function supabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase manquante : définir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir .env.example).",
    );
  }
  return { url, anonKey };
}
