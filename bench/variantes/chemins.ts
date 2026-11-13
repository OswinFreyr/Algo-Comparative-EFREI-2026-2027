// Trois façons de calculer les plus courts chemins dans le réseau routier (atelier 10, ADR-007).
// La question : depuis la position d'un livreur, quelle distance par la route jusqu'à chacun de ses arrêts
// restants ? Le réseau est rangé en tableaux compacts (bench/graphe/graphe.ts, voisinage), pont levé déjà retiré.
//
//   simple   l'algorithme de Dijkstra tel qu'il est écrit en 1959 : à chaque tour, on cherche parmi tous
//            les noeuds le plus proche pas encore fixé, en les parcourant tous. O(n²) par départ.
//   tas      Dijkstra avec le tas binaire de l'atelier 6 (bench/variantes/tas.ts) : le plus proche sort du tas en O(log n).
//            O((n + m) log n) par départ ; la recherche s'arrête dès que tous les arrêts sont fixés.
//   astar    A* : une recherche par arrêt, guidée par la distance à vol d'oiseau jusqu'à lui (l'heuristique).
//            On explore d'abord les noeuds qui vont dans la bonne direction.
//
// Dijkstra fixe les noeuds par distance croissante depuis le départ : quand un noeud est fixé, sa distance est
// la plus courte possible. Les trois variantes rendent les mêmes distances, au mètre près : les longueurs des
// arêtes sont des mètres entiers.
import type { Mode, Voisinage } from "../graphe/graphe.js";
import { volOiseau } from "../graphe/graphe.js";
import { TasBinaire } from "./tas.js";

// Le tas de l'atelier 6 : un élément par noeud mis en attente, avec sa priorité (la plus petite sort d'abord).
interface EnAttente { noeud: number; priorite: number }
const parPriorite = (a: EnAttente, b: EnAttente) => a.priorite - b.priorite;

export interface Requete { depart: number; arrets: number[]; mode: Mode }   // un livreur : position, arrêts restants, véhicule
export interface Reseau { v: Voisinage; lat: Float64Array; lon: Float64Array }
export interface Reponse { distances: number[]; fixes: number }  // une distance par arrêt (-1 : injoignable) ; noeuds fixés
export interface EntreeChemins { reseaux: Record<Mode, Reseau>; requetes: Requete[] }
export type Chemins = (e: EntreeChemins) => Reponse[];

// Variante 1 : Dijkstra simple, recherche du minimum par parcours de tous les noeuds.
function dijkstraSimple(r: Reseau, depart: number, arrets: number[]): Reponse {
  const { n, debut, cible, poids } = r.v;
  const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const fixe = new Uint8Array(n);
  const attendus = new Set(arrets);
  let restants = attendus.size, fixes = 0;
  dist[depart] = 0;
  while (restants > 0) {
    let u = -1, du = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) if (!fixe[i] && dist[i] < du) { du = dist[i]; u = i; }
    if (u < 0) break;                       // plus rien d'atteignable
    fixe[u] = 1; fixes++;
    if (attendus.has(u)) restants--;
    for (let p = debut[u]; p < debut[u + 1]; p++) {
      const v = cible[p], d = du + poids[p];
      if (d < dist[v]) dist[v] = d;
    }
  }
  return { distances: arrets.map(a => (fixe[a] ? dist[a] : -1)), fixes };
}

// Variante 2 : Dijkstra avec un tas binaire. Le tas garde les carrefours en attente, le plus proche au sommet :
// le chercher ne demande plus de parcourir tous les noeuds. Un noeud peut être dans le tas plusieurs fois ; seule
// sa première sortie compte (les suivantes ont une distance plus grande et sont ignorées).
function dijkstraTas(r: Reseau, depart: number, arrets: number[]): Reponse {
  const { n, debut, cible, poids } = r.v;
  const dist = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const fixe = new Uint8Array(n);
  const attendus = new Set(arrets);
  let restants = attendus.size, fixes = 0;
  const tas = new TasBinaire<EnAttente>(parPriorite);
  dist[depart] = 0; tas.ajouter({ noeud: depart, priorite: 0 });
  while (restants > 0 && tas.taille > 0) {
    const { noeud: u, priorite: du } = tas.retirer()!;
    if (fixe[u]) continue;
    fixe[u] = 1; fixes++;
    if (attendus.has(u)) restants--;

    // À COMPLÉTER (atelier 10) : le relâchement. Le carrefour u vient d'être fixé, à la distance du. Pour chaque
    // rue qui part de u (les cases debut[u] à debut[u + 1] - 1 de cible et de poids), calculer la distance de son
    // voisin en passant par u ; si elle est meilleure que celle notée dans dist, la noter, et mettre le voisin en
    // attente dans le tas avec cette distance pour priorité. dijkstraSimple, juste au-dessus, fait ce relâchement
    // sans tas : c'est le modèle à transposer, en quatre lignes.
    for (let p = debut[u]; p < debut[u + 1]; p++) {
      const v = cible[p], d = du + poids[p];
      if (d < dist[v]) { dist[v] = d; tas.ajouter({ noeud: v, priorite: d }); }
    }
  }
  return { distances: arrets.map(a => (fixe[a] ? dist[a] : -1)), fixes };
}

// Variante 3 : A*, une recherche par arrêt. La priorité d'un noeud est g + h : g, la distance déjà parcourue
// depuis le départ ; h, l'heuristique, la distance à vol d'oiseau jusqu'à l'arrêt visé. Comme h ne dépasse
// jamais la vraie distance par la route (l'heuristique est admissible), le premier passage sur l'arrêt donne
// la plus courte distance.
function aEtoile(r: Reseau, depart: number, arret: number, g: Float64Array, fixe: Uint8Array, touches: number[]): { distance: number; fixes: number } {
  const { debut, cible, poids } = r.v;
  const tas = new TasBinaire<EnAttente>(parPriorite);
  let fixes = 0;
  g[depart] = 0; touches.push(depart);

  // h est donnée : la distance à vol d'oiseau, en mètres, du noeud v à l'arrêt visé, jamais plus longue que la route.
  const h = (v: number) => volOiseau(r.lat[v], r.lon[v], r.lat[arret], r.lon[arret]);
  // À COMPLÉTER (atelier 10) : la priorité. Dans Dijkstra, le départ entre dans le tas avec la priorité 0, et chaque
  // voisin amélioré avec sa distance d. Dans A*, la priorité d'un noeud est sa distance déjà parcourue, plus ce que h
  // rend pour lui. Deux priorités à changer : celle du départ, ici, et celle du voisin v, dans la boucle.
  tas.ajouter({ noeud: depart, priorite: h(depart) });

  while (tas.taille > 0) {
    const u = tas.retirer()!.noeud;
    if (fixe[u]) continue;
    fixe[u] = 1; fixes++;
    if (u === arret) return { distance: g[u], fixes };
    for (let p = debut[u]; p < debut[u + 1]; p++) {
      const v = cible[p], d = g[u] + poids[p];
      if (d < g[v]) {
        if (g[v] === Number.POSITIVE_INFINITY) touches.push(v);
        g[v] = d;
        tas.ajouter({ noeud: v, priorite: d + h(v) });
      }
    }
  }
  return { distance: -1, fixes };
}

function astar(r: Reseau, depart: number, arrets: number[]): Reponse {
  // Les tableaux de travail servent pour chaque arrêt ; on ne remet à zéro que les cases touchées.
  const g = new Float64Array(r.v.n).fill(Number.POSITIVE_INFINITY);
  const fixe = new Uint8Array(r.v.n);
  const touches: number[] = [];
  const distances: number[] = [];
  let fixes = 0;
  for (const a of arrets) {
    const x = aEtoile(r, depart, a, g, fixe, touches);
    distances.push(x.distance); fixes += x.fixes;
    for (const t of touches) { g[t] = Number.POSITIVE_INFINITY; fixe[t] = 0; }
    touches.length = 0;
  }
  return { distances, fixes };
}

// Le garde-fou de dijkstraTas : un réseau d'essai de six carrefours, rangé en tableaux compacts comme le vrai.
//   0 -> 1 (7 m), 0 -> 2 (2 m), 1 -> 0 (7 m), 1 -> 2 (3 m), 1 -> 3 (4 m), 2 -> 0 (2 m), 2 -> 1 (3 m), 2 -> 3 (9 m),
//   3 -> 1 (4 m), 3 -> 4 (1 m), 5 -> 0 (1 m) ; aucune rue n'arrive au carrefour 5.
// Depuis le carrefour 0, les plus courtes distances sont 5 m (par le carrefour 2), 2 m, 9 m, 10 m, et -1 pour le 5.
const ESSAI: Reseau = {
  v: {
    n: 6,
    debut: Int32Array.from([0, 2, 5, 8, 10, 10, 11]),
    cible: Int32Array.from([1, 2, 0, 2, 3, 0, 1, 3, 1, 4, 0]),
    poids: Int32Array.from([7, 2, 7, 3, 4, 2, 3, 9, 4, 1, 1]),
  },
  lat: new Float64Array(6), lon: new Float64Array(6),
};
let dijkstraTasVerifie = false;

// Compare dijkstraTas à dijkstraSimple sur le réseau d'essai et s'arrête au premier écart : tant que le relâchement
// de dijkstraTas n'est pas écrit, ou s'il est faux, aucune commande ne doit afficher des distances fausses sans le
// dire. Appelé par distancesDepuis (npm run pont, npm run voyageur, la journée 5) et par le sujet chemins du harness.
export function verifierDijkstraTas(): void {
  if (dijkstraTasVerifie) return;
  const arrets = [1, 2, 3, 4, 5];
  const attendu = dijkstraSimple(ESSAI, 0, arrets).distances.join(", ");
  const trouve = dijkstraTas(ESSAI, 0, arrets).distances.join(", ");
  if (trouve !== attendu) throw new Error(
    `ARRÊT : dijkstraTas ne rend pas les distances de dijkstraSimple.\n` +
    `  Sur le réseau d'essai de six carrefours (décrit dans bench/variantes/chemins.ts), du carrefour 0 aux carrefours 1 à 5 :\n` +
    `    dijkstraSimple : ${attendu} mètres (-1 : carrefour injoignable)\n` +
    `    dijkstraTas    : ${trouve}\n` +
    `  Le relâchement de dijkstraTas est à écrire ou à reprendre : commentaire À COMPLÉTER (atelier 10) de\n` +
    `  bench/variantes/chemins.ts, fiche atelier numéro 10, sous-objectif 1 ; puis npm test.\n` +
    `  Si le tas binaire de l'atelier 6 est KO (npm run verifier -- 6), réparez-le d'abord : correction_J3.zip est sur Moodle.\n` +
    `  À partir de la journée 5, correction_J4.zip (sur Moodle) contient ce fichier corrigé.`);
  dijkstraTasVerifie = true;
}

// Les distances depuis un départ vers des arrêts, par Dijkstra avec tas : utilisé hors chronomètre par les
// démonstrations (npm run pont, npm run voyageur) et par la journée 5 (les distances entre les arrêts d'une tournée).
export function distancesDepuis(r: Reseau, depart: number, arrets: number[]): number[] {
  verifierDijkstraTas();
  return dijkstraTas(r, depart, arrets).distances;
}

export const simple: Chemins = e => e.requetes.map(x => dijkstraSimple(e.reseaux[x.mode], x.depart, x.arrets));
export const tas: Chemins = e => e.requetes.map(x => dijkstraTas(e.reseaux[x.mode], x.depart, x.arrets));
export const aStar: Chemins = e => e.requetes.map(x => astar(e.reseaux[x.mode], x.depart, x.arrets));

export const CHEMINS: Record<string, Chemins> = { simple, tas, astar: aStar };

// Somme de contrôle : les distances, dans l'ordre des livreurs et de leurs arrêts.
export function controleChemins(rep: Reponse[]): string {
  let h = 0;
  for (const x of rep) for (const d of x.distances) h = (Math.imul(h, 31) + Math.round(d) + 7) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}
