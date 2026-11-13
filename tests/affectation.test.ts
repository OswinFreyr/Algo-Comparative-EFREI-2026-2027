// Les trois variantes d'affectation doivent donner exactement le même résultat que le legacy.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireColis, lireHubs, lireLivreurs } from "../legacy/src/csv.js";
import { VARIANTES, controle } from "../bench/variantes/affectation.js";

const dossier = resolve("data", "jeux", "petite");

test("les variantes tri et map donnent le résultat du legacy", { skip: !existsSync(join(dossier, "colis.csv")) && "générez le jeu petite : npm run data -- --echelle petite" }, () => {
  const colis = lireColis(join(dossier, "colis.csv"));
  const livreurs = lireLivreurs(join(dossier, "livreurs.csv"));
  const hubs = lireHubs(join(dossier, "hubs.csv"));
  const reference = VARIANTES.naive(colis, livreurs, hubs);
  const somme = controle(reference);
  for (const nom of ["tri", "map"]) {
    const r = VARIANTES[nom](colis, livreurs, hubs);
    assert.equal(r.doublonsIgnores, reference.doublonsIgnores, `${nom} : doublons`);
    assert.equal(r.nonAffectes.length, reference.nonAffectes.length, `${nom} : non affectés`);
    assert.equal(controle(r), somme, `${nom} : somme de contrôle`);
  }
});

test("un lot vide donne des tournées vides", { skip: !existsSync(join(dossier, "livreurs.csv")) && "générez le jeu petite : npm run data -- --echelle petite" }, () => {
  const livreurs = lireLivreurs(join(dossier, "livreurs.csv"));
  const hubs = lireHubs(join(dossier, "hubs.csv"));
  for (const nom of Object.keys(VARIANTES)) {
    const r = VARIANTES[nom]([], livreurs, hubs);
    assert.equal(r.tournees.length, livreurs.length, nom);
    assert.equal(r.tournees.reduce((s, t) => s + t.colis.length, 0), 0, nom);
  }
});
