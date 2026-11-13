// La nuit du 24 septembre rejouée (journée 5). Le batch de nuit a fini à 10h10 au lieu de 02h00 (pièce 04).
// On le rejoue sur le jeu moyenne, deux fois : le legacy tel qu'il tourne (legacy/src), puis le batch de la cellule
// performance avec les décisions des journées 2 à 5 :
//   étape 1  l'index de trigrammes en mémoire (ADR-005, bench/variantes/adresses.ts) à la place de la force brute ;
//   étape 2  l'affectation avec la Map (ADR-001, bench/variantes/affectation.ts) ;
//   étape 3  la matrice des distances par la route calculée une fois par tournée (Dijkstra avec tas, ADR-007), puis
//            le 2-opt (ADR-008, bench/variantes/tournees.ts) à la place de l'ordre d'affectation ;
//   étape 4  la programmation dynamique pour la première vague des vélos cargo (ADR-009, bench/variantes/chargement.ts),
//            puis premier arrivé, premier chargé pour les vagues suivantes et pour les utilitaires.
//
//   npm run nuit
//   npm run nuit -- --etapes affectation,tournees,chargement     (sans l'étape 1 : ni référentiel ni PGlite nécessaires)
//   npm run nuit -- --limite-adresses 20 --referentiel gironde    (le legacy sur 20 colis, contre la Gironde entière)
//
// Le legacy ne rapproche que --limite-adresses colis (30 par défaut, comme npm run batch) : plusieurs secondes par
// colis. Sa ligne dit ce que donneraient les 6 412 colis du 24 septembre au même rythme : une extrapolation, dite
// comme telle. Les durées de la colonne "24 septembre" sont celles de la pièce 04, et seulement elles.
// Le réseau routier (data/referentiel/graphe) est nécessaire à l'étape 3.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireColis, lireHubs, lireLivreurs, lireReferentiel } from "../legacy/src/csv.js";
import type { Colis, Tournee } from "../legacy/src/modeles.js";
import { ETAPES, executerEtape, type Etape, type Jeu } from "../legacy/src/batch.js";
import { chargerVehicule } from "../legacy/src/chargement.js";
import { distanceKm } from "../legacy/src/geo.js";
import { lireOptions } from "../outils/options.js";
import { IndexTrigrammes } from "./variantes/adresses.js";
import { map as affecterMap } from "./variantes/affectation.js";
import { CHARGEMENT, tourneeCargo } from "./variantes/chargement.js";
import { distancesDepuis, type Reseau } from "./variantes/chemins.js";
import { deuxOpt, longueur, plusProcheVoisin } from "./variantes/tournees.js";
import { lireGraphe, voisinage, type Graphe, type Mode } from "./graphe/graphe.js";
import { accrocheDuMode, verifierDijkstraTasJ5 } from "./sujets/tournees.js";
import type { Accroche } from "./graphe/graphe.js";

// La chronologie et l'extrait des logs de la pièce 04 (post mortem du jeudi 24 septembre 2026). Les textes sont ceux de
// la chronologie (« fin de l'étape 1 (rapprochement d'adresses) : 6 h 35 », « 2 h 15 », « 42 minutes », « 9 h 40 ») ; les
// secondes sont celles des logs (duree=23739, 8077, 2535, 456 ; batch fin duree=34807), elles servent aux calculs.
// Le chargement n'a pas de durée dans la chronologie : 10h02:33 -> 10h10:09, les logs disent 456 s, soit 7 min 36 s.
const SEPTEMBRE: Record<Etape, { secondes: number; texte: string }> = {
  adresses: { secondes: 23739, texte: "6 h 35" }, affectation: { secondes: 8077, texte: "2 h 15" },
  tournees: { secondes: 2535, texte: "42 min" }, chargement: { secondes: 456, texte: "7 min 36 s" },
};
const SEPTEMBRE_TOTAL = { secondes: 34807, texte: "9 h 40" }, SEPTEMBRE_COLIS = 6412, SEPTEMBRE_DEPART = "0h30", SEPTEMBRE_FIN = "10h10";

const options = lireOptions({ valeur: ["jeu", "etapes", "limite-adresses", "referentiel"] });
const nomJeu = options.lire("jeu", "moyenne");
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
const etapes = options.lire("etapes", ETAPES.join(",")).split(",") as Etape[];
for (const e of etapes) if (!ETAPES.includes(e)) { console.error(`étape inconnue : ${e} (${ETAPES.join(", ")})`); process.exit(1); }
const limiteAdresses = Number(options.lire("limite-adresses", "30")) || 30;
const nomReferentiel = options.lire("referentiel", "metropole");
if (!existsSync(join(dossier, "colis.csv"))) { console.error(`jeu introuvable : ${dossier} (npm run data -- --echelle moyenne)`); process.exit(1); }

const virgule = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const nombre = (x: number) => Math.round(x).toLocaleString("fr-FR").replace(/[  ]/g, " ");
// Une durée lisible : 120 ms ; 12,3 s ; 2 min 05 s ; 6 h 35 min.
function duree(s: number): string {
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  if (s < 60) return `${virgule(s)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
}
// L'heure de fin d'un batch parti à 0h30, après `s` secondes.
function heureFin(s: number): string {
  const minutes = 30 + Math.round(s / 60);
  return `${Math.floor(minutes / 60) % 24}h${String(minutes % 60).padStart(2, "0")}`;
}

// ---------- la préparation, hors batch : le jeu, le référentiel, le réseau routier ----------
const t0 = performance.now();
const colis = lireColis(join(dossier, "colis.csv")), livreurs = lireLivreurs(join(dossier, "livreurs.csv")), hubs = lireHubs(join(dossier, "hubs.csv"));
let referentiel = null;
if (etapes.includes("adresses")) {
  const f = resolve("data", "referentiel", `adresses-${nomReferentiel}.csv`);
  if (!existsSync(f)) { console.error(`référentiel absent : ${f} (npm run ban) ; ou bien --etapes affectation,tournees,chargement pour sauter l'étape 1`); process.exit(1); }
  referentiel = lireReferentiel(f);
}
let g: Graphe | null = null, accroches: Record<Mode, Accroche> | null = null, reseaux: Record<Mode, Reseau> | null = null;
if (etapes.includes("tournees")) {
  try { g = lireGraphe(); } catch (e) { console.error(`${(e as Error).message}\nle réseau routier est nécessaire à l'étape 3 : la nuit ne se rejoue pas sans lui`); process.exit(1); }
  // Les distances de l'étape 3 sont celles de dijkstraTas (atelier 10) : s'il n'est pas juste, on s'arrête avant de mesurer.
  try { verifierDijkstraTasJ5(); } catch (e) { console.error((e as Error).message); process.exit(1); }
  reseaux = { velo: { v: voisinage(g, "velo"), lat: g.lat, lon: g.lon }, utilitaire: { v: voisinage(g, "utilitaire"), lat: g.lat, lon: g.lon } };
  // Chaque arrêt s'accroche à un carrefour que le véhicule peut atteindre et quitter (bench/sujets/tournees.ts).
  accroches = { velo: accrocheDuMode(g, reseaux.velo.v), utilitaire: accrocheDuMode(g, reseaux.utilitaire.v) };
}
const jeu: Jeu = { nom: nomJeu, colis, livreurs, hubs, referentiel };
console.log(`[nuit] la nuit du 24 septembre rejouée sur le jeu ${nomJeu} : ${nombre(colis.length)} colis, ${livreurs.length} livreurs ; le 24 septembre : ${nombre(SEPTEMBRE_COLIS)} colis, départ ${SEPTEMBRE_DEPART}, fin ${SEPTEMBRE_FIN}`);
console.log(`[nuit] préparation hors batch (${virgule((performance.now() - t0) / 1000)} s) : le jeu${referentiel ? `, le référentiel ${nomReferentiel} (${nombre(referentiel.length)} adresses)` : ""}${g ? `, le réseau routier (${nombre(g.n)} carrefours)` : ""}`);
if (!etapes.includes("adresses")) console.log(`[nuit] l'étape 1 (adresses) n'est pas rejouée (--etapes)`);

interface Mesure { secondes: number; detail: string; extrapole?: number }
const legacy = new Map<Etape, Mesure>(), cellule = new Map<Etape, Mesure>();

// ---------- le legacy, tel qu'il tourne ----------
console.log(`\n[nuit] 1. le legacy (legacy/src), étape par étape`);
for (const e of etapes) {
  if (e === "adresses") console.log(`[nuit] legacy, étape 1 : ${limiteAdresses} colis seulement contre les ${nombre(referentiel!.length)} adresses (plusieurs secondes par colis)…`);
  const m = executerEtape(e, jeu, { limiteAdresses });
  const s = m.dureeMs / 1000;
  const mesure: Mesure = { secondes: s, detail: Object.entries(m.details).map(([k, v]) => `${k}=${typeof v === "number" ? Number(v.toFixed(1)) : v}`).join(" ") };
  if (e === "adresses") mesure.extrapole = s / limiteAdresses * colis.length;
  legacy.set(e, mesure);
  console.log(`[nuit] legacy, étape ${ETAPES.indexOf(e) + 1} ${e} : ${duree(s)}  (${mesure.detail})`);
}

// ---------- la cellule performance : les décisions des journées 2 à 5 ----------
console.log(`\n[nuit] 2. le batch de la cellule performance, les décisions des journées 2 à 5`);
let tournees: Tournee[] = [];
for (const e of etapes) {
  const debut = performance.now();
  let detail = "";
  if (e === "adresses") {
    const tc = performance.now();
    const index = new IndexTrigrammes(referentiel!);
    const construction = (performance.now() - tc) / 1000;
    let trouves = 0;
    for (const c of colis) if (index.chercher(c.adresseSaisie)) trouves++;
    detail = `colis=${colis.length} trouves=${trouves} construction_index=${virgule(construction)} s`;
  } else if (e === "affectation") {
    const r = affecterMap(colis, livreurs, hubs);
    tournees = r.tournees;
    detail = `tournees=${r.tournees.length} affectes=${r.tournees.reduce((s, t) => s + t.colis.length, 0)} doublons=${r.doublonsIgnores}`;
  } else if (e === "tournees") {
    if (tournees.length === 0) tournees = affecterMap(colis, livreurs, hubs).tournees;
    let dijkstra = 0, arrets = 0, kmDeuxOpt = 0, kmAffectation = 0, estimees = 0, echanges = 0;
    for (const t of tournees) {
      if (t.colis.length < 2) continue;
      const mode: Mode = t.livreur.vehicule === "velo_cargo" ? "velo" : "utilitaire";
      // Les arrêts : un par carrefour distinct, dans l'ordre d'affectation, hub en tête.
      const accroche = accroches![mode];
      const points = [accroche.proche(t.hub.lat, t.hub.lon)];
      const dejaVu = new Set(points);
      for (const c of t.colis) { const x = accroche.proche(c.lat, c.lon); if (!dejaVu.has(x)) { dejaVu.add(x); points.push(x); } }
      // La matrice par la route, une fois : un Dijkstra par point ; symétrique (moyenne de l'aller et du retour).
      // Deux carrefours qui ne se joignent pas sur ce réseau : la distance à vol d'oiseau x 1,3 du legacy, comptée.
      const brut = points.map(p => { dijkstra++; return distancesDepuis(reseaux![mode], p, points); });
      const n = points.length, d: number[][] = brut.map(l => l.slice());
      for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
        const a = brut[i][j], b = brut[j][i];
        let m: number;
        if (a >= 0 && b >= 0) m = Math.round((a + b) / 2);
        else if (a >= 0 || b >= 0) m = Math.max(a, b);
        else { m = Math.round(distanceKm(g!.lat[points[i]], g!.lon[points[i]], g!.lat[points[j]], g!.lon[points[j]]) * 1000); estimees++; }
        d[i][j] = m; d[j][i] = m;
      }
      const ordreAffectation = points.slice(1).map((_, i) => i + 1);
      const r = deuxOpt(d, plusProcheVoisin(d));
      arrets += n - 1; echanges += r.iterations;
      kmAffectation += longueur(d, ordreAffectation) / 1000; kmDeuxOpt += longueur(d, r.ordre) / 1000;
    }
    detail = `tournees=${tournees.filter(t => t.colis.length >= 2).length} arrets=${arrets} dijkstra=${dijkstra} echanges=${echanges} km_2opt=${nombre(kmDeuxOpt)} km_ordre_affectation=${nombre(kmAffectation)}${estimees ? ` distances_estimees=${estimees}` : ""}`;
  } else if (e === "chargement") {
    if (tournees.length === 0) tournees = affecterMap(colis, livreurs, hubs).tournees;
    let vagues = 0, premiereVague = 0;
    for (const t of tournees) {
      if (t.colis.length === 0) continue;
      if (t.livreur.vehicule === "velo_cargo") {
        // La première vague par la table, puis premier arrivé, premier chargé pour le reste.
        const premiere = CHARGEMENT.dynamique({ tournees: [tourneeCargo(t)] })[0];
        const pris = new Set(premiere.pris);
        const reste: Colis[] = t.colis.filter((_, i) => !pris.has(i));
        vagues += 1 + (reste.length ? chargerVehicule({ ...t, colis: reste }).vagues.length : 0);
        premiereVague += premiere.pris.length;
      } else {
        const c = chargerVehicule(t);
        vagues += c.vagues.length; premiereVague += c.vagues[0]?.colis.length ?? 0;
      }
    }
    detail = `tournees=${tournees.filter(t => t.colis.length > 0).length} vagues=${vagues} colis_premiere_vague=${premiereVague}`;
  }
  const s = (performance.now() - debut) / 1000;
  if (e === "chargement") {
    // Pour la colonne gain, hors chronomètre : ce que le legacy mettait dans les premières vagues.
    const legacyPremiereVague = tournees.reduce((n, t) => n + (t.colis.length ? chargerVehicule(t).vagues[0].colis.length : 0), 0);
    detail += ` (legacy : ${legacyPremiereVague})`;
  }
  cellule.set(e, { secondes: s, detail });
  console.log(`[nuit] cellule, étape ${ETAPES.indexOf(e) + 1} ${e} : ${duree(s)}  (${detail})`);
}

// ---------- le tableau ----------
const largeurs = [12, 27, 34, 34, 28];
const ligne = (c: string[]) => c.map((x, i) => x.padEnd(largeurs[i])).join(" | ").trimEnd();
console.log(`\n${ligne(["étape", "24 septembre (logs réels)", "legacy ce soir", "cellule performance ce soir", "gain"])}`);
console.log(ligne(largeurs.map(l => "-".repeat(l))));
let totalLegacy = 0, totalLegacyExtrapole = 0, totalCellule = 0;
for (const e of ETAPES) {
  const l = legacy.get(e), c = cellule.get(e);
  if (!l || !c) { console.log(ligne([e, SEPTEMBRE[e].texte, "non rejouée", "non rejouée", ""])); continue; }
  totalLegacy += l.secondes; totalLegacyExtrapole += l.extrapole ?? l.secondes; totalCellule += c.secondes;
  const reference = l.extrapole ?? l.secondes;
  let gain = c.secondes > 0 ? `x ${virgule(reference / c.secondes, reference / c.secondes < 10 ? 1 : 0)}${l.extrapole ? " (legacy extrapolé)" : ""}` : "";
  if (e === "tournees") { const km = c.detail.match(/km_2opt=([\d ]+) km_ordre_affectation=([\d ]+)/); if (km) gain += ` ; ${nombre(Number(km[2].replace(/ /g, "")) - Number(km[1].replace(/ /g, "")))} km de moins` ; }
  if (e === "chargement") { const v = c.detail.match(/colis_premiere_vague=(\d+) \(legacy : (\d+)\)/); if (v) gain += ` ; ${nombre(Number(v[1]) - Number(v[2]))} colis de plus en 1re vague`; }
  console.log(ligne([e, SEPTEMBRE[e].texte, e === "adresses" ? `${duree(l.secondes)} pour ${limiteAdresses} colis (*)` : duree(l.secondes), e === "adresses" ? `${duree(c.secondes)} pour ${nombre(colis.length)} colis` : duree(c.secondes), gain]));
}
console.log(ligne(["total", `${SEPTEMBRE_TOTAL.texte} (fin ${SEPTEMBRE_FIN})`, `${duree(totalLegacy)}${legacy.has("adresses") ? " (*)" : ""}`, duree(totalCellule), ""]));

const la = legacy.get("adresses");
if (la) {
  console.log(`\n(*) le legacy ne rapproche que ${limiteAdresses} colis, ${virgule(la.secondes / limiteAdresses)} s chacun : à ce rythme, les ${nombre(SEPTEMBRE_COLIS)} colis du 24 septembre : ${duree(la.secondes / limiteAdresses * SEPTEMBRE_COLIS)} (une extrapolation, pas une mesure) ;`
    + ` les ${nombre(colis.length)} colis de ce jeu : ${duree(la.extrapole!)}, et le legacy entier finirait vers ${heureFin(totalLegacyExtrapole)}`);
}
console.log(`\n[nuit] le batch rejoué finirait vers ${heureFin(totalCellule)} (départ ${SEPTEMBRE_DEPART} comme le 24 septembre, ${duree(totalCellule)} plus tard${etapes.length < ETAPES.length ? ", étapes rejouées seulement" : ""})`);
