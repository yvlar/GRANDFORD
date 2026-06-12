import { createClient } from "@/lib/supabase/server";
import { cheminInterneSchema } from "@/lib/validation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Retour des flux d'auth (FR-11) : lien magique (token_hash) ou OAuth (code PKCE).
// Échange le jeton contre une session (cookies), puis route vers la suite.

const otpTypeSchema = z.enum([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const suivantParse = cheminInterneSchema.safeParse(searchParams.get("suivant"));
  const suivant = suivantParse.success ? suivantParse.data : "/onboarding";

  const supabase = await createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = otpTypeSchema.safeParse(searchParams.get("type"));
  const code = searchParams.get("code");

  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(suivant, request.url));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(suivant, request.url));
    }
  }

  return NextResponse.redirect(new URL("/connexion?erreur=callback", request.url));
}
