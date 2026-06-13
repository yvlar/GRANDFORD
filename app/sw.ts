/// <reference lib="webworker" />
// Service worker Serwist (Sprint 1) : précache de l'app shell pour l'hors-ligne
// (NFR-4) ; réception du Web Push (FR-10, Sprint 7). Compilé par @serwist/next dans
// un contexte webworker — exclu du `tsc` racine (voir tsconfig.json) pour éviter le conflit
// de libs DOM/WebWorker.
import { FALLBACK_REMINDER, type ReminderPayload } from "@/lib/notifications/payload";
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Réception d'un rappel (FR-10). Le payload est construit côté serveur par
// lib/notifications/payload.ts : date + horizon, structurellement SANS motif (R7)
// — on l'affiche tel quel, on n'y ajoute rien.
self.addEventListener("push", (event) => {
  // Payload absent, illisible ou incomplet → notification générique plutôt que
  // rien : perdre un rappel en silence est le pire échec du produit (R11).
  let payload = FALLBACK_REMINDER;
  try {
    const brut = event.data?.json() as Partial<ReminderPayload> | undefined;
    if (brut && typeof brut.title === "string" && typeof brut.body === "string") {
      payload = {
        title: brut.title,
        body: brut.body,
        url: typeof brut.url === "string" ? brut.url : "/",
      };
    }
  } catch {
    // on garde le repli
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url },
    }),
  );
});

// Toucher la notification ouvre (ou ramène) l'app sur la vue « coup d'œil ».
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existante = fenetres[0];
      if (existante) {
        await existante.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
