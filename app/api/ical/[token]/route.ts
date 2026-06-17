import type { Database } from "@/lib/database.types";
import { GRANDFORD_CYCLE } from "@/lib/engine";
import { generateIcalSpouse, generateIcalWorker, verifyIcalToken } from "@/lib/ical/generate";
import { addDays } from "@/lib/schedule/status";
import { todayCivil } from "@/lib/schedule/today";
import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Route d'abonnement iCal (FR-14). Stateless : le token HMAC remplace l'auth GoTrue.
// SUPABASE_SERVICE_ROLE côté serveur uniquement — la route n'est jamais client.

const teamSchema = z.enum(["A", "B", "C", "D"]);
const exceptionRowSchema = z.object({
  on_date: z.string(),
  effect: z.enum(["off", "working", "working_extra", "shift_swap"]),
  shift: z.enum(["jour", "nuit"]).nullable(),
});

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE manquant.");
  }
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  const secret = process.env.ICAL_SECRET;
  if (!secret) {
    return new NextResponse("Configuration manquante.", { status: 503 });
  }

  const verified = verifyIcalToken(token, secret);
  if (!verified) {
    return new NextResponse("Token invalide.", { status: 401 });
  }

  const { householdId, role } = verified;
  const supabase = createServiceClient();

  // Récupérer le profile_id du travailleur (role='worker') du foyer.
  // Nécessaire pour filtrer worker_assignments et exceptions par membre spécifique.
  const memberRes = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("household_id", householdId)
    .eq("role", "worker")
    .limit(1)
    .maybeSingle();

  if (memberRes.error || !memberRes.data) {
    return new NextResponse("Foyer introuvable.", { status: 404 });
  }

  const workerProfileId = memberRes.data.profile_id;

  // Récupérer l'équipe du travailleur, filtré par profile_id pour éviter toute ambiguïté.
  const assignmentRes = await supabase
    .from("worker_assignments")
    .select("team")
    .eq("household_id", householdId)
    .eq("profile_id", workerProfileId)
    .limit(1)
    .maybeSingle();

  if (assignmentRes.error || !assignmentRes.data) {
    return new NextResponse("Équipe non configurée.", { status: 404 });
  }

  const teamParsed = teamSchema.safeParse(assignmentRes.data.team);
  if (!teamParsed.success) {
    return new NextResponse("Équipe invalide.", { status: 500 });
  }
  const team = teamParsed.data;

  // Fenêtre ±90 jours à partir d'aujourd'hui.
  const today = todayCivil();
  const from = addDays(today, -90);
  const to = addDays(today, 90);

  // R7 : colonnes partageables uniquement — jamais de jointure vers exception_private.
  // Filtrer par profile_id du travailleur : n'inclure QUE ses écarts, pas ceux de la conjointe.
  const exceptionsRes = await supabase
    .from("exceptions")
    .select("on_date, effect, shift")
    .eq("household_id", householdId)
    .eq("profile_id", workerProfileId)
    .gte("on_date", from)
    .lte("on_date", to)
    .order("on_date");

  if (exceptionsRes.error) {
    return new NextResponse("Erreur de lecture.", { status: 500 });
  }

  // Zod valide chaque ligne à la frontière BD — les lignes invalides sont silencieusement ignorées.
  const exceptions = (exceptionsRes.data ?? []).flatMap((row) => {
    const parsed = exceptionRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });

  const ics =
    role === "worker"
      ? generateIcalWorker(team, exceptions, GRANDFORD_CYCLE, from, to)
      : generateIcalSpouse(team, exceptions, GRANDFORD_CYCLE, from, to);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="grandford.ics"',
      // Pas de cache côté client : l'horaire peut changer à tout moment.
      "Cache-Control": "no-store",
    },
  });
}
