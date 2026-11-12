// Le voyageur de commerce, posé sans être résolu (c'est l'atelier 12, le lendemain) : dans quel ordre visiter les
// arrêts d'une tournée pour faire le moins de kilomètres ? On essaie tous les ordres, pour 6 à 11 arrêts d'une
// vraie tournée, en chronométrant ; puis on calcule ce que coûteraient 15 et 40 arrêts au même rythme.
//
//   npm run voyageur
//   npm run voyageur -- --arrets 6,7,8,9,10,11 --jeu moyenne
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lireOptions } from "../outils/options.js";
import { lireGraphe, voisinage, type Graphe, type Mode } from "./graphe/graphe.js";
import { scenario14h02 } from "./graphe/scenario.js";
import { distancesDepuis, verifierDijkstraTas, type Reseau } from "./variantes/chemins.js";

const options = lireOptions({ valeur: ["jeu", "arrets"] });
const nomJeu = options.lire("jeu", "moyenne");
const tailles = options.lire("arrets", "6,7,8,9,10,11").split(",").map(Number);
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);

let g: Graphe;
// Les distances entre les arrêts sont celles de dijkstraTas : s'il n'est pas complété, on s'arrête ici.
try { g = lireGraphe(); verifierDijkstraTas(); } catch (e) { console.error((e as Error).message); process.exit(1); }
const t = scenario14h02(g, dossier).find(x => x.requete.arrets.length >= Math.max(...tailles))!;
if (!t) { console.error("aucune tournée n'a assez d'arrêts restants pour cette démonstration"); process.exit(1); }
const reseau: Reseau = { v: voisinage(g, t.mode as Mode), lat: g.lat, lon: g.lon };

function factorielle(n: number): number { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
const nombre = (x: number) => x < 1e7 ? Math.round(x).toLocaleString("fr-FR").replace(/[\u00a0\u202f]/g, " ") : x.toExponential(2).replace(".", ",").replace("e+", " x 10^");

console.log(`[voyageur] tournée de ${t.livreur} (${t.mode === "velo" ? "vélo cargo" : "utilitaire"}) : on essaie tous les ordres de ses k prochains arrêts`);
let ordresParSeconde = 0;
for (const k of tailles) {
  const points = [t.requete.depart, ...t.requete.arrets.slice(0, k)];
  // La matrice des distances entre les points : un tableau k + 1 par k + 1, plein (chaque point va à chaque autre).
  const d = points.map(p => distancesDepuis(reseau, p, points));
  const libre = new Uint8Array(k + 1);
  let meilleur = Number.POSITIVE_INFINITY, ordres = 0;
  const t0 = performance.now();
  const essayer = (ici: number, faits: number, longueur: number) => {
    if (faits === k) { ordres++; if (longueur < meilleur) meilleur = longueur; return; }
    for (let j = 1; j <= k; j++) if (!libre[j]) { libre[j] = 1; essayer(j, faits + 1, longueur + d[ici][j]); libre[j] = 0; }
  };
  essayer(0, 0, 0);
  const ms = performance.now() - t0;
  ordresParSeconde = ordres / Math.max(ms / 1000, 1e-6);
  console.log(`[voyageur] ${String(k).padStart(2)} arrêts : ${nombre(ordres).padStart(12)} ordres essayés en ${ms.toFixed(0).padStart(6)} ms, le meilleur fait ${(meilleur / 1000).toFixed(2).replace(".", ",")} km`);
}
for (const k of [15, 40]) {
  const s = factorielle(k) / ordresParSeconde;
  const jours = s / 86400, annees = jours / 365.25;
  const duree = s < 86400 * 2 ? `${(s / 3600).toFixed(1).replace(".", ",")} heures`
    : annees < 2 ? `${jours.toFixed(0)} jours` : `${nombre(annees)} années`;
  console.log(`[voyageur] ${k} arrêts : ${nombre(factorielle(k))} ordres, soit ${duree} au même rythme`);
}
