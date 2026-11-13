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
- Répétitions et échauffement : `simple`, 3 répétitions sans échauffement (une tournée dure des secondes) ; `tas` et `astar`, 5 répétitions et 3 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : le temps du recalcul de toutes les distances des tournées, réseau déjà chargé, et la mémoire prise pendant l'appel. Somme de contrôle identique entre `simple` et `tas` à 1 et 2 tournées, entre `tas` et `astar` à 1, 5 et 23 : les distances sont les mêmes au mètre.

| Option | 1 tournée | 2 tournées | 5 tournées | 23 tournées | Mémoire |
| --- | --- | --- | --- | --- | --- |
| A (`simple`) | 3 664 ms | 6 201 ms | non mesuré | non mesuré, 71 à 85 s estimées | 0,6 Mo à 1 tournée |
| B (`tas`) | 8,7 ms | 15,3 ms, sans échauffement | 30,8 ms | 115,6 ms | 29,5 Mo |
| C (`astar`) | 8,0 ms | non mesuré | 42,5 ms | 208,6 ms | 25,2 Mo |

Fichiers : `bench/resultats/2026-11-13T13-34-12-chemins.csv` (`simple` et `tas`, 1 et 2 tournées) et `bench/resultats/2026-11-13T13-34-22-chemins.csv` (`tas` et `astar`, 1, 5 et 23 tournées).

Sans tas, une seule tournée prend 3,7 s, 430 fois plus qu'avec le tas dans la même série (8,5 ms). Les 23 tournées ne sont pas mesurées : à 3,1 s par tournée (la mesure à deux) ou 3,7 s (la mesure à une, et `npm run pont -- --simple 2`, 84,5 s), l'estimation va de 71 à 85 s, au-dessus de la minute aux deux bouts.

Ces mesures sont celles du 13 novembre à 14h30. Les séries prises plus tôt le même jour, sur un poste chargé, sont écartées et gardées comme trace : `bench/resultats/2026-11-13T10-59-18-chemins.csv` et `bench/resultats/2026-11-13T13-26-53-chemins.csv` (20 s pour deux tournées sans tas, 3,7 puis 9,8 s pour une), `bench/resultats/2026-11-13T11-03-52-chemins.csv` (475 ms pour le tas et 827 ms pour A* à 23 tournées) et `bench/resultats/2026-11-13T11-06-01-chemins.csv` (127 ms et 221 ms). Une série à 15 répétitions et 5 tours d'échauffement (120 ms et 208 ms) et `npm run pont` (111 ms et 206 ms) concordent avec le tableau.

Courbe : `bench/resultats/2026-11-13T13-34-22-chemins.svg` (`npm run courbe -- bench/resultats/2026-11-13T13-34-22-chemins.csv --log`). Pour 23 fois plus de tournées, le temps du tas est multiplié par 13 et celui de A* par 26 : A* paie chaque arrêt, le tas paie chaque livreur.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 46 contre 40 pour A* et 38 pour Dijkstra sans tas (`adr/GRILLE-ADR-007.md`) : les 23 tournées sont recalculées en 116 ms, au mètre près, et à temps égal devant le barème c'est la robustesse qui écarte A*, juste seulement tant que le vol d'oiseau ne surestime jamais la route.

## 5. Conséquences et limites

La décision coûte 30 Mo pendant le recalcul et une dépendance au tas de l'atelier 6, qu'il faut maintenir : s'il est faux, les distances le sont aussi. Dans les 23 tournées, 3 arrêts sur 345 restent injoignables pont levé (distance -1), pour le tas comme pour A* : ils sont à traiter à part. Non mesuré : la VM du site et son Node 18 (nos mesures sont sous Node 24), le premier recalcul à froid en production (`npm run pont`, sans échauffement, donne 111 ms pour les 23 tournées), Dijkstra sans tas à 23 tournées.

Les distances sont justes, l'ordre des arrêts ne l'est plus : personne ne l'a recalculé. Pour les 15 arrêts qui restent à un livreur, il y a 1,31 x 10^12 ordres possibles ; à notre rythme (`npm run voyageur`, 11 arrêts essayés en 1,7 s), les essayer tous prendrait 15,5 heures, et 40 arrêts 10^33 années. Essayer tous les ordres n'est pas une option au-delà de 11 arrêts : il faudra une méthode approchée, qui est une autre décision.

Domaine de validité : nous avons fait varier le nombre de tournées (1 et 2 pour `simple`, 1, 5 et 23 pour `tas` et `astar`). Nous n'avons fait varier ni le nombre d'arrêts par livreur (15), ni le jeu (`moyenne`), ni l'heure et le pont levé, ni la taille du réseau (46 565 carrefours). Le tas coûte 5,0 ms par livreur (115,6 / 23), A* 0,60 ms par arrêt (208,6 / 345) : A* passe devant en temps sous 8,3 arrêts par livreur, donc à 8 arrêts restants ou moins. Cela ne change pas la décision : les deux resteraient sous la seconde, et A* garde sa note 3 de robustesse. La note 5 de temps du tas tient jusqu'à 200 tournées recalculées d'un coup, plus que les 75 en cours le 8 septembre (0,4 s) et que les 150 attendues si le volume double en 2027 (pièce 06) ; A* passerait la seconde dès 110 tournées. Si le réseau s'étend à Libourne et au Bassin, le temps par livreur grandit avec le nombre de carrefours : à mesurer quand ce réseau sera connu.

## 6. En trois phrases pour la directrice des opérations

Quand le pont se lève, il faut recalculer par la route la distance entre chaque livreur et les arrêts qui lui restent, et le 8 septembre ce recalcul a pris onze minutes pour 23 tournées pendant que les tablettes restaient figées. Nous retenons une méthode qui part de la position du livreur et avance de carrefour en carrefour en prenant toujours le plus proche d'abord, grâce à une liste d'attente qui garde le plus proche en tête : les 23 tournées sont recalculées en moins d'une seconde, au mètre près, le temps d'un feu rouge. Elle donne les bonnes distances mais ne dit pas dans quel ordre faire les arrêts, car essayer tous les ordres possibles pour quinze arrêts prendrait plus d'une demi-journée, et ce sera une autre décision.
