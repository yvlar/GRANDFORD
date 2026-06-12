"use client";

import { enregistrerAbonnementPush, supprimerAbonnementPush } from "@/app/notifications/actions";
import { fr } from "@/lib/i18n/fr";
import { vapidKeyToBytes } from "@/lib/notifications/push";
import { useCallback, useEffect, useState } from "react";

// Geste « activer les rappels » (FR-10, Sprint 7) : permission → PushManager.subscribe
// (clé VAPID publique) → persistance via l'action serveur (RLS : ses propres
// appareils). Un seul bouton, un seul état visible — reconnaissance > rappel (NFR-12).
// R7 ne se joue pas ici : l'appareil ne reçoit que ce que l'Edge Function envoie,
// et son payload est construit sans motif (lib/notifications/payload.ts).

type Etat = "verification" | "nonConfigure" | "nonSupporte" | "refuse" | "inactif" | "actif";

function pushSupporte(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function ActiverRappels({
  householdId,
  clePubliqueVapid,
}: {
  householdId: string;
  clePubliqueVapid: string | null;
}) {
  const t = fr.rappels;
  const [etat, setEtat] = useState<Etat>("verification");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      if (!clePubliqueVapid) {
        setEtat("nonConfigure");
        return;
      }
      if (!pushSupporte()) {
        setEtat("nonSupporte");
        return;
      }
      // getRegistration (pas .ready) : sans service worker actif (PWA non installée,
      // mode dev), .ready ne se résout jamais — on veut un constat, pas une attente.
      const registration = await navigator.serviceWorker.getRegistration();
      if (!actif) {
        return;
      }
      if (!registration) {
        setEtat("nonSupporte");
        return;
      }
      if (Notification.permission === "denied") {
        setEtat("refuse");
        return;
      }
      const abonnement = await registration.pushManager.getSubscription();
      if (actif) {
        setEtat(abonnement ? "actif" : "inactif");
      }
    })();
    return () => {
      actif = false;
    };
  }, [clePubliqueVapid]);

  const activer = useCallback(async () => {
    if (!clePubliqueVapid) {
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat("refuse");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setEtat("nonSupporte");
        return;
      }
      const abonnement =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(clePubliqueVapid),
        }));
      const json = abonnement.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("abonnement push incomplet");
      }
      const resultat = await enregistrerAbonnementPush(householdId, {
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });
      if (!resultat.ok) {
        // L'appareil ne doit pas se croire abonné si le serveur ne le sait pas.
        await abonnement.unsubscribe();
        setErreur(resultat.erreur);
        return;
      }
      setEtat("actif");
    } catch {
      setErreur(t.erreur);
    } finally {
      setEnCours(false);
    }
  }, [clePubliqueVapid, householdId, t.erreur]);

  const desactiver = useCallback(async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const abonnement = await registration?.pushManager.getSubscription();
      if (abonnement) {
        await supprimerAbonnementPush(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat("inactif");
    } catch {
      setErreur(t.erreur);
    } finally {
      setEnCours(false);
    }
  }, [t.erreur]);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="text-sm text-neutral-400">{t.consigne}</p>
      {etat === "verification" ? (
        <p className="text-sm text-neutral-500">{t.verification}</p>
      ) : null}
      {etat === "nonConfigure" ? (
        <p className="text-sm text-neutral-500">{t.nonConfigure}</p>
      ) : null}
      {etat === "nonSupporte" ? <p className="text-sm text-amber-300">{t.nonSupporte}</p> : null}
      {etat === "refuse" ? <p className="text-sm text-amber-300">{t.refuse}</p> : null}
      {etat === "inactif" ? (
        <button
          type="button"
          onClick={activer}
          disabled={enCours}
          className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
        >
          {t.activer}
        </button>
      ) : null}
      {etat === "actif" ? (
        <>
          <p className="text-sm text-emerald-300">🔔 {t.actifs}</p>
          <button
            type="button"
            onClick={desactiver}
            disabled={enCours}
            className="self-start text-sm text-neutral-400 underline hover:text-neutral-200"
          >
            {t.desactiver}
          </button>
        </>
      ) : null}
      {erreur ? (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-red-200">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
