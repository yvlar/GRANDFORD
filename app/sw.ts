/// <reference lib="webworker" />
// Service worker Serwist minimal (Sprint 1) : précache de l'app shell pour l'hors-ligne
// (NFR-4) et base pour la réception du Web Push (Sprint 7). Compilé par @serwist/next dans
// un contexte webworker — exclu du `tsc` racine (voir tsconfig.json) pour éviter le conflit
// de libs DOM/WebWorker.
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
