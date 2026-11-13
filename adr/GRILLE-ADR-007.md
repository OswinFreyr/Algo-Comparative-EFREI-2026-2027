# Grille comparative - ADR-007 : recalculer les distances quand le pont se lève

Ticket T-0733. Le 8 septembre à 14h02, le pont Chaban-Delmas se lève : 23 tournées à recalculer pendant qu'un livreur attend au feu. Le legacy a mis 11 minutes. Il se cite, il ne se note pas.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | recalculer les 23 tournées, pont déjà retiré | 4 |
| Mémoire | mémoire du recalcul, lue à 23 tournées | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | les distances sont celles de Dijkstra, au mètre, sans hypothèse à tenir | 2 |
| Coût de mise en oeuvre | lignes à écrire, et ce qu'il faut réutiliser et maintenir | 1 |

Les poids sont ceux de la fiche. Le temps pèse 4 : les tablettes étaient figées. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `simple`, Dijkstra sans tas. Option B : `tas`, Dijkstra avec le tas de l'atelier 6. Option C : `astar`, une recherche par arrêt guidée par le vol d'oiseau.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (simple) | 2 | 5 | 5 | 5 | 5 | 38 |
| B (tas) | 5 | 5 | 4 | 5 | 3 | 46 |
| C (astar) | 5 | 5 | 3 | 3 | 3 | 40 |

Total pondéré = 4 x Temps + 1 x Mémoire + 2 x Lisibilité + 2 x Robustesse + 1 x Coût.

Barème du temps, pour les 23 tournées : 5 sous 1 s, 4 sous 10 s, 3 sous 1 min, 2 sous 11 min, 1 au-delà. Barème de la mémoire : 5 sous 50 Mo, 4 sous 500 Mo, 3 au-delà. Deux options à moins d'un facteur 2 l'une de l'autre prennent la même note.

Mesures : `bench/resultats/2026-11-13T10-36-00-chemins.csv` (1 et 2 tournées) et `bench/resultats/2026-11-13T10-36-06-chemins.csv` (1, 5 et 23).

Justification des notes :

- Temps : tas 150 ms et A* 274 ms, tous les deux sous 1 s, note 5. Dijkstra sans tas n'est mesuré qu'à 1 et 2 tournées (4,4 s et 7,7 s). `npm run pont -- --simple 2` extrapole 4,7 s par tournée, soit 109 s pour les 23 : au-dessus d'une minute, en dessous des 11 minutes du 8 septembre, note 2.
- Mémoire : 3,4 Mo sans tas (à une tournée), 13,5 Mo avec le tas et 14,2 Mo pour A*, à 23 tournées. Tout reste sous 50 Mo, note 5. Le tas et A* sont à un facteur 1,05.
- Lisibilité, on part de 5 et une idée coûte un point : sans tas 5, le prochain carrefour se trouve en relisant tous les autres. Avec le tas 4, une idée, le tas et ses entrées périmées. A* 3, deux idées, ce tas et l'heuristique qui ne doit jamais surestimer.
- Robustesse : les trois rendent les mêmes distances, somme de contrôle `c720f156` à 23 tournées. Sans tas et avec le tas, note 5, aucune hypothèse. A* n'est juste que si le vol d'oiseau ne dépasse jamais la route, à revoir si l'unité change, note 3.
- Coût : sans tas 5, rien à écrire. Avec le tas 3, quelques lignes et le tas de l'atelier 6 à maintenir. A* 3, quelques lignes et le vol d'oiseau à maintenir.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 35, B = 47 et C = 42. La décision ne change pas.

Elle ne bascule pas en déplaçant les poids : à 23 tournées, A* n'est meilleur sur aucun critère. Il ne passe devant que si le temps mesuré change, c'est-à-dire sous 8,2 arrêts restants par livreur (une recherche par livreur pour le tas, une par arrêt pour A*). Au-delà, et le scénario en compte jusqu'à 15, le tas reste premier.
