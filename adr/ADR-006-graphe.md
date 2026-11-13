# ADR-006 - Ranger le réseau routier de la métropole en mémoire avec la variante `compacts`

## 1. Contexte

Pour recalculer les tournées sur les vraies rues (ticket T-0733, dont cette décision est le préalable), il faut le réseau routier de la métropole en mémoire, dans le processus qui sert aussi le site et l'API : un seul processus Node, sur une VM de 32 Go qui héberge aussi la base (pièce 03). Le réseau (`npm run graphe`, données OpenStreetMap) compte 46 565 carrefours, 111 288 arêtes orientées et 5 177 km de voies, soit 2,4 arêtes par carrefour en moyenne. La structure du legacy, la matrice, demanderait 46 565 x 46 565 = 2,17 milliards de cases, 16,2 Go, la moitié de la VM, dont 0,0051 % utiles : une case sur 19 484 contient une rue. La contrainte est la mémoire d'abord, le temps ensuite.

## 2. Options comparées

n est le nombre de carrefours, `m` le nombre d'arêtes.

- Option A (legacy, `matrice`) : un tableau n x n, la case `[u][v]` vaut la longueur de l'arête de u vers v, 0 s'il n'y en a pas (`matriceDistances` de `legacy/src/tournees.ts`). Complexité annoncée : O(n²) en mémoire et en temps.
- Option B (`listes`) : pour chaque carrefour, la liste de ses arêtes sortantes. Complexité annoncée : O(n + m) en mémoire et en temps.
- Option C (`compacts`) : les mêmes listes rangées bout à bout dans trois grands tableaux (`debut`, `cible`, `poids`). Complexité annoncée : O(n + m) en mémoire et en temps, avec moins d'objets.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : `data/referentiel/graphe`, des sous-graphes de 1 000 à 46 565 carrefours, les premiers atteints depuis le hub de Brienne.
- Répétitions et échauffement : 3 répétitions et 2 tours d'échauffement jusqu'à 5 000 carrefours, 5 répétitions et 5 tours de 5 000 à 46 565.
- Statistique retenue : la médiane.
- Mesuré : la construction de la représentation puis un parcours en largeur depuis le hub, et la mémoire prise pendant l'appel. Somme de contrôle identique pour les variantes à chaque taille.

| Option | 1 000 | 5 000 | 20 000 | 46 565 | Mémoire à 46 565 |
| --- | --- | --- | --- | --- | --- |
| A (`matrice`) | 2,6 ms | 56,6 ms | non mesuré | impossible | 16,2 Go, calculée |
| B (`listes`) | 0,3 ms | 1,2 ms | 2,8 ms | 6,9 ms | 21,8 Mo |
| C (`compacts`) | 1,6 ms | 0,7 ms | 0,8 ms | 1,7 ms | 6,6 Mo |

Fichiers : `bench/resultats/2026-11-12T14-41-53-graphe.csv` (matrice et listes, 1 000 à 5 000 carrefours), `bench/resultats/2026-11-12T14-42-54-graphe.csv` (listes et compacts, 5 000 à 46 565), `bench/resultats/2026-11-12T14-45-31-graphe.csv` (compacts à 1 000 ; durée relevée après 2 tours d'échauffement seulement, non stabilisée, à ne pas comparer aux autres colonnes).

La mémoire de la matrice passe de 7,9 Mo à 1 000 carrefours à 191,5 Mo à 5 000 : un rapport de 24,1 pour cinq fois plus de carrefours, le carré attendu (25). Celle des listes passe de 0,5 Mo à 2,5 Mo sur les mêmes tailles, un rapport de 5.

La matrice ne se mesure pas à 46 565 carrefours : Node s'arrête à court de mémoire. Sa mémoire est calculée, 8 octets la case, soit 16,2 Go ; la mesure à 5 000 carrefours (7,8 octets la case) confirme le calcul. À l'échelle de la métropole, les listes prennent 3,3 fois plus de mémoire que les tableaux compacts et 4 fois plus de temps.

Courbes : `bench/resultats/2026-11-12T14-41-53-graphe.svg` (matrice et listes, 1 000 à 5 000 carrefours : le temps de la matrice est multiplié par 22 pour cinq fois plus de carrefours, celui des listes par 3,5) et `bench/resultats/2026-11-12T14-42-54-graphe.svg` (listes et compacts jusqu'à la métropole entière).

## 4. Décision

Nous adoptons l'option C (`compacts`), total pondéré 44 contre 43 pour `listes` et 20 pour la matrice (`adr/GRILLE-ADR-006.md`) : la mémoire, qui pèse 4, interdit la matrice, 16,2 Go calculés, et départage les deux autres, 6,6 Mo mesurés pour les tableaux compacts contre 21,8 Mo pour les listes.

## 5. Conséquences et limites

La décision coûte en lisibilité et en souplesse, pas en mémoire ni en temps : il faut connaître le tableau `debut` et sa lecture par intervalle, et fermer une rue (un pont qui se lève) oblige à reconstruire les trois tableaux, quand les listes retirent une entrée. Cette reconstruction est comprise dans notre mesure, 1,7 ms pour construire puis parcourir la métropole entière. La décision est fragile : elle ne tient que d'un point, et un seul point de poids passé de la mémoire à la lisibilité donne l'avantage aux listes, 43 contre 42. Si l'équipe doit modifier le réseau souvent ou relire ce code sans l'avoir écrit, les listes sont défendables : elles ne coûtent que 15 Mo de plus sur une VM de 32 Go. La matrice ne l'est pas : outre ses 16,2 Go, elle perd en silence 1 034 arêtes sur 111 288, les tronçons parallèles entre les mêmes carrefours (110 254 paires distinctes). Non mesuré : la VM du site et son Node 18 (nos mesures sont sous Node 24), la mémoire de pointe du processus entier, les calculs de plus court chemin qui liront cette structure (atelier 10).

Domaine de validité : nous avons fait varier le nombre de carrefours (1 000, 2 000, 5 000, 20 000 et 46 565). Nous n'avons fait varier ni le hub de départ (Brienne), ni le nombre d'arêtes par carrefour (2,4). En 2027, avec Libourne et le Bassin, Efrei prévoit 12 000 colis par jour ouvré contre 6 000 en septembre 2026 (pièce 06) : le nombre de colis ne change pas la taille du réseau, c'est le territoire qui l'agrandit, et nous ne connaissons pas le nombre de carrefours de ces deux secteurs. Or la décision y est sensible. Les tableaux compacts prennent 0,15 ko par carrefour : ils passent 10 Mo, et perdent leur note 5 de mémoire, vers 70 000 carrefours, 1,5 fois la métropole. Au-delà, les deux options ont la même note de mémoire et les listes repassent devant, 43 contre 40, jusqu'à ce qu'elles dépassent elles-mêmes 100 Mo (0,48 ko par carrefour, vers 213 000 carrefours, 4,6 fois la métropole). La décision vaut donc pour la métropole et jusqu'à 70 000 carrefours ; elle se rejoue dès que le réseau de Libourne et du Bassin est connu. La matrice vaut 1,7 Go à 15 000 carrefours et 74,5 Go à 100 000 ; elle dépasse le tas de Node entre 16 400 carrefours (2 Go) et 23 200 (4 Go), soit un tiers à la moitié de la métropole.

## 6. En trois phrases pour la directrice des opérations

Pour calculer les tournées sur les vraies rues, le serveur doit garder en tête la carte des 46 565 carrefours de la métropole, et la façon actuelle de la noter prévoit une case pour chaque paire de carrefours, soit plus de deux milliards de cases presque toutes vides : elles prendraient la moitié de la place du serveur. Nous retenons une façon de faire qui ne note que les rues qui existent, rangées les unes derrière les autres : la carte entière tient alors dans une place plus de deux mille fois plus petite et se charge en quelques millièmes de seconde. Ce choix est serré avec une façon voisine, un peu plus gourmande mais plus simple à corriger quand un pont se lève, et il faudra le revoir quand la carte s'étendra à Libourne et au Bassin.
