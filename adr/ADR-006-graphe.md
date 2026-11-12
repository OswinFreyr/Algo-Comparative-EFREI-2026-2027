# ADR-006 - Ranger le réseau routier de la métropole en mémoire avec la variante `listes`

## 1. Contexte

Pour recalculer les tournées sur les vraies rues (ticket T-0733, dont cette décision est le préalable), il faut le réseau routier de la métropole en mémoire, dans le processus qui sert aussi le site et l'API. Le réseau (`npm run graphe`, données OpenStreetMap) compte 46 565 carrefours, 111 288 arêtes orientées et 5 177 km de voies, soit 2,4 arêtes par carrefour en moyenne. La structure du legacy, la matrice, demanderait 46 565 x 46 565 = 2,17 milliards de cases, 16,2 Go, dont 0,0051 % utiles : une case sur 19 484 contient une rue. La contrainte est la mémoire d'abord, le temps ensuite.

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

Pas de courbe dans ce premier jet.

## 4. Décision

Nous adoptons l'option B (`listes`), total pondéré 43 contre 42 pour `compacts` et 20 pour la matrice (`adr/GRILLE-ADR-006.md`) : la mémoire, qui pèse 4, interdit la matrice, 16,2 Go calculés contre 21,8 Mo mesurés pour les listes ; face aux tableaux compacts, qui prennent 6,6 Mo, c'est la lisibilité qui départage, d'un seul point.

## 5. Conséquences et limites

La décision coûte 21,8 Mo dans le processus du site, 15 Mo de plus que les tableaux compacts, et un chargement de 7 ms au lieu de 2. Elle est fragile : avec le poids du temps à 5 et celui de la lisibilité à 1, les tableaux compacts passent devant, 55 contre 54. Si le réseau ne change jamais en cours de journée et que personne n'a à modifier ce code, les tableaux compacts sont le meilleur choix. Non mesuré : la VM du site, la mémoire de pointe du processus entier, le coût de retirer une rue dans chaque représentation, les calculs de plus court chemin qui liront cette structure (atelier 10).

Domaine de validité : nous avons fait varier le nombre de carrefours (1 000, 2 000, 5 000, 20 000 et 46 565). Nous n'avons fait varier ni le hub de départ (Brienne), ni le nombre d'arêtes par carrefour (2,4). En 2027, avec Libourne et le Bassin, Efrei prévoit 12 000 colis par jour ouvré contre 6 000 en septembre 2026 (pièce 06) : le nombre de colis ne change pas la taille du réseau, c'est le territoire qui l'agrandit, et nous ne connaissons pas le nombre de carrefours de ces deux secteurs. Les listes prennent 0,48 ko par carrefour : elles restent sous 100 Mo, leur note 4, jusqu'à 213 000 carrefours environ, 4,6 fois la métropole. Les tableaux compacts prennent 0,15 ko par carrefour : ils passent 10 Mo, et perdent leur note 5, vers 70 000 carrefours, 1,5 fois la métropole ; au-delà, les deux options ont la même note de mémoire et les listes mènent de 5 points. La matrice vaut 1,7 Go à 15 000 carrefours et 74,5 Go à 100 000 ; elle dépasse le tas de Node entre 16 400 carrefours (2 Go) et 23 200 (4 Go), soit un tiers à la moitié de la métropole.

## 6. En trois phrases pour la directrice des opérations

Pour calculer les tournées sur les vraies rues, le serveur doit garder en tête la carte des 46 565 carrefours de la métropole, et la façon actuelle de la noter prévoit une case pour chaque paire de carrefours, soit plus de deux milliards de cases presque toutes vides : le serveur n'a pas la place. Nous retenons une façon de faire qui ne note, pour chaque carrefour, que les rues qui en partent : la carte entière tient alors dans une place environ sept cents fois plus petite et se charge en moins d'un centième de seconde. Une autre façon, encore plus économe mais plus difficile à corriger quand une rue ferme, reste une option si le territoire grandit beaucoup avec Libourne et le Bassin.
