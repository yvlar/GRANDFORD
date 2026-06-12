"use server";

import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

// La RPC refuse avec un ERRCODE stable (classe « GF », migration sprint03) : on mappe
// le code SQLSTATE — jamais le texte du message, reformulable — vers une clé d'erreur UI.
const CLES_ERREUR: Record<string, string> = {
  GF001: "invalide",
  GF002: "deja-utilisee",
  GF003: "expiree",
  GF004: "deja-membre",
};

export async function accepterInvitation(code: string): Promise<void> {
  const parsed = uuidSchema.safeParse(code);
  if (!parsed.success) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("redeem_invitation", { p_code: parsed.data });
  if (error) {
    const cle = (error.code && CLES_ERREUR[error.code]) || "generique";
    redirect(`/invitation/${parsed.data}?erreur=${cle}`);
  }
  redirect("/foyer");
}
