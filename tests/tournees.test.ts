// Atelier 11 : le 2-opt décroise une tournée et ne la rallonge jamais, la longueur compte le retour au hub, le recuit
// rend le même résultat deux fois de suite. Le premier test échoue tant que le gain d'un échange (À COMPLÉTER de
// bench/variantes/tournees.ts) n'est pas écrit.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOURNEES, deuxOpt, longueur, plusProcheVoisin, type TourneeNoel } from "../bench/variantes/tournees.js";
import { Alea } from "../data/generateur/alea.js";

// Une tournée construite à partir de points du plan (distances euclidiennes en mètres, arrondies, symétriques).
function tournee(livreur: string, points: [number, number][]): TourneeNoel {
  const d = points.map(([x1, y1]) => points.map(([x2, y2]) => Math.round(Math.hypot(x1 - x2, y1 - y2))));
  return { livreur, mode: "velo", depart: 0, arrets: points.slice(1).map((_, i) => i + 1), d, lat: points.map(p => p[1]), lon: points.map(p => p[0]) };
}

// Le hub à un coin d'un rectangle de 2 000 m sur 1 000 m, six arrêts sur son bord : les sept points sont en position
// convexe, le plus court tour est le tour du rectangle, 2 x 2 000 + 2 x 1 000 = 6 000 m. Un ordre sans croisement est
// forcément ce tour : le 2-opt, qui décroise, doit le trouver quel que soit l'ordre de départ.
const rectangle = tournee("rectangle", [[0, 0], [1000, 0], [2000, 0], [2000, 500], [2000, 1000], [1000, 1000], [0, 1000]]);
const PERIMETRE = 6000;

function auSort(alea: Alea, k: number, numero: number): TourneeNoel {
  return tournee(`sort-${numero}`, Array.from({ length: k + 1 }, () => [alea.entier(0, 10000), alea.entier(0, 10000)] as [number, number]));
}

test("le 2-opt trouve l'ordre optimal du rectangle depuis un ordre croisé", () => {
  const croise = [1, 4, 6, 3, 2, 5];          // des diagonales qui se croisent
  assert.ok(longueur(rectangle.d, croise) > PERIMETRE, "l'ordre de départ est bien plus long que le tour du rectangle");
  const r = deuxOpt(rectangle.d, croise);
  assert.equal(longueur(rectangle.d, r.ordre), PERIMETRE, `${longueur(rectangle.d, r.ordre)} m après le 2-opt, ${PERIMETRE} m pour le tour du rectangle (${r.iterations} échange(s))`);
  assert.ok(r.iterations > 0, "au moins un échange");
  assert.equal(TOURNEES.deuxopt({ tournees: [rectangle] })[0].metres, PERIMETRE, "depuis le plus proche voisin aussi");
});

test("le 2-opt ne rallonge jamais le plus proche voisin, sur 20 tournées au sort", () => {
  const alea = new Alea(1213);
  const tournees = Array.from({ length: 20 }, (_, k) => auSort(alea, alea.entier(5, 25), k));
  const v = TOURNEES.voisin({ tournees }), o = TOURNEES.deuxopt({ tournees });
  tournees.forEach((t, k) => {
    assert.ok(o[k].metres <= v[k].metres, `${t.livreur} : ${o[k].metres} m après le 2-opt, ${v[k].metres} m pour le plus proche voisin`);
    assert.deepEqual(o[k].ordre.slice().sort((a, b) => a - b), t.arrets, `${t.livreur} : l'ordre n'est pas une permutation des arrêts`);
    assert.equal(o[k].metres, longueur(t.d, o[k].ordre), `${t.livreur} : les mètres annoncés ne sont pas ceux de la matrice`);
  });
});

test("la longueur compte le départ du hub et le retour au hub", () => {
  const t = tournee("ligne", [[0, 0], [1000, 0], [2000, 0]]);   // le hub, puis deux arrêts alignés
  assert.equal(longueur(t.d, [1, 2]), 1000 + 1000 + 2000);
  assert.equal(longueur(t.d, [2, 1]), 2000 + 1000 + 1000);
  assert.equal(longueur(t.d, []), 0);
  for (const nom of Object.keys(TOURNEES)) {
    const r = TOURNEES[nom]({ tournees: [t] })[0];
    assert.equal(r.metres, longueur(t.d, r.ordre), nom);
    assert.equal(r.metres, 4000, `${nom} : le retour au hub manque`);
  }
  assert.deepEqual(plusProcheVoisin(t.d), [1, 2]);
});

test("le recuit rend le même ordre deux fois de suite, et ne fait pas pire que le plus proche voisin", () => {
  const alea = new Alea(31);
  const tournees = Array.from({ length: 5 }, (_, k) => auSort(alea, 30, k));
  const a = TOURNEES.recuit({ tournees }), b = TOURNEES.recuit({ tournees }), v = TOURNEES.voisin({ tournees });
  tournees.forEach((t, k) => {
    assert.deepEqual(a[k].ordre, b[k].ordre, `${t.livreur} : deux appels, deux ordres différents`);
    assert.ok(a[k].metres <= v[k].metres, `${t.livreur} : le recuit fait ${a[k].metres} m, le plus proche voisin ${v[k].metres}`);
    assert.equal(a[k].metres, longueur(t.d, a[k].ordre));
  });
});
