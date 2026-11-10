// Sujet "rapport" : le rapport de 6h, les cent premiers clients du mois (atelier 7, ADR-004).
// Les tailles sont des nombres de lignes de facturation, prises en tête du fichier du mois
// (npm run mois). La mémoire compte autant que le temps : c'est elle qui fait tomber le serveur.
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { LigneFacturation, TotalClient } from "../../legacy/src/rapport.js";
import { VARIANTES_RAPPORT, controleRapport } from "../variantes/rapport.js";
import type { Sujet } from "./types.js";

// Lecture en flux, hors chronomètre. Les chaînes qui se répètent (client, jour, type) sont partagées :
// trois millions de lignes tiennent ainsi dans quelques centaines de Mo.
async function lireMois(chemin: string): Promise<LigneFacturation[]> {
  const partagees = new Map<string, string>();
  const partager = (s: string) => { const d = partagees.get(s); if (d !== undefined) return d; partagees.set(s, s); return s; };
  const lignes: LigneFacturation[] = [];
  let entete: string[] | null = null;
  for await (const brut of createInterface({ input: createReadStream(chemin, { encoding: "utf-8" }), crlfDelay: Infinity })) {
    if (!brut) continue;
    const c = brut.split(";");
    if (!entete) { entete = c; continue; }
    lignes.push({ id: c[0], jour: partager(c[1]), client: partager(c[2]), type: partager(c[3]), montantCentimes: Number(c[4]) });
  }
  return lignes;
}

const sujet: Sujet<LigneFacturation[], LigneFacturation[], TotalClient[]> = {
  nom: "rapport",
  titre: "Le rapport de 6h : les cent premiers clients du mois, par chiffre d'affaires",
  parDefaut: { jeu: "mois", tailles: [100000, 1000000, 3000000], variantes: ["tri", "tas", "quickselect"] },
  async charger(dossier) {
    const f = join(dossier, "facturation.csv");
    if (!existsSync(f)) throw new Error(`facturation introuvable : ${f} (npm run mois)`);
    return lireMois(f);
  },
  tailleMax: d => d.length,
  preparer: (d, taille) => d.slice(0, taille),
  variantes: VARIANTES_RAPPORT,
  controle: controleRapport,
};

export default sujet;
