// La qualité du chargement de la première vague des vélos cargo (atelier 12, ADR-009, ticket T-0655), sans chronomètre fin.
// Pour les 60 tournées du jeu : ce que met le legacy dans la première vague (premier arrivé, premier chargé), puis
// chaque variante (glouton, programmation dynamique, backtracking) : points d'urgence emportés, colis pharmacie dans
// la première vague, écart au meilleur, temps total. Les poids et volumes réels sont vérifiés : une vague qui
// dépasse 80 kg ou 450 l est signalée.
//
//   npm run cargo
//   npm run cargo -- --tournees 10 --variantes glouton,dynamique
//   npm run cargo -- --detail                          (une ligne par tournée et par variante, avec les poids réels)
//   npm run cargo -- --tournee L007 --detail           (les colis pris par chaque variante sur une tournée)
//   npm run cargo -- --tournee L007 --limite-noeuds 5000000   (arrêter le backtracking au bout de 5 millions de noeuds)
//   npm run cargo -- --points 10,5,1                   (le barème pharmacie,express,standard ; 10,3,1 par défaut)
//
// Résultats : bench/resultats/<horodatage>-cargo.csv (tournee, variante, points, pharmacie, poids_hg, volume_l, noeuds, duree_ms)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { chargerVehicule } from "../legacy/src/chargement.js";
import { lireOptions } from "../outils/options.js";
import { CHARGEMENT, POINTS, bilan, type ReponseChargement } from "./variantes/chargement.js";
import { preparerChargement, type TourneeCargoJeu } from "./sujets/chargement.js";

const options = lireOptions({ valeur: ["jeu", "tournees", "tournee", "variantes", "limite-noeuds", "points", "resultats"], drapeau: ["detail"] });
const nomJeu = options.lire("jeu", "moyenne");
const nomsVariantes = options.lire("variantes", "glouton,dynamique,backtracking").split(",");
const limiteNoeuds = Number(options.lire("limite-noeuds", "0")) || undefined;
const detail = options.present("detail");
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
for (const v of nomsVariantes) if (!CHARGEMENT[v]) { console.error(`variante inconnue : ${v} (${Object.keys(CHARGEMENT).join(", ")})`); process.exit(1); }
// Le barème : pharmacie, express, standard. Il s'applique à la ligne legacy comme aux trois variantes.
const pointsLus = options.lire("points", `${POINTS.pharmacie},${POINTS.express},${POINTS.standard}`).split(",").map(Number);
if (pointsLus.length !== 3 || pointsLus.some(x => !Number.isInteger(x) || x < 0)) { console.error(`--points attend trois entiers, pharmacie,express,standard (par exemple 10,3,1), pas "${options.lire("points", "")}"`); process.exit(1); }
const bareme = { pharmacie: pointsLus[0], express: pointsLus[1], standard: pointsLus[2] };

let toutes: TourneeCargoJeu[];
try { toutes = preparerChargement(dossier, bareme).tournees; } catch (e) { console.error((e as Error).message); process.exit(1); }
let tournees = toutes.slice(0, Number(options.lire("tournees", String(toutes.length))) || toutes.length);
if (options.present("tournee")) {
  const id = options.lire("tournee", "");
  tournees = toutes.filter(t => t.livreur === id);
  if (tournees.length === 0) { console.error(`aucune tournée de vélo cargo pour le livreur ${id} (${toutes[0]?.livreur} à ${toutes[toutes.length - 1]?.livreur})`); process.exit(1); }
}

const nombre = (x: number) => Math.round(x).toLocaleString("fr-FR").replace(/[  ]/g, " ");
const virgule = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const duree = (ms: number) => ms < 1000 ? `${ms.toFixed(0)} ms` : `${virgule(ms / 1000)} s`;
const pharmacie = (t: TourneeCargoJeu, pris: number[]) => pris.filter(i => t.tournee.colis[i].priorite === "pharmacie").length;
const totalPharmacie = tournees.reduce((s, t) => s + t.tournee.colis.filter(c => c.priorite === "pharmacie").length, 0);
const totalColis = tournees.reduce((s, t) => s + t.colis.length, 0);
// Les poids et volumes réels d'une liste de colis pris, et le dépassement s'il y en a.
function reel(t: TourneeCargoJeu, pris: number[]): { kg: number; l: number; depasse: string } {
  let kg = 0, l = 0;
  for (const i of pris) { kg += t.tournee.colis[i].poidsKg; l += t.tournee.colis[i].volumeL; }
  const capaKg = t.tournee.livreur.capaciteKg, capaL = t.tournee.livreur.capaciteL;
  const depasse = [kg > capaKg + 1e-9 ? `dépasse ${capaKg} kg` : "", l > capaL + 1e-9 ? `dépasse ${capaL} l` : ""].filter(Boolean).join(" et ");
  return { kg, l, depasse };
}

console.log(`[cargo] ${tournees.length} tournée${tournees.length > 1 ? "s" : ""} de vélo cargo (jeu ${nomJeu}), ${nombre(totalColis)} colis dont ${nombre(totalPharmacie)} pharmacie ; la première vague : ${tournees[0].capaciteHg / 10} kg et ${tournees[0].capaciteL} l ; points pharmacie ${bareme.pharmacie}, express ${bareme.express}, standard ${bareme.standard}${options.present("points") ? " (--points)" : ""}`);
console.log(`[cargo] poids arrondis au-dessus à l'hectogramme, volumes au litre : les variantes travaillent sur le même problème arrondi, les poids réels sont vérifiés ensuite`);

// Les réponses : par variante, une par tournée, avec sa durée. Le legacy d'abord : la première vague de chargerVehicule.
interface Ligne { reponse: ReponseChargement; ms: number }
const reponses = new Map<string, Ligne[]>();
reponses.set("legacy", tournees.map(t => {
  const t0 = performance.now();
  const vague = chargerVehicule(t.tournee).vagues[0];
  const pris = vague ? vague.colis.map((_, i) => i) : [];   // les premiers colis, dans l'ordre, jusqu'au débordement
  return { reponse: bilan(t, pris), ms: performance.now() - t0 };
}));
for (const v of nomsVariantes) {
  reponses.set(v, tournees.map(t => {
    const t0 = performance.now();
    const r = CHARGEMENT[v]({ tournees: [t], limiteNoeuds })[0];
    return { reponse: r, ms: performance.now() - t0 };
  }));
}
const noms = ["legacy", ...nomsVariantes];
const points = (v: string) => reponses.get(v)!.reduce((s, l) => s + l.reponse.points, 0);
const meilleurPoints = Math.max(...noms.map(points));
const parPriorite = (v: string, priorite: string) => reponses.get(v)!.reduce((s, l, k) => s + l.reponse.pris.filter(i => tournees[k].tournee.colis[i].priorite === priorite).length, 0);
const pharmaciePremiereVague = (v: string) => parPriorite(v, "pharmacie");
const colisPremiereVague = (v: string) => reponses.get(v)!.reduce((s, l) => s + l.reponse.pris.length, 0);
const totalExpress = tournees.reduce((s, t) => s + t.tournee.colis.filter(c => c.priorite === "express").length, 0);

console.log(`\n${"variante".padEnd(14)} ${"points".padStart(8)}   ${"colis en 1re vague".padEnd(18)} ${"pharmacie".padEnd(13)} ${"express".padEnd(13)} ${"écart au meilleur".padEnd(18)} ${"temps total".padStart(12)}`);
for (const v of noms) {
  const lignes = reponses.get(v)!;
  const p = points(v), ecart = p - meilleurPoints;
  const ecartTexte = ecart === 0 ? "meilleur" : `${nombre(ecart)} (${virgule(100 * ecart / meilleurPoints)} %)`;
  const ms = lignes.reduce((s, l) => s + l.ms, 0);
  const noeuds = lignes.reduce((s, l) => s + (l.reponse.noeuds ?? 0), 0);
  const arretes = lignes.filter(l => l.reponse.arrete).length;
  let supplement = v === "backtracking" ? `   (${nombre(noeuds)} noeuds visités${arretes ? ` ; arrêté à la limite de ${nombre(limiteNoeuds!)} noeuds sur ${arretes} tournée${arretes > 1 ? "s" : ""} : résultat partiel, pas l'optimum` : ""})` : "";
  const depassements = lignes.filter((l, k) => reel(tournees[k], l.reponse.pris).depasse).length;
  if (depassements) supplement += `   !! ${depassements} vague${depassements > 1 ? "s" : ""} dépasse${depassements > 1 ? "nt" : ""} la capacité réelle (voir --detail)`;
  console.log(`${v.padEnd(14)} ${nombre(p).padStart(8)}   ${`${nombre(colisPremiereVague(v))} sur ${nombre(totalColis)}`.padEnd(18)} ${`${nombre(pharmaciePremiereVague(v))} sur ${nombre(totalPharmacie)}`.padEnd(13)} ${`${nombre(parPriorite(v, "express"))} sur ${nombre(totalExpress)}`.padEnd(13)} ${ecartTexte.padEnd(18)} ${duree(ms).padStart(12)}${supplement}`);
}

const pharmacieLegacy = pharmaciePremiereVague("legacy");
console.log(`\n[cargo] avec le legacy, ${nombre(totalPharmacie - pharmacieLegacy)} colis pharmacie sur ${nombre(totalPharmacie)} ${totalPharmacie - pharmacieLegacy === 1 ? "part" : "partent"} dans une vague suivante (la dernière à 13h), et ${nombre(totalExpress - parPriorite("legacy", "express"))} colis express sur ${nombre(totalExpress)}`);
if (reponses.has("glouton")) {
  const meilleureVariante = noms.filter(v => v !== "legacy" && points(v) === meilleurPoints)[0];
  const laisses = meilleurPoints - points("glouton");
  const pharmacieLaissee = pharmaciePremiereVague(meilleureVariante) - pharmaciePremiereVague("glouton");
  console.log(`[cargo] le glouton laisse ${nombre(laisses)} point${laisses > 1 ? "s" : ""} sur le quai, soit ${nombre(pharmacieLaissee)} colis pharmacie`
    + (meilleureVariante === "glouton" ? " (aucune variante exacte n'a fait mieux ici)" : ` (par rapport à ${meilleureVariante === "dynamique" ? "la programmation dynamique" : "le backtracking"})`));
}

// Le détail : une ligne par tournée et par variante, avec les poids et volumes réels de la vague.
if (detail && !options.present("tournee")) {
  console.log(`\n${"tournée".padEnd(8)} ${"variante".padEnd(14)} ${"points".padStart(6)} ${"pharmacie".padStart(10)} ${"colis".padStart(6)} ${"poids réel".padStart(11)} ${"volume réel".padStart(12)}`);
  tournees.forEach((t, k) => {
    for (const v of noms) {
      const r = reponses.get(v)![k].reponse, x = reel(t, r.pris);
      console.log(`${t.livreur.padEnd(8)} ${v.padEnd(14)} ${String(r.points).padStart(6)} ${`${pharmacie(t, r.pris)}/${pharmacie(t, t.colis.map((_, i) => i))}`.padStart(10)} ${String(r.pris.length).padStart(6)} ${`${virgule(x.kg)} kg`.padStart(11)} ${`${virgule(x.l)} l`.padStart(12)}${x.depasse ? `   !! ${x.depasse}` : ""}`);
    }
  });
}
// Le détail d'une tournée : les colis pris par chaque variante.
if (detail && options.present("tournee")) {
  const t = tournees[0];
  console.log(`\n[cargo] tournée de ${t.livreur} : ${t.colis.length} colis, ${pharmacie(t, t.colis.map((_, i) => i))} pharmacie, ${t.tournee.colis.filter(c => c.priorite === "express").length} express`);
  for (const v of noms) {
    const r = reponses.get(v)![0].reponse, x = reel(t, r.pris);
    console.log(`\n  ${v} : ${r.pris.length} colis, ${r.points} points, ${virgule(x.kg)} kg (${r.poidsHg} hg arrondis), ${virgule(x.l)} l (${r.volumeL} l arrondis)${x.depasse ? `   !! ${x.depasse}` : ""}${r.noeuds !== undefined ? `, ${nombre(r.noeuds)} noeuds visités` : ""}${r.arrete ? " (arrêté à la limite)" : ""}`);
    for (const i of r.pris) {
      const c = t.tournee.colis[i], a = t.colis[i];
      console.log(`    ${c.id}  ${c.priorite.padEnd(9)} ${`${virgule(c.poidsKg, 2)} kg`.padStart(9)} -> ${String(a.poidsHg).padStart(3)} hg  ${`${virgule(c.volumeL)} l`.padStart(8)} -> ${String(a.volumeL).padStart(3)} l  ${String(a.points).padStart(2)} pts`);
    }
  }
  if (reponses.has("glouton")) {
    const exacte = noms.find(v => v !== "legacy" && v !== "glouton" && points(v) === meilleurPoints);
    if (exacte) {
      const g = new Set(reponses.get("glouton")![0].reponse.pris), e = new Set(reponses.get(exacte)![0].reponse.pris);
      const laisses = [...e].filter(i => !g.has(i)), prisALaPlace = [...g].filter(i => !e.has(i));
      if (laisses.length) console.log(`\n  le glouton laisse ${laisses.map(i => t.tournee.colis[i].id).join(", ")} et prend à la place ${prisALaPlace.map(i => t.tournee.colis[i].id).join(", ") || "rien"}`);
      else console.log(`\n  sur cette tournée, le glouton prend les mêmes colis que ${exacte === "dynamique" ? "la programmation dynamique" : "le backtracking"}`);
    }
  }
}

// Le CSV : une ligne par tournée et par variante.
const dossierResultats = resolve(options.lire("resultats", join("bench", "resultats")));
mkdirSync(dossierResultats, { recursive: true });
const fichier = join(dossierResultats, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-cargo.csv`);
const sortie = ["tournee;variante;points;pharmacie;poids_hg;volume_l;noeuds;duree_ms"];
tournees.forEach((t, k) => {
  for (const v of noms) {
    const { reponse: r, ms } = reponses.get(v)![k];
    sortie.push([t.livreur, v, r.points, pharmacie(t, r.pris), r.poidsHg, r.volumeL, r.noeuds ?? "", ms.toFixed(3)].join(";"));
  }
});
writeFileSync(fichier, sortie.join("\n") + "\n", "utf-8");
console.log(`\n[cargo] résultats : ${relative(process.cwd(), fichier)}`);
