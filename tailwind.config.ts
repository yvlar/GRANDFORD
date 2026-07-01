import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// UI TDAH : fort contraste, peu de texte (NFR-12). Tokens sémantiques d'état : une
// couleur NOMMÉE par statut d'horaire, dérivée de la palette Tailwind existante (les
// teintes ne changent pas — on leur donne un nom métier). Source unique : changer une
// teinte d'état ici la propage partout (légende, cases, pastille). Chaque token porte
// un fond (DEFAULT) et un texte lisible dessus (`-fg`) : `bg-quart-jour text-quart-jour-fg`.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "quart-jour": { DEFAULT: colors.amber[400], fg: colors.amber[950] },
        "quart-nuit": { DEFAULT: colors.indigo[500], fg: colors.indigo[50] },
        conge: { DEFAULT: colors.emerald[500], fg: colors.emerald[950] },
        sommeil: { DEFAULT: colors.sky[500], fg: colors.sky[950] },
        travaille: { DEFAULT: colors.rose[500], fg: colors.rose[50] },
        // Temps supplémentaire (Sprint 29) : orange distinct de l'ambre `quart-jour`
        // pour signaler un quart AJOUTÉ (marqueur + pastille de légende).
        supplementaire: { DEFAULT: colors.orange[500], fg: colors.orange[950] },
      },
    },
  },
  plugins: [],
};

export default config;
