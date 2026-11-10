// Le rapport de 6h : tas de taille K et quickselect doivent donner les cent mêmes clients que le legacy, dans le même ordre.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LigneFacturation } from "../legacy/src/rapport.js";
import { VARIANTES_RAPPORT, controleRapport, topKParTas, totauxParClient } from "../bench/variantes/rapport.js";
import { Alea } from "../data/generateur/alea.js";

function mois(nLignes: number, nClients: number, graine = 11): LigneFacturation[] {
  const alea = new Alea(graine);
  return Array.from({ length: nLignes }, (_, i) => ({
    id: `F${i}`, jour: "2026-10-01", client: `CL${String(1 + Math.floor(nClients * Math.pow(alea.reel(), 2.6))).padStart(6, "0")}`,
    type: "livraison", montantCentimes: alea.entier(100, 900),
  }));
}

test("les trois variantes du rapport donnent le même classement", () => {
  const lignes = mois(30000, 800);
  const attendu = controleRapport(VARIANTES_RAPPORT.tri(lignes));
  for (const nom of ["tas", "quickselect"]) assert.equal(controleRapport(VARIANTES_RAPPORT[nom](lignes)), attendu, nom);
});

test("à total égal, le plus petit numéro de client passe devant", () => {
  const lignes: LigneFacturation[] = ["CL000003", "CL000001", "CL000002"].map((client, i) => ({ id: `F${i}`, jour: "2026-10-01", client, type: "livraison", montantCentimes: 500 }));
  for (const nom of Object.keys(VARIANTES_RAPPORT)) assert.deepEqual(VARIANTES_RAPPORT[nom](lignes).map(t => t.client), ["CL000001", "CL000002", "CL000003"], nom);
});

test("moins de clients que K : tous, dans l'ordre", () => {
  const lignes = mois(500, 20);
  const n = new Set(lignes.map(l => l.client)).size;
  for (const nom of Object.keys(VARIANTES_RAPPORT)) assert.equal(VARIANTES_RAPPORT[nom](lignes).length, n, nom);
  assert.equal(topKParTas(totauxParClient(lignes), 5).length, 5);
});
