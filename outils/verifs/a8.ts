// Correcteur de l'atelier 8 - L'adresse introuvable, ADR-005 (journée 4, fiche atelier numéro 8).
import { existsSync } from "node:fs";
import { chemin, ko, lireCsv, nombre, ok, protocole, resultats, type Atelier } from "./kit.js";
import { controlesAdr } from "./controles-adr.js";

// Les variantes et tailles d'une mesure du harness (CSV + protocole).
function mesures(sujet: string): { variantes: Set<string>; tailles: Set<number>; echauffement: number; csv: string }[] {
  return resultats(new RegExp(`-${sujet}\\.csv$`)).map(csv => {
    const { lignes } = lireCsv(csv);
    return { csv, variantes: new Set(lignes.map(l => l.variante)), tailles: new Set(lignes.map(l => nombre(l.taille))), echauffement: Number(protocole(csv)?.echauffement ?? -1) };
  });
}

const atelier: Atelier = {
  numero: 8,
  titre: "L'adresse introuvable (ADR-005)",
  controles: [
    {
      titre: "À COMPLÉTER : l'index de trigrammes retrouve les adresses",
      verifie: "IndexTrigrammes sur les 3 000 premières adresses du référentiel : 20 saisies exactes retrouvées, une saisie fautive rapprochée, au plus 10 candidats rangés du plus semblable au moins semblable",
      voir: "fiche atelier numéro 8, sous-objectif 2, et le commentaire À COMPLÉTER de bench/variantes/adresses.ts",
      test: async () => {
        const ref = chemin("data", "referentiel", "adresses-metropole.csv");
        if (!existsSync(ref)) return ko("data/referentiel/adresses-metropole.csv absent (npm run ban)");
        const { lireReferentiel } = await import("../../legacy/src/csv.js");
        const { libelle, normaliser } = await import("../../legacy/src/adresses.js");
        const { IndexTrigrammes } = await import("../../bench/variantes/adresses.js");
        const r = lireReferentiel(ref).slice(0, 3000);
        const index = new IndexTrigrammes(r);
        const echecs = r.slice(0, 20).filter(a => index.libelles[index.ids.indexOf(index.chercher(libelle(a)) ?? "")] !== normaliser(libelle(a)));
        if (echecs.length) return ko(`${echecs.length} saisie(s) exacte(s) sur 20 ne retrouvent pas leur adresse, par exemple "${libelle(echecs[0])}"`);
        const c = index.candidats(normaliser(libelle(r[7]).replace(/[aeiou]/, "")));
        if (c.length === 0) return ko("aucun candidat pour une saisie avec une lettre en moins");
        if (c.length > 10) return ko(`${c.length} candidats au lieu de 10 au plus`);
        return ok();
      },
    },
    {
      titre: "Le coût d'une saisie est mesuré pour les trois variantes",
      verifie: "des CSV bench/resultats/*-adresses.csv : brute à une taille au moins, trigrammes et postgres à trois tailles au moins avec un échauffement",
      voir: "fiche atelier numéro 8, sous-objectif 3",
      test: () => {
        const m = mesures("adresses");
        if (!m.some(x => x.variantes.has("brute"))) return ko("aucune mesure de la force brute");
        const index = m.some(x => x.variantes.has("trigrammes") && x.variantes.has("postgres") && x.tailles.size >= 3 && x.echauffement >= 1);
        return index ? ok() : ko("aucune mesure de trigrammes et postgres sur trois tailles avec au moins un tour d'échauffement");
      },
    },
    {
      titre: "L'exactitude des trois variantes est mesurée",
      verifie: "un CSV bench/resultats/*-exactitude.csv avec brute, trigrammes et postgres",
      voir: "fiche atelier numéro 8, sous-objectif 4",
      test: () => {
        for (const csv of resultats(/-exactitude\.csv$/)) {
          const v = new Set(lireCsv(csv).lignes.map(l => l.variante));
          if (["brute", "trigrammes", "postgres"].every(x => v.has(x))) return ok();
        }
        return ko("aucun CSV d'exactitude avec les trois variantes");
      },
    },
    {
      titre: "Le coût de construction de l'index est mesuré jusqu'au référentiel entier",
      verifie: "un CSV bench/resultats/*-adresses-index.csv avec trigrammes et postgres, jusqu'à 229 329 adresses",
      voir: "fiche atelier numéro 8, sous-objectif 4",
      test: () => {
        const m = mesures("adresses-index");
        return m.some(x => x.variantes.has("trigrammes") && x.variantes.has("postgres") && x.tailles.has(229329)) ? ok()
          : ko(`${m.length} mesure(s) de construction, aucune avec les deux index à 229 329 adresses`);
      },
    },
    ...controlesAdr(5, 8, 5),
  ],
};

export default atelier;
