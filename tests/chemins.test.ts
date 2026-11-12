// Atelier 10 : Dijkstra simple, Dijkstra avec tas et A* rendent les mêmes distances.
// Le premier test échoue tant que le relâchement de dijkstraTas (À COMPLÉTER de bench/variantes/chemins.ts) n'est
// pas écrit. Celui de A* passe que sa priorité compte h ou non : sans h, A* est juste mais ne va pas plus vite ;
// c'est le correcteur (npm run verifier -- 10) qui dit si h guide la recherche.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DOSSIER_GRAPHE, lireGraphe, sousGraphe, type Graphe } from "../bench/graphe/graphe.js";
import { CHEMINS, type EntreeChemins, type Reseau } from "../bench/variantes/chemins.js";

const sansGraphe = !existsSync(join(DOSSIER_GRAPHE, "aretes.csv.gz")) && "le graphe manque : data/referentiel/graphe (maj-J4.zip à décompresser à la racine du dépôt)";

// Un petit réseau : 2 000 noeuds autour du noeud 0, avec leurs vraies coordonnées.
function petitReseau(g: Graphe): Reseau {
  const s = sousGraphe(g, 2000, 0);
  // Retrouver les coordonnées : on refait la numérotation du sous-graphe dans le même ordre.
  const voisins: number[][] = Array.from({ length: g.n }, () => []);
  for (let k = 0; k < g.de.length; k++) { voisins[g.de[k]].push(g.vers[k]); voisins[g.vers[k]].push(g.de[k]); }
  const ordre = [0], vu = new Set([0]);
  for (let i = 0; i < ordre.length && ordre.length < 2000; i++) for (const v of voisins[ordre[i]]) if (!vu.has(v) && ordre.length < 2000) { vu.add(v); ordre.push(v); }
  const lat = Float64Array.from(ordre.map(i => g.lat[i])), lon = Float64Array.from(ordre.map(i => g.lon[i]));
  const debut = new Int32Array(s.n + 1);
  for (const d of s.de) debut[d + 1]++;
  for (let i = 0; i < s.n; i++) debut[i + 1] += debut[i];
  const place = debut.slice(0, s.n), cible = new Int32Array(s.de.length), poids = new Int32Array(s.de.length);
  s.de.forEach((d, k) => { const p = place[d]++; cible[p] = s.vers[k]; poids[p] = s.metres[k]; });
  return { v: { n: s.n, debut, cible, poids }, lat, lon };
}

// Deux livreurs sur le petit réseau. Un sous-graphe coupe des rues à sens unique à sa frontière : certains arrêts
// y sont injoignables (-1), pour les trois variantes à la fois.
function deuxLivreurs(): EntreeChemins {
  const r = petitReseau(lireGraphe());
  return { reseaux: { velo: r, utilitaire: r }, requetes: [
    { depart: 0, arrets: [10, 500, 1999, 1200], mode: "velo" },
    { depart: 777, arrets: [3, 1500], mode: "utilitaire" },
  ] };
}

test("Dijkstra avec tas rend les distances de Dijkstra simple", { skip: sansGraphe }, () => {
  const e = deuxLivreurs();
  const attendu = CHEMINS.simple(e).map(x => x.distances);
  assert.ok(attendu.flat().some(d => d > 0), "au moins un arrêt joignable");
  assert.deepEqual(CHEMINS.tas(e).map(x => x.distances), attendu,
    "dijkstraTas ne rend pas les distances de dijkstraSimple (lignes + : dijkstraTas ; lignes - : dijkstraSimple ; -1 : arrêt jamais atteint)");
});

test("A* rend les distances de Dijkstra simple", { skip: sansGraphe }, () => {
  const e = deuxLivreurs();
  assert.deepEqual(CHEMINS.astar(e).map(x => x.distances), CHEMINS.simple(e).map(x => x.distances),
    "A* ne rend pas les distances de dijkstraSimple (lignes + : A* ; lignes - : dijkstraSimple)");
});

test("un arrêt confondu avec le départ est à zéro mètre", { skip: sansGraphe }, () => {
  const r = petitReseau(lireGraphe());
  const e: EntreeChemins = { reseaux: { velo: r, utilitaire: r }, requetes: [{ depart: 5, arrets: [5], mode: "velo" }] };
  for (const nom of Object.keys(CHEMINS)) assert.deepEqual(CHEMINS[nom](e)[0].distances, [0], nom);
});
