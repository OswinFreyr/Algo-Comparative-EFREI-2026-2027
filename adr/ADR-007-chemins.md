# ADR-007 - Recalculer les distances par la route quand le pont se lève avec la variante `tas`

## 1. Contexte

Ticket T-0733 : le 8 septembre à 14h02, le pont Chaban-Delmas se lève ; le legacy met 11 minutes à recalculer 23 tournées et les tablettes restent figées. Rejoué sur le réseau réel (`npm run pont`, jeu `moyenne`) : 75 tournées en cours à 14h02, 21 passaient par le pont, 23 sont à recalculer (15 vélos cargo, 8 utilitaires). Leur reste à parcourir passe de 2 465,7 km pont ouvert à 2 562,2 km pont levé, soit 96,6 km de détour, dont 14,1 km pour la tournée la plus touchée. Chaque livreur a 15 arrêts restants : 345 distances à recalculer, sur un réseau de 46 565 carrefours rangé en tableaux compacts (ADR-006). La contrainte : des distances justes au mètre, rendues pendant qu'un livreur attend au feu.

## 2. Options comparées

`n` est le nombre de carrefours, `m` le nombre d'arêtes. Le legacy du 8 septembre (11 minutes) n'est pas une option notée.

- Option A (`simple`) : Dijkstra sans tas ; à chaque tour, on relit tous les carrefours pour trouver le plus proche pas encore fixé. Complexité annoncée : O(n²) par livreur.
- Option B (`tas`) : Dijkstra avec le tas binaire de l'atelier 6 ; le carrefour le plus proche sort du tas, une recherche par livreur, arrêtée quand tous ses arrêts sont fixés. Complexité annoncée : O((n + m) log n) par livreur.
- Option C (`astar`) : A*, une recherche par arrêt, guidée par la distance à vol d'oiseau jusqu'à cet arrêt. Complexité annoncée : O((n + m) log n) par arrêt au pire, bien moins de carrefours visités en pratique.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : le scénario du 8 septembre à 14h02 sur le jeu `moyenne`, pont levé ; la taille est le nombre de tournées recalculées, de 1 à 23.
- Répétitions et échauffement : `simple`, 3 répétitions sans échauffement (une tournée dure des secondes) ; `tas` et `astar`, 15 répétitions et 5 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : le temps du recalcul de toutes les distances des tournées, réseau déjà chargé, et la mémoire prise pendant l'appel. Somme de contrôle identique entre `simple` et `tas` à 1 et 2 tournées, entre `tas` et `astar` à 1, 5 et 23 : les distances sont les mêmes au mètre.

| Option | 1 tournée | 2 tournées | 5 tournées | 23 tournées | Mémoire |
| --- | --- | --- | --- | --- | --- |
| A (`simple`) | 3 731 ms | 21 435 ms | non mesuré | non mesuré, 86 s à 4 min estimées | 0,8 Mo à 2 tournées |
| B (`tas`) | 9,1 ms | non mesuré | 31,9 ms | 126,9 ms | 29,5 Mo |
| C (`astar`) | 9,4 ms | non mesuré | 48,0 ms | 220,5 ms | 25,4 Mo |

Fichiers : `bench/resultats/2026-11-13T10-59-18-chemins.csv` (`simple` et `tas`, 1 et 2 tournées) et `bench/resultats/2026-11-13T11-06-01-chemins.csv` (`tas` et `astar`, 1, 5 et 23 tournées).

Sans tas, une seule tournée prend 3,7 s, 410 fois plus qu'avec le tas, et la deuxième en prend 17,7 : le temps dépend de l'éloignement des arrêts, pas seulement du nombre de tournées. L'estimation pour les 23 va donc de 86 s (3,7 s par tournée) à 4 min (10,7 s par tournée) ; nous ne l'avons pas mesurée.

L'échauffement compte ici. Une première série à 3 tours d'échauffement et 5 répétitions (`bench/resultats/2026-11-13T11-03-52-chemins.csv`) donnait 475 ms pour le tas et 827 ms pour A* à 23 tournées, trois à quatre fois plus : le code n'était pas encore compilé au moment de la mesure. Nous l'écartons et la gardons comme trace ; `npm run pont` (119 ms et 215 ms) et la série à 5 tours concordent.

Courbe : `bench/resultats/2026-11-13T11-06-01-chemins.svg` (`npm run courbe -- bench/resultats/2026-11-13T11-06-01-chemins.csv --log`). Pour 23 fois plus de tournées, le temps du tas est multiplié par 14 et celui de A* par 23 : A* paie chaque arrêt, le tas paie chaque livreur.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 44 contre 38 pour A* et 35 pour Dijkstra sans tas (`adr/GRILLE-ADR-007.md`) : les 23 tournées sont recalculées en 127 ms, au mètre près, et à temps égal devant le barème c'est la robustesse qui écarte A*, juste seulement tant que le vol d'oiseau ne surestime jamais la route.

## 5. Conséquences et limites

La décision coûte 30 Mo pendant le recalcul et une dépendance au tas de l'atelier 6, qu'il faut maintenir : s'il est faux, les distances le sont aussi. Dans les 23 tournées, 3 arrêts sur 345 restent injoignables pont levé (distance -1), pour le tas comme pour A* : ils sont à traiter à part. Non mesuré : la VM du site et son Node 18 (nos mesures sont sous Node 24), le premier recalcul à froid en production (notre série à 3 tours d'échauffement donne 475 ms, encore sous la seconde), Dijkstra sans tas à 23 tournées.

Les distances sont justes, l'ordre des arrêts ne l'est plus : personne ne l'a recalculé. Pour les 15 arrêts qui restent à un livreur, il y a 1,31 x 10^12 ordres possibles ; à notre rythme (`npm run voyageur`, 11 arrêts essayés en 1,6 s), les essayer tous prendrait 14,7 heures, et 40 arrêts 10^33 années. Essayer tous les ordres n'est pas une option au-delà de 11 arrêts : il faudra une méthode approchée, qui est une autre décision.

Domaine de validité : nous avons fait varier le nombre de tournées (1 et 2 pour `simple`, 1, 5 et 23 pour `tas` et `astar`). Nous n'avons fait varier ni le nombre d'arrêts par livreur (15), ni le jeu (`moyenne`), ni l'heure et le pont levé, ni la taille du réseau (46 565 carrefours). Le tas coûte 5,5 ms par livreur (126,9 / 23), A* 0,64 ms par arrêt (220,5 / 345) : A* passe devant en temps sous 8,6 arrêts par livreur, donc à 8 arrêts restants ou moins. Cela ne change pas la décision : les deux resteraient sous la seconde, et A* garde sa note 3 de robustesse. La note 5 de temps du tas tient jusqu'à 180 tournées recalculées d'un coup, plus que les 75 en cours le 8 septembre (0,4 s) et que les 150 attendues si le volume double en 2027 (pièce 06) ; A* passerait la seconde dès 104 tournées. Si le réseau s'étend à Libourne et au Bassin, le temps par livreur grandit avec le nombre de carrefours : à mesurer quand ce réseau sera connu.

## 6. En trois phrases pour la directrice des opérations

Quand le pont se lève, il faut recalculer par la route la distance entre chaque livreur et les arrêts qui lui restent, et le 8 septembre ce recalcul a pris onze minutes pour 23 tournées pendant que les tablettes restaient figées. Nous retenons une méthode qui part de la position du livreur et avance de carrefour en carrefour en prenant toujours le plus proche d'abord, grâce à une liste d'attente qui garde le plus proche en tête : les 23 tournées sont recalculées en moins d'une seconde, au mètre près, le temps d'un feu rouge. Elle donne les bonnes distances mais ne dit pas dans quel ordre faire les arrêts, car essayer tous les ordres possibles pour quinze arrêts prendrait plus d'une demi-journée, et ce sera une autre décision.
