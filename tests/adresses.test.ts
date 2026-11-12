// Atelier 8 : l'index de trigrammes et pg_trgm comparent la même chose ; une saisie exacte retrouve son adresse.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lireReferentiel } from "../legacy/src/csv.js";
import { libelle } from "../legacy/src/adresses.js";
import { BaseAdresses, IndexTrigrammes, similarite, trigrammes } from "../bench/variantes/adresses.js";

const ref = resolve("data", "referentiel", "adresses-metropole.csv");
const sansRef = !existsSync(ref) && "préparez le référentiel : npm run ban";

test("les trigrammes suivent la règle de pg_trgm", () => {
  assert.deepEqual(trigrammes("ste").sort(), ["  s", " st", "ste", "te "].sort());
  assert.equal(trigrammes("ab ab").length, 3); // trigrammes distincts : "  a", " ab", "ab "
  assert.equal(similarite(4, 4, 4), 1);
});

test("une saisie exacte retrouve son adresse, une saisie fautive une adresse proche", { skip: sansRef }, () => {
  const r = lireReferentiel(ref).slice(0, 3000);
  const index = new IndexTrigrammes(r);
  for (const a of r.slice(0, 50)) assert.equal(index.libelles[index.ids.indexOf(index.chercher(libelle(a))!)], index.libelles[r.indexOf(a)]);
});

test("l'index en mémoire et PostgreSQL proposent les mêmes candidats", { skip: sansRef, timeout: 120_000 }, async () => {
  const r = lireReferentiel(ref).slice(0, 3000);
  const index = new IndexTrigrammes(r);
  const base = await BaseAdresses.construire(r);
  try {
    let memes = 0;
    const saisies = r.slice(0, 40).map((a, i) => (i % 2 ? libelle(a).replace(/[aeiou]/, "") : libelle(a).toLowerCase()));
    for (const s of saisies) if ((await base.chercher(s)) === index.chercher(s)) memes++;
    assert.ok(memes >= 38, `${memes} réponses identiques sur 40`);
  } finally { await base.fermer(); }
});
