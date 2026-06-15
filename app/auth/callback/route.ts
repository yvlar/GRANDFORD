import { createClient } from "@/lib/supabase/server";
import { cheminInterneSchema } from "@/lib/validation";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Retour des flux d'auth (FR-11) : lien magique (token_hash) ou OAuth (code PKCE).
// Échange le jeton contre une session (cookies), puis route vers la suite. En cas
// d'échec, on remonte une RAISON technique courte — préfixe = OÙ ça casse, suffixe =
// code Supabase/OAuth — pour rendre l'échec diagnosticable au lieu d'un message opaque
// (dette GoTrue du go-live). R7 : jamais le code/jeton ni une donnée personnelle.

const otpTypeSchema = z.enum([
  "email",
  "magiclink",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

function versEchec(request: NextRequest, suivant: string, raison: string): NextResponse {
  // `raison` est technique (codes OAuth/GoTrue) — sans secret ni donnée personnelle (R7).
  console.error(`[auth/callback] échec : ${raison}`);
  const url = new URL("/connexion", request.url);
  url.searchParams.set("erreur", "callback");
  url.searchParams.set("suivant", suivant);
  url.searchParams.set("detail", raison.slice(0, 120));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const suivantParse = cheminInterneSchema.safeParse(searchParams.get("suivant"));
  const suivant = suivantParse.success ? suivantParse.data : "/onboarding";

  // 1) Échec du fournisseur AVANT tout échange : Supabase n'a pas pu échanger le code
  //    externe (ex. secret Google invalide → "server_error"/"unexpected_failure").
  //    Aucun `code` n'arrive alors ; l'ancien code retombait en message générique opaque.
  const erreurFournisseur = searchParams.get("error_code") ?? searchParams.get("error");
  if (erreurFournisseur) {
    return versEchec(request, suivant, `fournisseur/${erreurFournisseur}`);
  }

  const supabase = await createClient();

  const tokenHash = searchParams.get("token_hash");
  const type = otpTypeSchema.safeParse(searchParams.get("type"));
  const code = searchParams.get("code");

  // 2) Lien magique : vérification directe du jeton (aucun code verifier requis).
  if (tokenHash && type.success) {
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(suivant, request.url));
    }
    return versEchec(request, suivant, `lien/${error.code ?? error.status ?? "inconnu"}`);
  }

  // 3) OAuth PKCE : échange code ↔ session (lit le code verifier déposé au départ).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(suivant, request.url));
    }
    return versEchec(request, suivant, `echange/${error.code ?? error.status ?? "inconnu"}`);
  }

  // 4) Ni erreur fournisseur, ni jeton : rien d'exploitable n'est arrivé sur le callback.
  return versEchec(request, suivant, "aucun_jeton");
}
