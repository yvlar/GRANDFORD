import type { Config } from "tailwindcss";

// UI TDAH : fort contraste, peu de texte (NFR-12). Le thème détaillé (tokens shadcn/ui)
// arrivera avec le premier composant réel (vue « coup d'œil », Sprint 4).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
