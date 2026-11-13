// Trois façons de remplir la première vague d'un vélo cargo (atelier 12, ADR-009, ticket T-0655).
// Le legacy charge premier arrivé, premier chargé (legacy/src/chargement.ts) : les colis pharmacie partent dans la
// vague où ils tombent, parfois la dernière, alors que le contrat (article 3) les veut livrés avant 10h00, donc dans
// la première vague, celle de 7h00. La question : parmi les colis de la tournée, lesquels partent dans la première
// vague (80 kg, 450 l) pour emporter le plus de points d'urgence (pharmacie 10, express 3, standard 1) ?
// Un sac à dos à deux contraintes.
//
//   glouton       les colis triés par points rapportés à l'encombrement (poids/80 + volume/450) ; on les prend
//                 dans cet ordre tant qu'ils rentrent. O(n log n). Rapide, pas optimal : il laisse des points sur le quai.
//   dynamique     la programmation dynamique : une table meilleur[p][v], le plus de points possible avec p hectogrammes
//                 et v litres, remplie colis par colis (deux couches roulantes) ; un bit par colis et par case pour
//                 retrouver les colis pris. Exacte sur le problème arrondi. Son temps dépend des capacités (800 x 450 x n),
//                 pas des données.
//   backtracking  un parcours en profondeur, prendre ou laisser chaque colis, colis triés par ratio ; une borne (les
//                 points acquis plus ce que rapporterait au mieux le reste, en fractionnant les colis) coupe les branches
//                 qui ne peuvent pas battre le meilleur connu. Exacte ; son temps dépend des données.
//
// Les entiers : la table veut des entiers. Les poids sont arrondis au-dessus à l'hectogramme (0,1 kg ; capacité 800),
// les volumes au-dessus au litre (capacité 450). Une vague faisable sur les valeurs arrondies l'est sur les vraies.
// Les trois variantes travaillent sur le même problème arrondi : deux variantes exactes rendent les mêmes points.
import type { Colis, Livreur, Priorite, Tournee } from "../../legacy/src/modeles.js";

export const POINTS: Record<Priorite, number> = { pharmacie: 10, express: 3, standard: 1 };

export interface ColisArrondi { poidsHg: number; volumeL: number; points: number }
export interface TourneeCargo { livreur: string; capaciteHg: number; capaciteL: number; colis: ColisArrondi[] }
// pris : les indices (dans t.colis) des colis de la première vague ; noeuds : ce que le backtracking a visité ;
// arrete : le backtracking s'est arrêté à la limite de noeuds, le résultat est le meilleur rencontré, pas l'optimum.
export interface ReponseChargement { pris: number[]; points: number; poidsHg: number; volumeL: number; noeuds?: number; arrete?: boolean }
export interface EntreeChargement { tournees: TourneeCargo[]; limiteNoeuds?: number }
export type Chargement = (e: EntreeChargement) => ReponseChargement[];

// Arrondir au-dessus : 4,61 kg -> 47 hg, 35,2 l -> 36 l. Le petit retrait (1e-9) évite qu'un produit comme 1,1 x 10,
// qui vaut 11,000000000000002 en flottant, soit arrondi à 12.
// Le barème des points peut changer (npm run cargo -- --points 10,5,1) : il s'applique à toutes les variantes à la fois.
export function arrondir(c: Colis, bareme: Record<Priorite, number> = POINTS): ColisArrondi {
  return { poidsHg: Math.ceil(c.poidsKg * 10 - 1e-9), volumeL: Math.ceil(c.volumeL - 1e-9), points: bareme[c.priorite] };
}

export function tourneeCargo(t: Tournee, bareme: Record<Priorite, number> = POINTS): TourneeCargo {
  return { livreur: t.livreur.id, capaciteHg: capaciteHg(t.livreur), capaciteL: t.livreur.capaciteL, colis: t.colis.map(c => arrondir(c, bareme)) };
}
export const capaciteHg = (l: Livreur) => Math.round(l.capaciteKg * 10);

// L'encombrement d'un colis : la part de la vague qu'il prend, poids et volume confondus.
const encombrement = (t: TourneeCargo, c: ColisArrondi) => c.poidsHg / t.capaciteHg + c.volumeL / t.capaciteL;

// Les indices des colis, du meilleur ratio points / encombrement au moins bon ; à égalité, l'ordre d'arrivée.
function parRatio(t: TourneeCargo): number[] {
  const ratio = t.colis.map(c => c.points / encombrement(t, c));
  return t.colis.map((_, i) => i).sort((a, b) => ratio[b] - ratio[a] || a - b);
}

// Le bilan d'une liste de colis pris : points, poids et volume arrondis. Sert aussi à npm run cargo pour la vague du legacy.
export function bilan(t: TourneeCargo, pris: number[], noeuds?: number, arrete?: boolean): ReponseChargement {
  let points = 0, poidsHg = 0, volumeL = 0;
  for (const i of pris) { points += t.colis[i].points; poidsHg += t.colis[i].poidsHg; volumeL += t.colis[i].volumeL; }
  const r: ReponseChargement = { pris: pris.slice().sort((a, b) => a - b), points, poidsHg, volumeL };
  if (noeuds !== undefined) r.noeuds = noeuds;
  if (arrete) r.arrete = true;
  return r;
}

// Variante 1 : le glouton. Dans l'ordre des ratios, on prend ce qui rentre encore ; un colis trop gros est laissé,
// on continue avec les suivants.
function gloutonTournee(t: TourneeCargo): ReponseChargement {
  const pris: number[] = [];
  let p = t.capaciteHg, v = t.capaciteL;
  for (const i of parRatio(t)) {
    const c = t.colis[i];
    if (c.poidsHg <= p && c.volumeL <= v) { pris.push(i); p -= c.poidsHg; v -= c.volumeL; }
  }
  return bilan(t, pris);
}

// Les marques de la programmation dynamique : pour un colis, un bit par case de la table. marquer note que la case
// numéro k a été obtenue en prenant ce colis ; estMarquee le relit, à la fin, pour retrouver les colis pris.
function marquer(m: Uint32Array, k: number): void { m[k >>> 5] |= 1 << (k & 31); }
function estMarquee(m: Uint32Array, k: number): boolean { return (m[k >>> 5] & (1 << (k & 31))) !== 0; }

// Variante 2 : la programmation dynamique. La case (p, v) de la couche i vaut le plus de points qu'on peut emporter
// avec les colis 0 à i, p hectogrammes et v litres. La couche i se calcule à partir de la couche i - 1 seulement :
// deux tableaux suffisent, qu'on échange à chaque colis. Pour retrouver les colis pris, on garde pour chaque colis
// un bit par case : 1 si la case a été obtenue en prenant ce colis.
function dynamiqueTournee(t: TourneeCargo): ReponseChargement {
  const P = t.capaciteHg, V = t.capaciteL, largeur = V + 1, cases = (P + 1) * largeur;
  let avant = new Int32Array(cases), apres = new Int32Array(cases);
  const marques = t.colis.map(() => new Uint32Array((cases + 31) >>> 5));
  for (let i = 0; i < t.colis.length; i++) {
    const { poidsHg: w, volumeL: u, points: pts } = t.colis[i], m = marques[i];
    for (let p = 0; p <= P; p++) {
      const base = p * largeur;
      // Le colis ne rentre pas dans p hectogrammes : la ligne est recopiée telle quelle.
      if (p < w) { apres.set(avant.subarray(base, base + largeur), base); continue; }
      for (let v = 0; v < u; v++) apres[base + v] = avant[base + v];
      const src = (p - w) * largeur - u;    // la case (p - w, v - u) de la couche d'avant est avant[src + v]
      for (let v = u; v <= V; v++) {
        const k = base + v;                   // le numéro de la case (p, v), le même dans les deux couches
        const sans = avant[k];                // sans ce colis : ce que valait la case à la couche d'avant
        const avec = avant[src + v] + pts;    // avec lui : la case (p - poids, v - volume) d'avant, plus ses points
        // À COMPLÉTER (atelier 12) : la règle de la case. La case de la nouvelle couche, apres[k], prend le meilleur
        // des deux : `sans`, ou `avec` s'il est strictement plus grand. Quand c'est `avec`, le colis est pris pour
        // cette case : il faut le noter avec marquer(m, k), sinon la liste des colis de la vague reste vide.
        apres[k] = sans;                      // provisoire : sans la règle, la case ne prend jamais le colis
      }
    }
    const tmp = avant; avant = apres; apres = tmp;
  }
  // Remonter depuis la case (P, V) : si le colis i a marqué la case, il est pris et on retire son poids et son volume.
  const pris: number[] = [];
  let p = P, v = V;
  for (let i = t.colis.length - 1; i >= 0; i--) {
    const k = p * largeur + v;
    if (estMarquee(marques[i], k)) { pris.push(i); p -= t.colis[i].poidsHg; v -= t.colis[i].volumeL; }
  }
  return bilan(t, pris);
}

// Variante 3 : le backtracking avec une borne. Les colis sont pris dans l'ordre des ratios ; à chaque colis, deux
// branches : le prendre (s'il rentre), le laisser. La borne d'un noeud : les points acquis, plus ce que rapporterait
// le reste si l'on pouvait fractionner les colis, en ne regardant que le poids, puis que le volume (le plus petit des
// deux : chaque relaxation à elle seule ne peut pas être dépassée). Si la borne ne dépasse pas le meilleur connu, la
// branche est coupée. La première feuille est la solution du glouton : la coupure est efficace dès le début.
function backtrackingTournee(t: TourneeCargo, limite: number): ReponseChargement {
  const ordre = parRatio(t), n = ordre.length;
  const w = Int32Array.from(ordre, i => t.colis[i].poidsHg), u = Int32Array.from(ordre, i => t.colis[i].volumeL);
  const pts = Int32Array.from(ordre, i => t.colis[i].points);
  // Les colis restants (rang >= i), du meilleur rapport points / poids au moins bon, puis points / volume :
  // l'ordre qu'il faut pour que la relaxation fractionnaire soit bien une borne supérieure.
  const parPoids = Int32Array.from(Array.from({ length: n }, (_, k) => k).sort((a, b) => pts[b] / w[b] - pts[a] / w[a] || a - b));
  const parVolume = Int32Array.from(Array.from({ length: n }, (_, k) => k).sort((a, b) => pts[b] / u[b] - pts[a] / u[a] || a - b));
  // Sommes des colis restants à partir du rang i : si tout rentre, on prend tout sans explorer.
  const resteW = new Int32Array(n + 1), resteU = new Int32Array(n + 1), restePts = new Int32Array(n + 1);
  for (let k = n - 1; k >= 0; k--) { resteW[k] = resteW[k + 1] + w[k]; resteU[k] = resteU[k + 1] + u[k]; restePts[k] = restePts[k + 1] + pts[k]; }

  const choix = new Uint8Array(n);    // 1 si le colis de rang k est pris dans la branche en cours
  let meilleur = 0, meilleurChoix = new Uint8Array(n), noeuds = 0, arrete = false;

  // Ce que rapporterait au mieux le reste avec `capa` d'une seule ressource (poids ou volume), colis fractionnés.
  const relaxation = (ordreRessource: Int32Array, taille: Int32Array, i: number, capa: number): number => {
    let gain = 0;
    for (let x = 0; x < n; x++) {
      const k = ordreRessource[x];
      if (k < i) continue;                 // déjà décidé
      if (taille[k] <= capa) { capa -= taille[k]; gain += pts[k]; }
      else return gain + pts[k] * capa / taille[k];
    }
    return gain;
  };

  const explorer = (i: number, p: number, v: number, acquis: number): void => {
    if (arrete) return;
    if (++noeuds > limite) { arrete = true; return; }
    if (i === n || (resteW[i] <= p && resteU[i] <= v)) {
      // Une feuille, ou tout le reste rentre : on le prend.
      const total = acquis + restePts[i];
      if (total > meilleur) { meilleur = total; meilleurChoix = choix.slice(); meilleurChoix.fill(1, i); }
      return;
    }
    const borne = acquis + Math.min(relaxation(parPoids, w, i, p), relaxation(parVolume, u, i, v));
    if (borne <= meilleur) return;      // la coupure : cette branche ne peut pas battre le meilleur connu
    if (w[i] <= p && u[i] <= v) { choix[i] = 1; explorer(i + 1, p - w[i], v - u[i], acquis + pts[i]); choix[i] = 0; }
    explorer(i + 1, p, v, acquis);
  };
  explorer(0, t.capaciteHg, t.capaciteL, 0);
  const pris: number[] = [];
  for (let k = 0; k < n; k++) if (meilleurChoix[k]) pris.push(ordre[k]);
  return bilan(t, pris, noeuds, arrete);
}

export const glouton: Chargement = e => e.tournees.map(gloutonTournee);
export const dynamique: Chargement = e => e.tournees.map(dynamiqueTournee);
export const backtracking: Chargement = e => e.tournees.map(t => backtrackingTournee(t, e.limiteNoeuds ?? Number.POSITIVE_INFINITY));

export const CHARGEMENT: Record<string, Chargement> = { glouton, dynamique, backtracking };

// Somme de contrôle neutre : les trois variantes ne rendent pas les mêmes points (le glouton n'est pas exact), on ne
// compare que le nombre de tournées chargées. La qualité se mesure à part : npm run cargo.
export function controleChargement(rep: ReponseChargement[]): string {
  return `${rep.length} tournées`;
}
