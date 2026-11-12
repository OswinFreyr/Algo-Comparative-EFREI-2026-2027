// Sujet "adresses" : rapprocher des adresses mal saisies du référentiel (atelier 8, ADR-005).
// La taille est le nombre de requêtes : les saisies des premiers colis du jeu, avec leurs fautes.
// Le référentiel est celui de la métropole (229 329 adresses). La construction de l'index (trigrammes ou
// PostgreSQL) se fait hors chronomètre, une fois par variante : elle se mesure avec le sujet "adresses-index".
//
// Les trois variantes ne répondent pas toujours la même chose : ce sont trois façons d'approcher une saisie
// fautive. La somme de contrôle ne porte donc ici que sur le nombre de saisies traitées, identique pour les
// trois ; l'exactitude de chacune, comparée à la vérité du jeu (verite.csv), se mesure à part, avec
// npm run exactitude. C'est la seule mesure du module où la somme de contrôle ne garantit pas le résultat.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireColis, lireReferentiel } from "../../legacy/src/csv.js";
import type { AdresseReferentiel, Colis } from "../../legacy/src/modeles.js";
import { BaseAdresses, IndexTrigrammes, brute } from "../variantes/adresses.js";
import type { Sujet } from "./types.js";

export interface DonneesAdresses {
  colis: Colis[];                       // les colis du jeu, doublons de numéro de suivi retirés
  referentiel: AdresseReferentiel[];
  structures: Map<string, unknown>;     // l'index de chaque variante, construit une fois
}
interface Entree { requetes: Colis[]; structure: unknown }

// referentiel : "metropole" (229 329 adresses, celui des mesures) ou "gironde" (730 137, celui du 22 septembre).
export function chargerAdresses(dossier: string, referentiel = "metropole"): DonneesAdresses {
  if (!existsSync(join(dossier, "colis.csv"))) throw new Error(`jeu introuvable : ${dossier} (npm run data -- --echelle petite)`);
  if (!["metropole", "gironde"].includes(referentiel)) throw new Error(`référentiel inconnu : ${referentiel} (metropole ou gironde)`);
  const ref = resolve("data", "referentiel", `adresses-${referentiel}.csv`);
  if (!existsSync(ref)) throw new Error(`référentiel absent : data/referentiel/adresses-${referentiel}.csv (npm run ban)`);
  const vus = new Set<string>();
  const colis = lireColis(join(dossier, "colis.csv")).filter(c => !vus.has(c.numeroSuivi) && vus.add(c.numeroSuivi));
  return { colis, referentiel: lireReferentiel(ref), structures: new Map() };
}

export async function structurePour(d: DonneesAdresses, variante: string): Promise<unknown> {
  if (!d.structures.has(variante)) {
    if (variante === "brute") d.structures.set(variante, d.referentiel);
    else if (variante === "trigrammes") d.structures.set(variante, new IndexTrigrammes(d.referentiel));
    else if (variante === "postgres") d.structures.set(variante, await BaseAdresses.construire(d.referentiel));
  }
  return d.structures.get(variante);
}

const sujet: Sujet<DonneesAdresses, Entree, (string | null)[]> = {
  nom: "adresses",
  titre: "Rapprocher des adresses mal saisies du référentiel de la métropole (atelier 8)",
  parDefaut: { jeu: "petite", tailles: [5, 10, 20], variantes: ["brute", "trigrammes", "postgres"] },
  charger: dossier => chargerAdresses(dossier),
  tailleMax: d => d.colis.length,
  preparer: async (d, taille, variante) => ({ requetes: d.colis.slice(0, taille), structure: await structurePour(d, variante) }),
  variantes: {
    brute: e => brute(e.requetes, e.structure as AdresseReferentiel[]),
    trigrammes: e => e.requetes.map(c => (e.structure as IndexTrigrammes).chercher(c.adresseSaisie)),
    postgres: async e => {
      const base = e.structure as BaseAdresses, r: (string | null)[] = [];
      for (const c of e.requetes) r.push(await base.chercher(c.adresseSaisie));
      return r;
    },
  },
  // Le nombre de réponses, pas leur contenu : voir l'en-tête.
  controle: r => `${r.length} saisies`,
};

export default sujet;
