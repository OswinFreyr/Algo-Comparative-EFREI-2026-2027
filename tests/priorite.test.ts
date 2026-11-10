// La file du quai : le tas binaire et la file à seaux doivent servir les colis dans le même ordre que le legacy.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireColis } from "../legacy/src/csv.js";
import { TasBinaire } from "../bench/variantes/tas.js";
import { VARIANTES_PRIORITE, controleSortie, simuler } from "../bench/variantes/priorite.js";
import { colisUniques, prisesDuSoir } from "../bench/sujets/priorite.js";
import { Alea } from "../data/generateur/alea.js";

test("le tas binaire rend ses éléments du plus petit au plus grand", () => {
  const alea = new Alea(7);
  const valeurs = Array.from({ length: 2000 }, () => alea.entier(0, 500));
  const tas = new TasBinaire<number>((a, b) => a - b);
  for (const v of valeurs) tas.ajouter(v);
  assert.equal(tas.taille, valeurs.length);
  const sortie: number[] = [];
  for (let v = tas.retirer(); v !== undefined; v = tas.retirer()) sortie.push(v);
  // Le premier rang qui diffère, plutôt que les 2 000 valeurs : la sortie de npm test reste lisible.
  const attendu = valeurs.slice().sort((a, b) => a - b);
  const rang = attendu.findIndex((v, i) => sortie[i] !== v);
  assert.ok(rang === -1 && sortie.length === attendu.length,
    rang === -1 ? `${sortie.length} éléments rendus au lieu de ${attendu.length}` : `rang ${rang} : ${sortie[rang]} rendu, ${attendu[rang]} attendu`);
});

const fichier = join(resolve("data", "jeux", "petite"), "colis.csv");
test("tas et seaux servent les colis dans l'ordre du legacy", { skip: !existsSync(fichier) && "générez le jeu petite : npm run data -- --echelle petite" }, () => {
  const arrivees = colisUniques(lireColis(fichier)).sort((a, b) => (a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : 0));
  const prises = prisesDuSoir(arrivees.length);
  const attendu = controleSortie(simuler(VARIANTES_PRIORITE.tableau(), arrivees, prises));
  for (const nom of ["tas", "seaux"]) {
    assert.equal(controleSortie(simuler(VARIANTES_PRIORITE[nom](), arrivees, prises)), attendu, `${nom} : ordre de sortie différent du legacy`);
  }
});

test("une file vide ne rend rien", () => {
  for (const nom of Object.keys(VARIANTES_PRIORITE)) assert.equal(VARIANTES_PRIORITE[nom]().prendre(), undefined, nom);
});
