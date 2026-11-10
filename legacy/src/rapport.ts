// Le rapport de 6h : les cent premiers clients du mois, par chiffre d'affaires. Le cron le lance à 6h,
// le premier jour ouvré du mois, sur la VM du site.
// On charge toutes les lignes de facturation du mois, on les trie par client pour les regrouper,
// on additionne, puis on trie les clients par total et on garde les cent premiers. (J. B., 2020)
import { lireLignes } from "./csv.js";

export interface LigneFacturation {
  id: string;
  jour: string;
  client: string;
  type: string;
  montantCentimes: number;
}

export interface TotalClient { client: string; totalCentimes: number; lignes: number }

export function lireFacturation(chemin: string): LigneFacturation[] {
  const { entete, lignes } = lireLignes(chemin);
  const c = (n: string) => { const i = entete.indexOf(n); if (i === -1) throw new Error(`colonne absente : ${n}`); return i; };
  const iId = c("id"), iJour = c("jour"), iCli = c("client_id"), iType = c("type"), iMt = c("montant_centimes");
  return lignes.map(l => ({ id: l[iId], jour: l[iJour], client: l[iCli], type: l[iType], montantCentimes: Number(l[iMt]) }));
}

// Le classement : le plus gros total d'abord ; à total égal, le numéro de client le plus petit.
export function meilleur(a: TotalClient, b: TotalClient): number {
  if (a.totalCentimes !== b.totalCentimes) return b.totalCentimes - a.totalCentimes;
  return a.client < b.client ? -1 : a.client > b.client ? 1 : 0;
}

export function rapportDuMois(lignes: LigneFacturation[], k = 100): TotalClient[] {
  // trier toutes les lignes par client, pour avoir les lignes d'un même client à la suite
  const triees = lignes.slice().sort((a, b) => (a.client < b.client ? -1 : a.client > b.client ? 1 : 0));
  const totaux: TotalClient[] = [];
  for (const l of triees) {
    const dernier = totaux[totaux.length - 1];
    if (dernier && dernier.client === l.client) { dernier.totalCentimes += l.montantCentimes; dernier.lignes++; }
    else totaux.push({ client: l.client, totalCentimes: l.montantCentimes, lignes: 1 });
  }
  totaux.sort(meilleur);
  return totaux.slice(0, k);
}
