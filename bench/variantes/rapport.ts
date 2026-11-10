// Trois façons de sortir les cent premiers clients du mois. Même classement, pas le même coût.
// Atelier 7 (journée 3) : mesurez-les, temps et mémoire, puis écrivez l'ADR-004.
import { meilleur, rapportDuMois, type LigneFacturation, type TotalClient } from "../../legacy/src/rapport.js";
import { TasBinaire } from "./tas.js";

export const K = 100;

// Additionner par client, en une passe, sans trier les lignes : une Map client -> total.
export function totauxParClient(lignes: LigneFacturation[]): TotalClient[] {
  const parClient = new Map<string, TotalClient>();
  for (const l of lignes) {
    const t = parClient.get(l.client);
    if (t) { t.totalCentimes += l.montantCentimes; t.lignes++; }
    else parClient.set(l.client, { client: l.client, totalCentimes: l.montantCentimes, lignes: 1 });
  }
  return [...parClient.values()];
}

// Variante 1 : le legacy tel quel. Trier les trois millions de lignes, regrouper, trier tous les clients.
export const tri = (lignes: LigneFacturation[]): TotalClient[] => rapportDuMois(lignes, K);

// Variante 2 : les totaux par Map, puis un tas de taille K qui garde les K meilleurs vus jusqu'ici.
export function topKParTas(totaux: TotalClient[], k: number): TotalClient[] {
  // Le sommet du tas est le moins bon des k meilleurs : c'est lui qu'un nouveau venu doit battre.
  const tas = new TasBinaire<TotalClient>((a, b) => meilleur(b, a));
  // À COMPLÉTER : parcourir les totaux. Tant que le tas compte moins de k clients, ajouter le client ;
  // ensuite, ne l'ajouter que s'il est meilleur que le sommet, en retirant d'abord le sommet.
  void totaux; void k;
  // Le tas rend du moins bon au meilleur : on retourne la liste.
  const resultat: TotalClient[] = [];
  for (let t = tas.retirer(); t; t = tas.retirer()) resultat.push(t);
  return resultat.reverse();
}
export const tas = (lignes: LigneFacturation[]): TotalClient[] => topKParTas(totauxParClient(lignes), K);

// Variante 3 : les totaux par Map, puis quickselect : on place le k-ième meilleur à sa place, sans trier
// le reste, puis on ne trie que les k premiers. En moyenne O(m) pour m clients.
export function quickselect(totaux: TotalClient[], k: number): TotalClient[] {
  const t = totaux.slice();
  if (t.length <= k) return t.sort(meilleur);
  let bas = 0, haut = t.length - 1;
  let graine = 2026; // pivot pseudo-aléatoire à graine fixe : le résultat ne dépend pas du hasard, le temps si peu
  while (bas < haut) {
    graine = (Math.imul(graine, 1103515245) + 12345) >>> 0;
    const pivot = t[bas + (graine % (haut - bas + 1))];
    let i = bas, j = haut;
    while (i <= j) {
      while (meilleur(t[i], pivot) < 0) i++;
      while (meilleur(t[j], pivot) > 0) j--;
      if (i <= j) { const x = t[i]; t[i] = t[j]; t[j] = x; i++; j--; }
    }
    if (k - 1 <= j) haut = j; else if (k - 1 >= i) bas = i; else break;
  }
  return t.slice(0, k).sort(meilleur);
}
export const selection = (lignes: LigneFacturation[]): TotalClient[] => quickselect(totauxParClient(lignes), K);

export const VARIANTES_RAPPORT: Record<string, (lignes: LigneFacturation[]) => TotalClient[]> = { tri, tas, quickselect: selection };

export function controleRapport(r: TotalClient[]): string {
  let h = 0;
  for (const t of r) { const s = `${t.client}:${t.totalCentimes};`; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16).padStart(8, "0");
}
