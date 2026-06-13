// Init Sentry côté navigateur. Injecté par withSentryConfig (next.config.mjs).
// Inerte sans DSN (Sprint 8) ; le scrubber R7 s'applique aussi côté client.
import { SENTRY_DSN, optionsCommunes } from "@/lib/monitoring/sentry-options";
import * as Sentry from "@sentry/nextjs";

Sentry.init({ dsn: SENTRY_DSN, ...optionsCommunes });
