"use client";

import { fr } from "@/lib/i18n/fr";
import { useFormStatus } from "react-dom";

// Bouton de soumission partagé pour les formulaires Server Action (Lots B+C).
// WHY client : `useFormStatus` lit l'état d'envoi du <form> parent — invisible côté
// serveur. Sans lui, les formulaires de /foyer, /connexion, /onboarding restaient
// actifs pendant la requête (double-soumission possible, aucun statut visible).
// Tap budget (NFR-1) intact : aucun écran ni clic ajouté, seulement un état visuel.
// Cibles tactiles ≥ 44 px (`min-h-11`). Le focus visible vient de la règle globale
// (globals.css) — inutile de le répéter ici.

type Variant = "primaire" | "secondaire" | "danger";

const VARIANTES: Record<Variant, string> = {
  primaire: "bg-emerald-600 text-neutral-50 hover:bg-emerald-500",
  secondaire: "border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800",
  danger: "bg-red-900 text-red-100 hover:bg-red-800",
};

interface BoutonSoumettreProps {
  readonly children: React.ReactNode;
  readonly variant?: Variant;
  /** Pleine largeur (CTA empilés) vs compact (boutons d'action en ligne). */
  readonly pleineLargeur?: boolean;
  readonly className?: string;
}

export function BoutonSoumettre({
  children,
  variant = "primaire",
  pleineLargeur = false,
  className = "",
}: BoutonSoumettreProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-colors duration-150 disabled:opacity-50 ${
        VARIANTES[variant]
      } ${pleineLargeur ? "w-full" : ""} ${className}`}
    >
      {pending ? fr.commun.envoiEnCours : children}
    </button>
  );
}
