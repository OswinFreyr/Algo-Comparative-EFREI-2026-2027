// Sujet "suivi" : le coût des requêtes de la page "Où est mon colis" (atelier 5, ADR-002).
// La structure de chaque variante est construite hors chronomètre ; le chronomètre mesure un lot de
// REQUETES requêtes (quatre numéros existants sur cinq, un mal tapé), tirées à graine fixe.
// Le coût de construction se mesure à part : sujet suivi-construction.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireScans, type Scan } from "../../legacy/src/suivi.js";
import { VARIANTES_SUIVI, controleReponses, genererRequetes, type Recherche } from "../variantes/suivi.js";
import type { Sujet } from "./types.js";

export const REQUETES = 100;
interface Entree { recherche: Recherche; requetes: string[] }

const sujet: Sujet<Scan[], Entree, (Scan | null)[]> = {
  nom: "suivi",
  titre: `Retrouver le dernier scan d'un colis : ${REQUETES} requêtes de la page Où est mon colis`,
  parDefaut: { jeu: "grande", tailles: [10000, 100000, 996844], variantes: ["tableau", "set", "map"] },
  charger(dossier) {
    const f = join(dossier, "scans.csv");
    if (!existsSync(f)) throw new Error(`scans introuvables : ${f} (npm run data -- --echelle grande)`);
    return lireScans(f);
  },
  tailleMax: d => d.length,
  // Les tailles sont des nombres de scans : les premiers scans du fichier, dans l'ordre d'enregistrement.
  preparer: (d, taille, variante) => {
    const lot = d.slice(0, taille);
    return { recherche: VARIANTES_SUIVI[variante].construire(lot), requetes: genererRequetes(lot, REQUETES) };
  },
  variantes: Object.fromEntries(Object.keys(VARIANTES_SUIVI).map(nom => [nom, (e: Entree) => e.requetes.map(n => e.recherche.chercher(n))])),
  controle: controleReponses,
};

export default sujet;
