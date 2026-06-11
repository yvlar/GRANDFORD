import { fr } from "@/lib/i18n/fr";

// Accueil placeholder du Sprint 1. La vraie vue « coup d'œil » arrive au Sprint 4.
export default function AccueilPage() {
  const t = fr.accueil;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 p-8 text-center text-neutral-50">
      <h1 className="text-4xl font-bold tracking-tight">{t.titre}</h1>
      <p className="max-w-prose text-lg text-neutral-300">{t.sousTitre}</p>
      <p className="max-w-prose text-sm text-neutral-500">{t.placeholder}</p>
    </main>
  );
}
