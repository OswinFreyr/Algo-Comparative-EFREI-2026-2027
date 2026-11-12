// La démonstration du ticket T-0733 : à 14h02, le pont Chaban-Delmas se lève. Quelles tournées en cours
// passaient par le pont, quel détour les attend, et combien de temps prend le recalcul selon la méthode.
//
//   npm run pont
//   npm run pont -- --jeu moyenne --simple 2        (mesurer Dijkstra simple sur 2 tournées, puis extrapoler)
//
// La longueur restante d'une tournée : de la position du livreur à son premier arrêt restant, puis d'arrêt en
// arrêt, par les plus courts chemins de son véhicule.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lireOptions } from "../outils/options.js";
import { lireGraphe, PONT_CHABAN, estDuPont, voisinage, type Graphe, type Mode } from "./graphe/graphe.js";
import { aRecalculer, scenario14h02 } from "./graphe/scenario.js";
import { CHEMINS, distancesDepuis, verifierDijkstraTas, type EntreeChemins, type Reseau } from "./variantes/chemins.js";

const options = lireOptions({ valeur: ["jeu", "simple"] });
const nomJeu = options.lire("jeu", "moyenne");
const nSimple = Number(options.lire("simple", "1"));
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
const km = (m: number) => (m / 1000).toFixed(1).replace(".", ",");
const duree = (ms: number) => ms < 1000 ? `${ms.toFixed(0)} ms` : ms < 120_000 ? `${(ms / 1000).toFixed(1).replace(".", ",")} s` : `${Math.floor(ms / 60000)} min ${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")} s`;

let g: Graphe;
// Les distances de cette démonstration sont celles de dijkstraTas : s'il n'est pas complété, on s'arrête ici.
try { g = lireGraphe(); verifierDijkstraTas(); } catch (e) { console.error((e as Error).message); process.exit(1); }
const s = scenario14h02(g, dossier);
const tournees = aRecalculer(s);
const reseaux = (leve: boolean) => {
  const ex = leve ? estDuPont(g, PONT_CHABAN) : () => false;
  const r = (m: Mode): Reseau => ({ v: voisinage(g, m, ex), lat: g.lat, lon: g.lon });
  return { velo: r("velo"), utilitaire: r("utilitaire") };
};
const ouvert = reseaux(false), leve = reseaux(true);

function longueurRestante(r: Record<Mode, Reseau>, mode: Mode, depart: number, arrets: number[]): number {
  let total = 0, ici = depart;
  for (const a of arrets) { const d = distancesDepuis(r[mode], ici, [a])[0]; if (d < 0) return -1; total += d; ici = a; }
  return total;
}

console.log(`[pont] ${s.length} tournées en cours à 14h02 (jeu ${nomJeu}), ${s.filter(t => t.touchee).length} passaient par le ${PONT_CHABAN}`);
console.log(`[pont] tournées à recalculer : ${tournees.length} (${tournees.filter(t => t.mode === "velo").length} vélos cargo, ${tournees.filter(t => t.mode === "utilitaire").length} utilitaires)`);
let avant = 0, apres = 0, pire = { livreur: "", detour: 0 };
for (const t of tournees) {
  const a = longueurRestante(ouvert, t.mode, t.requete.depart, t.requete.arrets);
  const b = longueurRestante(leve, t.mode, t.requete.depart, t.requete.arrets);
  if (a < 0 || b < 0) continue;
  avant += a; apres += b;
  if (b - a > pire.detour) pire = { livreur: `${t.livreur} (${t.mode === "velo" ? "vélo cargo" : "utilitaire"})`, detour: b - a };
}
console.log(`[pont] reste à parcourir : ${km(avant)} km pont ouvert, ${km(apres)} km pont levé, soit ${km(apres - avant)} km de détour`);
console.log(`[pont] la tournée la plus touchée : ${pire.livreur}, ${km(pire.detour)} km de plus`);

const entree: EntreeChemins = { reseaux: leve, requetes: tournees.map(t => t.requete) };
for (const v of ["tas", "astar"]) {
  CHEMINS[v](entree); // un tour d'échauffement
  const t0 = performance.now(); CHEMINS[v](entree); const ms = performance.now() - t0;
  console.log(`[pont] recalcul des ${tournees.length} tournées, ${v.padEnd(6)} : ${duree(ms)}`);
}
const t0 = performance.now();
CHEMINS.simple({ reseaux: leve, requetes: entree.requetes.slice(0, nSimple) });
const parTournee = (performance.now() - t0) / nSimple;
console.log(`[pont] recalcul, simple : ${duree(parTournee)} par tournée (mesuré sur ${nSimple}), soit ${duree(parTournee * tournees.length)} pour les ${tournees.length}`);
