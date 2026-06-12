"use server";

import { requestOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";
import { cheminInterneSchema } from "@/lib/validation";
import { redirect } from "next/navigation";
import { z } from "zod";

// Entrées externes → Zod (règle conventions-code-base.md).
const courrielSchema = z.email();

function cheminSuivant(formData: FormData): string {
  const parsed = cheminInterneSchema.safeParse(formData.get("suivant"));
  return parsed.success ? parsed.data : "/onboarding";
}

function versConnexion(erreur: string, suivant: string): never {
  redirect(`/connexion?erreur=${erreur}&suivant=${encodeURIComponent(suivant)}`);
}

export async function envoyerLienMagique(formData: FormData): Promise<void> {
  const suivant = cheminSuivant(formData);
  const courriel = courrielSchema.safeParse(formData.get("courriel"));
  if (!courriel.success) {
    versConnexion("courriel", suivant);
  }

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email: courriel.data,
    options: {
      emailRedirectTo: `${origin}/auth/callback?suivant=${encodeURIComponent(suivant)}`,
    },
  });
  if (error) {
    versConnexion("envoi", suivant);
  }
  redirect(`/connexion?envoye=1&suivant=${encodeURIComponent(suivant)}`);
}

async function seConnecterOAuth(provider: "google" | "apple", formData: FormData): Promise<void> {
  const suivant = cheminSuivant(formData);
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?suivant=${encodeURIComponent(suivant)}`,
    },
  });
  if (error || !data.url) {
    versConnexion("oauth", suivant);
  }
  redirect(data.url);
}

export async function seConnecterAvecGoogle(formData: FormData): Promise<void> {
  await seConnecterOAuth("google", formData);
}

export async function seConnecterAvecApple(formData: FormData): Promise<void> {
  await seConnecterOAuth("apple", formData);
}
