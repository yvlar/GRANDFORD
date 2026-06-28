"use client";

import { parseGroceryItemRows, parseGroceryListRows } from "@/lib/epicerie/db-rows";
import {
  type EpicerieHandlers,
  type GroceryItem,
  type GroceryList,
  compteRestant,
  grouperListes,
} from "@/lib/epicerie/types";
import { fr } from "@/lib/i18n/fr";
import { FORMAT_HORODATAGE } from "@/lib/schedule/format";
import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

// Listes d'épicerie (Sprint 25) — section partagée du foyer, dans la page /frigo. Les DEUX
// membres créent des listes, y ajoutent/retirent des articles, et les cochent/décochent.
// Live via Supabase Realtime (grocery_lists + grocery_items, filtrés par foyer). R7 : un
// libellé d'article n'est pas un motif d'absence.
// NFR-12 : icône + texte (jamais la couleur seule), cibles ≥ 44 px, aria-live pour le toast.

interface ListesEpicerieProps {
  readonly householdId: string;
  readonly currentUserId: string;
  /** Nom affiché par auteur (profile_id → nom) ; « Moi » est substitué pour soi. */
  readonly authorNames: Record<string, string>;
  readonly initialLists: readonly GroceryList[];
  readonly initialItems: readonly GroceryItem[];
  readonly handlers: EpicerieHandlers;
  /** false en démo (pas de BD/socket) : on saute l'abonnement Realtime. Défaut true. */
  readonly realtimeActif?: boolean;
}

// Parse d'une ligne Realtime via le MÊME schéma Zod que le chargement initial (frontière
// unique). Le socket est une entrée externe : on n'y fait jamais confiance, et un payload
// malformé ne doit pas planter le callback (safeParse → null).
function parseListRow(row: unknown): GroceryList | null {
  try {
    return parseGroceryListRows([row])[0] ?? null;
  } catch {
    return null;
  }
}
function parseItemRow(row: unknown): GroceryItem | null {
  try {
    return parseGroceryItemRows([row])[0] ?? null;
  } catch {
    return null;
  }
}

export function ListesEpicerie({
  householdId,
  currentUserId,
  authorNames,
  initialLists,
  initialItems,
  handlers,
  realtimeActif = true,
}: ListesEpicerieProps) {
  const t = fr.epicerie;
  const [lists, setLists] = useState<GroceryList[]>(() => [...initialLists]);
  const [items, setItems] = useState<GroceryItem[]>(() => [...initialItems]);
  const [titre, setTitre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmListId, setConfirmListId] = useState<string | null>(null);
  // Brouillon d'ajout d'article, par liste (chaque liste a son propre composeur inline).
  const [itemDrafts, setItemDrafts] = useState<Record<string, string>>({});
  const [enCours, startTransition] = useTransition();

  const upsertList = useCallback((liste: GroceryList) => {
    setLists((courantes) => [liste, ...courantes.filter((l) => l.id !== liste.id)]);
  }, []);
  const upsertItem = useCallback((item: GroceryItem) => {
    setItems((courants) => [...courants.filter((i) => i.id !== item.id), item]);
  }, []);

  // ── Realtime : grocery_lists + grocery_items de CE foyer ────────────────────
  useEffect(() => {
    if (!realtimeActif) {
      return;
    }
    const supabase = createClient();
    let actif = true;

    const abonner = async () => {
      await supabase.auth.getSession(); // pousse le jeton au socket → RLS appliquée
      if (!actif) {
        return;
      }
      const filtre = `household_id=eq.${householdId}`;
      const canal = supabase
        .channel(`epicerie:${householdId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "grocery_lists", filter: filtre },
          (payload) => {
            const liste = parseListRow(payload.new);
            if (!liste) {
              return;
            }
            upsertList(liste);
            if (liste.authorId !== currentUserId) {
              setToast(t.nouvelleListeToast);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "grocery_lists", filter: filtre },
          (payload) => {
            const id = (payload.old as Record<string, unknown>).id;
            if (typeof id === "string") {
              setLists((courantes) => courantes.filter((l) => l.id !== id));
              setItems((courants) => courants.filter((i) => i.listId !== id));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "grocery_items", filter: filtre },
          (payload) => {
            const item = parseItemRow(payload.new);
            if (item) {
              upsertItem(item);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "grocery_items", filter: filtre },
          (payload) => {
            const item = parseItemRow(payload.new);
            if (item) {
              upsertItem(item);
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "grocery_items", filter: filtre },
          (payload) => {
            const id = (payload.old as Record<string, unknown>).id;
            if (typeof id === "string") {
              setItems((courants) => courants.filter((i) => i.id !== id));
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
  }, [householdId, currentUserId, t.nouvelleListeToast, upsertList, upsertItem, realtimeActif]);

  // Toast éphémère (annoncé poliment aux lecteurs d'écran), auto-effacé.
  useEffect(() => {
    if (toast === null) {
      return;
    }
    const minuteur = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(minuteur);
  }, [toast]);

  const creerListe = () => {
    const texte = titre.trim();
    if (!texte || enCours) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.creerListe(texte);
      if (etat.ok) {
        setTitre("");
        setErreur(null);
        if (etat.liste) {
          upsertList(etat.liste); // optimiste (Realtime redélivrera — dédoublon par id)
        }
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const supprimerListe = (listId: string) => {
    setConfirmListId(null);
    startTransition(async () => {
      const etat = await handlers.supprimerListe(listId);
      if (etat.ok) {
        setLists((courantes) => courantes.filter((l) => l.id !== listId));
        setItems((courants) => courants.filter((i) => i.listId !== listId));
        setErreur(null);
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const ajouterElement = (listId: string) => {
    const texte = (itemDrafts[listId] ?? "").trim();
    if (!texte || enCours) {
      return;
    }
    startTransition(async () => {
      const etat = await handlers.ajouterElement(listId, texte);
      if (etat.ok) {
        setItemDrafts((d) => ({ ...d, [listId]: "" }));
        setErreur(null);
        if (etat.element) {
          upsertItem(etat.element);
        }
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const retirerElement = (itemId: string) => {
    startTransition(async () => {
      const etat = await handlers.retirerElement(itemId);
      if (etat.ok) {
        setItems((courants) => courants.filter((i) => i.id !== itemId));
        setErreur(null);
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  // Coche/décoche optimiste : on reflète l'état tout de suite (le RPC tient la vérité BD ;
  // Realtime redélivrera la ligne complète aux deux membres). checkedBy = moi sur cochage.
  const cocher = (item: GroceryItem) => {
    if (enCours) {
      return;
    }
    const prochain = !item.isChecked;
    startTransition(async () => {
      const etat = await handlers.cocherElement(item.id, prochain);
      if (etat.ok) {
        setErreur(null);
        setItems((courants) =>
          courants.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  isChecked: prochain,
                  checkedBy: prochain ? currentUserId : null,
                  checkedAt: prochain ? new Date().toISOString() : null,
                }
              : i,
          ),
        );
      } else {
        setErreur(etat.erreur);
      }
    });
  };

  const groupes = useMemo(() => grouperListes(lists, items), [lists, items]);

  return (
    <section aria-label={t.titre} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">🛒 {t.titre}</h2>
        <p className="text-sm text-neutral-400">{t.sousTitre}</p>
      </header>

      {/* Création d'une liste */}
      <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <label htmlFor="epicerie-titre" className="sr-only">
          {t.nouvelleListePlaceholder}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="epicerie-titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder={t.nouvelleListePlaceholder}
            maxLength={100}
            className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
          />
          <button
            type="button"
            disabled={enCours || !titre.trim()}
            onClick={creerListe}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 font-semibold text-neutral-50 transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            ➕ {t.creerListe}
          </button>
        </div>
      </div>

      {/* Toast live (nouvelle liste reçue) : <output> porte role="status" + aria-live poli. */}
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

      {groupes.length === 0 ? (
        <p className="text-sm text-neutral-400">{t.vide}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groupes.map(({ liste, elements }) => {
            const restant = compteRestant(elements);
            const auteur =
              liste.authorId === currentUserId ? t.parMoi : (authorNames[liste.authorId] ?? "—");
            return (
              <li
                key={liste.id}
                className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold">{liste.title}</h3>
                    <span className="text-xs text-neutral-500">
                      {auteur} · {FORMAT_HORODATAGE.format(new Date(liste.createdAt))}
                    </span>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      restant === 0
                        ? "bg-emerald-700 text-white"
                        : "bg-neutral-800 text-neutral-200"
                    }`}
                  >
                    {restant === 0 ? `✓ ${t.toutCoche}` : `🛒 ${t.restant(restant)}`}
                  </span>
                </div>

                {elements.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t.listeVide}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {elements.map((item) => {
                      const cochePar =
                        item.checkedBy === null
                          ? null
                          : item.checkedBy === currentUserId
                            ? t.parMoi
                            : (authorNames[item.checkedBy] ?? "—");
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 hover:bg-neutral-800"
                        >
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => cocher(item)}
                            aria-pressed={item.isChecked}
                            aria-label={`${item.isChecked ? t.decocher : t.cocher} : ${item.label}`}
                            className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm text-neutral-100 disabled:opacity-50"
                          >
                            <span aria-hidden="true">{item.isChecked ? "☑" : "☐"}</span>
                            <span
                              className={
                                item.isChecked ? "text-neutral-500 line-through" : undefined
                              }
                            >
                              {item.label}
                            </span>
                            {cochePar !== null ? (
                              <span className="text-xs italic text-neutral-500">
                                · {t.cochePar(cochePar)}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => retirerElement(item.id)}
                            aria-label={`${t.retirerElement} : ${item.label}`}
                            className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-medium text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100 disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Ajout d'un article (ouvert aux deux membres). */}
                <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-2">
                  <label htmlFor={`epicerie-item-${liste.id}`} className="sr-only">
                    {t.elementPlaceholder}
                  </label>
                  <input
                    id={`epicerie-item-${liste.id}`}
                    value={itemDrafts[liste.id] ?? ""}
                    onChange={(e) => setItemDrafts((d) => ({ ...d, [liste.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        ajouterElement(liste.id);
                      }
                    }}
                    placeholder={t.elementPlaceholder}
                    maxLength={200}
                    className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500"
                  />
                  <button
                    type="button"
                    disabled={enCours || !(itemDrafts[liste.id] ?? "").trim()}
                    onClick={() => ajouterElement(liste.id)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-neutral-50 hover:bg-emerald-600 disabled:opacity-50"
                  >
                    ➕ {t.ajouterElement}
                  </button>
                </div>

                {/* Suppression de la liste (confirmée en 2 temps), ouverte aux deux membres. */}
                <div className="flex justify-end">
                  {confirmListId === liste.id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmListId(null)}
                        className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
                      >
                        {t.annuler}
                      </button>
                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() => supprimerListe(liste.id)}
                        className="inline-flex min-h-11 items-center rounded-lg bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                      >
                        🗑 {t.confirmerSuppressionListe}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmListId(liste.id)}
                      aria-label={`${t.supprimerListe} : ${liste.title}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                    >
                      🗑 {t.supprimerListe}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
