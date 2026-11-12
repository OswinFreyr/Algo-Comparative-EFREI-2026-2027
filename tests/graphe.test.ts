// Atelier 9 : les trois représentations du graphe donnent le même parcours.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_GRAPHE, lireGraphe, sousGraphe } from "../bench/graphe/graphe.js";
import { REPRESENTATIONS, controleParcours } from "../bench/variantes/representations.js";

const sansGraphe = !existsSync(join(DOSSIER_GRAPHE, "aretes.csv.gz")) && "le graphe manque : data/referentiel/graphe (maj-J4.zip à décompresser à la racine du dépôt)";

test("matrice, listes et tableaux compacts parcourent le même sous-graphe", { skip: sansGraphe }, () => {
  const g = lireGraphe();
  for (const taille of [1, 300, 1500]) {
    const s = sousGraphe(g, taille, 0);
    const attendu = controleParcours(REPRESENTATIONS.matrice(s));
    for (const nom of ["listes", "compacts"]) assert.equal(controleParcours(REPRESENTATIONS[nom](s)), attendu, `${nom}, ${taille} noeuds`);
  }
});

test("un graphe d'un seul noeud se parcourt", () => {
  const s = { n: 1, de: [], vers: [], metres: [] };
  for (const nom of Object.keys(REPRESENTATIONS)) assert.equal(REPRESENTATIONS[nom](s).atteints, 1, nom);
});
