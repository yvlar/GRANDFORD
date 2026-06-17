import { fr } from "@/lib/i18n/fr";
import Link from "next/link";

// Politique de confidentialité (Loi 25 / PIPEDA) — accessible sans authentification.
// Doit être visible avant l'acceptation d'une invitation (consentement éclairé, règle securite-secrets.md).

export default function PolitiquePage() {
  const t = fr.politique;
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 bg-neutral-950 p-6 text-neutral-50">
      <Link
        href="/"
        className="inline-flex items-center gap-1 self-start text-sm font-semibold text-emerald-400 hover:text-emerald-300"
      >
        ← {t.retourAccueil}
      </Link>

      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t.titre}</h1>
        <p className="mt-2 text-sm text-neutral-400">{t.dateEntreeVigueur}</p>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-neutral-300">{t.intro}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.donnees}</h2>
        <ul className="flex flex-col gap-1 pl-4">
          {t.donneesListe.map((item) => (
            <li key={item} className="list-disc text-neutral-300">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.finalites}</h2>
        <ul className="flex flex-col gap-1 pl-4">
          {t.finalitesListe.map((item) => (
            <li key={item} className="list-disc text-neutral-300">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t.droits}</h2>
        <p className="text-neutral-300">{t.droitsTexte}</p>
      </section>

      <section className="flex flex-col gap-2 text-sm text-neutral-400">
        <p>{t.retention}</p>
        <p>{t.region}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t.contact}</h2>
        <p className="text-neutral-300">{t.responsable}</p>
        <a
          href={`mailto:${t.responsableCourriel}`}
          className="text-emerald-400 underline hover:text-emerald-300"
        >
          {t.responsableCourriel}
        </a>
      </section>
    </main>
  );
}
