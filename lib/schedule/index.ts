// Point d'entrée de la couche « vue d'horaire » : fonctions pures qui combinent le
// moteur (consommé tel quel), les écarts partagés et le sommeil — utilisables client
// et serveur (l'horaire ne dépend jamais du réseau pour se calculer, NFR-4).
export * from "./availability";
export * from "./calendar";
export * from "./today";
