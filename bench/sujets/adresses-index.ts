// Sujet "adresses-index" : ce que coûte la construction de l'index (atelier 8, ADR-005).
// La taille est le nombre d'adresses du référentiel indexées (les premières du fichier de la métropole).
// Le chronomètre mesure la construction entière ; la mémoire relevée par le harness est celle du tas de Node :
// elle voit l'index de trigrammes, pas celui de PostgreSQL, qui vit hors du tas (sa taille sur disque est
// donnée par npm run exactitude).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lireReferentiel } from "../../legacy/src/csv.js";
import type { AdresseReferentiel } from "../../legacy/src/modeles.js";
import { BaseAdresses, IndexTrigrammes } from "../variantes/adresses.js";
import type { Sujet } from "./types.js";

const sujet: Sujet<AdresseReferentiel[], AdresseReferentiel[], { taille: number }> = {
  nom: "adresses-index",
  titre: "Construire l'index d'adresses : trigrammes en mémoire ou pg_trgm (atelier 8)",
  parDefaut: { jeu: "petite", tailles: [10000, 50000, 229329], variantes: ["trigrammes", "postgres"] },
  charger: () => {
    const ref = resolve("data", "referentiel", "adresses-metropole.csv");
    if (!existsSync(ref)) throw new Error("référentiel absent : data/referentiel/adresses-metropole.csv (npm run ban)");
    return lireReferentiel(ref);
  },
  tailleMax: d => d.length,
  preparer: (d, taille) => d.slice(0, taille),
  variantes: {
    trigrammes: e => ({ taille: new IndexTrigrammes(e).taille }),
    // La base est fermée dans la mesure : sans cela, chaque tour d'échauffement garderait la sienne en mémoire.
    postgres: async e => {
      const base = await BaseAdresses.construire(e);
      const taille = base.libelles.length;
      await base.fermer();
      return { taille };
    },
  },
  controle: r => `n${r.taille}`,
};

export default sujet;
