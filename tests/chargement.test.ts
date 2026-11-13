// Atelier 12 : la programmation dynamique et le backtracking rendent le même meilleur chargement de la première vague,
// et le chargement rendu respecte les deux capacités. Ces tests échouent tant que la règle de la case (À COMPLÉTER
// de bench/variantes/chargement.ts) n'est pas écrite.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHARGEMENT, type ColisArrondi, type TourneeCargo } from "../bench/variantes/chargement.js";
import { Alea } from "../data/generateur/alea.js";

const colis = (poidsHg: number, volumeL: number, points: number): ColisArrondi => ({ poidsHg, volumeL, points });

// Huit colis, une caisse de 10 hg et 10 l. Le meilleur chargement vaut 31 points, et un seul le vaut : les colis 0, 1, 5
// et 6 (poids 3 + 2 + 4 + 1 = 10, volume 3 + 1 + 4 + 1 = 9, points 7 + 7 + 10 + 7). Le glouton, qui classe par points /
// encombrement, prend le colis 3 (10 points pour 5 hg) avant le colis 5 et finit à 27 points (colis 1, 3, 6, 7).
const huit: TourneeCargo = {
  livreur: "test", capaciteHg: 10, capaciteL: 10,
  colis: [colis(3, 3, 7), colis(2, 1, 7), colis(5, 1, 1), colis(5, 3, 10), colis(3, 6, 3), colis(4, 4, 10), colis(1, 1, 7), colis(2, 3, 3)],
};

// Le meilleur chargement par énumération de tous les sous-ensembles : la référence des petits tests.
function optimum(t: TourneeCargo): number {
  let meilleur = 0;
  for (let masque = 0; masque < 1 << t.colis.length; masque++) {
    let p = 0, v = 0, pts = 0;
    for (let i = 0; i < t.colis.length; i++) if (masque & (1 << i)) { p += t.colis[i].poidsHg; v += t.colis[i].volumeL; pts += t.colis[i].points; }
    if (p <= t.capaciteHg && v <= t.capaciteL && pts > meilleur) meilleur = pts;
  }
  return meilleur;
}

// Une instance tirée au sort : 12 à 16 colis, une caisse de 60 hg et 40 l, des colis de 2 à 25 hg et 1 à 15 l.
function auSort(alea: Alea, numero: number): TourneeCargo {
  const n = alea.entier(12, 16);
  return { livreur: `sort-${numero}`, capaciteHg: 60, capaciteL: 40, colis: Array.from({ length: n }, () => colis(alea.entier(2, 25), alea.entier(1, 15), alea.choix([1, 1, 1, 3, 3, 10]))) };
}

test("la programmation dynamique rend l'optimum connu sur huit colis", () => {
  assert.equal(optimum(huit), 31, "la référence du test");
  const r = CHARGEMENT.dynamique({ tournees: [huit] })[0];
  assert.equal(r.points, 31, `${r.points} points rendus, 31 attendus (colis pris : ${r.pris.join(", ") || "aucun"})`);
  assert.deepEqual(r.pris, [0, 1, 5, 6]);
  assert.equal(CHARGEMENT.glouton({ tournees: [huit] })[0].points, 27, "le glouton laisse 4 points sur le quai sur cette instance");
});

test("la programmation dynamique et le backtracking rendent les mêmes points sur 20 instances au sort", () => {
  const alea = new Alea(2026);
  const tournees = Array.from({ length: 20 }, (_, k) => auSort(alea, k));
  const d = CHARGEMENT.dynamique({ tournees }), b = CHARGEMENT.backtracking({ tournees });
  for (let k = 0; k < tournees.length; k++) {
    assert.equal(d[k].points, b[k].points, `instance ${k} : la programmation dynamique rend ${d[k].points} points, le backtracking ${b[k].points}`);
    assert.equal(b[k].points, optimum(tournees[k]), `instance ${k} : le backtracking ne rend pas l'optimum`);
  }
});

test("la liste des colis pris respecte les deux capacités, poids et volume", () => {
  const alea = new Alea(13);
  const tournees = [huit, ...Array.from({ length: 10 }, (_, k) => auSort(alea, k))];
  for (const nom of Object.keys(CHARGEMENT)) {
    const reponses = CHARGEMENT[nom]({ tournees });
    reponses.forEach((r, k) => {
      const t = tournees[k];
      let p = 0, v = 0, pts = 0;
      for (const i of r.pris) { p += t.colis[i].poidsHg; v += t.colis[i].volumeL; pts += t.colis[i].points; }
      assert.equal(new Set(r.pris).size, r.pris.length, `${nom}, ${t.livreur} : un colis pris deux fois`);
      assert.ok(p <= t.capaciteHg, `${nom}, ${t.livreur} : ${p} hg dans une caisse de ${t.capaciteHg}`);
      assert.ok(v <= t.capaciteL, `${nom}, ${t.livreur} : ${v} l dans une caisse de ${t.capaciteL}`);
      assert.equal(pts, r.points, `${nom}, ${t.livreur} : les points annoncés ne sont pas ceux des colis pris`);
      assert.equal(p, r.poidsHg); assert.equal(v, r.volumeL);
    });
  }
  // Le glouton ne dépasse jamais l'optimum ; les deux variantes exactes l'atteignent, avec une liste qui n'est pas vide.
  CHARGEMENT.glouton({ tournees }).forEach((r, k) => assert.ok(r.points <= optimum(tournees[k]), `glouton, ${tournees[k].livreur} : au-dessus de l'optimum`));
  for (const nom of ["dynamique", "backtracking"]) {
    CHARGEMENT[nom]({ tournees }).forEach((r, k) => assert.equal(r.points, optimum(tournees[k]), `${nom}, ${tournees[k].livreur} : ${r.points} points (${r.pris.length} colis pris), l'optimum en vaut ${optimum(tournees[k])}`));
  }
});
