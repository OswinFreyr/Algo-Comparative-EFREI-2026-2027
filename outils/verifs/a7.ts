// Correcteur de l'atelier 7 - Le rapport de 6h, ADR-004 (journée 3, fiche atelier numéro 7).
import { chemin, ko, lireCsv, manifeste, nombre, ok, resultats, tasMele, type Atelier } from "./kit.js";
import { controlesAdr, courbe, mesure } from "./controles-adr.js";

const atelier: Atelier = {
  numero: 7,
  titre: "Le rapport de 6h (ADR-004)",
  controles: [
    {
      titre: "Le mois de facturation est généré : trois millions de lignes",
      verifie: "data/jeux/mois/MANIFESTE.json : 3 000 000 de lignes, graine 2026",
      voir: "fiche atelier numéro 7, sous-objectif 1",
      test: () => {
        const m = manifeste("mois");
        if (!m) return ko("data/jeux/mois absent");
        return m.lignes === 3_000_000 && m.graine === 2026 ? ok() : ko(`${m.lignes} lignes, graine ${m.graine}`);
      },
    },
    {
      titre: "À COMPLÉTER : le tas de taille K donne les cent mêmes clients que le legacy",
      verifie: "topKParTas (bench/variantes/rapport.ts) sur 30 000 lignes tirées à graine fixe, comparé au tri complet du legacy",
      voir: "fiche atelier numéro 7, sous-objectif 2, le commentaire À COMPLÉTER de topKParTas ; si le tas lui-même est faux, npm run verifier -- 6",
      test: async () => {
        const { TasBinaire } = await import("../../bench/variantes/tas.js");
        const t = new TasBinaire<number>((a, b) => a - b);
        [5, 3, 8, 1, 9, 2].forEach(x => t.ajouter(x));
        const s: number[] = []; for (let x = t.retirer(); x !== undefined; x = t.retirer()) s.push(x);
        if (s.join() !== "1,2,3,5,8,9") return ko("le tas binaire de l'atelier 6 ne rend pas ses éléments dans l'ordre");
        const mele = await tasMele();
        if (mele) return ko(`le tas binaire de l'atelier 6 est faux : ${mele} ; correction_tas.zip est sur Moodle`);
        const { Alea } = await import("../../data/generateur/alea.js");
        const v = await import("../../bench/variantes/rapport.js");
        const alea = new Alea(11);
        const lignes = Array.from({ length: 30000 }, (_, i) => ({ id: `F${i}`, jour: "2026-10-01", client: `CL${String(1 + Math.floor(800 * Math.pow(alea.reel(), 2.6))).padStart(6, "0")}`, type: "livraison", montantCentimes: alea.entier(100, 900) }));
        const attendu = v.tri(lignes), obtenu = v.tas(lignes);
        if (obtenu.length !== attendu.length) return ko(`${obtenu.length} client(s) rendu(s) au lieu de ${attendu.length}`);
        const k = obtenu.findIndex((x, i) => x.client !== attendu[i].client);
        return k === -1 ? ok() : ko(`à la place ${k + 1}, ${obtenu[k].client} au lieu de ${attendu[k].client}`);
      },
    },
    {
      titre: "Les trois variantes sont mesurées jusqu'à trois millions de lignes, mémoire comprise",
      verifie: "un CSV bench/resultats/*-rapport.csv : tri, tas et quickselect, trois tailles jusqu'à 3 000 000, échauffement de 2 au moins, sommes de contrôle concordantes, colonne memoire_ko renseignée",
      voir: "fiche atelier numéro 7, sous-objectif 3",
      test: () => {
        const r = mesure("rapport", ["tri", "tas", "quickselect"], { tailles: 3, echauffement: 2, tailleMax: 3_000_000 });
        if (!r.ok) return r;
        const csv = resultats(/-rapport\.csv$/).find(f => f.endsWith(r.trouve));
        const memo = csv ? lireCsv(csv).lignes.map(l => nombre(l.memoire_ko)) : [];
        return memo.some(x => x !== 0) ? r : ko("la colonne memoire_ko vaut 0 partout : le harness relève-t-il la mémoire ?");
      },
    },
    {
      titre: "La courbe est tracée",
      verifie: "un fichier *-rapport.svg dans bench/resultats",
      voir: "fiche atelier numéro 7, sous-objectif 4",
      test: () => courbe(["rapport"]),
    },
    ...controlesAdr(4, 7, 5),
  ],
};
void chemin;

export default atelier;
