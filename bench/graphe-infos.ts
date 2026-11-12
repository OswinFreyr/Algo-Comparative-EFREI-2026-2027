// Ce que contient le graphe routier de la métropole, et ce que coûterait de le ranger en matrice (atelier 9).
//
//   npm run graphe
import { lireGraphe, PONT_CHABAN } from "./graphe/graphe.js";

let g;
try { g = lireGraphe(); } catch (e) { console.error((e as Error).message); process.exit(1); }
const m = g.de.length;
const km = Array.from(g.metres).reduce((s, x) => s + x, 0) / 1000;
const velo = g.velo.reduce((s, x) => s + x, 0), util = g.utilitaire.reduce((s, x) => s + x, 0);
const ponts = new Map<string, number>();
for (const p of g.pont) if (p) ponts.set(p, (ponts.get(p) ?? 0) + 1);
const go = (o: number) => o >= 1024 ** 3 ? `${(o / 1024 ** 3).toFixed(1).replace(".", ",")} Go` : `${(o / 1024 ** 2).toFixed(1).replace(".", ",")} Mo`;
const nombre = (x: number) => x.toLocaleString("fr-FR").replace(/[\u00a0\u202f]/g, " ");

console.log(`[graphe] ${nombre(g.n)} noeuds (intersections), ${nombre(m)} arêtes orientées, ${nombre(Math.round(km / 2))} km de voies environ`);
console.log(`[graphe] arêtes permises : ${nombre(velo)} au vélo cargo, ${nombre(util)} à l'utilitaire ; ${(m / g.n).toFixed(1).replace(".", ",")} arêtes par noeud en moyenne`);
console.log(`[graphe] ${PONT_CHABAN} : ${ponts.get(PONT_CHABAN) ?? 0} arêtes ; Pont de Pierre : ${ponts.get("Pont de Pierre") ?? 0} arêtes (vélos seulement)`);
console.log(`[graphe] une matrice d'adjacence de toute la métropole : ${nombre(g.n)} x ${nombre(g.n)} = ${(g.n * g.n / 1e9).toFixed(2).replace(".", ",")} milliards de cases, soit ${go(g.n * g.n * 8)} à 8 octets la case`);
console.log(`[graphe] dont ${(100 * m / (g.n * g.n)).toFixed(4).replace(".", ",")} % de cases utiles : une case sur ${nombre(Math.round(g.n * g.n / m))} contient une rue`);
console.log(`[graphe] des listes d'adjacence : une entrée par arête, ${nombre(m)} entrées`);
