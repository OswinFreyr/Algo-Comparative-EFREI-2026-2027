// Correcteur de l'atelier 5 - Où est mon colis, ADR-002 (journée 3, fiche atelier numéro 5).
import { existsSync } from "node:fs";
import { chemin, ko, ok, type Atelier } from "./kit.js";
import { controlesAdr, courbe, mesure } from "./controles-adr.js";

const atelier: Atelier = {
  numero: 5,
  titre: "Où est mon colis (ADR-002)",
  controles: [
    {
      titre: "À COMPLÉTER : la Map rend le même dernier scan que le legacy",
      verifie: "construireMap (bench/variantes/suivi.ts) sur les scans du jeu petite, 400 requêtes, réponse par réponse",
      voir: "fiche atelier numéro 5, sous-objectif 2, et le commentaire À COMPLÉTER de construireMap",
      test: async () => {
        const f = chemin("data", "jeux", "petite", "scans.csv");
        if (!existsSync(f)) return ko("data/jeux/petite/scans.csv absent (npm run data -- --echelle petite)");
        const { lireScans } = await import("../../legacy/src/suivi.js");
        const v = await import("../../bench/variantes/suivi.js");
        const scans = lireScans(f);
        const requetes = v.genererRequetes(scans, 400);
        const ref = v.tableau.construire(scans), m = v.map.construire(scans);
        let manques = 0, faux = 0, anciens = 0;
        for (const n of requetes) {
          const a = ref.chercher(n), b = m.chercher(n);
          if (a && !b) manques++;
          else if (!a && b) faux++;
          else if (a && b && a.id !== b.id) anciens++;
        }
        const total = manques + faux + anciens;
        if (total === 0) return ok();
        const quoi = [manques && `${manques} numéro(s) connu(s) introuvable(s) dans la Map`, faux && `${faux} numéro(s) inconnu(s) trouvé(s)`, anciens && `${anciens} réponse(s) qui ne sont pas le scan le plus récent`].filter(Boolean).join(", ");
        return ko(`${total} réponse(s) sur 400 diffèrent du legacy : ${quoi}`);
      },
    },
    {
      titre: "Le coût d'une requête est mesuré jusqu'au jeu grande",
      verifie: "un CSV bench/resultats/*-suivi.csv : tableau, set et map, trois tailles jusqu'à 996 844 scans, échauffement de 3 au moins, sommes de contrôle concordantes",
      voir: "fiche atelier numéro 5, sous-objectif 3",
      test: () => mesure("suivi", ["tableau", "set", "map"], { tailles: 3, echauffement: 3, tailleMax: 996844 }),
    },
    {
      titre: "Le coût de construction est mesuré, mémoire comprise",
      verifie: "un CSV bench/resultats/*-suivi-construction.csv : tableau, set et map, trois tailles jusqu'à 996 844 scans, échauffement de 3 au moins",
      voir: "fiche atelier numéro 5, sous-objectif 4",
      test: () => mesure("suivi-construction", ["tableau", "set", "map"], { tailles: 3, echauffement: 3, tailleMax: 996844 }),
    },
    {
      titre: "La courbe des requêtes est tracée",
      verifie: "un fichier *-suivi.svg dans bench/resultats",
      voir: "fiche atelier numéro 5, sous-objectif 3, et l'annexe : la courbe se trace avant la mesure de construction",
      test: () => courbe(["suivi"]),
    },
    ...controlesAdr(2, 5, 5),
  ],
};

export default atelier;
