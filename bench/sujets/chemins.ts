// Sujet "chemins" : recalculer les distances des tournées en cours quand le pont Chaban-Delmas se lève
// (atelier 10, ADR-007, ticket T-0733). La taille est le nombre de tournées recalculées (23 le 8 septembre).
// Chaque tournée : la position du livreur à 14h02 et ses arrêts restants, sur le réseau de son véhicule
// (vélo cargo ou utilitaire), pont levé. Le scénario se prépare hors chronomètre (bench/graphe/scenario.ts).
import { lireGraphe, PONT_CHABAN, estDuPont, voisinage, type Graphe, type Mode } from "../graphe/graphe.js";
import { aRecalculer, scenario14h02 } from "../graphe/scenario.js";
import { CHEMINS, controleChemins, verifierDijkstraTas, type EntreeChemins, type Reponse, type Requete } from "../variantes/chemins.js";
import type { Sujet } from "./types.js";

interface Donnees { g: Graphe; entree: EntreeChemins }

export function preparerChemins(dossierJeu: string, pontLeve = true): Donnees {
  const g = lireGraphe();
  const exclure = pontLeve ? estDuPont(g, PONT_CHABAN) : () => false;
  const reseau = (m: Mode) => ({ v: voisinage(g, m, exclure), lat: g.lat, lon: g.lon });
  const requetes: Requete[] = aRecalculer(scenario14h02(g, dossierJeu)).map(t => t.requete);
  return { g, entree: { reseaux: { velo: reseau("velo"), utilitaire: reseau("utilitaire") }, requetes } };
}

const sujet: Sujet<Donnees, EntreeChemins, Reponse[]> = {
  nom: "chemins",
  titre: "Recalculer les tournées en cours, pont Chaban-Delmas levé : Dijkstra simple, avec tas, A* (atelier 10)",
  parDefaut: { jeu: "moyenne", tailles: [1, 5, 23], variantes: ["simple", "tas", "astar"] },
  // Avant toute mesure : dijkstraTas doit rendre les distances de dijkstraSimple (le relâchement de l'atelier 10).
  charger: dossier => { verifierDijkstraTas(); return preparerChemins(dossier); },
  tailleMax: d => d.entree.requetes.length,
  preparer: (d, taille) => ({ reseaux: d.entree.reseaux, requetes: d.entree.requetes.slice(0, taille) }),
  variantes: CHEMINS,
  controle: controleChemins,
};

export default sujet;
