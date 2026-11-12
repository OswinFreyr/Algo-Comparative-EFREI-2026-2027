// Correcteur de l'atelier 10 - Le pont se lève, ADR-007 (journée 4, fiche atelier numéro 10).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ko, lireCsv, nombre, ok, protocole, resultats, type Atelier } from "./kit.js";
import { controlesAdr } from "./controles-adr.js";
import type { EntreeChemins } from "../../bench/variantes/chemins.js";

function mesures(): { variantes: Set<string>; tailles: Set<number>; echauffement: number; memeControle: boolean }[] {
  return resultats(/-chemins\.csv$/).map(csv => {
    const { lignes } = lireCsv(csv);
    const parTaille = new Map<string, Set<string>>();
    for (const l of lignes) { if (!parTaille.has(l.taille)) parTaille.set(l.taille, new Set()); parTaille.get(l.taille)!.add(l.controle); }
    return {
      variantes: new Set(lignes.map(l => l.variante)), tailles: new Set(lignes.map(l => nombre(l.taille))),
      echauffement: Number(protocole(csv)?.echauffement ?? -1),
      memeControle: lignes.length > 0 && [...parTaille.values()].every(s => s.size === 1 && [...s][0] !== ""),
    };
  });
}

// Ce qu'il faut pour rejouer le scénario : le tas de l'atelier 6, le réseau, un jeu de données. Rend la phrase du KO, ou null.
async function prealables(): Promise<string | null> {
  // Dijkstra et A* utilisent le tas de l'atelier 6 : on le vérifie d'abord.
  const { TasBinaire } = await import("../../bench/variantes/tas.js");
  const t = new TasBinaire<number>((a, b) => a - b);
  [5, 3, 8, 1, 9, 2].forEach(x => t.ajouter(x));
  const s: number[] = []; for (let x = t.retirer(); x !== undefined; x = t.retirer()) s.push(x);
  if (s.join() !== "1,2,3,5,8,9") return "le tas binaire de l'atelier 6 ne rend pas ses éléments dans l'ordre (correction_J3.zip, puis npm run verifier -- 6)";
  const { DOSSIER_GRAPHE } = await import("../../bench/graphe/graphe.js");
  if (!existsSync(join(DOSSIER_GRAPHE, "aretes.csv.gz"))) return "data/referentiel/graphe/aretes.csv.gz absent (maj-J4.zip à décompresser à la racine du dépôt)";
  if (!jeu()) return "ni le jeu moyenne ni le jeu petite ne sont générés";
  return null;
}
const jeu = () => ["moyenne", "petite"].map(j => join("data", "jeux", j)).find(d => existsSync(join(d, "colis.csv")));

// Les tournées du scénario du 8 septembre, pont levé, lues une seule fois pour les trois premiers contrôles.
let scenario: Promise<EntreeChemins> | null = null;
function entreeScenario(): Promise<EntreeChemins> {
  if (!scenario) scenario = (async () => {
    const { preparerChemins } = await import("../../bench/sujets/chemins.js");
    return preparerChemins(jeu()!).entree;
  })();
  return scenario;
}

// Dijkstra avec tas contre Dijkstra simple, sur trois tournées, vers leurs deux arrêts les plus proches à vol
// d'oiseau (Dijkstra simple s'arrête dès qu'ils sont fixés : une seconde ou deux en tout). Rend null si les distances
// sont les mêmes, sinon ce qui a été trouvé et une indication sur la nature de l'écart, sans la ligne qui le corrige.
let ecart: Promise<string | null> | null = null;
function ecartDijkstra(): Promise<string | null> { return ecart ??= chercherEcart(); }
async function chercherEcart(): Promise<string | null> {
  const { CHEMINS } = await import("../../bench/variantes/chemins.js");
  const { volOiseau } = await import("../../bench/graphe/graphe.js");
  const e = await entreeScenario();
  const proches = (q: EntreeChemins["requetes"][number]) => {
    const { lat, lon } = e.reseaux[q.mode];
    return q.arrets.slice().sort((a, b) => volOiseau(lat[q.depart], lon[q.depart], lat[a], lon[a]) - volOiseau(lat[q.depart], lon[q.depart], lat[b], lon[b])).slice(0, 2);
  };
  const essai: EntreeChemins = { reseaux: e.reseaux, requetes: e.requetes.slice(0, 3).map(q => ({ ...q, arrets: proches(q) })) };
  const simple = CHEMINS.simple(essai).map(x => x.distances), tas = CHEMINS.tas(essai).map(x => x.distances);
  const i = simple.findIndex((x, k) => x.join() !== tas[k].join());
  if (i < 0) return null;
  const trouve = `tournée ${i + 1}, ses deux arrêts les plus proches : Dijkstra simple trouve ${simple[i].join(" et ")} mètres, Dijkstra avec tas ${tas[i].join(" et ")}`;
  const a = simple[i], b = tas[i];
  let indication: string;
  if (b.every(d => d === -1)) indication = "-1 veut dire jamais atteint : aucun voisin n'est sorti du tas, y sont-ils entrés ?";
  else if (b.some(d => d === Number.POSITIVE_INFINITY)) indication = "un carrefour est fixé sans que sa distance ait été notée";
  else if (b.some((d, k) => d > a[k])) indication = "une distance trop longue : une distance déjà notée a-t-elle été remplacée par une moins bonne ?";
  else indication = "une distance trop courte : la priorité d'un voisin dans le tas est-elle sa distance depuis le départ ?";
  return `${trouve} ; ${indication}`;
}

// Un carrefour sorti du tas est fixé, sa distance ne s'améliorera plus : s'il y retourne, c'est qu'un voisin entre
// dans le tas même quand sa distance n'est pas meilleure. Les distances restent justes, mais le tas grossit pour
// rien et Dijkstra avec tas se mesure deux fois plus lent. On compte ces retours sur une tournée, en écoutant le tas.
async function retoursAuTas(): Promise<{ retours: number; ajouts: number }> {
  const { TasBinaire } = await import("../../bench/variantes/tas.js");
  const { CHEMINS } = await import("../../bench/variantes/chemins.js");
  const e = await entreeScenario();
  const tas = TasBinaire.prototype as unknown as { ajouter(x: unknown): void; retirer(): unknown };
  const ajouter = tas.ajouter, retirer = tas.retirer;
  const sortis = new Set<number>();
  let retours = 0, ajouts = 0;
  tas.ajouter = function (this: unknown, x: unknown) { ajouts++; if (sortis.has((x as { noeud: number })?.noeud)) retours++; return ajouter.call(this, x); };
  tas.retirer = function (this: unknown) { const x = retirer.call(this) as { noeud: number } | undefined; if (x) sortis.add(x.noeud); return x; };
  try { CHEMINS.tas({ reseaux: e.reseaux, requetes: e.requetes.slice(0, 1) }); } finally { tas.ajouter = ajouter; tas.retirer = retirer; }
  return { retours, ajouts };
}

const atelier: Atelier = {
  numero: 10,
  titre: "Le pont se lève (ADR-007)",
  controles: [
    {
      titre: "À COMPLÉTER : Dijkstra avec tas rend les distances de Dijkstra simple",
      verifie: "tas et simple sur trois tournées du scénario du 8 septembre (pont levé), vers leurs deux arrêts les plus proches : les mêmes distances, au mètre près",
      voir: "fiche atelier numéro 10, sous-objectif 1, et le commentaire À COMPLÉTER de dijkstraTas dans bench/variantes/chemins.ts ; si le tas lui-même est faux, npm run verifier -- 6",
      test: async () => {
        const manque = await prealables();
        if (manque) return ko(manque);
        const trouve = await ecartDijkstra();
        return trouve ? ko(trouve) : ok();
      },
    },
    {
      titre: "Dijkstra avec tas ne remet pas dans le tas un carrefour déjà fixé",
      verifie: "sur la première tournée du scénario, aucun carrefour déjà sorti du tas n'y est ajouté de nouveau",
      voir: "fiche atelier numéro 10, sous-objectif 1 : ce que fait dijkstraTas d'un voisin dont la distance n'est pas meilleure",
      test: async () => {
        const manque = await prealables();
        if (manque) return ko(manque);
        if (await ecartDijkstra()) return ko("Dijkstra avec tas n'est pas encore juste (premier contrôle)");
        const { retours, ajouts } = await retoursAuTas();
        return retours === 0 ? ok(`${ajouts} ajouts au tas`) : ko(`sur ${ajouts} ajouts au tas, ${retours} remettent en attente un carrefour déjà fixé : les distances sont justes, mais le tas grossit pour rien et la mesure du sous-objectif 4 s'en ressent ; un voisin entre-t-il dans le tas quand sa distance ne s'améliore pas ?`);
      },
    },
    {
      titre: "À COMPLÉTER : A* rend les distances de Dijkstra",
      verifie: "astar et tas sur trois tournées du scénario du 8 septembre (pont levé) : les mêmes distances, au mètre près",
      voir: "fiche atelier numéro 10, sous-objectif 3, et le commentaire À COMPLÉTER de aEtoile dans bench/variantes/chemins.ts",
      test: async () => {
        const manque = await prealables();
        if (manque) return ko(manque);
        if (await ecartDijkstra()) return ko("Dijkstra avec tas n'est pas encore juste (premier contrôle) : A* se compare à lui");
        const { CHEMINS } = await import("../../bench/variantes/chemins.js");
        const d = await entreeScenario();
        const e: EntreeChemins = { reseaux: d.reseaux, requetes: d.requetes.slice(0, 3) };
        const a = CHEMINS.tas(e).map(x => x.distances.join(",")), b = CHEMINS.astar(e).map(x => x.distances.join(","));
        const i = a.findIndex((x, k) => x !== b[k]);
        return i < 0 ? ok() : ko(`tournée ${i + 1} : Dijkstra trouve ${a[i].split(",").slice(0, 3).join(", ")}... mètres, A* ${b[i].split(",").slice(0, 3).join(", ")}...`);
      },
    },
    {
      titre: "L'heuristique guide vraiment A*",
      verifie: "sur une tournée, vers un arrêt éloigné, A* fixe moins de noeuds que Dijkstra",
      voir: "fiche atelier numéro 10, sous-objectif 3 : la priorité d'un voisin dans le tas",
      test: async () => {
        const manque = await prealables();
        if (manque) return ko(manque);
        if (await ecartDijkstra()) return ko("Dijkstra avec tas n'est pas encore juste (premier contrôle) : A* se compare à lui");
        const { CHEMINS } = await import("../../bench/variantes/chemins.js");
        const d = await entreeScenario();
        const q = d.requetes[0];
        const e: EntreeChemins = { reseaux: d.reseaux, requetes: [{ ...q, arrets: [q.arrets[q.arrets.length - 1]] }] };
        const fd = CHEMINS.tas(e)[0].fixes, fa = CHEMINS.astar(e)[0].fixes;
        return fa < fd ? ok(`${fa} noeuds fixés par A*, ${fd} par Dijkstra`) : ko(`A* fixe ${fa} noeuds, Dijkstra ${fd} : sans heuristique, A* explore comme Dijkstra`);
      },
    },
    {
      titre: "Dijkstra simple est mesuré",
      verifie: "un CSV bench/resultats/*-chemins.csv avec la variante simple",
      voir: "fiche atelier numéro 10, sous-objectif 4",
      test: () => mesures().some(x => x.variantes.has("simple")) ? ok() : ko("aucune mesure de Dijkstra simple"),
    },
    {
      titre: "Dijkstra avec tas et A* sont mesurés jusqu'aux 23 tournées, et concordent",
      verifie: "un CSV bench/resultats/*-chemins.csv avec tas et astar à 23 tournées, un échauffement, la même somme de contrôle à chaque taille",
      voir: "fiche atelier numéro 10, sous-objectif 4",
      test: () => {
        const m = mesures().filter(x => x.variantes.has("tas") && x.variantes.has("astar") && x.tailles.has(23));
        if (m.length === 0) return ko("aucune mesure de tas et astar à 23 tournées");
        if (!m.some(x => x.echauffement >= 1)) return ko("pas de tour d'échauffement");
        return m.some(x => x.memeControle) ? ok() : ko("la colonne controle diffère entre tas et astar");
      },
    },
    ...controlesAdr(7, 10, 6),
  ],
};

export default atelier;
