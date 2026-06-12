import { describe, expect, it } from "vitest";
import { vapidKeyToBytes } from "./push";

// Décodage base64url de la clé VAPID — la seule logique non triviale du chemin
// d'abonnement (le reste est des appels navigateur, mockés nulle part : testé en
// vrai au Sprint 8 sur l'iPhone, R11).

describe("vapidKeyToBytes", () => {
  it("décode une chaîne base64url (alphabet -_ sans padding) vers les bons octets", () => {
    // "??>" = 0x3f 0x3f 0x3e → base64url "Pz8-" (le « - » remplace « + »).
    expect(Array.from(vapidKeyToBytes("Pz8-"))).toEqual([0x3f, 0x3f, 0x3e]);
    // 0xff 0xef → base64url "_-8" (le « _ » remplace « / », padding retiré).
    expect(Array.from(vapidKeyToBytes("_-8"))).toEqual([0xff, 0xef]);
  });

  it("restitue une clé VAPID publique réaliste (65 octets, préfixe 0x04 non compressé)", () => {
    // Clé P-256 factice : 0x04 suivi de 64 octets — la forme exacte produite par
    // `web-push generate-vapid-keys` (87 caractères base64url).
    const octets = [4, ...Array.from({ length: 64 }, (_, i) => i)];
    const base64url = Buffer.from(octets).toString("base64url");
    expect(base64url).toHaveLength(87);
    expect(Array.from(vapidKeyToBytes(base64url))).toEqual(octets);
  });
});
