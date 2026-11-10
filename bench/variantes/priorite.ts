// Trois façons de tenir la file du quai : les préparateurs prennent toujours le colis le plus urgent.
// Atelier 6 (journée 3) : mesurez-les, puis écrivez l'ADR-003.
//
// La règle métier : les pharmacies d'abord, puis les express, puis le standard ; à priorité égale, par fin
// de créneau, puis par heure de création ; à égalité complète, dans l'ordre d'arrivée sur le quai.
import type { Colis } from "../../legacy/src/modeles.js";
import { FileQuai, parEcheance } from "../../legacy/src/quai.js";
import { TasBinaire } from "./tas.js";

export interface File { ajouter(c: Colis): void; prendre(): Colis | undefined }

// Variante 1 : le legacy tel quel. Un tri complet de la file à chaque arrivée, un shift à chaque prise.
export const tableau = (): File => new FileQuai();

// Variante 2 : un tas binaire. O(log n) par arrivée et par prise. Le rang d'arrivée départage les égalités,
// comme le fait le tri stable du legacy.
export const tas = (): File => {
  let rang = 0;
  const rangs = new Map<Colis, number>();
  const t = new TasBinaire<Colis>((a, b) => parEcheance(a, b) || rangs.get(a)! - rangs.get(b)!);
  return {
    ajouter: c => { rangs.set(c, rang++); t.ajouter(c); },
    prendre: () => { const c = t.retirer(); if (c) rangs.delete(c); return c; },
  };
};

// Variante 3 : une file à seaux. Trois files d'attente, une par priorité, servies dans l'ordre d'arrivée.
// O(1) par arrivée et par prise. Elle ne regarde ni le créneau ni l'heure de création : elle suppose que
// les colis arrivent dans l'ordre où ils ont été créés, et qu'une priorité n'a qu'une fin de créneau.
export const seaux = (): File => {
  const ordre = ["pharmacie", "express", "standard"];
  const files: Colis[][] = ordre.map(() => []);
  const tetes = ordre.map(() => 0);
  return {
    ajouter: c => { files[ordre.indexOf(c.priorite)].push(c); },
    prendre: () => {
      for (let p = 0; p < files.length; p++) if (tetes[p] < files[p].length) return files[p][tetes[p]++];
      return undefined;
    },
  };
};

// Contre-exemple, à ne pas reprendre : le même tas sans le rang d'arrivée. Deux colis de même priorité,
// même créneau et même seconde de création sortent alors dans un ordre qui dépend de la forme du tas.
// Il sert à montrer pourquoi la somme de contrôle diffère ; il n'est pas dans les variantes par défaut.
export const tasSansRang = (): File => {
  const t = new TasBinaire<Colis>(parEcheance);
  return { ajouter: c => t.ajouter(c), prendre: () => t.retirer() };
};

export const VARIANTES_PRIORITE: Record<string, () => File> = { tableau, tas, seaux, "tas-sans-rang": tasSansRang };

// La soirée sur le quai : après chaque arrivée, les préparateurs prennent `prises[i]` colis (0, 1 ou 2) ;
// à la fin, ils vident la file. Le résultat est l'ordre de sortie des colis.
export function simuler(file: File, arrivees: Colis[], prises: number[]): string[] {
  const sortie: string[] = [];
  for (let i = 0; i < arrivees.length; i++) {
    file.ajouter(arrivees[i]);
    for (let k = 0; k < prises[i]; k++) { const c = file.prendre(); if (c) sortie.push(c.id); }
  }
  for (let c = file.prendre(); c; c = file.prendre()) sortie.push(c.id);
  return sortie;
}

// Somme de contrôle de l'ordre de sortie.
export function controleSortie(sortie: string[]): string {
  let h = 0;
  for (const id of sortie) for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}
