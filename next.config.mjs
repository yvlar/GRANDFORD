import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

// PWA via Serwist : service worker construit depuis app/sw.ts vers public/sw.js.
// WHY: désactivé hors production pour éviter un cache agressif pendant le développement.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WHY: sortie « standalone » (serveur Node minimal + traçage des dépendances) pour une
  // image Docker légère et non-root. Sans effet sur Vercel, qui utilise son propre build.
  output: "standalone",
};

// Sentry enveloppe la config (instrumente le build + injecte sentry.client.config).
// WHY pas d'upload de source maps ici : il exige SENTRY_AUTH_TOKEN/org/project, posés
// au go-live (Sprint 8) ; sans eux, le plugin se contente d'instrumenter et reste muet.
export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
});
