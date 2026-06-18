import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "GRANDFORD",
  description: "Prothèse de mémoire partagée — horaire d'usine 12 h et diffusion des écarts.",
  applicationName: "GRANDFORD",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GRANDFORD",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-CA" className={jakarta.variable}>
      <body className="font-[family-name:var(--font-jakarta)]">{children}</body>
    </html>
  );
}
