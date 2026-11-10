// Correcteur de l'atelier 6 - Priorité aux pharmacies, ADR-003 (journée 3, fiche atelier numéro 6).
import { chemin, ko, lireCsv, ok, resultats, tasMele, type Atelier } from "./kit.js";
import { controlesAdr, courbe, mesure } from "./controles-adr.js";

const atelier: Atelier = {
  numero: 6,
  titre: "Priorité aux pharmacies (ADR-003)",
  controles: [
    {
      titre: "À COMPLÉTER : le tas binaire rend ses éléments dans l'ordre",
      verifie: "TasBinaire (bench/variantes/tas.ts) : 2 000 nombres tirés à graine fixe, ajoutés puis retirés un par un ; puis 4 000 ajouts et retraits mêlés, la règle du tas vérifiée après chacun",
      voir: "fiche atelier numéro 6, sous-objectif 2, et les deux commentaires À COMPLÉTER de bench/variantes/tas.ts",
      test: async () => {
        const { TasBinaire } = await import("../../bench/variantes/tas.js");
        const { Alea } = await import("../../data/generateur/alea.js");
        const alea = new Alea(7);
        const valeurs = Array.from({ length: 2000 }, () => alea.entier(0, 500));
        const tas = new TasBinaire<number>((a, b) => a - b);
        for (const v of valeurs) tas.ajouter(v);
        const sortie: number[] = [];
        for (let i = 0; i < valeurs.length; i++) sortie.push(tas.retirer() as number);
        const attendu = valeurs.slice().sort((a, b) => a - b);
        const k = sortie.findIndex((x, i) => x !== attendu[i]);
        if (k !== -1) return ko(`le ${k === 0 ? "1er" : `${k + 1}e`} élément retiré vaut ${sortie[k]}, alors que ${attendu[k]} devait sortir avant`);
        const mele = await tasMele();
        return mele ? ko(mele) : ok();
      },
    },
    {
      titre: "Les trois files sont mesurées aux volumes du 9 novembre et de décembre",
      verifie: "un CSV bench/resultats/*-priorite.csv : tableau, tas et seaux, avec 9 000 et 15 000 colis, échauffement de 2 au moins, sommes de contrôle concordantes",
      voir: "fiche atelier numéro 6, sous-objectif 3",
      test: () => mesure("priorite", ["tableau", "tas", "seaux"], { tailles: 3, echauffement: 2, requises: [9000, 15000] }),
    },
    {
      titre: "La courbe est tracée",
      verifie: "un fichier *-priorite.svg dans bench/resultats",
      voir: "fiche atelier numéro 6, sous-objectif 3, et l'annexe : la courbe se trace avant l'épreuve",
      test: () => courbe(["priorite"]),
    },
    {
      titre: "La file à seaux est mise à l'épreuve d'arrivées dans le désordre",
      verifie: "un CSV bench/resultats/*-priorite-arrivees.csv qui contient la file à seaux",
      voir: "fiche atelier numéro 6, sous-objectif 4, et le contrat pharmacies (pièce 05, article 3)",
      test: () => {
        const csv = resultats(/-priorite-arrivees\.csv$/).find(f => lireCsv(f).lignes.some(l => l.variante === "seaux"));
        if (!csv) return ko("aucune mesure du sujet priorite-arrivees qui aille jusqu'à la file à seaux");
        return ok();
      },
    },
    ...controlesAdr(3, 6, 5),
  ],
};
void chemin;

export default atelier;
