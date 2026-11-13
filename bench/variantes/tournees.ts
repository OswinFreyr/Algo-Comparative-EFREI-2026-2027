// Trois façons d'ordonner les arrêts d'une tournée (atelier 11, ADR-008, ticket T-0531).
// Le legacy visite les arrêts dans l'ordre d'affectation (legacy/src/tournees.ts, étape 3) : les livreurs tracent
// à la main des tournées bien plus courtes. En décembre, les vélos cargo passent à 40 arrêts par vague : essayer
// tous les ordres est exclu dès 15 arrêts (atelier 10). Il faut un ordre court sans tout essayer.
//
//   voisin   le plus proche voisin : depuis le hub, aller à l'arrêt le plus proche pas encore visité, et ainsi de
//            suite. O(n²). Rapide, souvent 15 à 25 % trop long, avec de longs retours en fin de tournée.
//   deuxopt  le 2-opt : partir du plus proche voisin, puis, tant qu'il existe deux arêtes qui se croisent, les
//            décroiser en inversant le segment entre elles. S'arrête quand aucun échange n'améliore (un optimum local).
//   recuit   le recuit simulé : partir du plus proche voisin, tirer au hasard un segment à inverser ; accepter si
//            c'est mieux, sinon avec la probabilité exp(-delta / T), où T, la température, baisse à chaque pas :
//            on accepte d'abord presque tout, puis de moins en moins, pour sortir des optimums locaux.
//            Générateur à graine fixe : même tournée, même résultat, sur toutes les machines. Rend le meilleur ordre rencontré.
//
// Une tournée : le hub (point 0), k arrêts (points 1 à k), et la matrice d des distances par la route entre les
// points, en mètres. La longueur d'un ordre compte le départ du hub et le retour au hub. La matrice est symétrique
// (voir bench/sujets/tournees.ts) : inverser un segment ne change que les deux arêtes à ses bouts.
import type { Mode } from "../graphe/graphe.js";

export interface TourneeNoel {
  livreur: string;
  mode: Mode;
  depart: number;        // le noeud du hub
  arrets: number[];      // les noeuds des arrêts, dans l'ordre d'affectation (40 au plus)
  d: number[][];         // (k + 1) x (k + 1), mètres ; 0 = le hub, i = l'arrêt arrets[i - 1]
  lat: number[];         // les coordonnées des k + 1 points, hub compris, pour dessiner
  lon: number[];
}
// ordre : les arrêts 1..k dans l'ordre de visite (une permutation) ; metres : la longueur, retour au hub compris ;
// iterations : ce que la variante a fait (arrêts placés, échanges effectués, pas du recuit).
export interface ReponseTournee { ordre: number[]; metres: number; iterations: number }
export interface EntreeTournees { tournees: TourneeNoel[] }
export type Tournees = (e: EntreeTournees) => ReponseTournee[];

// Les réglages du recuit : la température de départ (en mètres : un allongement de 2 000 m est accepté une fois sur
// e au début), son facteur de baisse à chaque pas (0,99985 : T vaut encore 2 m au pas 46 000, 0,25 m au dernier pas, le
// budget entier sert), le nombre de pas, la graine.
export interface Reglages { temperature: number; refroidissement: number; pas: number; graine: number }
export const RECUIT: Reglages = { temperature: 2000, refroidissement: 0.99985, pas: 60_000, graine: 20261213 };

// La longueur d'un ordre : du hub au premier arrêt, d'arrêt en arrêt, puis le retour au hub.
export function longueur(d: number[][], ordre: number[]): number {
  if (ordre.length === 0) return 0;
  let total = d[0][ordre[0]];
  for (let i = 1; i < ordre.length; i++) total += d[ordre[i - 1]][ordre[i]];
  return total + d[ordre[ordre.length - 1]][0];
}

// Variante 1 : le plus proche voisin. À égalité de distance, le plus petit numéro.
export function plusProcheVoisin(d: number[][]): number[] {
  const k = d.length - 1, visite = new Uint8Array(k + 1), ordre: number[] = [];
  let ici = 0;
  for (let n = 0; n < k; n++) {
    let proche = -1, dp = Number.POSITIVE_INFINITY;
    for (let j = 1; j <= k; j++) if (!visite[j] && d[ici][j] < dp) { dp = d[ici][j]; proche = j; }
    visite[proche] = 1; ordre.push(proche); ici = proche;
  }
  return ordre;
}

// Un échange du 2-opt, pour la trace : les positions i et j dans la route, le gain en mètres, la longueur après.
export interface Echange { i: number; j: number; gain: number; metres: number }

// Inverse les cases de a à b (incluses) d'un tableau.
function inverser(t: number[], a: number, b: number): void {
  while (a < b) { const x = t[a]; t[a] = t[b]; t[b] = x; a++; b--; }
}

// Variante 2 : le 2-opt. La route est [0, o1, ..., ok, 0] : route[i] et route[i + 1] forment une arête, route[j] et
// route[j + 1] une autre (route[k + 1] est le retour au hub). Inverser le segment route[i + 1 .. j] remplace les arêtes
// (a, b) et (c, e) par (a, c) et (b, e) : les deux arêtes se décroisent. On repart du début après chaque échange, et
// on s'arrête à la première passe sans échange.
export function deuxOpt(d: number[][], depart: number[], journal?: (e: Echange) => void): { ordre: number[]; iterations: number } {
  const k = depart.length, route = [0, ...depart, 0];
  // Garde-fou : un 2-opt juste fait quelques dizaines d'échanges sur 40 arrêts (chacun raccourcit strictement). Au-delà de
  // 4 k² échanges, c'est que des échanges sont faits sans raccourcir la tournée (un gain mal calculé, ou accepté quand il
  // est nul) : on s'arrête avec un message plutôt que de tourner sans fin.
  const plafond = 4 * (k + 1) * (k + 1);
  let echanges = 0, ameliore = true;
  while (ameliore) {
    ameliore = false;
    if (echanges > plafond) throw new Error(`le 2-opt ne converge pas : plus de ${plafond} échanges sur ${k} arrêts. Des échanges sont faits sans que la tournée raccourcisse : le gain est-il bien la longueur des deux arêtes retirées moins celle des deux arêtes ajoutées, et l'échange n'est-il fait que si ce gain est strictement positif ?`);
    if (route[0] !== 0 || route[k + 1] !== 0 || route.length !== k + 2) throw new Error("le 2-opt a cassé la route : le hub (0) doit rester au début et à la fin ; l'inversion va de i + 1 à j");
    for (let i = 0; i < k - 1 && !ameliore; i++) {
      for (let j = i + 2; j <= k; j++) {
        const a = route[i], b = route[i + 1], c = route[j], e = route[j + 1];
        // À COMPLÉTER (atelier 11) : le gain d'un échange, en mètres. L'échange retire de la route les arêtes (a, b)
        // et (c, e) et y ajoute les arêtes (a, c) et (b, e) ; d[x][y] est la distance par la route du point x au
        // point y, en mètres. Le gain est la longueur de ce qu'on retire moins la longueur de ce qu'on ajoute. Juste
        // en dessous, le segment n'est inversé que si le gain est strictement positif : la tournée raccourcit.
        const gain = d[a][b] + d[c][e] - d[a][c] - d[b][e];   // retiré (a,b) et (c,e), moins ajouté (a,c) et (b,e)
        if (gain > 0) {
          inverser(route, i + 1, j); echanges++; ameliore = true;
          if (journal) journal({ i, j, gain, metres: longueur(d, route.slice(1, k + 1)) });
          break;
        }
      }
    }
  }
  return { ordre: route.slice(1, k + 1), iterations: echanges };
}

// Le générateur pseudo-aléatoire du recuit (mulberry32, celui du générateur de données) : même graine, même suite.
export function mulberry32(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un point de la courbe du recuit, pour la trace : le pas, la température, la longueur courante et la meilleure.
export interface PasRecuit { pas: number; temperature: number; metres: number; meilleur: number }

// Variante 3 : le recuit simulé. Le mouvement est l'inversion d'un segment tiré au hasard (un échange du 2-opt pris au
// hasard, bon ou mauvais) ; delta est l'allongement qu'il produit (négatif : la tournée raccourcit).
export function recuitSimule(d: number[][], depart: number[], journal?: (p: PasRecuit) => void, tousLes = 500, reglages: Reglages = RECUIT): { ordre: number[]; iterations: number } {
  const k = depart.length, route = [0, ...depart, 0], alea = mulberry32(reglages.graine);
  let courant = longueur(d, depart), meilleur = courant, meilleureRoute = route.slice();
  let T = reglages.temperature;
  if (k < 3) return { ordre: depart.slice(), iterations: 0 };
  for (let pas = 1; pas <= reglages.pas; pas++) {
    const i = 1 + Math.floor(alea() * (k - 1));            // la première case du segment : 1 .. k - 1
    const j = i + 1 + Math.floor(alea() * (k - i));        // la dernière : i + 1 .. k
    const a = route[i - 1], b = route[i], c = route[j], e = route[j + 1];
    const delta = d[a][c] + d[b][e] - d[a][b] - d[c][e];
    if (delta < 0 || alea() < Math.exp(-delta / T)) {
      inverser(route, i, j); courant += delta;
      if (courant < meilleur) { meilleur = courant; meilleureRoute = route.slice(); }
    }
    T *= reglages.refroidissement;
    if (journal && pas % tousLes === 0) journal({ pas, temperature: T, metres: courant, meilleur });
  }
  return { ordre: meilleureRoute.slice(1, k + 1), iterations: reglages.pas };
}

// L'optimum par force brute, pour les petites tournées (npm run noel -- --arrets 9, correcteur 11) : tous les ordres,
// comme npm run voyageur, avec une coupure (un ordre entamé déjà plus long que le meilleur connu n'est pas poursuivi :
// même résultat, temps bien moindre). Au-delà de 11 arrêts, ne pas y penser.
export function forceBrute(d: number[][]): { ordre: number[]; metres: number; ordres: number } {
  const n = d.length - 1, libre = new Uint8Array(n + 1), courant: number[] = [];
  let meilleur = Number.POSITIVE_INFINITY, meilleurOrdre: number[] = [], ordres = 0;
  const essayer = (ici: number, faits: number, l: number) => {
    if (l >= meilleur) return;
    if (faits === n) { ordres++; const total = l + d[ici][0]; if (total < meilleur) { meilleur = total; meilleurOrdre = courant.slice(); } return; }
    for (let j = 1; j <= n; j++) if (!libre[j]) { libre[j] = 1; courant.push(j); essayer(j, faits + 1, l + d[ici][j]); courant.pop(); libre[j] = 0; }
  };
  essayer(0, 0, 0);
  return { ordre: meilleurOrdre, metres: meilleur, ordres };
}

const reponse = (d: number[][], ordre: number[], iterations: number): ReponseTournee => ({ ordre, metres: longueur(d, ordre), iterations });

export const voisin: Tournees = e => e.tournees.map(t => { const o = plusProcheVoisin(t.d); return reponse(t.d, o, o.length); });
export const deuxopt: Tournees = e => e.tournees.map(t => { const r = deuxOpt(t.d, plusProcheVoisin(t.d)); return reponse(t.d, r.ordre, r.iterations); });
// Le recuit avec d'autres réglages (npm run noel -- --pas 200000) ; la variante mesurée par le harness garde RECUIT.
export const recuitAvec = (reglages: Reglages): Tournees => e => e.tournees.map(t => { const r = recuitSimule(t.d, plusProcheVoisin(t.d), undefined, 500, reglages); return reponse(t.d, r.ordre, r.iterations); });
export const recuit: Tournees = recuitAvec(RECUIT);

export const TOURNEES: Record<string, Tournees> = { voisin, deuxopt, recuit };

// Somme de contrôle neutre : les trois variantes ne rendent pas le même ordre (ce sont trois approximations), on ne
// compare que le nombre de tournées ordonnées. La qualité (kilomètres, écart à l'optimum) se mesure à part : npm run noel.
export function controleTournees(rep: ReponseTournee[]): string {
  return `${rep.length} tournées`;
}
