// Sujet "priorite-arrivees" : la même soirée, mais les colis arrivent sur le quai dans l'ordre du fichier,
// qui n'est pas tout à fait celui de leur création (un camion en retard, un scan oublié).
// Il sert à vérifier une hypothèse de la file à seaux : qu'elle donne encore le même ordre de sortie.
import sujetPriorite, { colisUniques, prisesDuSoir } from "./priorite.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireColis } from "../../legacy/src/csv.js";
import type { Sujet } from "./types.js";

const sujet: Sujet = {
  ...(sujetPriorite as Sujet),
  nom: "priorite-arrivees",
  titre: "La file du quai quand les colis n'arrivent pas dans l'ordre de leur création",
  parDefaut: { jeu: "grande", tailles: [1000, 9000], variantes: ["tableau", "tas", "seaux"] },
  charger(dossier) {
    const f = join(dossier, "colis.csv");
    if (!existsSync(f)) throw new Error(`jeu introuvable : ${dossier} (npm run data -- --echelle grande)`);
    return colisUniques(lireColis(f));
  },
};
void prisesDuSoir;

export default sujet;
