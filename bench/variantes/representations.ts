// Trois façons de ranger un graphe routier en mémoire (atelier 9, ADR-006).
// Chaque variante construit sa représentation à partir de la liste des arêtes, puis fait un parcours en
// largeur depuis le noeud 0 (le hub) : la même question à chaque fois, "quels noeuds atteint-on, et en
// combien de tronçons ?". Le parcours en largeur visite les noeuds par distance croissante en nombre de
// tronçons ; il ne dépend pas de l'ordre des voisins, donc les trois variantes rendent le même résultat.
//
//   matrice   une matrice d'adjacence : un tableau n x n, la case [u][v] vaut la longueur de l'arête u -> v,
//             0 s'il n'y en a pas. Trouver les voisins de u, c'est lire toute la ligne u. C'est la structure
//             du legacy (legacy/src/tournees.ts, matriceDistances), pour les arrêts d'une tournée.
//   listes    des listes d'adjacence : pour chaque noeud, la liste de ses arêtes sortantes.
//   compacts  les mêmes listes rangées bout à bout dans trois grands tableaux (debut, cible, poids) :
//             moins d'objets, moins de mémoire, plus dur à modifier.
import type { SousGraphe } from "../graphe/graphe.js";

export interface Parcours { atteints: number; sommeProfondeurs: number; aretesVues: number }
export type Representation = (s: SousGraphe) => Parcours;

// Le parcours en largeur, écrit une fois pour toutes les représentations : `voisinsDe(u, visiter)` appelle
// visiter(v) pour chaque arête u -> v.
function largeur(n: number, voisinsDe: (u: number, visiter: (v: number) => void) => void): Parcours {
  const profondeur = new Int32Array(n).fill(-1);
  const file = new Int32Array(n);
  let tete = 0, queue = 0, somme = 0, vues = 0;
  profondeur[0] = 0; file[queue++] = 0;
  while (tete < queue) {
    const u = file[tete++];
    voisinsDe(u, v => {
      vues++;
      if (profondeur[v] === -1) { profondeur[v] = profondeur[u] + 1; somme += profondeur[v]; file[queue++] = v; }
    });
  }
  return { atteints: queue, sommeProfondeurs: somme, aretesVues: vues };
}

// Variante 1 : la matrice d'adjacence. Mémoire et temps en n².
export const matrice: Representation = s => {
  const m: number[][] = [];
  for (let i = 0; i < s.n; i++) m.push(new Array<number>(s.n).fill(0));
  for (let k = 0; k < s.de.length; k++) m[s.de[k]][s.vers[k]] = s.metres[k];
  return largeur(s.n, (u, visiter) => {
    const ligne = m[u];
    for (let v = 0; v < s.n; v++) if (ligne[v] > 0) visiter(v);
  });
};

// Variante 2 : les listes d'adjacence. Mémoire et temps en n + m (m le nombre d'arêtes).
export interface Voisin { vers: number; metres: number }
export const listes: Representation = s => {
  const voisins: Voisin[][] = Array.from({ length: s.n }, () => []);

  s.de.forEach((u, k) => voisins[u].push({ vers: s.vers[k], metres: s.metres[k] }));
  // À COMPLÉTER (atelier 9) : ranger chaque arête k (de s.de[k] vers s.vers[k], longueur s.metres[k]) dans la
  // liste de son noeud de départ, voisins[s.de[k]], sous la forme { vers, metres }. Puis, dans le parcours
  // ci-dessous, appeler visiter(...) pour chaque voisin de u, en lisant voisins[u].
  return largeur(s.n, (u, visiter) => {
    voisins[u].forEach(({ vers }) => visiter(vers));
  });
};

// Variante 3 : les tableaux compacts. Les arêtes qui partent de u sont aux cases debut[u] à debut[u + 1] - 1.
export const compacts: Representation = s => {
  const debut: number[] = new Array<number>(s.n + 1).fill(0);
  for (let k = 0; k < s.de.length; k++) debut[s.de[k] + 1]++;
  for (let i = 0; i < s.n; i++) debut[i + 1] += debut[i];
  const place = debut.slice(0, s.n);
  const cible: number[] = new Array<number>(s.de.length).fill(0), poids: number[] = new Array<number>(s.de.length).fill(0);
  for (let k = 0; k < s.de.length; k++) { const p = place[s.de[k]]++; cible[p] = s.vers[k]; poids[p] = s.metres[k]; }
  return largeur(s.n, (u, visiter) => {
    for (let p = debut[u]; p < debut[u + 1]; p++) visiter(cible[p]);
  });
};

export const REPRESENTATIONS: Record<string, Representation> = { matrice, listes, compacts };

// Le nombre d'arêtes vues n'entre pas dans le contrôle : deux tronçons parallèles entre les mêmes intersections
// (une rue et sa contre-allée) n'occupent qu'une case de la matrice, la seconde écrase la première.
export function controleParcours(p: Parcours): string {
  return `${p.atteints}-${p.sommeProfondeurs}`;
}
