// Sujet "suivi-construction" : le coût de construire la structure de recherche (atelier 5, ADR-002).
// Le chronomètre mesure la construction seule ; la mémoire relevée est celle de la structure construite.
// La somme de contrôle interroge ensuite la structure sur cent numéros tirés à graine fixe, hors chronomètre.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireScans, type Scan } from "../../legacy/src/suivi.js";
import { VARIANTES_SUIVI, controleReponses, genererRequetes, type Recherche } from "../variantes/suivi.js";
import type { Sujet } from "./types.js";

interface Entree { scans: Scan[]; sondes: string[] }
interface Construit { recherche: Recherche; sondes: string[] }

const sujet: Sujet<Scan[], Entree, Construit> = {
  nom: "suivi-construction",
  titre: "Construire la structure de recherche de la page Où est mon colis (une fois, quand les scans arrivent)",
  parDefaut: { jeu: "grande", tailles: [10000, 100000, 996844], variantes: ["tableau", "set", "map"] },
  charger(dossier) {
    const f = join(dossier, "scans.csv");
    if (!existsSync(f)) throw new Error(`scans introuvables : ${f} (npm run data -- --echelle grande)`);
    return lireScans(f);
  },
  tailleMax: d => d.length,
  preparer: (d, taille) => { const lot = d.slice(0, taille); return { scans: lot, sondes: genererRequetes(lot, 100, 7) }; },
  variantes: Object.fromEntries(Object.entries(VARIANTES_SUIVI).map(([nom, v]) => [nom, (e: Entree) => ({ recherche: v.construire(e.scans), sondes: e.sondes })])),
  controle: r => controleReponses(r.sondes.map(n => r.recherche.chercher(n))),
};

export default sujet;
