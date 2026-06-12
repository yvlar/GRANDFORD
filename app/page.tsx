import { fr } from "@/lib/i18n/fr";
import Link from "next/link";

// Accueil placeholder du Sprint 1. La vraie vue « coup d'œil » arrive au Sprint 4.
// Reste statique (consultable hors-ligne, NFR-4) : la session se vérifie sur /foyer.
export default function AccueilPage() {
  const t = fr.accueil;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
      <h1 className="text-4xl font-bold tracking-tight">{t.titre}</h1>
      <p className="max-w-prose text-lg text-neutral-300">{t.sousTitre}</p>
      <p className="max-w-prose text-sm text-neutral-500">{t.placeholder}</p>
      <nav className="mt-4 flex gap-3">
        <Link
          href="/connexion"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-semibold hover:bg-emerald-500"
        >
          {t.seConnecter}
        </Link>
        <Link
          href="/foyer"
          className="rounded-lg border border-neutral-700 px-6 py-3 text-lg font-semibold text-neutral-300 hover:bg-neutral-900"
        >
          {t.monFoyer}
        </Link>
      </nav>
    </main>
  );
}
