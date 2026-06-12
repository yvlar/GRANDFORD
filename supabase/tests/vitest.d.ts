import "vitest";

// Valeurs transmises par le globalSetup (supabase/tests/global-setup.ts) aux tests.
declare module "vitest" {
  interface ProvidedContext {
    rlsAvailable: boolean;
    rlsDbUrl: string;
  }
}
