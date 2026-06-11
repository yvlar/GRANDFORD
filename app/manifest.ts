import type { MetadataRoute } from "next";

// Manifeste PWA (NFR-4). Installable = pré-requis du Web Push sur iOS (R11, architecture.md:130).
// Servi sur /manifest.webmanifest par Next (route de métadonnées).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GRANDFORD",
    short_name: "GRANDFORD",
    description: "Horaire d'usine 12 h et partage des écarts pour le couple.",
    lang: "fr-CA",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
