// Sujet "priorite" : la file du quai le soir (atelier 6, ADR-003).
// Les colis arrivent dans l'ordre de leur création (doublons écartés) ; après chaque arrivée, les
// préparateurs prennent 0 ou 1 colis, tiré à graine fixe ; à la fin, ils vident la file.
// Le chronomètre mesure toute la soirée ; la somme de contrôle porte sur l'ordre de sortie.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireColis } from "../../legacy/src/csv.js";
import type { Colis } from "../../legacy/src/modeles.js";
import { Alea } from "../../data/generateur/alea.js";
import { VARIANTES_PRIORITE, controleSortie, simuler } from "../variantes/priorite.js";
import type { Sujet } from "./types.js";

interface Entree { arrivees: Colis[]; prises: number[] }

// Les colis uniques (le premier de chaque numéro de suivi), dans l'ordre du fichier.
export function colisUniques(colis: Colis[]): Colis[] {
  const vus = new Set<string>();
  return colis.filter(c => (vus.has(c.numeroSuivi) ? false : (vus.add(c.numeroSuivi), true)));
}
export function prisesDuSoir(n: number, graine = 2026): number[] {
  const alea = new Alea(graine);
  return Array.from({ length: n }, () => alea.entier(0, 1));
}

const sujet: Sujet<Colis[], Entree, string[]> = {
  nom: "priorite",
  titre: "Servir les colis les plus urgents d'abord : la file du quai, un soir",
  parDefaut: { jeu: "grande", tailles: [1000, 9000, 15000], variantes: ["tableau", "tas", "seaux"] },
  charger(dossier) {
    const f = join(dossier, "colis.csv");
    if (!existsSync(f)) throw new Error(`jeu introuvable : ${dossier} (npm run data -- --echelle grande)`);
    // L'ordre de création : tri stable par heure de création.
    return colisUniques(lireColis(f)).slice().sort((a, b) => (a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : 0));
  },
  tailleMax: d => d.length,
  preparer: (d, taille) => ({ arrivees: d.slice(0, taille), prises: prisesDuSoir(taille) }),
  variantes: Object.fromEntries(Object.entries(VARIANTES_PRIORITE).map(([nom, f]) => [nom, (e: Entree) => simuler(f(), e.arrivees, e.prises)])),
  controle: controleSortie,
};

export default sujet;
