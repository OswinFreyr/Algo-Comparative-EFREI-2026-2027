# Grille comparative - ADR-001 : affecter les colis aux livreurs

Ticket : l'étape 2 du batch de nuit (affectation) doit tenir son budget de 43 minutes en décembre, à 15 000 colis.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | ce que la production paiera : durée estimée à 15 000 colis la nuit (couples colis-livreur x 3,26 ms par requête, plus le calcul mesuré), croissance quand le volume grandit | 4 |
| Mémoire | pic mémoire à 10 000 colis, lu comme un ordre de grandeur | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | comportement sur les doublons, les vides, les entrées invalides | 2 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux imposés par le ticket ADR-001. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`naive`). Option B : `tri`. Option C : `map`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 4 | 5 | 5 | 5 | 37 |
| B (tri) | 2 | 4 | 4 | 5 | 3 | 33 |
| C (map) | 4 | 4 | 3 | 5 | 3 | 39 |

Total pondéré = 4 x Temps + 1 x Mémoire + 2 x Lisibilité + 2 x Robustesse + 1 x Coût.

Barème de la note de temps (fixé sur le budget de 43 minutes de l'étape 2) : 5 sous 20 minutes, 4 sous 43, 3 sous 65, 2 sous 90, 1 au-delà. Les minutes sont celles de la nuit à 15 000 colis : couples (`bench/resultats/2026-11-09T14-02-13-couples.csv`) x 3,26 ms par requête (1 490 s pour 457 300 requêtes), plus le calcul mesuré par le harness (`bench/resultats/2026-11-09T15-08-17-affectation.csv`).

Justification rapide des notes :

- Temps A : 1 271 770 couples x 3,26 ms = 69,1 minutes, plus 4,7 s de calcul (2,09 s à 10 000 colis, x 2,25 à 15 000) : 69,2 minutes, au-dessus du budget, note 2.
- Temps B : le même nombre de couples que le legacy (1 271 770, il parcourt aussi les 85 livreurs pour chaque colis) : 69,1 minutes, le calcul (estimé à quelques dizaines de ms) ne change rien, note 2.
- Temps C : 651 031 couples x 3,26 ms = 35,4 minutes, calcul (estimé à une dizaine de ms) négligeable, sous le budget, note 4.
- Mémoire : les relevés du tas à 10 000 colis (A 4,4 Mo, B 2,4 Mo, C 5,2 Mo) ne se lisent pas comme une tendance : dans un même lancement, B relève 6,9 Mo à 2 000 colis et 1,3 Mo à 5 000, et la capture de la fiche donne 34 Mo pour B contre 2,4 Mo ici ; c'est le ramasse-miettes qui parle. Tout reste à quelques Mo, la mémoire ne départage pas : même note 4 pour les trois (pas de relance faite, voir la limite dans l'ADR).
- Lisibilité (on part de 5, une idée à connaître coûte un point) : A 5, parcours simple, file, liste des numéros déjà vus et tri de la tournée, aucune idée à connaître ; B 4, une idée : le tri par index pour repérer les doublons ; C 3, deux idées : le Set des numéros vus et la Map des tournées par hub.
- Robustesse : `npm test` passe (2 tests sur 2) pour B et C, A est la référence. Le doublon triple (le même colis trois fois, plus un autre) donne pour les trois options 2 colis affectés et 2 doublons comptés ; un lot vide donne 85 tournées vides ; un hub inconnu lève une erreur claire. Note 5 pour les trois.
- Coût : A 5, rien ne change. B 3, quelques lignes et un tableau d'indices trié à préparer à chaque lancement. C 3, quelques lignes aussi, avec un Set et une Map construits à chaque lancement (pas de structure à maintenir entre deux nuits).

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 : A 34, B 31, C 40. La décision ne change pas (C reste premier) et l'écart passe de 2 à 6 points. En gardant les autres poids (mémoire 1, lisibilité 2, robustesse 2, coût 1), C dépasse A dès que le poids du temps passe 3 (à 3, égalité à 35 contre 35) : le poids imposé, 4, est à un point de la bascule, c'est une décision fragile aux poids, le CTO doit le savoir ; elle est en revanche solide sur les chiffres (35 minutes contre 69).
