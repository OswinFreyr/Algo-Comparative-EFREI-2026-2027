// Quatre façons de retrouver le dernier scan d'un colis. Même réponse, pas le même coût.
// Atelier 5 (journée 3) : mesurez tableau, set et map, puis écrivez l'ADR-002.
// La quatrième, dichotomie, sert à la démonstration de fin de journée, après le tri.
//
// Chaque variante a deux temps : construire une structure à partir des scans (une fois, quand les scans
// arrivent), puis chercher un numéro dans cette structure (40 000 fois par jour). Le harness mesure
// les deux séparément : sujet suivi-construction, puis sujet suivi.
import { Alea } from "../../data/generateur/alea.js";
import { dernierScan, plusRecent, type Scan } from "../../legacy/src/suivi.js";

export interface Recherche { chercher(numero: string): Scan | null }
export interface VarianteSuivi { construire(scans: Scan[]): Recherche }

// Variante 1 : le legacy tel quel. Rien à construire ; chaque requête parcourt tous les scans.
export const tableau: VarianteSuivi = {
  construire: scans => ({ chercher: n => dernierScan(scans, n) }),
};

// Variante 2 : un Set des numéros connus. Un numéro mal tapé est refusé tout de suite ;
// un numéro connu parcourt encore tous les scans.
export const set: VarianteSuivi = {
  construire: scans => {
    const connus = new Set<string>();
    for (const s of scans) connus.add(s.numeroSuivi);
    return { chercher: n => (connus.has(n) ? dernierScan(scans, n) : null) };
  },
};

// Variante 3 : une Map du numéro de suivi vers son scan le plus récent. Chaque requête lit une case.
export function construireMap(scans: Scan[]): Map<string, Scan> {
  const index = new Map<string, Scan>();
  for (const scan of scans) {
    const precedent = index.get(scan.numeroSuivi);
    if (precedent === undefined || plusRecent(scan, precedent)) {
      index.set(scan.numeroSuivi, scan);
    }
  }
  return index;
}
export const map: VarianteSuivi = {
  construire: scans => {
    const index = construireMap(scans);
    return { chercher: n => index.get(n) ?? null };
  },
};

// Variante 4 (démonstration de fin de journée) : trier une fois, chercher par dichotomie.
// Les scans sont triés par numéro (les plus anciens d'abord à numéro égal), puis on garde, pour chaque
// numéro, son dernier scan, dans deux tableaux parallèles rangés par numéro.
export function construireTrie(scans: Scan[]): { numeros: string[]; derniers: Scan[] } {
  const tries = scans.slice().sort((a, b) =>
    a.numeroSuivi < b.numeroSuivi ? -1 : a.numeroSuivi > b.numeroSuivi ? 1 : plusRecent(a, b) ? 1 : -1);
  const numeros: string[] = [], derniers: Scan[] = [];
  for (let i = 0; i < tries.length; i++) {
    const fin = i === tries.length - 1 || tries[i + 1].numeroSuivi !== tries[i].numeroSuivi;
    if (fin) { numeros.push(tries[i].numeroSuivi); derniers.push(tries[i]); }
  }
  return { numeros, derniers };
}
// La dichotomie : on coupe l'intervalle en deux à chaque comparaison. 17 comparaisons pour 100 000 numéros.
export function chercherDichotomie(numeros: string[], n: string): number {
  let bas = 0, haut = numeros.length - 1;
  while (bas <= haut) {
    const milieu = (bas + haut) >>> 1;
    if (numeros[milieu] === n) return milieu;
    if (numeros[milieu] < n) bas = milieu + 1; else haut = milieu - 1;
  }
  return -1;
}
export const dichotomie: VarianteSuivi = {
  construire: scans => {
    const { numeros, derniers } = construireTrie(scans);
    return { chercher: n => { const i = chercherDichotomie(numeros, n); return i === -1 ? null : derniers[i]; } };
  },
};

export const VARIANTES_SUIVI: Record<string, VarianteSuivi> = { tableau, set, map, dichotomie };

// Somme de contrôle d'une liste de réponses : identique pour deux variantes correctes.
export function controleReponses(reponses: (Scan | null)[]): string {
  let h = 0;
  for (const r of reponses) {
    const s = r === null ? "-" : r.id;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Les requêtes de la page, à graine fixe : quatre sur cinq portent un numéro qui existe, une sur cinq un
// numéro mal tapé (une lettre en moins, deux lettres inversées, une lettre changée), comme le support
// les voit passer. Deux binômes qui tirent avec la même graine posent les mêmes requêtes.
export function genererRequetes(scans: Scan[], nombre: number, graine = 2026): string[] {
  const alea = new Alea(graine);
  const vus = new Set<string>(), numeros: string[] = [];
  for (const s of scans) if (!vus.has(s.numeroSuivi)) { vus.add(s.numeroSuivi); numeros.push(s.numeroSuivi); }
  const requetes: string[] = [];
  for (let k = 0; k < nombre; k++) {
    const n = alea.choix(numeros);
    if (alea.reel() < 0.8) { requetes.push(n); continue; }
    const i = alea.entier(3, n.length - 2), sorte = alea.entier(0, 2);
    if (sorte === 0) requetes.push(n.slice(0, i) + n.slice(i + 1));
    else if (sorte === 1) requetes.push(n.slice(0, i) + n[i + 1] + n[i] + n.slice(i + 2));
    else requetes.push(n.slice(0, i) + (n[i] === "7" ? "1" : "7") + n.slice(i + 1));
  }
  return requetes;
}
