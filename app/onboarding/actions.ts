"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const nomFoyerSchema = z.string().trim().min(1).max(80);

export async function creerFoyer(formData: FormData): Promise<void> {
  const nom = nomFoyerSchema.safeParse(formData.get("nom"));
  if (!nom.success) {
    redirect("/onboarding?erreur=nom");
  }

  const supabase = await createClient();
  // Atomique côté BD (RPC SECURITY INVOKER) : foyer + membership(worker), sous RLS.
  const { error } = await supabase.rpc("create_household_with_membership", {
    p_name: nom.data,
  });
  if (error) {
    redirect("/onboarding?erreur=creation");
  }
  redirect("/foyer");
}
