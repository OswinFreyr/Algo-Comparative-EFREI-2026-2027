# Grille comparative - ADR-003 : servir le plus urgent sur le quai

Ticket : le quai, un soir. 9 000 colis le 9 novembre, 15 000 au pic de décembre, dont des pharmacies. La file doit garder devant le plus urgent, dans l'ordre exact du contrat, quel que soit l'ordre d'arrivée. Le temps se juge sur le calcul d'une soirée, dans le processus de Quai qui sert aussi le site et l'API.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée d'une soirée de 15 000 colis, calcul seul, dans le processus de Quai | 3 |
| Mémoire | pic mémoire de la même soirée | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | ordre exact du contrat, quel que soit l'ordre d'arrivée et le nombre d'heures limites | 3 |
| Coût de mise en oeuvre | lignes changées, structure à écrire, données à préparer | 1 |

Les poids sont ceux du ticket. Aucun critère à 0 : le temps compte, mais moins que sur une page appelée 40 000 fois par jour, parce qu'une soirée de quelques secondes tient. La robustesse pèse autant que le temps : un ordre faux en silence casse le contrat des pharmacies.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`, tri complet à chaque arrivée). Option B : `tas`. Option C : `seaux`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (tableau) | 3 | 4 | 5 | 5 | 5 | 43 |
| B (tas) | 5 | 5 | 3 | 5 | 3 | 44 |
| C (seaux) | 5 | 5 | 4 | 2 | 4 | 38 |

Total pondéré = 3 x Temps + 1 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Barème du temps, fixé avant la mesure sur une soirée de 15 000 colis : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà. Barème de la mémoire, même soirée : 5 sous 10 Mo, 4 sous 50 Mo, 3 sous 200 Mo, 2 sous 1 Go, 1 au-delà. Deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.

Mesures : médianes du harness, jeu `grande`, 5 répétitions, échauffement 2 (`bench/resultats/2026-11-10T11-16-37-priorite.csv`).

Justification des notes :

- Temps : à 15 000 colis, le tableau met 4 514 ms (note 3), le tas 26 ms (note 5), les seaux 2 ms (note 5). De 9 000 à 15 000 colis, le tableau passe de 1 624 ms à 4 514 ms, soit un facteur 2,78, le carré de 15 / 9 : la soirée du legacy croît comme le carré du volume.
- Mémoire : à 15 000 colis, 11 038 Ko pour le tableau (10,8 Mo, note 4), 2 183 Ko pour le tas (2,1 Mo, note 5), 873 Ko pour les seaux (0,9 Mo, note 5). Le relevé du tableau à 9 000 colis est 13 613 Ko, à moins d'un facteur 2 du relevé à 15 000 : même note.
- Lisibilité, on part de 5 et une idée à connaître coûte un point : tableau 5, le tri et le retrait du premier se lisent tels quels ; seaux 4, une idée, une file par priorité ; tas 3, deux idées, l'arbre rangé dans un tableau et ses deux gestes (remonter, descendre).
- Robustesse : le tableau et le tas rendent l'ordre du contrat (priorité, fin de créneau, heure de création, puis rang d'arrivée). Leurs sommes de contrôle concordent sur la soirée ordonnée et sur les arrivées en désordre (`bench/resultats/2026-11-10T11-18-27-priorite-arrivees.csv`, 89c52d41 des deux côtés à 1 000 colis). Note 5. Les seaux ignorent le créneau et l'heure de création : dès que les colis n'arrivent pas dans l'ordre de création, l'ordre est faux en silence (seaux bc776f41 contre tableau 89c52d41, le harness s'arrête). Note 2. L'article 3 du contrat donne en plus deux heures limites aux pharmacies (10 h et 12 h) ; les seaux ne les distinguent pas.
- Coût : tableau 5, rien ne change. Tas 3, la structure est à écrire et à tester (`remonter` et `descendre`). Seaux 4, quelques lignes et une structure déjà fournie, trois files.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 44, B = 51 et C = 44 : la décision ne change pas, le tas reste premier, et l'écart passe de 1 à 7.

La décision est fragile autour des poids choisis. Le tas ne devance le tableau que d'un point (44 contre 43). Il suffit de baisser le poids du temps de 3 à 2 et de reporter ce point sur la robustesse (poids 4) pour que le tableau passe devant : A = 45, B = 44, C = 35. C'est la pente qui tranche : le tableau est quadratique, le tas ne l'est pas. Une soirée du legacy passe 10 s vers 22 300 colis (4 514 ms à 15 000, multipliés par le carré du rapport des volumes) ; sa note de temps tombe alors à 2 et le tas s'écarte. Les seaux ne reviennent pas : leur note de robustesse 2, avec un poids 3, les laisse 6 points derrière le tas.
