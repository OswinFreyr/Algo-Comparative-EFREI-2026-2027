// Le graphe routier de Bordeaux Métropole (data/referentiel/graphe), lu une fois, et les outils qui servent
// aux ateliers 9 et 10 : distance à vol d'oiseau, accrochage d'un point GPS au noeud le plus proche,
// sous-graphe autour d'un hub, listes de voisins par mode de transport.
//
// Vocabulaire. Un graphe est un ensemble de noeuds (ici les intersections) reliés par des arêtes (ici les
// tronçons de rue entre deux intersections). Une arête est orientée : elle va de "de" à "vers" ; une rue à
// double sens donne deux arêtes. Le poids d'une arête est sa longueur en mètres.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireLignes } from "../../legacy/src/csv.js";

export interface Graphe {
  n: number;                 // nombre de noeuds, numérotés de 0 à n - 1
  lat: Float64Array;
  lon: Float64Array;
  de: Int32Array;            // les arêtes, une case par arête
  vers: Int32Array;
  metres: Int32Array;
  velo: Uint8Array;          // 1 si le vélo cargo peut emprunter l'arête dans ce sens
  utilitaire: Uint8Array;    // 1 si l'utilitaire peut l'emprunter
  type: string[];
  nom: string[];
  pont: string[];            // vide, ou le nom du pont
}

export type Mode = "velo" | "utilitaire";

export const DOSSIER_GRAPHE = resolve("data", "referentiel", "graphe");
export const PONT_CHABAN = "Pont Jacques Chaban-Delmas";

export function lireGraphe(dossier = DOSSIER_GRAPHE): Graphe {
  const fn = join(dossier, "noeuds.csv.gz"), fa = join(dossier, "aretes.csv.gz");
  if (!existsSync(fn) || !existsSync(fa)) throw new Error(`graphe absent : ${dossier} (noeuds.csv.gz et aretes.csv.gz, livrés par maj-J4.zip)`);
  const N = lireLignes(fn), A = lireLignes(fa);
  const n = N.lignes.length, m = A.lignes.length;
  const g: Graphe = {
    n, lat: new Float64Array(n), lon: new Float64Array(n),
    de: new Int32Array(m), vers: new Int32Array(m), metres: new Int32Array(m), velo: new Uint8Array(m), utilitaire: new Uint8Array(m),
    type: new Array(m), nom: new Array(m), pont: new Array(m),
  };
  for (const l of N.lignes) { const i = Number(l[0]); g.lat[i] = Number(l[1]); g.lon[i] = Number(l[2]); }
  A.lignes.forEach((l, k) => {
    g.de[k] = Number(l[0]); g.vers[k] = Number(l[1]); g.metres[k] = Number(l[2]);
    g.velo[k] = Number(l[3]); g.utilitaire[k] = Number(l[4]);
    g.type[k] = l[5] ?? ""; g.nom[k] = l[6] ?? ""; g.pont[k] = l[7] ?? "";
  });
  return g;
}

// Distance à vol d'oiseau en mètres (formule de haversine), avec le rayon terrestre de la préparation du graphe.
// Elle ne dépasse jamais la longueur d'une arête : c'est ce qui rend l'heuristique de A* admissible.
export function volOiseau(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

// Accroche un point GPS (une adresse livrée, un hub) au noeud le plus proche, grâce à une grille de cases
// d'environ 500 m : on ne regarde que les noeuds des cases voisines.
export class Accroche {
  private readonly cases = new Map<string, number[]>();
  private static readonly PAS = 0.005;
  constructor(private readonly g: Graphe) {
    for (let i = 0; i < g.n; i++) {
      const k = this.cle(Math.floor(g.lat[i] / Accroche.PAS), Math.floor(g.lon[i] / Accroche.PAS));
      const l = this.cases.get(k); if (l) l.push(i); else this.cases.set(k, [i]);
    }
  }
  private cle(a: number, b: number): string { return `${a}:${b}`; }
  proche(lat: number, lon: number): number {
    const a = Math.floor(lat / Accroche.PAS), b = Math.floor(lon / Accroche.PAS);
    let meilleur = -1, d = Number.POSITIVE_INFINITY;
    for (let rayon = 1; meilleur < 0 && rayon < 50; rayon++) {
      for (let x = a - rayon; x <= a + rayon; x++) for (let y = b - rayon; y <= b + rayon; y++) {
        for (const i of this.cases.get(this.cle(x, y)) ?? []) {
          const e = volOiseau(lat, lon, this.g.lat[i], this.g.lon[i]);
          if (e < d || (e === d && i < meilleur)) { d = e; meilleur = i; }
        }
      }
    }
    return meilleur;
  }
}

// Les arêtes d'un sous-graphe : les `taille` premiers noeuds atteints en largeur depuis `depart` (sans tenir
// compte des sens ni des modes), renumérotés de 0 à taille - 1, et les arêtes dont les deux bouts y sont.
export interface SousGraphe { n: number; de: number[]; vers: number[]; metres: number[] }
export function sousGraphe(g: Graphe, taille: number, depart: number): SousGraphe {
  const voisins: number[][] = Array.from({ length: g.n }, () => []);
  for (let k = 0; k < g.de.length; k++) { voisins[g.de[k]].push(g.vers[k]); voisins[g.vers[k]].push(g.de[k]); }
  const num = new Int32Array(g.n).fill(-1);
  const file = [depart]; num[depart] = 0;
  let n = 1;
  for (let i = 0; i < file.length && n < taille; i++) {
    for (const v of voisins[file[i]]) {
      if (num[v] === -1 && n < taille) { num[v] = n++; file.push(v); }
    }
  }
  const s: SousGraphe = { n, de: [], vers: [], metres: [] };
  for (let k = 0; k < g.de.length; k++) {
    const a = num[g.de[k]], b = num[g.vers[k]];
    if (a >= 0 && b >= 0) { s.de.push(a); s.vers.push(b); s.metres.push(g.metres[k]); }
  }
  return s;
}

// Les voisins de chaque noeud pour un mode, en tableaux compacts : les arêtes qui partent de u sont aux cases
// debut[u] à debut[u + 1] - 1 de cible et poids. `exclure` retire des arêtes (un pont levé).
export interface Voisinage { n: number; debut: Int32Array; cible: Int32Array; poids: Int32Array }
export function voisinage(g: Graphe, mode: Mode, exclure: (k: number) => boolean = () => false): Voisinage {
  const permis = mode === "velo" ? g.velo : g.utilitaire;
  const debut = new Int32Array(g.n + 1);
  for (let k = 0; k < g.de.length; k++) if (permis[k] && !exclure(k)) debut[g.de[k] + 1]++;
  for (let i = 0; i < g.n; i++) debut[i + 1] += debut[i];
  const place = debut.slice(0, g.n);
  const cible = new Int32Array(debut[g.n]), poids = new Int32Array(debut[g.n]);
  for (let k = 0; k < g.de.length; k++) {
    if (!permis[k] || exclure(k)) continue;
    const p = place[g.de[k]]++;
    cible[p] = g.vers[k]; poids[p] = g.metres[k];
  }
  return { n: g.n, debut, cible, poids };
}

export const estDuPont = (g: Graphe, nom: string) => (k: number) => g.pont[k] === nom;
