// Sujet "graphe" : construire une représentation du réseau routier et la parcourir (atelier 9, ADR-006).
// La taille est le nombre de noeuds du sous-graphe : les noeuds atteints en premier depuis le hub de Brienne
// (quai de Paludate), en suivant les rues. Le réseau entier de la métropole compte 46 565 noeuds.
// Le chronomètre mesure la construction de la représentation puis un parcours en largeur depuis le hub.
import { lireGraphe, Accroche, sousGraphe, type Graphe, type SousGraphe } from "../graphe/graphe.js";
import { REPRESENTATIONS, controleParcours, type Parcours } from "../variantes/representations.js";
import type { Sujet } from "./types.js";

export const HUB_BRIENNE = { lat: 44.8235, lon: -0.5545 };

interface Donnees { g: Graphe; hub: number; cache: Map<number, SousGraphe> }

const sujet: Sujet<Donnees, SousGraphe, Parcours> = {
  nom: "graphe",
  titre: "Ranger le réseau routier en mémoire : matrice, listes ou tableaux compacts (atelier 9)",
  parDefaut: { jeu: "graphe", tailles: [1000, 2000, 5000], variantes: ["matrice", "listes", "compacts"] },
  charger: () => {
    const g = lireGraphe();
    return { g, hub: new Accroche(g).proche(HUB_BRIENNE.lat, HUB_BRIENNE.lon), cache: new Map() };
  },
  tailleMax: d => d.g.n,
  // Le sous-graphe se calcule hors chronomètre, une fois par taille.
  preparer: (d, taille) => {
    if (!d.cache.has(taille)) d.cache.set(taille, sousGraphe(d.g, taille, d.hub));
    return d.cache.get(taille)!;
  },
  variantes: REPRESENTATIONS,
  controle: controleParcours,
};

export default sujet;
