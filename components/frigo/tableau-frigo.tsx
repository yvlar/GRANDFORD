"use client";

import { parseFrigoRows } from "@/lib/frigo/db-rows";
import {
  type FrigoHandlers,
  type FrigoNote,
  estEditee,
  estNouvellePourMoi,
  grouperEnFils,
  statutLecture,
} from "@/lib/frigo/types";
import { fr } from "@/lib/i18n/fr";
import { FORMAT_HORODATAGE } from "@/lib/schedule/format";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

// Tableau de la « note du frigo » (Sprint 20) — visible des deux membres du foyer.
// Live via Supabase Realtime : une note collée par l'un APPARAÎT chez l'autre sans
// rafraîchir (INSERT), et l'accusé « Lu ✓ » s'affiche en direct chez l'auteur (UPDATE).
// R7 : le body est une remarque de couple, jamais un motif d'absence.
// NFR-12 : icône + texte (jamais la couleur seule), cibles ≥ 44 px, aria-live pour le toast.

interface TableauFrigoProps {
  readonly householdId: string;
  readonly currentUserId: string;
  /** Nom affiché par auteur (profile_id → nom) ; « Moi » est substitué pour soi. */
  readonly authorNames: Record<string, string>;
  readonly initialNotes: readonly FrigoNote[];
  readonly handlers: FrigoHandlers;
  /** false en démo (pas de BD/socket) : on saute l'abonnement Realtime. Défaut true. */
  readonly realtimeActif?: boolean;
}

// Parse d'une ligne Realtime (snake_case) → FrigoNote via le MÊME schéma Zod que le
// chargement initial (lib/frigo/db-rows.ts) — une seule frontière de validation. Le socket
// est une entrée externe : on n'y fait jamais confiance, et on ne laisse pas un payload
// malformé faire planter le callback (safeParse → null).
function parseRealtimeRow(row: unknown): FrigoNote | null {
  try {
    return parseFrigoRows([row])[0] ?? null;
  } catch {
    return null;
  }
}

function trierRecentDabord(notes: readonly FrigoNote[]): FrigoNote[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function TableauFrigo({
  householdId,
  currentUserId,
  authorNames,
  initialNotes,
  handlers,
  realtimeActif = true,
}: TableauFrigoProps) {
  const t = fr.frigo;
  const [notes, setNotes] = useState<FrigoNote[]>(() => trierRecentDabord(initialNotes));
  const [corps, setCorps] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Édition inline : note en cours d'édition + son brouillon de corps (auteur seul).
  const [editId, setEditId] = useState<string | null>(null);
  const [editCorps, setEditCorps] = useState("");
  // Réponse inline (Sprint 23) : note de tête à laquelle on répond + brouillon de réponse.
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyCorps, setReplyCorps] = useState("");
  const [enCours, startTransition] = useTransition();
  // Notes déjà marquées lues dans cette session — évite de rappeler le RPC en boucle.
  const dejaMarquees = useRef<Set<string>>(new Set());

  const upsertNote = useCallback((note: FrigoNote) => {
    setNotes((courantes) => {
      const sansDoublon = courantes.filter((n) => n.id !== note.id);
      return trierRecentDabord([note, ...sansDoublon]);
    });
  }, []);

  // Pose l'accusé de lecture LOCALEMENT par fusion ciblée (id) plutôt que par un snapshot
  // capturé : un UPDATE Realtime concurrent (ex. édition du corps par l'auteur) n'est ainsi
  // jamais écrasé — on ne touche que read_at/read_by.
  const marquerLueLocalement = useCallback((noteId: string, lecteurId: string) => {
    setNotes((courantes) =>
      courantes.map((n) =>
        n.id === noteId ? { ...n, readAt: new Date().toISOString(), readBy: lecteurId } : n,
      ),
    );
  }, []);

  // ── Realtime : INSERT/UPDATE/DELETE sur les notes de CE foyer ───────────────
  useEffect(() => {
    if (!realtimeActif) {
      return;
    }
    const supabase = createClient();
    let actif = true;

    const abonner = async () => {
      // Pousse le jeton de session au socket pour que la RLS s'applique côté Realtime.
      await supabase.auth.getSession();
      if (!actif) {
        return;
      }
      const canal = supabase
        .channel(`frigo:${householdId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "fridge_notes",
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const note = parseRealtimeRow(payload.new);
            if (!note) {
              return;
            }
            upsertNote(note);
            if (note.authorId !== currentUserId) {
              setToast(note.parentId !== null ? t.nouvelleReponseToast : t.nouvelleNoteToast);
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "fridge_notes",
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const note = parseRealtimeRow(payload.new);
            if (note) {
              // Reset d'accusé (l'auteur a réédité la note) : on RETIRE l'id du garde
              // anti-tempête pour que l'auto-marquage puisse re-poser l'accusé. Sans ça, la
              // note rééditée réafficherait « Nouveau » sans jamais redevenir « lue ».
              if (note.readAt === null) {
                dejaMarquees.current.delete(note.id);
              }
              upsertNote(note);
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "fridge_notes",
            filter: `household_id=eq.${householdId}`,
          },
          (payload) => {
            const id = (payload.old as Record<string, unknown>).id;
            if (typeof id === "string") {
              setNotes((courantes) => courantes.filter((n) => n.id !== id));
            }
          },
        )
        .subscribe();

      return canal;
    };

    const canalPromise = abonner();
    return () => {
      actif = false;
      void (async () => {
        const canal = await canalPromise;
        if (canal) {
          await supabase.removeChannel(canal);
        }
      })();
    };
  }, [
    householdId,
    currentUserId,
    t.nouvelleNoteToast,
    t.nouvelleReponseToast,
    upsertNote,
    realtimeActif,
  ]);

  // ── Auto-marquage « lu » : à l'affichage, on accuse réception des notes de l'autre ──
  useEffect(() => {
    for (const note of notes) {
      if (estNouvellePourMoi(note, currentUserId) && !dejaMarquees.current.has(note.id)) {
        // On marque l'ESSAI fait avant l'appel (jamais retiré, même en cas d'échec) : sans
        // ça, un échec persistant ré-armerait l'effet à chaque rendu → tempête de RPC. Le RPC
        // est idempotent côté serveur ; un échec transitoire se rejoue au prochain montage.
        dejaMarquees.current.add(note.id);
        void (async () => {
          const etat = await handlers.marquerLue(note.id);
          // Optimisme : on efface le badge « Nouveau » localement tout de suite (le lecteur
          // EST read_by) ; l'auteur, lui, reçoit l'accusé live par Realtime + push.
          if (etat.ok) {
            marquerLueLocalement(note.id, currentUserId);
          }
        })();
      }
    }
  }, [notes, currentUserId, handlers, marquerLueLocalement]);

  // Toast éphémère (annoncé poliment aux lecteurs d'écran), auto-effacé.
  useEffect(() => {
    if (toast === null) {
      return;
    }
    const minuteur = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(minuteur);
  }, [toast]);

  const coller = () => {
    const texte = corps.trim();
    if (!texte || enCours) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.creer(texte);
      if (etat.ok) {
        setCorps("");
        setErreur(null);
        // Affichage optimiste : la note apparaît tout de suite (le live Realtime la
        // redélivrera — upsertNote dédoublonne par id).
        if (etat.note) {
          upsertNote(etat.note);
        }
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const retirer = (noteId: string) => {
    setConfirmId(null);
    startTransition(async () => {
      const etat = await handlers.supprimer(noteId);
      if (etat.ok) {
        setNotes((courantes) => courantes.filter((n) => n.id !== noteId));
        setErreur(null);
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  // Ouvre l'édition d'une note : précharge son corps, ferme une éventuelle confirmation de
  // retrait (les deux modes s'excluent sur une même carte).
  const demanderEdition = (note: FrigoNote) => {
    setConfirmId(null);
    setReplyToId(null); // modes exclusifs : ouvrir l'édition ferme un composeur de réponse ouvert
    setErreur(null); // un bandeau d'erreur d'une action précédente ne doit pas traîner pendant l'édition
    setEditCorps(note.body);
    setEditId(note.id);
  };

  const enregistrerEdition = (noteId: string) => {
    const texte = editCorps.trim();
    if (!texte || enCours) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.modifier(noteId, texte);
      if (etat.ok) {
        setEditId(null);
        setErreur(null);
        // Optimisme : le live Realtime redélivrera la note modifiée (upsertNote dédoublonne).
        if (etat.note) {
          upsertNote(etat.note);
        }
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  // Ouvre la réponse à une note de tête : ferme l'édition/retrait en cours (modes exclusifs),
  // repart d'un brouillon vierge.
  const demanderReponse = (parentId: string) => {
    setConfirmId(null);
    setEditId(null);
    setErreur(null);
    setReplyCorps("");
    setReplyToId(parentId);
  };

  const envoyerReponse = (parentId: string) => {
    const texte = replyCorps.trim();
    if (!texte || enCours) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.repondre(parentId, texte);
      if (etat.ok) {
        setReplyToId(null);
        setReplyCorps("");
        setErreur(null);
        // Optimisme : la réponse apparaît tout de suite (Realtime la redélivrera — dédoublon par id).
        if (etat.note) {
          upsertNote(etat.note);
        }
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  // Regroupement en fils, mémoïsé : ne recalcule que quand les notes changent (pas à chaque
  // frappe dans un brouillon ni à chaque bascule d'UI).
  const fils = useMemo(() => grouperEnFils(notes), [notes]);

  // Rend une carte (note de tête OU réponse). Factorisé : parent et réponses partagent la
  // même carte ; CarteNote dérive lui-même « est une réponse » de note.parentId.
  const renderCarte = (note: FrigoNote, index: number) => (
    <CarteNote
      note={note}
      index={index}
      currentUserId={currentUserId}
      authorNames={authorNames}
      confirmActif={confirmId === note.id}
      editActif={editId === note.id}
      editCorps={editCorps}
      enCours={enCours}
      // Répondre : seulement sur une note de tête (fil à un seul niveau). Ouvert aux DEUX membres.
      onRepondre={note.parentId === null ? () => demanderReponse(note.id) : undefined}
      onDemanderRetrait={() => {
        setEditId(null);
        setReplyToId(null); // modes exclusifs : la confirmation de retrait ferme un composeur ouvert
        setConfirmId(note.id);
      }}
      onAnnuler={() => setConfirmId(null)}
      onConfirmerRetrait={() => retirer(note.id)}
      onDemanderEdition={() => demanderEdition(note)}
      onChangerEditCorps={setEditCorps}
      onAnnulerEdition={() => setEditId(null)}
      onEnregistrerEdition={() => enregistrerEdition(note.id)}
    />
  );

  return (
    <section aria-label={t.titre} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">📌 {t.titre}</h1>
        <p className="text-sm text-neutral-400">{t.sousTitre}</p>
      </header>

      {/* Zone de saisie */}
      <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <label htmlFor="frigo-corps" className="sr-only">
          {t.placeholder}
        </label>
        <textarea
          id="frigo-corps"
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          placeholder={t.placeholder}
          maxLength={500}
          rows={3}
          className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
        />
        <div className="flex justify-end">
          <button
            type="button"
            disabled={enCours || !corps.trim()}
            onClick={coller}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-neutral-50 transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            📎 {t.ajouter}
          </button>
        </div>
      </div>

      {/* Toast live (nouvelle note reçue) : <output> porte role="status" + aria-live poli. */}
      <output aria-live="polite" className="block min-h-0">
        {toast !== null ? (
          <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-200">🔔 {toast}</p>
        ) : null}
      </output>

      {erreur !== null ? (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">
          {erreur}
        </p>
      ) : null}

      {/* Tableau : un fil par note de tête (la note + ses réponses indentées). */}
      {notes.length === 0 ? (
        <p className="text-sm text-neutral-400">{t.vide}</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {fils.map((fil, index) => (
            <li key={fil.parent.id} className="flex flex-col gap-2">
              {renderCarte(fil.parent, index)}

              {fil.reponses.length > 0 ? (
                <ul
                  aria-label={t.reponsesAria}
                  className="ml-5 flex flex-col gap-2 border-l-2 border-neutral-700 pl-3"
                >
                  {fil.reponses.map((reponse) => (
                    <li key={reponse.id}>{renderCarte(reponse, 0)}</li>
                  ))}
                </ul>
              ) : null}

              {replyToId === fil.parent.id ? (
                <ComposeurReponse
                  parentId={fil.parent.id}
                  valeur={replyCorps}
                  enCours={enCours}
                  onChanger={setReplyCorps}
                  onAnnuler={() => setReplyToId(null)}
                  onEnvoyer={() => envoyerReponse(fil.parent.id)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ComposeurReponseProps {
  readonly parentId: string;
  readonly valeur: string;
  readonly enCours: boolean;
  readonly onChanger: (valeur: string) => void;
  readonly onAnnuler: () => void;
  readonly onEnvoyer: () => void;
}

// Composeur de réponse inline (Sprint 23). Monté seulement quand le fil est ouvert : son
// effet de montage porte le focus dans la zone de texte (NFR-12 : pas de chasse au champ).
function ComposeurReponse({
  parentId,
  valeur,
  enCours,
  onChanger,
  onAnnuler,
  onEnvoyer,
}: ComposeurReponseProps) {
  const t = fr.frigo;
  const zone = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    zone.current?.focus();
  }, []);

  return (
    <div className="ml-5 flex flex-col gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <label htmlFor={`frigo-reponse-${parentId}`} className="sr-only">
        {t.repondre}
      </label>
      <textarea
        ref={zone}
        id={`frigo-reponse-${parentId}`}
        value={valeur}
        onChange={(e) => onChanger(e.target.value)}
        placeholder={t.reponsePlaceholder}
        maxLength={500}
        rows={2}
        className="w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onAnnuler}
          className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
        >
          {t.annuler}
        </button>
        <button
          type="button"
          disabled={enCours || !valeur.trim()}
          onClick={onEnvoyer}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-neutral-50 hover:bg-emerald-500 disabled:opacity-50"
        >
          ↩️ {t.repondre}
        </button>
      </div>
    </div>
  );
}

interface CarteNoteProps {
  readonly note: FrigoNote;
  readonly index: number;
  readonly currentUserId: string;
  readonly authorNames: Record<string, string>;
  readonly confirmActif: boolean;
  readonly editActif: boolean;
  readonly editCorps: string;
  readonly enCours: boolean;
  /** Ouvre la réponse à cette note ; absent sur une réponse (fil à un seul niveau). */
  readonly onRepondre?: () => void;
  readonly onDemanderRetrait: () => void;
  readonly onAnnuler: () => void;
  readonly onConfirmerRetrait: () => void;
  readonly onDemanderEdition: () => void;
  readonly onChangerEditCorps: (valeur: string) => void;
  readonly onAnnulerEdition: () => void;
  readonly onEnregistrerEdition: () => void;
}

function CarteNote({
  note,
  index,
  currentUserId,
  authorNames,
  confirmActif,
  editActif,
  editCorps,
  enCours,
  onRepondre,
  onDemanderRetrait,
  onAnnuler,
  onConfirmerRetrait,
  onDemanderEdition,
  onChangerEditCorps,
  onAnnulerEdition,
  onEnregistrerEdition,
}: CarteNoteProps) {
  const t = fr.frigo;
  const estMienne = note.authorId === currentUserId;
  // « Est une réponse » se dérive de la note elle-même (parentId) — pas de prop parallèle.
  const estReponse = note.parentId !== null;
  // À l'ouverture de l'édition, on porte le focus dans la zone de texte (NFR-12 :
  // reconnaissance > rappel, parcours clavier/lecteur d'écran sans chasse au champ).
  const zoneEdition = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editActif) {
      zoneEdition.current?.focus();
    }
  }, [editActif]);
  // D1 (Sprint 23) : sur une réponse, statutLecture/estNouvellePourMoi renvoient déjà
  // « non-applicable »/false (la règle vit dans les helpers) — pas de double garde ici.
  const statut = statutLecture(note, currentUserId);
  const nouvelle = estNouvellePourMoi(note, currentUserId);
  // « Édité » : visible des deux membres (l'indice que le corps a changé), réponses comprises.
  // Distinct de l'accusé de lecture, qui ne concerne que mes propres notes de tête.
  const editee = estEditee(note);
  const auteur = estMienne ? t.parMoi : (authorNames[note.authorId] ?? "—");
  // Légère inclinaison alternée pour l'effet « collé au frigo » (décoratif). Les réponses
  // restent droites et un cran plus claires : elles se lisent comme un fil sous la note.
  const inclinaison = estReponse ? "" : index % 2 === 0 ? "-rotate-1" : "rotate-1";
  const fond = estReponse ? "bg-amber-50" : "bg-amber-100";

  return (
    <article
      className={`relative flex flex-col gap-3 rounded-sm ${fond} p-4 text-neutral-900 shadow-md ${inclinaison} ${
        nouvelle ? "ring-2 ring-emerald-500" : ""
      }`}
    >
      {estReponse ? null : (
        <span
          aria-label={t.aimantAria}
          className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-red-600 shadow"
        />
      )}

      {nouvelle ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
          ✦ {t.nouveau}
        </span>
      ) : null}

      {editActif ? (
        <>
          <label htmlFor={`frigo-edit-${note.id}`} className="sr-only">
            {t.editer}
          </label>
          <textarea
            ref={zoneEdition}
            id={`frigo-edit-${note.id}`}
            value={editCorps}
            onChange={(e) => onChangerEditCorps(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full resize-y rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-neutral-900"
          />
        </>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
        <span>
          <span className="font-semibold">{auteur}</span> ·{" "}
          {FORMAT_HORODATAGE.format(new Date(note.createdAt))}
          {editee ? (
            <span className="ml-1 inline-flex items-center gap-1 italic text-neutral-500">
              · ✎ {t.edite}
            </span>
          ) : null}
        </span>

        {/* Accusé de lecture : seulement sur MES notes (l'autre a-t-il lu ?). */}
        {statut === "lu" ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
            ✓ {t.lu}
          </span>
        ) : statut === "non-lu" ? (
          <span className="inline-flex items-center gap-1 text-neutral-500">◌ {t.nonLu}</span>
        ) : null}
      </footer>

      {/* Répondre : note de tête seulement (fil à un seul niveau), ouvert aux DEUX membres.
          Masqué pendant l'édition/le retrait de cette carte (modes exclusifs). */}
      {onRepondre && !editActif && !confirmActif ? (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onRepondre}
            aria-label={`${t.repondre} : ${note.body.slice(0, 30)}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-neutral-700 hover:bg-amber-200"
          >
            ↩️ {t.repondre}
          </button>
        </div>
      ) : null}

      {/* Édition + retrait : auteur seul. Édition inline et retrait (confirmé en 2 temps,
          anti-suppression accidentelle) s'excluent l'un l'autre sur une même carte. */}
      {estMienne ? (
        <div className="flex justify-end gap-2 border-t border-amber-200 pt-2">
          {editActif ? (
            <>
              <button
                type="button"
                onClick={onAnnulerEdition}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-neutral-700 hover:bg-amber-200"
              >
                {t.annuler}
              </button>
              <button
                type="button"
                disabled={enCours || !editCorps.trim()}
                onClick={onEnregistrerEdition}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                💾 {t.enregistrer}
              </button>
            </>
          ) : confirmActif ? (
            <>
              <button
                type="button"
                onClick={onAnnuler}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-neutral-700 hover:bg-amber-200"
              >
                {t.annuler}
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={onConfirmerRetrait}
                className="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                🗑 {t.confirmerSuppression}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onDemanderEdition}
                aria-label={`${t.editer} : ${note.body.slice(0, 30)}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-neutral-700 hover:bg-amber-200"
              >
                ✏️ {t.editer}
              </button>
              <button
                type="button"
                onClick={onDemanderRetrait}
                aria-label={`${t.supprimer} : ${note.body.slice(0, 30)}`}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-neutral-700 hover:bg-amber-200"
              >
                🗑 {t.supprimer}
              </button>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
