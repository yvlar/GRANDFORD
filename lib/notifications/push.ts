// Aides PURES de l'abonnement Web Push côté client (FR-10). Aucune I/O ici :
// l'appel à PushManager vit dans le composant, l'écriture en BD dans l'action.

/** Résultat d'une action d'abonnement, affichable par le composant (sans navigation). */
export interface EtatRappels {
  readonly ok: boolean;
  readonly erreur: string | null;
}

/** Les clés d'un PushSubscription telles que persistées dans `push_subscriptions`. */
export interface PushSubscriptionInput {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/**
 * Décode la clé publique VAPID (base64url) vers les octets attendus par
 * `PushManager.subscribe({ applicationServerKey })`.
 * WHY ne pas passer la chaîne telle quelle : la cible première est Safari iOS
 * (R11) — la conversion manuelle est le seul chemin supporté partout.
 */
// WHY le générique explicite : PushManager exige un BufferSource adossé à un
// ArrayBuffer strict (TS ≥ 5.7 distingue ArrayBufferLike/SharedArrayBuffer).
export function vapidKeyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}
