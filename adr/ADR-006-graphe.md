# ADR-006 - Ranger le réseau routier de la métropole en tableaux compacts

## 1. Contexte

Pour recalculer les tournées sur les vraies rues (préalable du ticket T-0733, le pont Chaban-Delmas), le réseau de la métropole doit tenir dans le processus qui sert aussi le site et l'API. Il compte 46 565 carrefours et 111 288 rues orientées, 5 177 km de voies (`npm run graphe`). Une matrice d'adjacence ferait 46 565 × 46 565 cases, 2,17 milliards, soit 16,2 Go à 8 octets, dont 0,0051 % de cases utiles : une case sur 19 484 contient une rue. La contrainte est cette mémoire.

## 2. Options comparées

- Option A (`matrice`) : un tableau n × n, la case [u][v] garde la longueur de la rue, 0 s'il n'y en a pas. Lire les voisins, c'est lire toute la ligne. Complexité annoncée : O(n²) en mémoire et à la construction.
- Option B (`listes`) : pour chaque carrefour, la liste de ses rues sortantes. Complexité annoncée : O(n + m), m le nombre de rues.
- Option C (`compacts`) : les mêmes listes rangées bout à bout dans trois tableaux, `debut`, `cible` et `poids`. Les rues de u vont de `debut[u]` à `debut[u + 1] - 1`. Complexité annoncée : O(n + m), avec moins d'objets.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Réseau : `data/referentiel/graphe`. Les tailles sont des sous-graphes : les premiers carrefours atteints depuis le hub de Brienne, puis la métropole entière.
- Répétitions et échauffement : matrice et listes, 3 répétitions et 2 tours, à 1 000, 2 000 et 5 000 carrefours. Listes et compacts, 5 répétitions et 5 tours, à 5 000, 20 000 et 46 565.
- Statistique retenue : la médiane.
- Mesuré : le temps de construire puis de parcourir, et la mémoire. La matrice n'est pas lancée à 46 565 carrefours : sa mémoire se calcule. Sommes de contrôle identiques à chaque taille mesurée.

| Option | 1 000 | 5 000 | 20 000 | 46 565 | Mémoire à 46 565 |
| --- | --- | --- | --- | --- | --- |
| A | 4,0 ms | 77,8 ms | non mesuré | impossible | 16,2 Go, calculés |
| B | 0,40 ms | 0,54 ms | 2,5 ms | 5,9 ms | 17,4 Mo |
| C | non mesuré | 0,24 ms | 0,99 ms | 2,2 ms | 6,6 Mo |

De 1 000 à 5 000 carrefours, la mémoire de la matrice passe de 8 238 Ko à 196 118 Ko, un facteur 23,8, contre 25 pour le carré de 5. Celle des listes passe de 0,6 Mo à 1,9 Mo.

Mesures : `bench/resultats/2026-11-13T08-12-22-graphe.csv`, `bench/resultats/2026-11-13T08-12-23-graphe.csv`.

## 4. Décision

Nous adoptons l'option C (`compacts`), total pondéré 44 contre 43 pour les listes et 23 pour la matrice (`adr/GRILLE-ADR-006.md`) : la matrice est interdite par les 16,2 Go calculés, et, entre les deux qui tiennent, les compacts occupent 6,6 Mo contre 17,4 Mo.

## 5. Conséquences et limites

Les compacts sont plus durs à modifier : quand un pont se lève, les trois tableaux se reconstruisent. Les listes se contentent de retirer une rue. L'écart de la grille n'est qu'un point, et il tient au facteur 2,6 entre 6,6 Mo et 17,4 Mo. Un point déplacé de la mémoire vers la lisibilité retourne la décision, 43 pour les listes contre 42. Non mesuré : la matrice à 46 565 carrefours, et le réseau au-delà de la métropole.

Domaine de validité : nous avons fait varier le nombre de carrefours (1 000, 2 000, 5 000, 20 000, 46 565). Nous n'avons pas fait varier le nombre de rues parallèles, ni ajouté Libourne et le Bassin. La matrice dépasse un tas de 2 Go vers 16 400 carrefours, et un tas de 4 Go vers 23 200 ; à 15 000 elle ferait 1,7 Go, à 100 000 environ 75 Go. Les compacts dépassent 100 Mo vers 700 000 carrefours, quinze fois la métropole. En 2027, Efrei prévoit 12 000 colis par jour contre 6 000 (pièce 06) : même un réseau deux fois plus grand resterait autour de 13 Mo. La décision tient jusque-là.

## 6. En trois phrases pour la directrice des opérations

Pour recalculer les trajets sur les vraies rues, le plan de la métropole doit tenir dans la machine qui sert aussi le site. Une case pour chaque paire de carrefours demanderait plus de mémoire que cette machine n'en a. Nous ne gardons que les rues qui existent, rangées les unes derrière les autres : le plan entier se charge en un instant, et il reste léger même si l'activité double.
