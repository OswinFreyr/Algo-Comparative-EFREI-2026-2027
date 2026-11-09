// Le harness : le banc de mesure de la cellule performance.
// Il lance les variantes d'un même sujet sur des lots de tailles croissantes, répète les mesures
// et exporte les résultats. Il sert à chaque atelier jusqu'au projet.
//
//   npm run bench
//   npm run bench -- --sujet affectation --jeu moyenne --tailles 1000,2000,5000,10000 --variantes naive,tri,map --repetitions 5 --echauffement 200
//   npm run bench -- --liste            (les sujets disponibles et leurs variantes)
//
// Un sujet (bench/sujets/<sujet>.ts) dit quoi mesurer ; le harness dit comment mesurer.
// Résultats : bench/resultats/<horodatage>-<sujet>.csv, une ligne par mesure,
// et bench/resultats/<horodatage>-<sujet>.json, le protocole (machine, jeu, répétitions, échauffement).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { cpus, totalmem, type as typeOs, release } from "node:os";
import { join, relative, resolve } from "node:path";
import { lireOptions } from "../outils/options.js";
import type { Sujet } from "./sujets/types.js";

const options = lireOptions({
  valeur: ["sujet", "jeu", "tailles", "variantes", "repetitions", "echauffement", "chauffe-max", "resultats"],
  drapeau: ["liste"],
});

const dossierSujets = resolve("bench", "sujets");
if (options.present("liste")) {
  for (const f of readdirSync(dossierSujets).filter(f => f.endsWith(".ts") && f !== "types.ts").sort()) {
    const s: Sujet = (await import(`./sujets/${f.replace(/\.ts$/, ".js")}`)).default;
    console.log(`${s.nom.padEnd(14)} ${s.titre}`);
    console.log(`${"".padEnd(14)} variantes : ${Object.keys(s.variantes).join(", ")} ; par défaut --jeu ${s.parDefaut.jeu} --tailles ${s.parDefaut.tailles.join(",")}`);
  }
  process.exit(0);
}

const nomSujet = options.lire("sujet", "affectation");
if (!existsSync(join(dossierSujets, `${nomSujet}.ts`))) {
  console.error(`sujet inconnu : ${nomSujet} (npm run bench -- --liste pour voir les sujets)`);
  process.exit(1);
}
const sujet: Sujet = (await import(`./sujets/${nomSujet}.js`)).default;

const nomJeu = options.lire("jeu", sujet.parDefaut.jeu);
const tailles = options.lire("tailles", sujet.parDefaut.tailles.join(",")).split(",").map(Number);
const nomsVariantes = options.lire("variantes", sujet.parDefaut.variantes.join(",")).split(",");
const repetitions = Number(options.lire("repetitions", "1"));
const echauffement = Number(options.lire("echauffement", "0"));
// La chauffe d'une variante, à une taille, s'arrête après `echauffement` tours ou après `chauffeMax` millisecondes.
const chauffeMax = Number(options.lire("chauffe-max", "5000"));
const dossierResultats = resolve(options.lire("resultats", join("bench", "resultats")));
if (tailles.some(t => !Number.isInteger(t) || t < 1)) { console.error("--tailles attend des entiers positifs séparés par des virgules"); process.exit(1); }
if (!Number.isInteger(repetitions) || repetitions < 1) { console.error("--repetitions attend un entier positif"); process.exit(1); }
if (!Number.isInteger(echauffement) || echauffement < 0) { console.error("--echauffement attend un entier positif ou nul"); process.exit(1); }
if (!Number.isInteger(chauffeMax) || chauffeMax < 1) { console.error("--chauffe-max attend un nombre de millisecondes, entier positif"); process.exit(1); }
for (const nom of nomsVariantes) {
  if (!sujet.variantes[nom]) { console.error(`variante inconnue pour ${sujet.nom} : ${nom} (${Object.keys(sujet.variantes).join(", ")})`); process.exit(1); }
}

const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
let donnees: unknown;
try { donnees = await sujet.charger(dossier); } catch (e) { console.error((e as Error).message); process.exit(1); }
if (Math.max(...tailles) > sujet.tailleMax(donnees)) { console.error(`le jeu ${nomJeu} ne permet pas une taille de ${Math.max(...tailles)} (au plus ${sujet.tailleMax(donnees)})`); process.exit(1); }

const machine = {
  processeur: cpus()[0]?.model.trim() ?? "inconnu", coeurs: cpus().length,
  memoire_go: Math.round(totalmem() / 1024 ** 3), systeme: `${typeOs()} ${release()}`, node: process.version,
};
console.log(`[harness] sujet=${sujet.nom} jeu=${nomJeu} tailles=${tailles.join(",")} variantes=${nomsVariantes.join(",")} repetitions=${repetitions} echauffement=${echauffement}`);
console.log(`[harness] node=${machine.node} processeur="${machine.processeur}" memoire=${machine.memoire_go}Go systeme="${machine.systeme}"`);

interface Mesure { variante: string; taille: number; repetition: number; dureeMs: number; memoireKo: number; controle: string; }
const mesures: Mesure[] = [];
let puits = 0; // dépend de chaque résultat : le compilateur ne peut pas supprimer un calcul dont il dépend
const premierControle = new Map<number, { variante: string; controle: string }>();

mesure: for (const nom of nomsVariantes) {
  const fn = sujet.variantes[nom];
  for (const taille of tailles) {
    const entree = await sujet.preparer(donnees, taille, nom);

    // À COMPLÉTER 1 : l'échauffement. Exécuter fn(entree) `echauffement` fois sans rien noter, pour que le
    // compilateur à la volée ait fait son travail avant la première mesure. Arrêter la chauffe plus tôt si elle
    // dure déjà depuis `chauffeMax` millisecondes (5 secondes par défaut) : une variante qui dure des secondes
    // est compilée dès ses premiers appels, la chauffer deux cents fois ne coûterait que du temps.
    // Une variante peut rendre une promesse (une requête à une base, atelier 8) : attendez-la avec await,
    // comme l'appel mesuré plus bas.
    const debutChauffe = performance.now();
    for (let i = 0; i < echauffement; i++) {
      if (performance.now() - debutChauffe >= chauffeMax) break;
      puits += String(await fn(entree)).length & 1;
    }

    for (let r = 1; r <= repetitions; r++) {
      // À COMPLÉTER 2 : la mémoire. Forcer un passage du garbage collector (global.gc, le script npm "bench"
      // lance Node avec --expose-gc), relever process.memoryUsage().heapUsed avant l'appel, puis juste après,
      // et noter la différence en Ko.
      global.gc?.();
      const memoireAvant = process.memoryUsage().heapUsed;
      const debut = performance.now();
      const resultat = await fn(entree);
      const dureeMs = performance.now() - debut;
      const memoireKo = Math.round((process.memoryUsage().heapUsed - memoireAvant) / 1024);

      // À COMPLÉTER 3 : consommer le résultat. Un résultat que personne ne lit peut être supprimé par le
      // compilateur. La somme de contrôle sujet.controle(resultat) le lit, et sert à vérifier que les
      // variantes donnent toutes le même résultat. Faites aussi dépendre `puits` (un nombre) de cette somme
      // (une chaîne) : le code d'un de ses caractères suffit.
      const somme = sujet.controle(resultat);
      puits += somme.charCodeAt(0) || 0;

      mesures.push({ variante: nom, taille, repetition: r, dureeMs, memoireKo, controle: somme });
      console.log(`[harness] variante=${nom} taille=${taille} repetition=${r} duree_ms=${dureeMs.toFixed(2)} memoire_ko=${memoireKo} controle=${somme}`);

      // Deux variantes correctes donnent le même résultat : sinon on compare deux programmes différents.
      const premier = premierControle.get(taille);
      if (!premier) premierControle.set(taille, { variante: nom, controle: somme });
      else if (premier.controle !== somme) {
        console.error(`[harness] ARRÊT : à la taille ${taille}, ${nom} donne ${somme} et ${premier.variante} donnait ${premier.controle}.`);
        console.error(`[harness] Les deux variantes ne font pas la même chose : la mesure s'arrête là.`);
        process.exitCode = 2;
        break mesure;
      }
    }
  }
}

// Résumé : une valeur par variante et par taille.
// À COMPLÉTER 4 : remplacer la moyenne par la médiane. La moyenne est tirée par la mesure la plus lente,
// la médiane ne l'est pas.
function resume(valeurs: number[]): number {
  if (valeurs.length === 0) return Number.NaN;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 1 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

console.log("\nvariante        taille   duree_ms   memoire_ko");
for (const nom of nomsVariantes) {
  for (const taille of tailles) {
    const m = mesures.filter(x => x.variante === nom && x.taille === taille);
    if (m.length === 0) continue;
    console.log(`${nom.padEnd(14)} ${String(taille).padStart(7)} ${resume(m.map(x => x.dureeMs)).toFixed(2).padStart(10)} ${resume(m.map(x => x.memoireKo)).toFixed(0).padStart(12)}`);
  }
}

mkdirSync(dossierResultats, { recursive: true });
const horodatage = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const fichierCsv = join(dossierResultats, `${horodatage}-${sujet.nom}.csv`);

// À COMPLÉTER 5 : l'export. Écrire les mesures dans `fichierCsv` (déclaré juste au-dessus), une ligne par mesure,
// avec l'en-tête variante;taille;repetition;duree_ms;memoire_ko;controle. Sans le CSV, la mesure n'existe pas.
writeFileSync(fichierCsv, ["variante;taille;repetition;duree_ms;memoire_ko;controle",
  ...mesures.map(m => `${m.variante};${m.taille};${m.repetition};${m.dureeMs.toFixed(3)};${m.memoireKo};${m.controle}`)].join("\n") + "\n", "utf-8");

// Le protocole de la mesure, à côté du CSV : la rubrique 3 de l'ADR se recopie d'ici.
const protocole = { sujet: sujet.nom, jeu: nomJeu, tailles, variantes: nomsVariantes, repetitions, echauffement, chauffe_max_ms: chauffeMax, statistique: "médiane", machine, date: new Date().toISOString(), csv: relative(process.cwd(), fichierCsv) };
writeFileSync(fichierCsv.replace(/\.csv$/, ".json"), JSON.stringify(protocole, null, 2) + "\n", "utf-8");
if (existsSync(fichierCsv)) console.log(`\n[harness] resultats : ${relative(process.cwd(), fichierCsv)} (protocole : ${relative(process.cwd(), fichierCsv.replace(/\.csv$/, ".json"))})`);
else console.log(`\n[harness] aucun CSV écrit : sans le CSV, la mesure n'existe pas (À COMPLÉTER 5)`);
void puits;
