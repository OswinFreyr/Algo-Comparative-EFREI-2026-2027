// Sujet "chargement" : remplir la première vague des vélos cargo (atelier 12, ADR-009, ticket T-0655).
// La taille est le nombre de tournées de vélos cargo chargées : les 60 vélos du jeu moyenne, dans l'ordre des
// livreurs. Les tournées sont celles de l'affectation (variante map) ; les poids et les volumes sont arrondis
// au-dessus (hectogramme, litre) hors chronomètre.
//
// Les trois variantes ne rendent pas les mêmes points : le glouton n'est pas exact. La somme de contrôle ne porte
// donc que sur le nombre de tournées chargées, comme à l'atelier 8 ; la qualité (points, colis pharmacie en
// première vague, écart au meilleur) se mesure à part, avec npm run cargo.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireColis, lireHubs, lireLivreurs } from "../../legacy/src/csv.js";
import type { Priorite, Tournee } from "../../legacy/src/modeles.js";
import { map as affecterMap } from "../variantes/affectation.js";
import { CHARGEMENT, POINTS, controleChargement, tourneeCargo, type EntreeChargement, type ReponseChargement, type TourneeCargo } from "../variantes/chargement.js";
import type { Sujet } from "./types.js";

// Une tournée du jeu : la version arrondie pour les variantes, et la tournée du legacy (les vrais colis, dans
// l'ordre d'affectation) pour vérifier, détailler et comparer au chargement premier arrivé, premier chargé.
export interface TourneeCargoJeu extends TourneeCargo { tournee: Tournee }
export interface DonneesChargement { tournees: TourneeCargoJeu[] }

// bareme : les points par priorité (pharmacie 10, express 3, standard 1 par défaut ; npm run cargo -- --points 10,5,1).
export function preparerChargement(dossierJeu: string, bareme: Record<Priorite, number> = POINTS): DonneesChargement {
  if (!existsSync(join(dossierJeu, "colis.csv"))) throw new Error(`jeu introuvable : ${dossierJeu} (npm run data -- --echelle moyenne)`);
  const colis = lireColis(join(dossierJeu, "colis.csv")), livreurs = lireLivreurs(join(dossierJeu, "livreurs.csv")), hubs = lireHubs(join(dossierJeu, "hubs.csv"));
  const tournees = affecterMap(colis, livreurs, hubs).tournees
    .filter(t => t.livreur.vehicule === "velo_cargo" && t.colis.length > 0)
    .map(t => ({ ...tourneeCargo(t, bareme), tournee: t }));
  return { tournees };
}

const sujet: Sujet<DonneesChargement, EntreeChargement, ReponseChargement[]> = {
  nom: "chargement",
  titre: "Remplir la première vague des vélos cargo : glouton, programmation dynamique, backtracking (atelier 12)",
  parDefaut: { jeu: "moyenne", tailles: [1, 5, 20], variantes: ["glouton", "dynamique", "backtracking"] },
  charger: dossier => preparerChargement(dossier),
  tailleMax: d => d.tournees.length,
  preparer: (d, taille) => ({ tournees: d.tournees.slice(0, taille) }),
  variantes: CHARGEMENT,
  controle: controleChargement,
};

export default sujet;
