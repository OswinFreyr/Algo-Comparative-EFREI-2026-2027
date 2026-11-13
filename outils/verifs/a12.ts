// Correcteur de l'atelier 12 - Charger le vélo cargo, ADR-009 (journée 5, fiche atelier numéro 12).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ko, lireCsv, nombre, ok, resultats, type Atelier, type Resultat } from "./kit.js";
import { controlesAdr, mesure } from "./controles-adr.js";
import type { TourneeCargoJeu } from "../../bench/sujets/chargement.js";

const virgule = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

// Les cinq premières tournées de vélos cargo du jeu moyenne (ou petite), arrondies, avec leurs vrais colis.
async function cinqTournees(): Promise<TourneeCargoJeu[] | null> {
  const jeu = ["moyenne", "petite"].map(j => join("data", "jeux", j)).find(d => existsSync(join(d, "colis.csv")));
  if (!jeu) return null;
  const { preparerChargement } = await import("../../bench/sujets/chargement.js");
  return preparerChargement(jeu).tournees.slice(0, 5);
}

// La vague d'une variante respecte-t-elle les deux capacités, sur les valeurs arrondies et sur les vraies ?
function faisable(t: TourneeCargoJeu, pris: number[], variante: string): string | null {
  const nom = variante === "glouton" ? "du glouton" : variante === "backtracking" ? "du backtracking" : "de la programmation dynamique";
  if (new Set(pris).size !== pris.length) return `${t.livreur} : la vague ${nom} prend deux fois le même colis`;
  if (pris.some(i => i < 0 || i >= t.colis.length)) return `${t.livreur} : la vague ${nom} rend un indice de colis qui n'existe pas`;
  let hg = 0, l = 0, kg = 0, lReel = 0;
  for (const i of pris) { hg += t.colis[i].poidsHg; l += t.colis[i].volumeL; kg += t.tournee.colis[i].poidsKg; lReel += t.tournee.colis[i].volumeL; }
  if (hg > t.capaciteHg) return `${t.livreur} : la vague ${nom} fait ${hg} hg arrondis (${virgule(hg / 10)} kg) pour ${t.capaciteHg} hg au plus`;
  if (l > t.capaciteL) return `${t.livreur} : la vague ${nom} fait ${l} l arrondis pour ${t.capaciteL} l au plus`;
  if (kg > t.tournee.livreur.capaciteKg + 1e-9) return `${t.livreur} : la vague ${nom} pèse ${virgule(kg, 2)} kg sur les vrais poids, pour ${t.tournee.livreur.capaciteKg} kg au plus (l'arrondi va dans le mauvais sens ?)`;
  if (lReel > t.tournee.livreur.capaciteL + 1e-9) return `${t.livreur} : la vague ${nom} fait ${virgule(lReel)} l sur les vrais volumes, pour ${t.tournee.livreur.capaciteL} l au plus`;
  return null;
}

const atelier: Atelier = {
  numero: 12,
  titre: "Charger le vélo cargo (ADR-009)",
  controles: [
    {
      titre: "À COMPLÉTER : la programmation dynamique rend les points du backtracking",
      verifie: "sur cinq tournées de vélos cargo du jeu moyenne (ou petite) : dynamique et backtracking rendent les mêmes points, et la vague de chacune tient dans 80 kg (800 hg arrondis) et 450 l, sur les valeurs arrondies comme sur les vraies",
      voir: "fiche atelier numéro 12, sous-objectif 2, et le commentaire À COMPLÉTER de bench/variantes/chargement.ts",
      test: async (): Promise<Resultat> => {
        const tournees = await cinqTournees();
        if (!tournees) return ko("ni le jeu moyenne ni le jeu petite ne sont générés");
        const { CHARGEMENT } = await import("../../bench/variantes/chargement.js");
        const d = CHARGEMENT.dynamique({ tournees }), b = CHARGEMENT.backtracking({ tournees });
        for (let k = 0; k < tournees.length; k++) {
          const t = tournees[k];
          if (d[k].points !== b[k].points) {
            // L'indication dit la nature de l'écart, pas la ligne qui le corrige. Plus de points que le backtracking : pas
            // d'indication (une capacité n'est pas respectée dans la table ; ce message est tel quel dans le diaporama).
            const indication = d[k].points === 0 ? " ; 0 point : aucun colis n'est retrouvé. Soit aucune case ne prend de colis, soit les cases qui en prennent un ne le notent pas"
              : d[k].points < b[k].points ? " ; moins que le meilleur chargement : une case ne prend pas le meilleur des deux, ou un colis est noté alors que la case ne le prend pas" : "";
            return ko(`tournée ${t.livreur} (${t.colis.length} colis) : la programmation dynamique rend ${d[k].points} points, le backtracking ${b[k].points}${indication}`);
          }
          const f = faisable(t, d[k].pris, "la programmation dynamique") ?? faisable(t, b[k].pris, "le backtracking");
          if (f) return ko(f);
          const points = d[k].pris.reduce((s, i) => s + t.colis[i].points, 0);
          if (points !== d[k].points) return ko(`tournée ${t.livreur} : la programmation dynamique annonce ${d[k].points} points, ses colis pris en font ${points}`);
        }
        return ok(`${tournees.length} tournées, ${d.reduce((s, r) => s + r.points, 0)} points`);
      },
    },
    {
      titre: "Le glouton est faisable et ne dépasse jamais l'optimum",
      verifie: "sur les mêmes cinq tournées : la vague du glouton tient dans les deux capacités et ne vaut pas plus de points que le backtracking",
      voir: "fiche atelier numéro 12, sous-objectif 1",
      test: async (): Promise<Resultat> => {
        const tournees = await cinqTournees();
        if (!tournees) return ko("ni le jeu moyenne ni le jeu petite ne sont générés");
        const { CHARGEMENT } = await import("../../bench/variantes/chargement.js");
        const g = CHARGEMENT.glouton({ tournees }), b = CHARGEMENT.backtracking({ tournees });
        for (let k = 0; k < tournees.length; k++) {
          const f = faisable(tournees[k], g[k].pris, "le glouton");
          if (f) return ko(f);
          if (g[k].points > b[k].points) return ko(`tournée ${tournees[k].livreur} : le glouton rend ${g[k].points} points, plus que l'optimum du backtracking (${b[k].points}) : une des deux vagues est fausse`);
        }
        const laisses = b.reduce((s, r, k) => s + r.points - g[k].points, 0);
        return ok(`${laisses} point${laisses > 1 ? "s" : ""} laissé${laisses > 1 ? "s" : ""} sur le quai sur ${tournees.length} tournées`);
      },
    },
    {
      titre: "Les trois variantes sont mesurées jusqu'à 20 tournées, avec échauffement",
      verifie: "un CSV bench/resultats/*-chargement.csv avec glouton, dynamique et backtracking, trois tailles dont 20 tournées, un tour d'échauffement au moins",
      voir: "fiche atelier numéro 12, sous-objectif 3",
      test: () => mesure("chargement", ["glouton", "dynamique", "backtracking"], { tailleMax: 20, echauffement: 1, tailles: 3 }),
    },
    {
      titre: "La qualité est mesurée",
      verifie: "un CSV bench/resultats/*-cargo.csv (npm run cargo) avec les trois variantes et au moins 20 tournées",
      voir: "fiche atelier numéro 12, sous-objectif 4",
      test: () => {
        const csvs = resultats(/-cargo\.csv$/);
        if (csvs.length === 0) return ko("aucun fichier bench/resultats/*-cargo.csv");
        const raisons: string[] = [];
        for (const csv of csvs) {
          const { lignes } = lireCsv(csv);
          const variantes = new Set(lignes.map(l => l.variante)), tournees = new Set(lignes.map(l => l.tournee));
          const manques = ["glouton", "dynamique", "backtracking"].filter(v => !variantes.has(v));
          if (manques.length) { raisons.push(`${csv.split(/[\\/]/).pop()} : sans ${manques.join(", ")}`); continue; }
          if (tournees.size < 20) { raisons.push(`${csv.split(/[\\/]/).pop()} : ${tournees.size} tournée(s)`); continue; }
          if (lignes.some(l => Number.isNaN(nombre(l.points)))) { raisons.push(`${csv.split(/[\\/]/).pop()} : une colonne points illisible`); continue; }
          return ok(`${csv.split(/[\\/]/).pop()}, ${tournees.size} tournées`);
        }
        return ko(raisons.slice(0, 2).join(" ; "));
      },
    },
    ...controlesAdr(9, 12, 5),
  ],
};

export default atelier;
