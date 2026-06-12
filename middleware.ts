import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Tout sauf les actifs statiques et les fichiers PWA (service worker, manifeste,
  // icônes) : eux ne portent jamais de session et doivent rester servis tels quels.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)",
  ],
};
