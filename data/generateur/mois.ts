// Génère les lignes de facturation d'un mois d'Efrei Logistique, à graine fixe : ce que lit le rapport de 6h.
// Une ligne par prestation facturée : surtout le suivi (chaque scan est facturé un ou deux centimes), puis les
// livraisons, les prises en charge, les retours et les suppléments. Pour les 1 900 comptes professionnels
// d'Efrei (pièce 01) : quelques gros sites de e-commerce, beaucoup de petits commerces. Environ un million
// d'euros sur le mois, à peu près le chiffre d'affaires de 2025 (9,8 millions) ramené à un mois d'octobre 2026.
//
//   npm run mois                       3 000 000 de lignes dans data/jeux/mois/ (quelques secondes)
//   npm run mois -- --lignes 1000000   un volume libre
//
// Sortie : data/jeux/mois/facturation.csv (id;jour;client_id;type;montant_centimes) et MANIFESTE.json.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { once } from "node:events";
import { Alea } from "./alea.js";
import { lireOptions } from "../../outils/options.js";

const options = lireOptions({ valeur: ["lignes", "graine", "sortie"] });
const nLignes = Number(options.lire("lignes", "3000000"));
const graine = Number(options.lire("graine", "2026"));
if (!Number.isInteger(nLignes) || nLignes < 1000) { console.error("--lignes attend un entier d'au moins 1000"); process.exit(1); }
const dossier = resolve(options.lire("sortie", resolve("data", "jeux", "mois")));
const NB_CLIENTS = 1_900;
const JOURS = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12",
  "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
  "2026-10-23", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
const TYPES: readonly (readonly [string, number])[] = [["suivi", 180], ["livraison", 8], ["prise_en_charge", 8], ["retour", 1], ["supplement", 3]];
const TARIFS: Record<string, [number, number]> = { suivi: [1, 2], livraison: [520, 890], prise_en_charge: [20, 60], retour: [300, 520], supplement: [50, 300] };

const t0 = performance.now();
const alea = new Alea(graine);
mkdirSync(dossier, { recursive: true });
const chemin = resolve(dossier, "facturation.csv");
const flux = createWriteStream(chemin, { encoding: "utf-8" });
const hash = createHash("sha1");
const ecrire = async (s: string) => { hash.update(s); if (!flux.write(s)) await once(flux, "drain"); };

await ecrire("id;jour;client_id;type;montant_centimes\n");
let paquet = "";
let total = 0;
for (let i = 1; i <= nLignes; i++) {
  // Un client sur dix fait les trois quarts du volume : l'exposant tasse les tirages vers les petits numéros.
  const client = 1 + Math.floor(NB_CLIENTS * Math.pow(alea.reel(), 2.6));
  const jour = JOURS[Math.floor(alea.reel() * JOURS.length)];
  const type = alea.pondere(TYPES);
  const [mini, maxi] = TARIFS[type];
  const montant = alea.entier(mini, maxi);
  total += montant;
  paquet += `F${String(i).padStart(8, "0")};${jour};CL${String(client).padStart(6, "0")};${type};${montant}\n`;
  if (i % 50_000 === 0) { await ecrire(paquet); paquet = ""; }
}
if (paquet) await ecrire(paquet);
flux.end();
await once(flux, "finish");

const manifeste = {
  jeu: "mois", graine, mois: "2026-10", lignes: nLignes, clients: NB_CLIENTS, total_centimes: total,
  genere_le: new Date().toISOString(), sha1: { "facturation.csv": hash.digest("hex") },
};
writeFileSync(resolve(dossier, "MANIFESTE.json"), JSON.stringify(manifeste, null, 2) + "\n", "utf-8");
const euros = Math.round(total / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
console.log(`jeu mois : ${nLignes} lignes de facturation, ${NB_CLIENTS} clients, ${euros} euros facturés`);
console.log(`écrit dans ${dossier} en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
