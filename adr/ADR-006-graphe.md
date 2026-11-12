# ADR-006 - Ranger le réseau routier de la métropole en tableaux compacts

## 1. Contexte

Pour recalculer les tournées sur les vraies rues (ticket T-0733, un pont qui se lève), il faut le réseau routier de Bordeaux Métropole en mémoire, dans le processus qui sert aussi le site et l'API. `npm run graphe` décrit un réseau de 46 565 carrefours et 111 288 arêtes orientées, 5 177 km de voies, 2,4 arêtes par carrefour en moyenne. Le legacy range les distances dans une matrice d'adjacence : pour toute la métropole, 46 565 x 46 565 = 2,17 milliards de cases, soit 16,2 Go à 8 octets la case, dont 0,0051 % de cases utiles (une case sur 19 484 contient une rue). La contrainte est la mémoire du processus, puis le temps d'un parcours ; en 2027, avec Libourne et le Bassin, Efrei prévoit 12 000 colis par jour ouvré contre 6 000 en septembre 2026.

## 2. Options comparées

- Option A (legacy, `matrice`) : un tableau n x n, la case [u][v] vaut la longueur de l'arête u -> v ; les voisins de u s'obtiennent en lisant toute la ligne u. Complexité annoncée : O(n²) en mémoire et en temps, n étant le nombre de carrefours.
- Option B (`listes`) : pour chaque carrefour, la liste de ses arêtes sortantes. Complexité annoncée : O(n + m) en mémoire et en temps, m étant le nombre d'arêtes.
- Option C (`compacts`) : les mêmes listes rangées bout à bout dans trois tableaux (`debut`, `cible`, `poids`) ; les rues de u sont aux cases `debut[u]` à `debut[u + 1] - 1`. Complexité annoncée : O(n + m) en mémoire et en temps, avec moins d'objets que B.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : sous-graphes de n carrefours (les n premiers atteints depuis le hub de Brienne) de 1 000 à 5 000 pour la matrice, jusqu'aux 46 565 carrefours du réseau (OpenStreetMap, `data/referentiel/graphe`) pour les listes et les tableaux compacts.
- Répétitions et échauffement : 3 répétitions et 2 tours d'échauffement pour la matrice et les listes à 1 000-5 000 carrefours ; 5 répétitions et 5 tours d'échauffement jusqu'à 46 565.
- Statistique retenue : la médiane.
- Ce qui est mesuré : la durée de la construction de la structure puis d'un parcours depuis le hub, et la mémoire prise après un passage du garbage collector. Somme de contrôle identique pour les trois variantes à chaque taille. CSV : `bench/resultats/2026-11-12T14-51-54-graphe.csv` et `bench/resultats/2026-11-12T14-52-05-graphe.csv`.

| Option | 1 000 carrefours | 5 000 | 20 000 | 46 565 | Mémoire à 46 565 |
| --- | --- | --- | --- | --- | --- |
| A (`matrice`) | 5,1 ms | 91,4 ms | non mesuré (3,2 Go calculés) | impossible (non mesuré) | 16,2 Go calculés |
| B (`listes`) | 0,68 ms | 1,29 ms | 4,06 ms | 12,4 ms | 17,4 Mo |
| C (`compacts`) | non mesuré | 0,47 ms | 1,24 ms | 2,9 ms | 6,6 Mo |

La mémoire de la matrice grandit comme le carré du nombre de carrefours : 8,2 Mo à 1 000, 31,6 Mo à 2 000, 196 Mo à 5 000, soit 23,8 fois la mémoire à 1 000 pour 5 fois plus de carrefours (25 attendu pour un carré). La matrice ne se mesure pas à 46 565 carrefours, Node s'arrêterait à court de mémoire : ses 16,2 Go sont calculés. Les listes occupent 17,4 Mo et les tableaux compacts 6,6 Mo, soit 2,6 fois moins ; les tableaux compacts sont aussi 4 fois plus rapides à 46 565 carrefours.

## 4. Décision

Nous adoptons l'option C (`compacts`), total pondéré 42 contre 41 pour `listes` et 23 pour la matrice (`adr/GRILLE-ADR-006.md`) ; la mémoire, qui pèse 4, interdit la matrice (16,2 Go calculés, 0,0051 % de cases utiles), et départage les deux autres à 6,6 Mo contre 17,4 Mo.

## 5. Conséquences et limites

La décision entre listes et tableaux compacts est fragile : un seul point passé de la mémoire à la lisibilité (mémoire 3, lisibilité 3) donne l'avantage aux listes, 41 contre 39. Les tableaux compacts sont plus durs à relire (trois tableaux, un cumul de comptes) et à modifier : lever un pont oblige à reconstruire `debut`, `cible` et `poids`, alors que les listes retirent un élément. Si l'équipe préfère modifier le réseau souvent plutôt que gagner 11 Mo, les listes sont défendables. La matrice, elle, perd en silence 1 034 arêtes sur 111 288 (les tronçons parallèles entre mêmes carrefours, 110 254 paires distinctes) : un parcours qui s'appuie sur elle est faux autrement qu'en mémoire. Non mesuré : la matrice à 46 565 et à 20 000 carrefours (calculée), la mémoire du processus entier du site, le temps d'un recalcul complet des tournées (atelier 10).

Domaine de validité : nous avons fait varier le nombre de carrefours (1 000 à 46 565 pour les listes et les tableaux compacts, 1 000 à 5 000 pour la matrice). Nous n'avons pas fait varier la densité du réseau (2,4 arêtes par carrefour) ni le mode de transport. La matrice dépasse 2 Go vers 15 800 carrefours et 4 Go vers 22 400 (n² x 8 octets), 1,8 Go à 15 000 et 80 Go à 100 000 ; les tableaux compacts dépasseraient 100 Mo vers 700 000 carrefours, 15 fois la métropole. Les 12 000 colis par jour de 2027 ne changent pas la taille du réseau, donc pas cette mémoire : seul l'élargissement à Libourne et au Bassin la ferait grandir, et son nombre de carrefours n'est pas connu (pièce 06 non consultée).

## 6. En trois phrases pour la directrice des opérations

Pour recalculer les tournées sur les vraies rues, le site doit garder en mémoire tout le réseau routier de la métropole, et l'ancienne façon de le ranger demanderait des milliards de cases dont presque toutes resteraient vides, bien plus de place que le programme du site n'en a. Nous retenons un rangement qui ne note que les rues qui existent, à la suite les unes des autres : il occupe très peu de place et se parcourt en quelques millièmes de seconde. Ce choix est serré avec un rangement voisin, plus simple à modifier quand un pont se lève, et il vaut tant que le réseau reste de la taille de la métropole.
