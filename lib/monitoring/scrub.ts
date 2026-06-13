// Nettoyage R7 / Loi 25 de TOUT événement Sentry avant envoi — fonction PURE
// (mutation en place de l'objet fourni, aucune I/O). Testée sans DSN ni réseau.
//
// WHY : Sentry ne doit JAMAIS recevoir une donnée personnelle ni le MOTIF d'une
// absence (la donnée la plus sensible du produit, R7). On ne se fie pas à la
// discipline des messages d'erreur : on retire STRUCTURELLEMENT les conteneurs à
// risque (identité, corps/cookies/en-têtes de requête, données libres, variables
// locales de pile, fils d'Ariane) et on caviarde courriels et dates ISO dans les
// textes qui subsistent. C'est `@sentry/nextjs` qui appellera ceci via `beforeSend`
// (cf. instrumentation Sentry) ; ici, zéro import pour rester trivialement testable.

const COURRIEL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const DATE_ISO = /\b\d{4}-\d{2}-\d{2}\b/g;
const CAVIARDE = "[retiré]";

// Seuls ces contextes Sentry sont sûrs (techniques, sans donnée du foyer). Tout
// contexte applicatif (ex. `state` d'un store) tombe.
const CONTEXTES_SURS = new Set(["os", "runtime", "trace", "app", "device", "culture"]);

function caviarder(texte: string): string {
  return texte.replace(COURRIEL, CAVIARDE).replace(DATE_ISO, CAVIARDE);
}

// Sous-ensembles — tout optionnel, AUCUNE signature d'index — des structures
// Sentry que l'on touche. WHY pas d'index `[k]: unknown` : les types Sentry
// (RequestEventData, Breadcrumb, StackFrame…) n'en ont pas et ne seraient alors
// plus assignables ; on liste donc explicitement les champs lus ou écrits.
interface ScrubRequest {
  url?: unknown;
  method?: unknown;
  cookies?: unknown;
  headers?: unknown;
  data?: unknown;
  query_string?: unknown;
}

interface ScrubBreadcrumb {
  category?: unknown;
  type?: unknown;
  level?: unknown;
  message?: unknown;
  data?: unknown;
}

interface ScrubFrame {
  vars?: unknown;
  filename?: unknown;
  function?: unknown;
}

interface ScrubException {
  type?: unknown;
  value?: unknown;
  stacktrace?: { frames?: ScrubFrame[] } | null;
}

/**
 * Sous-ensemble — tout optionnel — des champs d'un événement Sentry que l'on
 * touche. Un `ErrorEvent` ou un `TransactionEvent` de `@sentry/nextjs` y est
 * structurellement assignable.
 */
export interface ScrubbableEvent {
  user?: unknown;
  server_name?: unknown;
  extra?: unknown;
  message?: unknown;
  transaction?: unknown;
  // `Tags` et `Contexts` de Sentry portent une signature d'index → compatibles Record.
  tags?: Record<string, unknown> | null;
  request?: ScrubRequest | null;
  contexts?: Record<string, unknown> | null;
  breadcrumbs?: ScrubBreadcrumb[] | null;
  exception?: { values?: ScrubException[] | null } | null;
  // WHY threads : sur le runtime serveur Node, Sentry attache souvent la pile ici
  // (et non sous `exception`) ; ses frames portent les MÊMES variables locales (un
  // `motif` en portée fuirait, R7). Même structure que les valeurs d'exception.
  threads?: { values?: ScrubException[] | null } | null;
}

/** Caviarde la valeur et retire les variables locales de chaque frame d'une pile. */
function scrubStacktraces(values: ScrubException[] | null | undefined): void {
  if (!Array.isArray(values)) {
    return;
  }
  for (const item of values) {
    if (typeof item.value === "string") {
      item.value = caviarder(item.value);
    }
    const frames = item.stacktrace?.frames;
    if (Array.isArray(frames)) {
      for (const frame of frames) {
        frame.vars = undefined;
      }
    }
  }
}

/** Retire de l'événement tout ce qui pourrait porter une donnée personnelle ou un motif. */
export function scrubSentryEvent(event: ScrubbableEvent): void {
  // 1) Identité : aucune. Sentry mettrait courriel / IP / username — on supprime tout.
  event.user = undefined;
  event.server_name = undefined;

  // 2) Données applicatives libres : un écart, un motif ou une date pourraient y vivre.
  event.extra = undefined;

  // 3) Requête HTTP : corps, cookies, en-têtes (jeton de session) et chaîne de
  //    requête (`?date=…`) retirés ; on ne garde que l'URL sans sa query.
  const req = event.request;
  if (req) {
    req.cookies = undefined;
    req.headers = undefined;
    req.data = undefined;
    req.query_string = undefined;
    if (typeof req.url === "string") {
      req.url = req.url.split("?")[0];
    }
  }

  // 4) Contextes : allowlist technique ; tout le reste tombe.
  const contexts = event.contexts;
  if (contexts) {
    for (const cle of Object.keys(contexts)) {
      if (!CONTEXTES_SURS.has(cle)) {
        delete contexts[cle];
      }
    }
  }

  // 5) Fils d'Ariane : on garde le squelette (catégorie / type / niveau) pour
  //    déboguer, on retire les données et on caviarde le message (souvent une URL).
  if (Array.isArray(event.breadcrumbs)) {
    for (const fil of event.breadcrumbs) {
      fil.data = undefined;
      if (typeof fil.message === "string") {
        fil.message = caviarder(fil.message);
      }
    }
  }

  // 6) Étiquettes et nom de transaction : caviardés (une étiquette ou un nom posé à
  //    la main peut porter un courriel ou une date).
  const tags = event.tags;
  if (tags) {
    for (const cle of Object.keys(tags)) {
      const valeur = tags[cle];
      if (typeof valeur === "string") {
        tags[cle] = caviarder(valeur);
      }
    }
  }
  if (typeof event.transaction === "string") {
    event.transaction = caviarder(event.transaction);
  }

  // 7) Message, exceptions ET threads : variables locales de pile retirées (elles
  //    portent un motif si `includeLocalVariables` est actif) ; textes caviardés.
  if (typeof event.message === "string") {
    event.message = caviarder(event.message);
  }
  scrubStacktraces(event.exception?.values);
  scrubStacktraces(event.threads?.values);
}
