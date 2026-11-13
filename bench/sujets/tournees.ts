// Sujet "tournees" : ordonner les 40 arrêts d'une tournée de vélo cargo (atelier 11, ADR-008, ticket T-0531).
// La taille est le nombre de tournées ordonnées : les vélos cargo du jeu moyenne (60 au plus), dans l'ordre des
// livreurs, chacune ramenée à ses 40 premiers colis affectés. Les distances entre arrêts (hub compris) sont par la
// route, calculées hors chronomètre par le Dijkstra avec tas de l'atelier 10 sur le réseau du vélo : 41 Dijkstra
// par tournée, plusieurs dizaines de secondes en tout. Elles sont mises en cache sur le disque
// (data/jeux/<jeu>/cache-tournees-40.json, régénéré s'il manque) pour que le harness, npm run noel et le
// correcteur ne les refassent pas.
//
// Chaque arrêt est rattaché au carrefour le plus proche (bench/graphe/graphe.ts, Accroche), comme dans le scénario
// du pont. Deux colis au même carrefour font un seul arrêt ; un colis au carrefour du hub n'est pas un arrêt.
// Le réseau du vélo a des sens uniques : l'aller et le retour entre deux arrêts diffèrent (165 m en moyenne sur le
// jeu moyenne). Le 2-opt inverse des segments, ce qui suppose la même distance dans les deux sens : la matrice
// garde la moyenne de l'aller et du retour, arrondie au mètre. Les trois variantes, l'ordre du legacy et la force
// brute sont mesurés sur cette même matrice.
//
// Les trois variantes ne rendent pas le même ordre : la somme de contrôle ne porte que sur le nombre de tournées
// ordonnées, comme à l'atelier 8 ; la qualité se mesure à part, avec npm run noel.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { lireColis, lireHubs, lireLivreurs } from "../../legacy/src/csv.js";
import { Accroche, lireGraphe, voisinage, type Graphe, type Mode, type Voisinage } from "../graphe/graphe.js";
import { map as affecterMap } from "../variantes/affectation.js";
import { distancesDepuis, verifierDijkstraTas, type Reseau } from "../variantes/chemins.js";
import { TOURNEES, controleTournees, type EntreeTournees, type ReponseTournee, type TourneeNoel } from "../variantes/tournees.js";
import type { Sujet } from "./types.js";

// Cette semaine, l'atelier 10 (bench/variantes/chemins.ts) se fait le vendredi 13 novembre au matin, avant les
// ateliers 11 et 12. Le message d'arrêt de dijkstraTas, écrit pour la journée 4, renvoie à correction_J4.zip ; ce
// zip ne contient pas chemins.ts. Ce qui suit le complète, sans toucher au fichier des étudiants.
export const OU_TROUVER_CHEMINS =
  `  Cette semaine, l'atelier 10 se fait le vendredi matin : correction_J4.zip ne contient pas chemins.ts.\n` +
  `  Bloqués sur le relâchement : correction_dijkstra.zip (Moodle, pendant l'atelier 10), à décompresser\n` +
  `  à la racine du dépôt.\n` +
  `  Après l'atelier 10 : correction_atelier10.zip (Moodle), à décompresser à la racine du dépôt, puis copiez\n` +
  `  correction/J4/chemins.ts dans bench/variantes/chemins.ts.`;

// Le garde-fou de dijkstraTas (bench/variantes/chemins.ts), avec ce qu'il faut savoir cette semaine pour réparer.
export function verifierDijkstraTasJ5(): void {
  try { verifierDijkstraTas(); } catch (e) { throw new Error(`${(e as Error).message}\n${OU_TROUVER_CHEMINS}`); }
}

export const ARRETS_PAR_VAGUE = 40;   // décembre 2026 : 40 arrêts par vague au lieu de 25 (pièce 06)
const VERSION_CACHE = 1;

export interface DonneesTournees { tournees: TourneeNoel[] }
interface Cache { version: number; arrets: number; tournees: TourneeNoel[] }

// L'accrochage d'un point GPS au carrefour le plus proche, parmi ceux que le mode (vélo, utilitaire) peut atteindre et
// quitter : un carrefour d'où aucune rue permise ne part (un chemin piéton, une voie interdite aux voitures) est écarté,
// ses coordonnées mises à NaN pour que l'accrochage ne le voie jamais. Sert aussi à npm run nuit.
export function accrocheDuMode(g: Graphe, v: Voisinage): Accroche {
  const sortant = new Uint8Array(g.n), entrant = new Uint8Array(g.n);
  for (let u = 0; u < g.n; u++) for (let p = v.debut[u]; p < v.debut[u + 1]; p++) { sortant[u] = 1; entrant[v.cible[p]] = 1; }
  const lat = Float64Array.from(g.lat), lon = Float64Array.from(g.lon);
  for (let i = 0; i < g.n; i++) if (!sortant[i] || !entrant[i]) { lat[i] = Number.NaN; lon[i] = Number.NaN; }
  return new Accroche({ ...g, lat, lon });
}

// La matrice des distances par la route entre des points, symétrique (moyenne de l'aller et du retour, au mètre).
// Les points doivent se joindre tous les uns les autres (voir joignables).
export function matriceRoute(reseau: Reseau, points: number[]): number[][] {
  const brut = points.map(p => distancesDepuis(reseau, p, points));
  return symetriser(brut);
}
function symetriser(brut: number[][]): number[][] {
  const n = brut.length, d: number[][] = brut.map(l => l.slice());
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { const m = Math.round((brut[i][j] + brut[j][i]) / 2); d[i][j] = m; d[j][i] = m; }
  return d;
}

// Quelques carrefours ne se joignent pas dans les deux sens sur le réseau du vélo (un sens unique en bout de réseau) :
// on écarte ceux qui posent problème, le plus gênant d'abord, et on garde les `k` premiers qui restent, hub en tête.
// Rend les points gardés et leur matrice brute (aller et retour distincts).
function joignables(reseau: Reseau, candidats: number[], k: number): { points: number[]; brut: number[][] } {
  let points = candidats.slice(), brut = points.map(p => distancesDepuis(reseau, p, points));
  for (;;) {
    const manques = points.map((_, i) => brut[i].filter((x, j) => j !== i && x < 0).length + brut.reduce((s, l, j) => s + (j !== i && l[i] < 0 ? 1 : 0), 0));
    const pire = manques.indexOf(Math.max(...manques));
    if (manques[pire] === 0 || pire === 0) break;      // tout se joint (ou c'est le hub qui est isolé : on le garde tel quel)
    points.splice(pire, 1); brut.splice(pire, 1); for (const l of brut) l.splice(pire, 1);
  }
  const n = Math.min(points.length, k + 1);
  return { points: points.slice(0, n), brut: brut.slice(0, n).map(l => l.slice(0, n)) };
}

export function preparerTournees(dossierJeu: string, arrets = ARRETS_PAR_VAGUE): DonneesTournees {
  if (!existsSync(join(dossierJeu, "colis.csv"))) throw new Error(`jeu introuvable : ${dossierJeu} (npm run data -- --echelle moyenne)`);
  const fichierCache = join(dossierJeu, `cache-tournees-${arrets}.json`);
  if (existsSync(fichierCache)) {
    try {
      const c = JSON.parse(readFileSync(fichierCache, "utf-8")) as Cache;
      if (c.version === VERSION_CACHE && c.arrets === arrets && Array.isArray(c.tournees)) return { tournees: c.tournees };
    } catch { /* cache illisible : on le refait */ }
  }
  const g = lireGraphe();   // lève une erreur claire si le réseau manque
  const colis = lireColis(join(dossierJeu, "colis.csv")), livreurs = lireLivreurs(join(dossierJeu, "livreurs.csv")), hubs = lireHubs(join(dossierJeu, "hubs.csv"));
  const velos = affecterMap(colis, livreurs, hubs).tournees.filter(t => t.livreur.vehicule === "velo_cargo" && t.colis.length >= 2);
  console.log(`[tournees] préparation des distances par la route : ${arrets + 1} Dijkstra par tournée, ${velos.length} tournées (une fois ; cache : ${basename(dossierJeu)}/${basename(fichierCache)})…`);
  verifierDijkstraTasJ5();   // les distances viennent du Dijkstra avec tas de l'atelier 10 : juste, ou rien
  const t0 = performance.now();
  const reseau: Reseau = { v: voisinage(g, "velo"), lat: g.lat, lon: g.lon };
  const accroche = accrocheDuMode(g, reseau.v);
  const tournees: TourneeNoel[] = [];
  for (const t of velos) {
    const depart = accroche.proche(t.hub.lat, t.hub.lon);
    const noeuds: number[] = [];
    for (const c of t.colis) {
      const x = accroche.proche(c.lat, c.lon);
      if (x !== depart && !noeuds.includes(x)) noeuds.push(x);
      if (noeuds.length === arrets + 6) break;             // quelques candidats de plus, au cas où certains ne se joignent pas
    }
    const { points, brut } = joignables(reseau, [depart, ...noeuds], arrets);
    if (points.length < 3) continue;
    const mode: Mode = "velo";
    tournees.push({ livreur: t.livreur.id, mode, depart, arrets: points.slice(1), d: symetriser(brut), lat: points.map(p => g.lat[p]), lon: points.map(p => g.lon[p]) });
  }
  const cache: Cache = { version: VERSION_CACHE, arrets, tournees };
  writeFileSync(fichierCache, JSON.stringify(cache), "utf-8");
  console.log(`[tournees] distances prêtes : ${tournees.length} tournées en ${((performance.now() - t0) / 1000).toFixed(1).replace(".", ",")} s, gardées dans ${basename(fichierCache)}`);
  return { tournees };
}

// La même tournée ramenée à ses k premiers arrêts (la sous-matrice qui va avec).
export function sousTournee(t: TourneeNoel, k: number): TourneeNoel {
  const n = Math.min(k, t.arrets.length) + 1;
  return { ...t, arrets: t.arrets.slice(0, n - 1), d: t.d.slice(0, n).map(l => l.slice(0, n)), lat: t.lat.slice(0, n), lon: t.lon.slice(0, n) };
}

const sujet: Sujet<DonneesTournees, EntreeTournees, ReponseTournee[]> = {
  nom: "tournees",
  titre: "Ordonner les 40 arrêts d'une tournée de vélo cargo : plus proche voisin, 2-opt, recuit simulé (atelier 11)",
  parDefaut: { jeu: "moyenne", tailles: [1, 5, 20], variantes: ["voisin", "deuxopt", "recuit"] },
  charger: dossier => preparerTournees(dossier),
  tailleMax: d => d.tournees.length,
  preparer: (d, taille) => ({ tournees: d.tournees.slice(0, taille) }),
  variantes: TOURNEES,
  controle: controleTournees,
};

export default sujet;
