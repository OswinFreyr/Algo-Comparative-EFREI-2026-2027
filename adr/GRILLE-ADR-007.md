# Grille comparative - ADR-007 : recalculer les distances par la route quand le pont se lève

Ticket T-0733 : le 8 septembre à 14h02, le pont Chaban-Delmas se lève, 23 tournées sont à recalculer, le recalcul dure 11 minutes et les tablettes restent figées. La contrainte : recalculer les distances par la route, au mètre près, pendant qu'un livreur attend au feu.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée du recalcul des 23 tournées du 8 septembre, pont levé | 4 |
| Mémoire | mémoire relevée par le harness à 23 tournées, lue comme un ordre de grandeur | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | `npm test`, la justesse au mètre et l'absence d'hypothèse à tenir | 2 |
| Coût de mise en oeuvre | lignes à écrire, ce qu'il faut réutiliser et maintenir | 1 |

Les poids sont ceux imposés par le ticket. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `simple`, Dijkstra sans tas. Option B : `tas`, Dijkstra avec le tas binaire de l'atelier 6. Option C : `astar`, A*, une recherche par arrêt. Le legacy du 8 septembre (11 minutes) est cité dans l'ADR, il ne se note pas.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (simple) | 2 | 5 | 4 | 5 | 4 | 35 |
| B (tas) | 5 | 5 | 3 | 5 | 3 | 44 |
| C (astar) | 5 | 5 | 2 | 3 | 3 | 38 |

Total pondéré = 4 x Temps + 1 x Mémoire + 2 x Lisibilité + 2 x Robustesse + 1 x Coût.

Les barèmes, fixés avant de mesurer (ceux de la fiche atelier 10) :

- Temps (les 23 tournées) : 5 sous 1 s, 4 sous 10 s, 3 sous 1 min, 2 sous 11 min (le 8 septembre), 1 au-delà.
- Mémoire : 5 sous 50 Mo, 4 sous 500 Mo, 3 au-delà ; `memoire_ko` est un ordre de grandeur, deux options à moins d'un facteur 2 l'une de l'autre ont la même note.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour dire ce que fait la méthode, comment elle trouve le prochain carrefour à fixer et où changer l'arrêt visé.
- Robustesse : 5 si la méthode rend les mêmes distances que Dijkstra au mètre, sans hypothèse sur les données ; 3 si elle n'est juste que sous une hypothèse à tenir ; 2 si elle rend des distances fausses en silence sur le scénario du pont ; 1 si `npm test` échoue.
- Coût : 5 si rien n'est à écrire ; 4 pour quelques lignes sans structure à maintenir ; 3 pour quelques lignes et une structure du dépôt à réutiliser et à maintenir ; 2 pour une structure nouvelle dans l'équipe ; 1 si une dépendance s'ajoute.

Mesures du 13 novembre à 14h30 : `bench/resultats/2026-11-13T13-34-12-chemins.csv` (`simple` et `tas`, 1 et 2 tournées, 3 répétitions, sans échauffement) et `bench/resultats/2026-11-13T13-34-22-chemins.csv` (`tas` et `astar`, 1, 5 et 23 tournées, médiane de 5 répétitions, 3 tours d'échauffement). Les séries prises plus tôt le même jour, poste chargé, sont écartées.

Justification rapide des notes :

- Temps A : mesuré à une tournée (3,7 s) et à deux (6,2 s), pas à 23. Estimé pour les 23 : de 71 s à 85 s ; au-dessus de 1 min et sous 11 min, note 2.
- Temps B : 116 ms pour les 23 tournées, sous 1 s, note 5. Temps C : 209 ms, sous 1 s, note 5 ; A* est 1,8 fois plus lent que le tas, mais les deux sont sous le seuil.
- Mémoire : A 0,6 Mo à une tournée, B 29,5 Mo à 23, C 25,2 Mo à 23 ; les trois sous 50 Mo, note 5.
- Lisibilité : A 4, une idée, fixer à chaque tour le carrefour non fixé le plus proche du départ. B 3, deux idées : la même, et le tas avec ses entrées périmées (un carrefour peut y être plusieurs fois, seule sa première sortie compte). C 2, trois idées : les deux précédentes, et l'heuristique avec sa condition (le vol d'oiseau ne doit jamais dépasser la route) ; l'arrêt visé est en plus dans la priorité, une recherche par arrêt.
- Robustesse : `npm test` passe pour les trois tests des plus courts chemins. A 5, c'est la référence. B 5 : même somme de contrôle que A à une et deux tournées, aucune hypothèse. C 3 : même somme de contrôle que B à 1, 5 et 23 tournées, mais seulement parce que le vol d'oiseau ne surestime jamais la route ; à revoir si l'unité des longueurs change ou si l'on passe des mètres aux minutes.
- Coût : A 4, la méthode est écrite, quelques lignes pour la brancher, rien d'autre à maintenir. B 3 : quatre lignes écrites, et le tas de l'atelier 6 à réutiliser et à maintenir. C 3 : deux priorités changées, le tas et le vol d'oiseau à réutiliser et à maintenir.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 1, robustesse 2, coût 1) : A 33, B 46, C 41. La décision ne change pas, B reste premier.

Entre B et C, aucun poids ne retourne la décision : les deux ont les mêmes notes de temps, de mémoire et de coût, et B est devant sur la lisibilité (+ 1) et la robustesse (+ 2). Il faudrait qu'A* gagne deux notes de temps sur le tas pour passer devant (8 points contre 6), ce qu'aucune de nos mesures n'approche. Entre B et A, l'écart vaut 3 x poids du temps - poids de la lisibilité - poids du coût, soit + 9 avec les poids du ticket : A ne passe devant que si la lisibilité et le coût pèsent ensemble plus de trois fois le temps, par exemple temps 1, mémoire 1, lisibilité 4, robustesse 2, coût 2, où A l'emporte 41 contre 38. La décision est solide.
