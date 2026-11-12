// L'exactitude des trois façons de rapprocher une adresse (atelier 8, ADR-005), sans chronomètre fin.
// Pour chaque variante : combien de saisies retrouvent la bonne adresse officielle (data/jeux/<jeu>/verite.csv),
// par sorte de saisie (exacte, accents, abréviation, faute...), ce que coûte la construction de l'index,
// et le temps moyen d'une requête.
//
//   npm run exactitude
//   npm run exactitude -- --jeu petite --requetes 300 --variantes trigrammes,postgres
//   npm run exactitude -- --saisie "ste catherine 33000 bordeaux"      (ce que chaque variante répond à une saisie)
//   npm run exactitude -- --referentiel gironde --requetes 100 --requetes-brute 2   (la Gironde entière, 730 137 adresses)
//
// La force brute coûte plusieurs secondes par saisie : elle ne traite que --requetes-brute saisies (10 par défaut).
// Résultats : bench/resultats/<horodatage>-exactitude.csv
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { lireLignes } from "../legacy/src/csv.js";
import { libelle, normaliser } from "../legacy/src/adresses.js";
import { lireOptions } from "../outils/options.js";
import { BaseAdresses, IndexTrigrammes, brute } from "./variantes/adresses.js";
import { chargerAdresses } from "./sujets/adresses.js";

const options = lireOptions({ valeur: ["jeu", "referentiel", "requetes", "requetes-brute", "variantes", "saisie", "resultats"] });
const nomJeu = options.lire("jeu", "petite");
const nomsVariantes = options.lire("variantes", "brute,trigrammes,postgres").split(",");
const nRequetes = Number(options.lire("requetes", "300"));
const nBrute = Number(options.lire("requetes-brute", "10"));
const dossier = existsSync(nomJeu) ? resolve(nomJeu) : resolve("data", "jeux", nomJeu);
for (const v of nomsVariantes) if (!["brute", "trigrammes", "postgres"].includes(v)) { console.error(`variante inconnue : ${v} (brute, trigrammes, postgres)`); process.exit(1); }

let d;
try { d = chargerAdresses(dossier, options.lire("referentiel", "metropole")); } catch (e) { console.error((e as Error).message); process.exit(1); }
const ms = (debut: number) => performance.now() - debut;
const go = (o: number) => (o / 1024 / 1024).toFixed(1).replace(".", ",");

// Une saisie libre : ce que répond chaque variante, avec les candidats des index.
const saisie = options.lire("saisie", "");
if (saisie) {
  console.log(`[exactitude] saisie : "${saisie}" (normalisée : "${normaliser(saisie)}")`);
  for (const v of nomsVariantes) {
    let t = performance.now();
    if (v === "brute") {
      const r = brute([{ id: "saisie", adresseSaisie: saisie } as any], d.referentiel)[0];
      const a = d.referentiel.find(x => x.id === r);
      console.log(`  brute       ${ms(t).toFixed(0).padStart(6)} ms  -> ${a ? normaliser(libelle(a)) : "rien"}`);
    } else if (v === "trigrammes") {
      const index = new IndexTrigrammes(d.referentiel);
      t = performance.now();
      const c = index.candidats(normaliser(saisie));
      const r = index.chercher(saisie);
      console.log(`  trigrammes  ${ms(t).toFixed(0).padStart(6)} ms  -> ${r ? index.libelles[index.ids.indexOf(r)] : "rien"}`);
      console.log(`              candidats : ${c.slice(0, 5).map(x => index.libelles[x]).join(" | ")}`);
    } else {
      const base = await BaseAdresses.construire(d.referentiel);
      t = performance.now();
      const c = await base.candidats(normaliser(saisie));
      const r = await base.chercher(saisie);
      console.log(`  postgres    ${ms(t).toFixed(0).padStart(6)} ms  -> ${r ? base.libelles[base.ids.indexOf(r)] : "rien"}`);
      console.log(`              candidats : ${c.slice(0, 5).map(x => base.libelles[x]).join(" | ")}`);
      await base.fermer();
    }
  }
  process.exit(0);
}

const verite = new Map<string, { id: string; sorte: string }>();
const { entete, lignes } = lireLignes(join(dossier, "verite.csv"));
const iC = entete.indexOf("colis_id"), iA = entete.indexOf("adresse_ban_id"), iS = entete.indexOf("sorte_saisie");
for (const l of lignes) verite.set(l[iC], { id: l[iA], sorte: l[iS] });

const SORTES = ["exacte", "accents", "abreviation", "faute", "double", "sans_numero", "commune"];
console.log(`[exactitude] jeu=${nomJeu} referentiel=${d.referentiel.length} variantes=${nomsVariantes.join(",")} requetes=${nRequetes} (brute : ${nBrute})`);
const sortie = ["variante;requetes;justes;taux;ms_par_requete;construction_ms;index_mo;" + SORTES.join(";")];

for (const v of nomsVariantes) {
  const n = v === "brute" ? Math.min(nBrute, nRequetes) : nRequetes;
  const requetes = d.colis.slice(0, n);
  // La mémoire d'un index : le tas de Node plus les tableaux typés (Int32Array), rangés hors du tas.
  const memoire = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
  if (global.gc) global.gc();
  const avant = memoire();
  let t = performance.now();
  let index: IndexTrigrammes | null = null, base: BaseAdresses | null = null;
  if (v === "trigrammes") index = new IndexTrigrammes(d.referentiel);
  if (v === "postgres") base = await BaseAdresses.construire(d.referentiel);
  const construction = ms(t);
  if (global.gc) global.gc();
  let tailleIndex = 0;
  if (index) tailleIndex = memoire() - avant;
  if (base) tailleIndex = (await base.tailles()).index;

  t = performance.now();
  let reponses: (string | null)[];
  if (v === "brute") reponses = brute(requetes, d.referentiel);
  else if (index) reponses = requetes.map(c => index!.chercher(c.adresseSaisie));
  else { reponses = []; for (const c of requetes) reponses.push(await base!.chercher(c.adresseSaisie)); }
  const parRequete = ms(t) / Math.max(1, n);

  const parSorte = new Map(SORTES.map(s => [s, { n: 0, ok: 0 }]));
  let justes = 0;
  requetes.forEach((c, i) => {
    const vrai = verite.get(c.id);
    if (!vrai) return;
    const s = parSorte.get(vrai.sorte) ?? { n: 0, ok: 0 };
    s.n++;
    if (reponses[i] === vrai.id) { s.ok++; justes++; }
    parSorte.set(vrai.sorte, s);
  });
  const taux = justes / Math.max(1, n);
  console.log(`\n  ${v.padEnd(11)} ${justes}/${n} justes (${(taux * 100).toFixed(1).replace(".", ",")} %), ${parRequete.toFixed(1).replace(".", ",")} ms par requête`
    + (v === "brute" ? "" : `, construction ${(construction / 1000).toFixed(1).replace(".", ",")} s, index ${go(tailleIndex)} Mo${v === "postgres" ? " sur le disque de PostgreSQL" : " en mémoire"}`));
  console.log("  " + SORTES.map(s => { const x = parSorte.get(s)!; return `${s} ${x.ok}/${x.n}`; }).join("  "));
  if (base) await base.fermer();
  sortie.push([v, n, justes, taux.toFixed(3), parRequete.toFixed(2), construction.toFixed(0), (tailleIndex / 1024 / 1024).toFixed(1),
    ...SORTES.map(s => { const x = parSorte.get(s)!; return `${x.ok}/${x.n}`; })].join(";"));
}

const dossierResultats = resolve(options.lire("resultats", join("bench", "resultats")));
mkdirSync(dossierResultats, { recursive: true });
const fichier = join(dossierResultats, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}-exactitude.csv`);
writeFileSync(fichier, sortie.join("\n") + "\n", "utf-8");
console.log(`\n[exactitude] résultats : ${relative(process.cwd(), fichier)}`);
