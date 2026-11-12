// Correcteur de l'atelier 9 - Charger Bordeaux, ADR-006 (journée 4, fiche atelier numéro 9).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ko, lireCsv, nombre, ok, protocole, resultats, type Atelier } from "./kit.js";
import { controlesAdr } from "./controles-adr.js";

function mesures(): { variantes: Set<string>; tailles: Set<number>; echauffement: number; memeControle: boolean }[] {
  return resultats(/-graphe\.csv$/).map(csv => {
    const { lignes } = lireCsv(csv);
    const parTaille = new Map<string, Set<string>>();
    for (const l of lignes) { if (!parTaille.has(l.taille)) parTaille.set(l.taille, new Set()); parTaille.get(l.taille)!.add(l.controle); }
    return {
      variantes: new Set(lignes.map(l => l.variante)), tailles: new Set(lignes.map(l => nombre(l.taille))),
      echauffement: Number(protocole(csv)?.echauffement ?? -1),
      memeControle: lignes.length > 0 && [...parTaille.values()].every(s => s.size === 1 && [...s][0] !== ""),
    };
  });
}

const atelier: Atelier = {
  numero: 9,
  titre: "Charger Bordeaux (ADR-006)",
  controles: [
    {
      titre: "À COMPLÉTER : les listes d'adjacence parcourent le graphe comme la matrice",
      verifie: "les variantes listes et matrice sur trois sous-graphes autour du hub (1, 300 et 1 500 noeuds) : même nombre de noeuds atteints, mêmes profondeurs",
      voir: "fiche atelier numéro 9, sous-objectif 2, et le commentaire À COMPLÉTER de bench/variantes/representations.ts",
      test: async () => {
        const { DOSSIER_GRAPHE, lireGraphe, sousGraphe } = await import("../../bench/graphe/graphe.js");
        if (!existsSync(join(DOSSIER_GRAPHE, "aretes.csv.gz"))) return ko("data/referentiel/graphe/aretes.csv.gz absent (maj-J4.zip à décompresser à la racine du dépôt)");
        const { REPRESENTATIONS, controleParcours } = await import("../../bench/variantes/representations.js");
        const g = lireGraphe();
        for (const taille of [1, 300, 1500]) {
          const s = sousGraphe(g, taille, 0);
          const a = REPRESENTATIONS.matrice(s), b = REPRESENTATIONS.listes(s);
          if (controleParcours(a) !== controleParcours(b)) return ko(`sous-graphe de ${taille} noeuds : les listes atteignent ${b.atteints} noeud(s) (somme des profondeurs ${b.sommeProfondeurs}), la matrice ${a.atteints} (${a.sommeProfondeurs})`);
        }
        return ok();
      },
    },
    {
      titre: "La matrice est mesurée sur des sous-graphes croissants",
      verifie: "un CSV bench/resultats/*-graphe.csv avec la variante matrice à trois tailles au moins, un échauffement, et des sommes de contrôle qui concordent",
      voir: "fiche atelier numéro 9, sous-objectif 3",
      test: () => {
        const m = mesures().filter(x => x.variantes.has("matrice") && x.tailles.size >= 3);
        if (m.length === 0) return ko("aucune mesure de la matrice à trois tailles");
        if (!m.some(x => x.echauffement >= 1)) return ko("la mesure de la matrice n'a pas de tour d'échauffement");
        return m.some(x => x.memeControle) ? ok() : ko("la colonne controle diffère entre variantes à une même taille");
      },
    },
    {
      titre: "Les listes sont mesurées à l'échelle de la métropole entière",
      verifie: "un CSV bench/resultats/*-graphe.csv avec listes ou compacts à 46 565 noeuds",
      voir: "fiche atelier numéro 9, sous-objectif 4",
      test: () => mesures().some(x => (x.variantes.has("listes") || x.variantes.has("compacts")) && x.tailles.has(46565)) ? ok()
        : ko("aucune mesure à 46 565 noeuds"),
    },
    ...controlesAdr(6, 9, 5),
  ],
};

export default atelier;
