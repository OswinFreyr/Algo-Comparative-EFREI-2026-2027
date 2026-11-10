// Les variantes de la page "Où est mon colis" doivent rendre le même dernier scan que le legacy.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { lireScans } from "../legacy/src/suivi.js";
import { VARIANTES_SUIVI, controleReponses, genererRequetes } from "../bench/variantes/suivi.js";

const fichier = join(resolve("data", "jeux", "petite"), "scans.csv");

test("les variantes de suivi rendent le même dernier scan que le legacy", { skip: !existsSync(fichier) && "générez le jeu petite : npm run data -- --echelle petite" }, () => {
  const scans = lireScans(fichier);
  const requetes = genererRequetes(scans, 400);
  const reference = VARIANTES_SUIVI.tableau.construire(scans);
  const attendu = requetes.map(n => reference.chercher(n));
  assert.ok(attendu.some(r => r === null) && attendu.some(r => r !== null), "les requêtes mêlent numéros connus et mal tapés");
  for (const nom of ["set", "map", "dichotomie"]) {
    const r = VARIANTES_SUIVI[nom].construire(scans);
    assert.equal(controleReponses(requetes.map(n => r.chercher(n))), controleReponses(attendu), `${nom} : réponses différentes du legacy`);
  }
});

test("un numéro inconnu rend null, une liste vide aussi", () => {
  for (const nom of Object.keys(VARIANTES_SUIVI)) {
    assert.equal(VARIANTES_SUIVI[nom].construire([]).chercher("EFL260924000001C"), null, nom);
  }
});
