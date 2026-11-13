// La tournée de Noël (atelier 11, ADR-008, ticket T-0531) : la qualité des trois façons d'ordonner 40 arrêts, sans
// chronomètre fin. Pour les 60 tournées de vélos cargo du jeu, sur la même matrice de distances par la route :
// l'ordre d'affectation du legacy, le plus proche voisin, le 2-opt, le recuit simulé ; kilomètres totaux, écart au
// meilleur, temps total ; puis ce que la flotte économise par jour.
//
//   npm run noel
//   npm run noel -- --tournees 10
//   npm run noel -- --arrets 9                    (les 9 premiers arrêts : l'optimum par force brute, l'écart de chaque variante)
//   npm run noel -- --tournee L007 --trace        (une tournée : les ordres, chaque échange du 2-opt, la courbe du recuit)
//   npm run noel -- --pas 200000                  (le budget de pas du recuit, 60 000 par défaut ; le refroidissement suit)
//
// Avec --trace, la dernière ligne est `[noel-trace] {...}`, un objet JSON que les animations du diaporama relisent :
//   livreur, arrets (k), points [{lat, lon}] (le hub en 0, puis les arrêts 1..k), matrice (k + 1) x (k + 1) en mètres,
//   ordres {legacy, voisin, deuxopt, recuit} (les arrêts 1..k dans l'ordre de visite), metres {legacy, voisin, deuxopt, recuit},
//   echanges [{i, j, gain, metres}] (chaque échange du 2-opt : positions dans la route, gain, longueur après),
//   courbe [{pas, T, metres, meilleur}] (le recuit tous les 500 pas : température, longueur courante, meilleure longueur).
// Résultats : bench/resultats/<horodatage>-noel.csv (tournee, variante, arrets, metres, iterations, duree_ms)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { lireOptions } from "../outils/options.js";
import { preparerTournees, sousTournee } from "./sujets/tournees.js";
import { RECUIT, TOURNEES, deuxOpt, forceBrute, longueur, plusProcheVoisin, recuitAvec, recuitSimule, type Echange, type PasRecuit, type TourneeNoel, type Tournees } from "./variantes/tournees.js";

const options = lireOptions({ valeur: ["jeu", "tournees", "tournee", "arrets", "variantes", "pas", "resultats"], drapeau: ["trace"] });
const nomJeu = options.lire("jeu", "moyenne");
const nomsVariantes = options.lire("variantes", "voisin,deuxopt,recuit").split(",");
const trace = options.present("trace");
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
for (const v of nomsVariantes) if (!TOURNEES[v]) { console.error(`variante inconnue : ${v} (${Object.keys(TOURNEES).join(", ")})`); process.exit(1); }
// Le budget de pas du recuit (--pas). Le refroidissement suit le budget : la température finit au même point (0,25 m)
// quel que soit le nombre de pas, sinon un budget plus grand n'ajouterait que des pas à température nulle.
const pas = Number(options.lire("pas", String(RECUIT.pas)));
if (!Number.isInteger(pas) || pas < 1) { console.error(`--pas attend un entier positif, pas "${options.lire("pas", "")}"`); process.exit(1); }
const temperatureFinale = RECUIT.temperature * Math.pow(RECUIT.refroidissement, RECUIT.pas);
const refroidissement = pas === RECUIT.pas ? RECUIT.refroidissement : Number(Math.pow(temperatureFinale / RECUIT.temperature, 1 / pas).toFixed(7));
const reglages = { ...RECUIT, pas, refroidissement };
const variantes: Record<string, Tournees> = { ...TOURNEES, recuit: recuitAvec(reglages) };

let toutes: TourneeNoel[];
try { toutes = preparerTournees(dossier).tournees; } catch (e) { console.error((e as Error).message); process.exit(1); }
let tournees = toutes.slice(0, Number(options.lire("tournees", String(toutes.length))) || toutes.length);
if (options.present("tournee")) {
  const id = options.lire("tournee", "");
  tournees = toutes.filter(t => t.livreur === id);
  if (tournees.length === 0) { console.error(`aucune tournée de vélo cargo pour le livreur ${id} (${toutes[0]?.livreur} à ${toutes[toutes.length - 1]?.livreur})`); process.exit(1); }
}
const arrets = Number(options.lire("arrets", "0")) || 0;
if (arrets) tournees = tournees.map(t => sousTournee(t, arrets));
const k = Math.max(...tournees.map(t => t.arrets.length));

const nombre = (x: number) => Math.round(x).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const virgule = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const km = (m: number) => (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/[\u00a0\u202f]/g, " ");
const duree = (ms: number) => ms < 1000 ? `${ms.toFixed(0)} ms` : `${virgule(ms / 1000)} s`;
const ordreLegacy = (t: TourneeNoel) => t.arrets.map((_, i) => i + 1);

interface Ligne { ordre: number[]; metres: number; iterations: number; ms: number }
const reponses = new Map<string, Ligne[]>();
reponses.set("legacy", tournees.map(t => { const o = ordreLegacy(t); return { ordre: o, metres: longueur(t.d, o), iterations: 0, ms: 0 }; }));
for (const v of nomsVariantes) {
  try {
    reponses.set(v, tournees.map(t => {
      const t0 = performance.now();
      const r = variantes[v]({ tournees: [t] })[0];
      return { ...r, ms: performance.now() - t0 };
    }));
  } catch (e) {
    // Les garde-fous du 2-opt (bench/variantes/tournees.ts) : leur message suffit, sans la pile d'appels.
    if (!(e instanceof Error) || !e.message.startsWith("le 2-opt")) throw e;
    console.error(`ARRÊT, variante ${v} : ${e.message}\n  Voir le commentaire À COMPLÉTER (atelier 11) de bench/variantes/tournees.ts et la fiche atelier numéro 11, sous-objectif 2 ; puis npm test.`);
    process.exit(1);
  }
}
const noms = ["legacy", ...nomsVariantes];
const total = (v: string) => reponses.get(v)!.reduce((s, l) => s + l.metres, 0);

console.log(`[noel] ${tournees.length} tournée${tournees.length > 1 ? "s" : ""} de vélo cargo à ${k} arrêts (jeu ${nomJeu}), distances par la route, retour au hub compris`);
if (nomsVariantes.includes("recuit")) console.log(`[noel] recuit : ${nombre(pas)} pas${options.present("pas") ? " (--pas)" : ""}, température de départ ${nombre(reglages.temperature)} m, x ${String(reglages.refroidissement).replace(".", ",")} par pas${pas === RECUIT.pas ? "" : " (ajusté au budget : même température finale)"}, graine ${reglages.graine}`);

if (arrets) {
  // L'écart à l'optimum, tournée par tournée, pour chaque variante.
  if (k > 11) { console.error(`--arrets ${k} : la force brute ne tient pas au-delà de 11 arrêts (npm run voyageur)`); process.exit(1); }
  const t0 = performance.now();
  const optimums = tournees.map(t => forceBrute(t.d));
  const ordres = optimums.reduce((s, o) => s + o.ordres, 0);
  const factorielle = Array.from({ length: k }, (_, i) => i + 1).reduce((f, x) => f * x, 1);
  console.log(`[noel] l'optimum par force brute (${k}! = ${nombre(factorielle)} ordres par tournée ; avec la coupure, ${nombre(ordres)} ordres complets essayés) en ${duree(performance.now() - t0)}, puis l'écart de chaque variante`);
  reponses.set("optimum", optimums.map(o => ({ ordre: o.ordre, metres: o.metres, iterations: o.ordres, ms: 0 })));
  for (const v of noms) {
    const lignes = reponses.get(v)!;
    const ecarts = lignes.map((l, i) => 100 * (l.metres - optimums[i].metres) / optimums[i].metres);
    const trouves = lignes.filter((l, i) => l.metres === optimums[i].metres).length;
    const moyenne = ecarts.reduce((s, x) => s + x, 0) / ecarts.length, pire = Math.max(...ecarts);
    console.log(`  ${v.padEnd(8)} : +${virgule(moyenne)} % en moyenne, optimum trouvé ${trouves} fois sur ${tournees.length}${pire > 0 ? ` (au pire +${virgule(pire)} %)` : ""}`);
  }
} else {
  const meilleur = Math.min(...noms.map(total));
  console.log(`\n${"variante".padEnd(10)} ${"km totaux".padStart(10)}   ${"écart au meilleur".padEnd(18)} ${"temps total".padStart(12)}`);
  for (const v of noms) {
    const lignes = reponses.get(v)!, m = total(v);
    const ecart = m === meilleur ? "meilleur" : `+${virgule(100 * (m - meilleur) / meilleur)} %`;
    const ms = lignes.reduce((s, l) => s + l.ms, 0);
    console.log(`${v.padEnd(10)} ${km(m).padStart(10)}   ${ecart.padEnd(18)} ${(v === "legacy" ? "-" : duree(ms)).padStart(12)}${v === "deuxopt" ? `   (${nombre(lignes.reduce((s, l) => s + l.iterations, 0))} échanges)` : ""}`);
  }
  const legacy = total("legacy");
  const gain = (v: string) => `${nombre((legacy - total(v)) / 1000)} km`;
  if (tournees.length > 1 && reponses.has("deuxopt")) {
    console.log(`\n[noel] sur la flotte, ${tournees.length} tournées : ${gain("deuxopt")} de moins par jour que l'ordre d'affectation avec le 2-opt`
      + (reponses.has("recuit") ? ` (${gain("recuit")} avec le recuit)` : "")
      + ` ; ${km(legacy / tournees.length)} km par tournée dans l'ordre d'affectation, ${km(total("deuxopt") / tournees.length)} km avec le 2-opt`);
  }
  // La question du cours 10 : le recuit bat-il le 2-opt ? Tournée par tournée, pas seulement sur le total.
  if (tournees.length > 1 && reponses.has("deuxopt") && reponses.has("recuit")) {
    const a = reponses.get("deuxopt")!, b = reponses.get("recuit")!;
    const compte = (f: (x: number, y: number) => boolean) => a.filter((l, i) => f(b[i].metres, l.metres)).length;
    console.log(`[noel] le recuit contre le 2-opt, tournée par tournée : plus court ${compte((x, y) => x < y)} fois, plus long ${compte((x, y) => x > y)} fois, égal ${compte((x, y) => x === y)} fois sur ${tournees.length}`);
  }
}

// La trace d'une tournée : les ordres, chaque échange du 2-opt, la courbe du recuit, puis la ligne JSON.
if (trace) {
  if (tournees.length !== 1) console.log(`\n[noel] --trace ne détaille qu'une tournée : la première, ${tournees[0].livreur} (donnez --tournee)`);
  const t = tournees[0], depart = plusProcheVoisin(t.d);
  const echanges: Echange[] = [], courbe: PasRecuit[] = [];
  const o = deuxOpt(t.d, depart, e => echanges.push(e));
  const r = recuitSimule(t.d, depart, p => courbe.push(p), 500, reglages);
  const ordres: Record<string, number[]> = { legacy: ordreLegacy(t), voisin: depart, deuxopt: o.ordre, recuit: r.ordre };
  const metres: Record<string, number> = Object.fromEntries(Object.entries(ordres).map(([n, x]) => [n, longueur(t.d, x)]));
  console.log(`\n[noel] tournée de ${t.livreur}, ${t.arrets.length} arrêts (hub = 0)`);
  for (const n of Object.keys(ordres)) console.log(`  ${n.padEnd(8)} ${km(metres[n]).padStart(7)} km : 0 ${ordres[n].join(" ")} 0`);
  console.log(`\n[noel] le 2-opt depuis le plus proche voisin : ${echanges.length} échanges (i, j : positions dans la route ; gain en mètres ; longueur après)`);
  for (const e of echanges) console.log(`  échange ${String(e.i).padStart(2)} ${String(e.j).padStart(2)}  gain ${nombre(e.gain).padStart(6)} m  -> ${km(e.metres)} km`);
  console.log(`\n[noel] le recuit, tous les 5 000 pas (température en mètres ; longueur courante ; meilleure)`);
  for (const p of courbe) if (p.pas % 5000 === 0) console.log(`  pas ${nombre(p.pas).padStart(6)}  T ${virgule(p.temperature).padStart(8)} m  ${km(p.metres).padStart(7)} km  meilleur ${km(p.meilleur)} km`);
  const json = { livreur: t.livreur, arrets: t.arrets.length, points: t.lat.map((lat, i) => ({ lat, lon: t.lon[i] })), matrice: t.d, ordres, metres, echanges, courbe: courbe.map(p => ({ pas: p.pas, T: Number(p.temperature.toFixed(3)), metres: p.metres, meilleur: p.meilleur })) };
  console.log(`\n[noel-trace] ${JSON.stringify(json)}`);
}

// Le CSV : une ligne par tournée et par variante (legacy et optimum compris).
const dossierResultats = resolve(options.lire("resultats", join("bench", "resultats")));
mkdirSync(dossierResultats, { recursive: true });
const fichier = join(dossierResultats, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-noel.csv`);
const sortie = ["tournee;variante;arrets;metres;iterations;duree_ms"];
tournees.forEach((t, i) => {
  for (const v of reponses.keys()) { const l = reponses.get(v)![i]; sortie.push([t.livreur, v, t.arrets.length, l.metres, l.iterations, l.ms.toFixed(3)].join(";")); }
});
writeFileSync(fichier, sortie.join("\n") + "\n", "utf-8");
console.log(`\n[noel] résultats : ${relative(process.cwd(), fichier)}`);
