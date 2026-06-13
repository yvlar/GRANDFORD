// Init Sentry côté edge (middleware, runtime edge). Chargé par instrumentation.ts
// quand NEXT_RUNTIME === "edge". Inerte sans DSN (Sprint 8).
import { SENTRY_DSN, optionsCommunes } from "@/lib/monitoring/sentry-options";
import * as Sentry from "@sentry/nextjs";

Sentry.init({ dsn: SENTRY_DSN, ...optionsCommunes });
