import Link from "next/link";
import type { ReactNode } from "react";

// Tuile de navigation (NFR-12) : grande cible contrastée plutôt qu'un lien textuel —
// pictogramme + libellé court, reconnaissance > rappel. Source UNIQUE du look « tuile »,
// partagée par l'accueil (vue coup d'œil), Mon foyer et le frigo.

// WHY classes exportées : le bouton de déconnexion doit rester un <button> dans un <form>
// (POST, jamais un GET) — il ne peut pas réutiliser le <Link> de TuileNav, mais doit avoir
// le même rendu. On partage donc les classes plutôt que de les dupliquer.
export const CLASSES_TUILE =
  "flex min-h-16 flex-col justify-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-neutral-100 transition-colors hover:border-neutral-700 hover:bg-neutral-800";

/** Intérieur d'une tuile : pictogramme (décoratif) + libellé. `children` = ornement optionnel
 *  collé au libellé (ex. pastille de non-lues). Réutilisable dans un <Link> ou un <button>. */
export function ContenuTuile({
  icone,
  libelle,
  children,
}: {
  readonly icone: string;
  readonly libelle: string;
  readonly children?: ReactNode;
}) {
  return (
    <>
      <span className="text-2xl" aria-hidden="true">
        {icone}
      </span>
      <span className="flex items-center gap-2 text-sm font-semibold">
        {libelle}
        {children}
      </span>
    </>
  );
}

/** Tuile-lien (cas courant). Pour une action (déconnexion), utiliser `CLASSES_TUILE` +
 *  `ContenuTuile` sur un <button> dans son <form>. */
export function TuileNav({
  href,
  icone,
  libelle,
  children,
}: {
  readonly href: string;
  readonly icone: string;
  readonly libelle: string;
  readonly children?: ReactNode;
}) {
  return (
    <Link href={href} className={CLASSES_TUILE}>
      <ContenuTuile icone={icone} libelle={libelle}>
        {children}
      </ContenuTuile>
    </Link>
  );
}
