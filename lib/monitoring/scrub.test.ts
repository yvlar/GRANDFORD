import { describe, expect, it } from "vitest";
import { type ScrubbableEvent, scrubSentryEvent } from "./scrub";

describe("scrubSentryEvent — étanchéité R7 des événements Sentry", () => {
  it("retire entièrement l'identité (courriel, IP, username)", () => {
    const event: ScrubbableEvent = {
      user: { id: "42", email: "marie@exemple.com", ip_address: "1.2.3.4", username: "marie" },
      server_name: "vercel-prod-1",
    };
    scrubSentryEvent(event);
    expect(event.user).toBeUndefined();
    expect(event.server_name).toBeUndefined();
  });

  it("retire les données applicatives libres (extra)", () => {
    const event: ScrubbableEvent = { extra: { motif: "maladie", date: "2026-07-15" } };
    scrubSentryEvent(event);
    expect(event.extra).toBeUndefined();
  });

  it("vide corps, cookies, en-têtes et chaîne de requête, et tronque l'URL à son chemin", () => {
    const event: ScrubbableEvent = {
      request: {
        url: "https://grandford.app/ecarts?date=2026-07-15&motif=maladie",
        method: "POST",
        cookies: "sb-access-token=secret",
        headers: { authorization: "Bearer secret" },
        data: { motif: "maladie" },
        query_string: "date=2026-07-15",
      },
    };
    scrubSentryEvent(event);
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.url).toBe("https://grandford.app/ecarts");
    // La méthode, non sensible, reste pour le débogage.
    expect(event.request?.method).toBe("POST");
  });

  it("ne garde que les contextes techniques sûrs et jette les contextes applicatifs", () => {
    const event: ScrubbableEvent = {
      contexts: {
        os: { name: "iOS" },
        runtime: { name: "node" },
        state: { foyer: { motif: "maladie" } },
        response: { body: "marie@exemple.com" },
      },
    };
    scrubSentryEvent(event);
    expect(event.contexts?.os).toEqual({ name: "iOS" });
    expect(event.contexts?.runtime).toEqual({ name: "node" });
    expect(event.contexts?.state).toBeUndefined();
    expect(event.contexts?.response).toBeUndefined();
  });

  it("retire les données des fils d'Ariane et caviarde leur message", () => {
    const event: ScrubbableEvent = {
      breadcrumbs: [
        {
          category: "navigation",
          type: "default",
          level: "info",
          message: "vers marie@exemple.com",
          data: { motif: "x" },
        },
      ],
    };
    scrubSentryEvent(event);
    expect(event.breadcrumbs?.[0]?.data).toBeUndefined();
    expect(event.breadcrumbs?.[0]?.message).toBe("vers [retiré]");
    // Le squelette utile au débogage subsiste.
    expect(event.breadcrumbs?.[0]?.category).toBe("navigation");
  });

  it("caviarde courriels et dates ISO dans le message de l'événement", () => {
    const event: ScrubbableEvent = {
      message: "échec pour marie@exemple.com sur l'écart du 2026-07-15",
    };
    scrubSentryEvent(event);
    expect(event.message).toBe("échec pour [retiré] sur l'écart du [retiré]");
  });

  it("caviarde la valeur d'exception et retire les variables locales de pile", () => {
    const event: ScrubbableEvent = {
      exception: {
        values: [
          {
            type: "Error",
            value: "doublon le 2026-07-15 pour marie@exemple.com",
            stacktrace: {
              frames: [
                {
                  filename: "capture.ts",
                  function: "create",
                  vars: { motif: "maladie", onDate: "2026-07-15" },
                },
              ],
            },
          },
        ],
      },
    };
    scrubSentryEvent(event);
    expect(event.exception?.values?.[0]?.value).toBe("doublon le [retiré] pour [retiré]");
    expect(event.exception?.values?.[0]?.type).toBe("Error");
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
    // L'emplacement du code (non sensible) reste pour le débogage.
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe("capture.ts");
  });

  it("retire les variables locales des frames de threads (pile serveur Node)", () => {
    const event: ScrubbableEvent = {
      threads: {
        values: [
          {
            stacktrace: {
              frames: [
                { filename: "actions.ts", vars: { motif: "maladie", onDate: "2026-07-15" } },
              ],
            },
          },
        ],
      },
    };
    scrubSentryEvent(event);
    expect(event.threads?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
    // L'emplacement du code subsiste pour le débogage.
    expect(event.threads?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe("actions.ts");
  });

  it("caviarde courriels et dates dans les valeurs d'étiquettes", () => {
    const event: ScrubbableEvent = {
      tags: { route: "/ecarts", contact: "marie@exemple.com", jour: "2026-07-15", count: 3 },
    };
    scrubSentryEvent(event);
    expect(event.tags?.route).toBe("/ecarts");
    expect(event.tags?.contact).toBe("[retiré]");
    expect(event.tags?.jour).toBe("[retiré]");
    // Une étiquette non textuelle est laissée telle quelle.
    expect(event.tags?.count).toBe(3);
  });

  it("caviarde le nom de transaction", () => {
    const event: ScrubbableEvent = { transaction: "GET /horaire du 2026-07-15" };
    scrubSentryEvent(event);
    expect(event.transaction).toBe("GET /horaire du [retiré]");
  });

  it("caviarde plusieurs occurrences dans un même texte", () => {
    const event: ScrubbableEvent = {
      message: "2026-01-02 et 2026-03-04 ; a@b.co, c@d.io",
    };
    scrubSentryEvent(event);
    expect(event.message).toBe("[retiré] et [retiré] ; [retiré], [retiré]");
  });

  it("ne plante pas sur un événement minimal (tous champs absents)", () => {
    const event: ScrubbableEvent = {};
    expect(() => scrubSentryEvent(event)).not.toThrow();
    expect(event).toEqual({});
  });
});
