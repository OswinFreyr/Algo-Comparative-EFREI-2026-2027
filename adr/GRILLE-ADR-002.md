# Grille comparative - ADR-002 : retrouver le dernier scan d'un colis

Ticket : la page « Où est mon colis », 40 000 fois par jour, parmi 13 millions de scans gardés six mois. La note de temps se lit sur une requête à ce volume, pas sur le lot de 100 mesuré par le harness.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | une requête projetée à 13 millions de scans : la page est appelée 40 000 fois par jour | 5 |
| Mémoire | mémoire de la structure de recherche, mesurée à la construction sur 996 844 scans | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | ce qu'il faut tenir à jour, et le format des numéros | 1 |
| Coût de mise en oeuvre | lignes changées, structure fournie par le langage, dépendance | 1 |

Les poids sont ceux de la fiche. Le temps pèse 5 : une page interactive ne supporte pas d'attendre. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `set`. Option C : `map`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (tableau) | 2 | 5 | 5 | 4 | 5 | 34 |
| B (set) | 2 | 4 | 4 | 3 | 4 | 29 |
| C (map) | 5 | 4 | 4 | 3 | 4 | 44 |

Total pondéré = 5 x Temps + 2 x Mémoire + 1 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barème du temps, sur une requête à 13 millions de scans : 5 sous 10 ms, 4 sous 50 ms, 3 sous 100 ms, 2 sous 1 s, 1 au-delà. On part de la médiane du lot de 100 à 996 844 scans (`bench/resultats/2026-11-10T09-34-05-suivi.csv`), on divise par 100, puis on multiplie par 13 pour le tableau et le Set, qui grandissent avec le nombre de scans. La Map ne grandit pas : une lecture reste une lecture.

Barème de la mémoire, à la construction (`bench/resultats/2026-11-10T09-36-07-suivi-construction.csv`) : 5 sous 1 Mo, 4 sous 10 Mo.

Justification des notes :

- Temps : 1 488,5 ms / 100 = 14,9 ms par requête, fois 13 = 193 ms pour le tableau, note 2. 964,4 ms / 100 = 9,6 ms, fois 13 = 125 ms pour le Set, note 2. La Map met 0,06 ms pour le lot, soit moins de 0,001 ms par requête, note 5. La construction, une fois, coûte 0,02 ms, 290 ms et 765 ms : elle ne change pas ces notes, la page fait 40 000 requêtes par jour.
- Mémoire : 1 Ko pour le tableau, note 5. 5 122 Ko (5 Mo) pour le Set et 7 170 Ko (7 Mo) pour la Map, tous les deux sous 10 Mo et au-dessus de 1 Mo, note 4.
- Lisibilité, on part de 5 et une idée à connaître coûte un point : tableau 5, le parcours se lit tel quel ; Set 4, l'ensemble des numéros connus ; Map 4, le numéro vers son dernier scan.
- Robustesse : tableau 4, rien à tenir à jour, le format du numéro n'est pas vérifié. Set 3 et Map 3, la structure est à tenir à jour quand les scans arrivent. Les trois répondent pareil sur le jeu mesuré (somme `5a720532`).
- Coût : tableau 5, rien ne change. Set 4 et Map 4, quelques lignes et une structure fournie par le langage, aucune dépendance.

## 3. La sensibilité

Les poids du ticket sont déjà un temps à 5 et une lisibilité à 1 : A = 34, B = 29, C = 44. La Map reste première, et le Set ne peut pas la passer : ils sont notés pareil partout sauf sur le temps.

La décision ne bascule pas près de ces poids. Elle se retourne si le temps tombe à 2 et si ces trois points vont à la lisibilité (poids 4) : A = 43, B = 35, C = 41. Avec le temps encore à 3 et la lisibilité à 3, la Map mène 42 contre 40.
