// Le scénario du ticket T-0733 : mardi 8 septembre, 14h02, le pont Chaban-Delmas se lève.
// Les tournées du jour sont celles de l'affectation (variante map) sur un jeu de données ; à 14h02, chaque
// livreur a fait la moitié de ses arrêts, il est sur le dernier fait ; il lui reste les suivants de sa vague.
// Une tournée est touchée par la levée si au moins un de ses plus courts chemins restants passait par le pont.
// Les tournées touchées sont à recalculer ; le ticket T-0733 en compte 23 : si moins de 23 passaient par le pont, on complète
// avec des tournées voisines, à vérifier aussi (21 touchées sur le jeu du module, plus 2).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { lireColis, lireHubs, lireLivreurs } from "../../legacy/src/csv.js";
import { map as affecterMap } from "../variantes/affectation.js";
import { Accroche, PONT_CHABAN, estDuPont, voisinage, type Graphe, type Mode } from "./graphe.js";
import { TasBinaire } from "../variantes/tas.js";
import type { Requete } from "../variantes/chemins.js";

export const ARRETS_RESTANTS = 15;   // les arrêts qui restent dans la vague en cours
export const TOURNEES_TOUCHEES = 23; // le ticket T-0733 : 23 tournées en cours

export interface Tournee14h { livreur: string; mode: Mode; requete: Requete; touchee: boolean }

// Dijkstra avec le numéro de l'arête par laquelle on arrive à chaque noeud, pour savoir si un chemin passe
// par le pont. Utilisé seulement pour préparer le scénario, hors chronomètre.
function cheminsAvecArete(v: ReturnType<typeof voisinage>, aretes: Int32Array, depart: number): { dist: Float64Array; par: Int32Array; avant: Int32Array } {
  const dist = new Float64Array(v.n).fill(Number.POSITIVE_INFINITY), par = new Int32Array(v.n).fill(-1), avant = new Int32Array(v.n).fill(-1);
  const fixe = new Uint8Array(v.n), tas = new TasBinaire<{ noeud: number; priorite: number }>((a, b) => a.priorite - b.priorite);
  dist[depart] = 0; tas.ajouter({ noeud: depart, priorite: 0 });
  while (tas.taille > 0) {
    const { noeud: u, priorite: du } = tas.retirer()!;
    if (fixe[u]) continue;
    fixe[u] = 1;
    for (let p = v.debut[u]; p < v.debut[u + 1]; p++) {
      const w = v.cible[p], d = du + v.poids[p];
      if (d < dist[w]) { dist[w] = d; par[w] = aretes[p]; avant[w] = u; tas.ajouter({ noeud: w, priorite: d }); }
    }
  }
  return { dist, par, avant };
}

// Le numéro d'arête (dans le graphe) de chaque case des tableaux compacts d'un voisinage, dans le même ordre.
function numerosAretes(g: Graphe, mode: Mode): Int32Array {
  const permis = mode === "velo" ? g.velo : g.utilitaire;
  const debut = new Int32Array(g.n + 1);
  for (let k = 0; k < g.de.length; k++) if (permis[k]) debut[g.de[k] + 1]++;
  for (let i = 0; i < g.n; i++) debut[i + 1] += debut[i];
  const place = debut.slice(0, g.n), num = new Int32Array(debut[g.n]);
  for (let k = 0; k < g.de.length; k++) if (permis[k]) num[place[g.de[k]]++] = k;
  return num;
}

export function scenario14h02(g: Graphe, dossierJeu: string): Tournee14h[] {
  if (!existsSync(join(dossierJeu, "colis.csv"))) throw new Error(`jeu introuvable : ${dossierJeu} (npm run data -- --echelle moyenne)`);
  const colis = lireColis(join(dossierJeu, "colis.csv")), livreurs = lireLivreurs(join(dossierJeu, "livreurs.csv")), hubs = lireHubs(join(dossierJeu, "hubs.csv"));
  const tournees = affecterMap(colis, livreurs, hubs).tournees;
  const accroche = new Accroche(g);
  const reseaux = { velo: voisinage(g, "velo"), utilitaire: voisinage(g, "utilitaire") };
  const numeros = { velo: numerosAretes(g, "velo"), utilitaire: numerosAretes(g, "utilitaire") };
  const surLePont = estDuPont(g, PONT_CHABAN);
  const resultat: Tournee14h[] = [];
  for (const t of tournees) {
    if (t.colis.length < 4) continue;
    const mode: Mode = t.livreur.vehicule === "velo_cargo" ? "velo" : "utilitaire";
    const noeuds = t.colis.map(c => accroche.proche(c.lat, c.lon));
    const ici = Math.floor(noeuds.length / 2) - 1;
    const depart = noeuds[ici];
    const arrets: number[] = [];
    for (const x of noeuds.slice(ici + 1)) if (x !== depart && !arrets.includes(x) && arrets.length < ARRETS_RESTANTS) arrets.push(x);
    const c = cheminsAvecArete(reseaux[mode], numeros[mode], depart);
    let touchee = false;
    for (const a of arrets) {
      for (let x = a; x !== depart && c.avant[x] >= 0; x = c.avant[x]) if (surLePont(c.par[x])) { touchee = true; break; }
      if (touchee) break;
    }
    resultat.push({ livreur: t.livreur.id, mode, requete: { depart, arrets, mode }, touchee });
  }
  return resultat;
}

// Les tournées à recalculer quand le pont se lève : les touchées d'abord, dans l'ordre des livreurs, puis,
// s'il en manque pour arriver à 23, les autres (elles aussi doivent vérifier qu'elles ne passaient pas par le pont).
export function aRecalculer(s: Tournee14h[]): Tournee14h[] {
  const touchees = s.filter(t => t.touchee), autres = s.filter(t => !t.touchee);
  return [...touchees, ...autres].slice(0, TOURNEES_TOUCHEES);
}
