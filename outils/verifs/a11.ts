// Correcteur de l'atelier 11 - La tournée de Noël, ADR-008 (journée 5, fiche atelier numéro 11).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ko, lireCsv, nombre, ok, resultats, type Atelier, type Resultat } from "./kit.js";
import { controlesAdr, mesure } from "./controles-adr.js";
import type { TourneeNoel } from "../../bench/variantes/tournees.js";

const virgule = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const km = (m: number) => `${virgule(m / 1000)} km`;

// Les dix premières tournées de vélos cargo du jeu moyenne (ou petite), à 40 arrêts, distances par la route (cache).
async function dixTournees(): Promise<TourneeNoel[] | string> {
  const { DOSSIER_GRAPHE } = await import("../../bench/graphe/graphe.js");
  const jeu = ["moyenne", "petite"].map(j => join("data", "jeux", j)).find(d => existsSync(join(d, "colis.csv")));
  if (!jeu) return "ni le jeu moyenne ni le jeu petite ne sont générés";
  if (!existsSync(join(jeu, "cache-tournees-40.json")) && !existsSync(join(DOSSIER_GRAPHE, "aretes.csv.gz"))) return "ni le cache des distances (data/jeux/<jeu>/cache-tournees-40.json) ni le réseau routier (data/referentiel/graphe) ne sont là";
  const { preparerTournees } = await import("../../bench/sujets/tournees.js");
  return preparerTournees(jeu).tournees.slice(0, 10);
}

// L'ordre est-il une permutation des arrêts 1..k, et les mètres annoncés sont-ils ceux de la matrice ?
function coherent(t: TourneeNoel, r: { ordre: number[]; metres: number }, nom: string, longueur: (d: number[][], o: number[]) => number): string | null {
  const k = t.arrets.length;
  if (r.ordre.length !== k || new Set(r.ordre).size !== k || r.ordre.some(x => !Number.isInteger(x) || x < 1 || x > k)) return `${t.livreur} : l'ordre de ${nom} n'est pas une permutation des arrêts 1 à ${k} (${r.ordre.length} arrêts, ${new Set(r.ordre).size} distincts)`;
  if (r.metres !== longueur(t.d, r.ordre)) return `${t.livreur} : ${nom} annonce ${r.metres} m, la matrice en compte ${longueur(t.d, r.ordre)} (le retour au hub ?)`;
  return null;
}

const atelier: Atelier = {
  numero: 11,
  titre: "La tournée de Noël (ADR-008)",
  controles: [
    {
      titre: "À COMPLÉTER : le 2-opt ne rallonge jamais la tournée du plus proche voisin",
      verifie: "sur dix tournées de 40 arrêts (cache) : deuxopt rend une permutation des arrêts, ses mètres sont ceux de la matrice (recalculés), jamais plus que ceux du plus proche voisin, et moins sur une tournée au moins",
      voir: "fiche atelier numéro 11, sous-objectif 2, et le commentaire À COMPLÉTER de bench/variantes/tournees.ts",
      test: async (): Promise<Resultat> => {
        const tournees = await dixTournees();
        if (typeof tournees === "string") return ko(tournees);
        const { TOURNEES, longueur } = await import("../../bench/variantes/tournees.js");
        const v = TOURNEES.voisin({ tournees }), o = TOURNEES.deuxopt({ tournees });
        let raccourcies = 0, gagne = 0;
        for (let k = 0; k < tournees.length; k++) {
          const t = tournees[k];
          const c = coherent(t, v[k], "le plus proche voisin", longueur) ?? coherent(t, o[k], "le 2-opt", longueur);
          if (c) return ko(c);
          if (o[k].metres > v[k].metres) return ko(`${t.livreur} : ${km(o[k].metres)} après le 2-opt, ${km(v[k].metres)} pour le plus proche voisin : un échange a rallongé la tournée (le gain compare-t-il les bonnes arêtes ?)`);
          if (o[k].metres < v[k].metres) { raccourcies++; gagne += v[k].metres - o[k].metres; }
        }
        if (raccourcies === 0) return ko(`sur ${tournees.length} tournées, le 2-opt rend exactement la tournée du plus proche voisin : aucun échange n'est fait`);
        return ok(`${raccourcies} tournées sur ${tournees.length} raccourcies, ${km(gagne)} gagnés en tout`);
      },
    },
    {
      titre: "Sur neuf arrêts, le 2-opt est à moins de 3 % de l'optimum",
      verifie: "sur les dix tournées ramenées à leurs 9 premiers arrêts : l'optimum par force brute, et l'écart moyen du 2-opt à cet optimum sous 3 %",
      voir: "fiche atelier numéro 11, sous-objectif 4 (npm run noel -- --arrets 9)",
      test: async (): Promise<Resultat> => {
        const tournees = await dixTournees();
        if (typeof tournees === "string") return ko(tournees);
        const { TOURNEES, forceBrute } = await import("../../bench/variantes/tournees.js");
        const { sousTournee } = await import("../../bench/sujets/tournees.js");
        const neuf = tournees.map(t => sousTournee(t, 9));
        const o = TOURNEES.deuxopt({ tournees: neuf });
        const ecarts = neuf.map((t, k) => { const opt = forceBrute(t.d).metres; return 100 * (o[k].metres - opt) / opt; });
        const moyenne = ecarts.reduce((s, x) => s + x, 0) / ecarts.length;
        const pire = Math.max(...ecarts);
        if (ecarts.some(x => x < -1e-9)) return ko("le 2-opt rend une tournée plus courte que l'optimum : la longueur ou l'ordre est faux");
        return moyenne < 3 ? ok(`+${virgule(moyenne)} % en moyenne, au pire +${virgule(pire)} %`) : ko(`+${virgule(moyenne)} % en moyenne au-dessus de l'optimum (au pire +${virgule(pire)} %), 3 % admis`);
      },
    },
    {
      titre: "Le recuit fait au moins aussi bien que le plus proche voisin, et pareil deux fois de suite",
      verifie: "sur les dix tournées : recuit.metres <= voisin.metres, les mètres recalculés sur la matrice, et deux appels rendent le même ordre (graine fixe)",
      voir: "fiche atelier numéro 11, sous-objectif 2",
      test: async (): Promise<Resultat> => {
        const tournees = await dixTournees();
        if (typeof tournees === "string") return ko(tournees);
        const { TOURNEES, longueur } = await import("../../bench/variantes/tournees.js");
        const v = TOURNEES.voisin({ tournees }), a = TOURNEES.recuit({ tournees }), b = TOURNEES.recuit({ tournees });
        for (let k = 0; k < tournees.length; k++) {
          const t = tournees[k];
          const c = coherent(t, a[k], "le recuit", longueur);
          if (c) return ko(c);
          if (a[k].metres > v[k].metres) return ko(`${t.livreur} : ${km(a[k].metres)} pour le recuit, ${km(v[k].metres)} pour le plus proche voisin : le recuit ne rend pas le meilleur ordre rencontré`);
          if (a[k].ordre.join() !== b[k].ordre.join()) return ko(`${t.livreur} : deux appels du recuit, deux ordres différents (${km(a[k].metres)} puis ${km(b[k].metres)}) : la graine n'est pas fixe`);
        }
        return ok(`${tournees.length} tournées, ${km(v.reduce((s, r, k) => s + r.metres - a[k].metres, 0))} gagnés sur le plus proche voisin`);
      },
    },
    {
      titre: "Les trois variantes sont mesurées jusqu'à 20 tournées, avec échauffement",
      verifie: "un CSV bench/resultats/*-tournees.csv avec voisin, deuxopt et recuit, trois tailles dont 20 tournées, un tour d'échauffement au moins",
      voir: "fiche atelier numéro 11, sous-objectif 3",
      test: () => mesure("tournees", ["voisin", "deuxopt", "recuit"], { tailleMax: 20, echauffement: 1 }),
    },
    {
      titre: "La qualité est mesurée",
      verifie: "un CSV bench/resultats/*-noel.csv (npm run noel) avec les trois variantes, 20 tournées ou plus, à quarante arrêts (celui de --arrets 9 ne compte pas)",
      voir: "fiche atelier numéro 11, sous-objectif 4",
      test: () => {
        const csvs = resultats(/-noel\.csv$/);
        if (csvs.length === 0) return ko("aucun fichier bench/resultats/*-noel.csv");
        const raisons: string[] = [];
        for (const csv of csvs) {
          const { lignes } = lireCsv(csv);
          const variantes = new Set(lignes.map(l => l.variante)), tournees = new Set(lignes.map(l => l.tournee));
          const manques = ["voisin", "deuxopt", "recuit"].filter(v => !variantes.has(v));
          if (manques.length) { raisons.push(`${csv.split(/[\\/]/).pop()} : sans ${manques.join(", ")}`); continue; }
          if (tournees.size < 20) { raisons.push(`${csv.split(/[\\/]/).pop()} : ${tournees.size} tournée(s)`); continue; }
          const arrets = Math.max(...lignes.map(l => nombre(l.arrets) || 0));
          if (arrets && arrets < 20) { raisons.push(`${csv.split(/[\\/]/).pop()} : ${arrets} arrêts (c'est la mesure de --arrets 9, pas celle de npm run noel)`); continue; }
          if (lignes.some(l => Number.isNaN(nombre(l.metres)))) { raisons.push(`${csv.split(/[\\/]/).pop()} : une colonne metres illisible`); continue; }
          return ok(`${csv.split(/[\\/]/).pop()}, ${tournees.size} tournées`);
        }
        return ko(raisons.slice(0, 2).join(" ; "));
      },
    },
    ...controlesAdr(8, 11, 5),
  ],
};

export default atelier;
