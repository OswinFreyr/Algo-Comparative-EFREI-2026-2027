// Contrôles communs aux ateliers qui finissent sur une mesure et un ADR (ateliers 5 et suivants).
// Mêmes règles que le correcteur de l'atelier 4 : la mesure existe, échauffement réglé, sommes de contrôle
// concordantes ; l'ADR a ses six rubriques, cite sa mesure, donne son domaine de validité et trois phrases
// sans jargon ; la grille a ses poids et ses notes.
import { existsSync, readdirSync } from "node:fs";
import { chemin, ko, lancerNode, lireCsv, lireTexte, nombre, ok, protocole, resultats, rubriques, type Controle, type Resultat } from "./kit.js";

// Les mots qu'on n'emploie pas devant la directrice des opérations (slide "Trois phrases pour Nadia Ferreira").
export const INTERDITS = ["algorithme", "complexité", "quadratique", "O(n", "O(log", "boucle", "tableau", "indexOf", "cache", "référentiel",
  "index", "requête", "base de données", "variante", "benchmark", "performance", "harness", "map", "set", "médiane", "milliseconde", "ms",
  "dichotomie", "quickselect", "hachage", "file de priorité",
  "trigramme", "Levenshtein", "PostgreSQL", "postgres", "SQL", "pg_trgm", "matrice", "graphe", "noeud", "arête", "Dijkstra", "A*", "heuristique",
  "glouton", "programmation dynamique", "backtracking", "2-opt", "recuit", "permutation", "sac à dos", "optimum"];

function sansAccents(s: string): string { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
const nomCsv = (p: string) => p.split(/[\\/]/).pop() ?? p;

// Une mesure du harness sur un sujet : variantes attendues, nombre de tailles, échauffement minimal,
// taille minimale à atteindre, même somme de contrôle pour toutes les variantes à chaque taille.
export function mesure(sujet: string, variantes: string[], o: { tailles?: number; echauffement?: number; tailleMax?: number; requises?: number[] } = {}): Resultat {
  const motif = new RegExp(`-${sujet.replace(/[-]/g, "\\-")}\\.csv$`);
  const csvs = resultats(motif);
  if (csvs.length === 0) return ko(`aucun fichier bench/resultats/*-${sujet}.csv`);
  const raisons: string[] = [];
  for (const csv of csvs) {
    const p = protocole(csv);
    const { lignes } = lireCsv(csv);
    const v = new Set(lignes.map(l => l.variante));
    const tailles = [...new Set(lignes.map(l => nombre(l.taille)))];
    const manques: string[] = [];
    if (!variantes.every(x => v.has(x))) manques.push(`variantes ${[...v].join(",") || "aucune"}`);
    if (tailles.length < (o.tailles ?? 3)) manques.push(`${tailles.length} taille(s)`);
    if (o.tailleMax && Math.max(...tailles) < o.tailleMax) manques.push(`taille maximale ${Math.max(...tailles)}`);
    for (const t of o.requises ?? []) if (!tailles.includes(t)) manques.push(`pas de mesure à ${t}`);
    if (Number(p?.echauffement ?? -1) < (o.echauffement ?? 2)) manques.push(`échauffement ${p?.echauffement ?? "inconnu"}`);
    if (manques.length) { raisons.push(`${nomCsv(csv)} : ${manques.join(", ")}`); continue; }
    const parTaille = new Map<string, Set<string>>();
    for (const l of lignes) { if (!parTaille.has(l.taille)) parTaille.set(l.taille, new Set()); parTaille.get(l.taille)!.add(l.controle); }
    if ([...parTaille.values()].every(s => s.size === 1 && [...s][0] !== "")) return ok(nomCsv(csv));
    raisons.push(`${nomCsv(csv)} : la colonne controle est vide ou diffère entre variantes`);
  }
  return ko(raisons.slice(0, 2).join(" ; ") + (raisons.length > 2 ? ` (et ${raisons.length - 2} autre(s) fichier(s))` : ""));
}

export function courbe(sujets: string[]): Resultat {
  for (const s of sujets) if (resultats(new RegExp(`-${s.replace(/[-]/g, "\\-")}\\.svg$`)).length) return ok();
  return ko(`aucune courbe ${sujets.map(s => `*-${s}.svg`).join(" ni ")} dans bench/resultats`);
}

function fichierAdr(n: number): string | null {
  const d = chemin("adr");
  if (!existsSync(d)) return null;
  const nn = String(n).padStart(3, "0");
  const f = readdirSync(d).find(x => new RegExp(`^ADR-${nn}.*\\.md$`, "i").test(x));
  return f ? chemin("adr", f) : null;
}
function rubrique(r: Map<string, string>, k: number): string | undefined {
  for (const [titre, corps] of r) if (titre.startsWith(`${k}.`)) return corps;
  return undefined;
}

// Les quatre contrôles d'un ADR et de sa grille, numérotés comme dans la fiche atelier.
export function controlesAdr(n: number, fiche: number, sousObjectif: number): Controle[] {
  const nn = String(n).padStart(3, "0");
  const voir = `fiche atelier numéro ${fiche}, sous-objectif ${sousObjectif}`;
  return [
    {
      titre: `La grille comparative de l'ADR-${nn} est remplie`,
      verifie: `adr/GRILLE-ADR-${nn}.md : cinq poids dont la somme fait 10, puis une note de 1 à 5 par critère pour au moins trois options`,
      voir: `${voir}, et adr/grille-comparative.md`,
      test: () => {
        const p = chemin("adr", `GRILLE-ADR-${nn}.md`);
        if (!existsSync(p)) return ko(`adr/GRILLE-ADR-${nn}.md absent (copiez adr/grille-comparative.md)`);
        const lignes = lireTexte(p).split(/\r?\n/).filter(l => l.trim().startsWith("|"));
        const cellules = (l: string) => l.split("|").slice(1, -1).map(c => c.trim());
        const poids = ["Temps", "Mémoire", "Lisibilité", "Robustesse", "Coût"].map(c => {
          const l = lignes.find(x => cellules(x)[0]?.startsWith(c) && cellules(x).length === 3);
          return l ? nombre(cellules(l)[2]) : Number.NaN;
        });
        if (poids.some(Number.isNaN)) return ko("un poids n'est pas un nombre dans le tableau des critères");
        const somme = poids.reduce((s, x) => s + x, 0);
        if (somme !== 10) return ko(`la somme des poids vaut ${somme}`);
        const options = lignes.filter(l => { const c = cellules(l); return c.length >= 7 && c.slice(1, 6).every(x => /^[1-5]$/.test(x)); });
        return options.length >= 3 ? ok(`poids ${poids.join(", ")} ; ${options.length} options notées`) : ko(`${options.length} option(s) notée(s) de 1 à 5 sur les cinq critères`);
      },
    },
    {
      titre: `L'ADR-${nn} a ses six rubriques, remplies`,
      verifie: `adr/ADR-${nn}-*.md : les six titres du gabarit, et plus aucune phrase du gabarit dedans`,
      voir: `${voir}, et adr/ADR-000-gabarit.md`,
      test: () => {
        const f = fichierAdr(n);
        if (!f) return ko(`aucun fichier adr/ADR-${nn}-*.md`);
        const texte = lireTexte(f), r = rubriques(texte);
        const manques = [1, 2, 3, 4, 5, 6].filter(k => !rubrique(r, k) || rubrique(r, k)!.length < 40);
        if (manques.length) return ko(`rubrique(s) ${manques.join(", ")} absente(s) ou presque vide(s)`);
        const restes = ["Une phrase : l'option retenue", "Le ticket du jour, les volumes", "La même décision, sans un seul terme technique", "| A | ... ms"].filter(x => texte.includes(x));
        return restes.length ? ko(`texte du gabarit encore présent : "${restes[0]}"`) : ok();
      },
    },
    {
      titre: `La rubrique 3 de l'ADR-${nn} renvoie à une mesure qui existe, la rubrique 5 donne le domaine de validité`,
      verifie: "un chemin bench/resultats/... cité en rubrique 3 et présent sur le disque ; un nombre en rubrique 5",
      voir: `${voir}, et la slide "Jusqu'où tient votre décision ?" de la journée 2`,
      test: () => {
        const f = fichierAdr(n);
        if (!f) return ko(`aucun fichier adr/ADR-${nn}-*.md`);
        const r = rubriques(lireTexte(f));
        const cites = (rubrique(r, 3) ?? "").match(/bench[\\/]resultats[\\/][\w.:-]+\.(csv|svg)/g) ?? []; // \ sous Windows, / ailleurs
        if (!cites.some(c => existsSync(chemin(...c.split(/[\\/]/))))) return ko(cites.length ? `${cites[0]} cité mais absent du disque` : "aucun fichier de bench/resultats cité en rubrique 3");
        return /\d{2,}/.test(rubrique(r, 5) ?? "") ? ok() : ko("aucun nombre dans la rubrique 5");
      },
    },
    {
      titre: `Les trois phrases de l'ADR-${nn} tiennent sans jargon`,
      verifie: "la rubrique 6 : trois phrases, aucun mot de la liste de la slide \"Trois phrases pour Nadia Ferreira\", ni les noms des structures et des méthodes vues depuis (dichotomie, trigramme, Dijkstra...)",
      voir: `${voir}, et l'exemple du cours de la journée 2`,
      test: () => {
        const f = fichierAdr(n);
        if (!f) return ko(`aucun fichier adr/ADR-${nn}-*.md`);
        const corps = (rubrique(rubriques(lireTexte(f)), 6) ?? "").split(/\r?\n/).filter(l => !/^\s*>/.test(l)).join(" ");
        const phrases = corps.split(/(?<=[.!?]["»”]?)\s+/).map(s => s.trim()).filter(s => s.length > 3);
        const brut = sansAccents(corps);
        // Le mot ou son pluriel (requêtes, tableaux) ; tous les mots trouvés d'un coup, pas un par passage.
        const trouves = INTERDITS.filter(m => new RegExp(`(^|[^a-z])${sansAccents(m).replace(/[()*]/g, "\\$&")}(?:s|x)?([^a-z]|$)`, "i").test(brut));
        if (trouves.length) return ko(`${trouves.length > 1 ? "mots techniques trouvés" : "mot technique trouvé"} : ${trouves.map(m => `"${m}"`).join(", ")}`);
        return phrases.length === 3 ? ok() : ko(`${phrases.length} phrase(s) au lieu de trois`);
      },
    },
  ];
}

// Lance un fichier de tests précis ; rend le nom du premier test en échec, sans la sortie complète.
export function tests(fichier: string): Resultat {
  // Le format TAP, quelle que soit la version de Node : le correcteur lit "# fail" et "not ok".
  const r = lancerNode(["--test", "--test-reporter=tap", fichier], 300_000);
  const echecs = Number(r.sortie.match(/# fail (\d+)/)?.[1] ?? NaN);
  if (r.code === 0) return ok();
  const premier = r.sortie.match(/not ok \d+ - (.+)/)?.[1];
  return ko(Number.isNaN(echecs) ? "les tests ne se lancent pas" : `${echecs} test(s) en échec${premier ? ` : "${premier.trim()}"` : ""}`);
}
