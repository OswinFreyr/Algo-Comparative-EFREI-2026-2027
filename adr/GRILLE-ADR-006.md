# Grille comparative - ADR-006 : ranger le réseau routier de la métropole en mémoire

Préalable du ticket T-0733 : pour recalculer les tournées sur les vraies rues, il faut le réseau routier de la métropole (46 565 carrefours, 111 288 arêtes orientées) en mémoire, dans le processus qui sert aussi le site et l'API. La contrainte est la mémoire d'abord, le temps ensuite.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée pour construire la représentation de la métropole entière puis la parcourir depuis le hub | 2 |
| Mémoire | mémoire relevée à 46 565 carrefours, lue comme un ordre de grandeur ; calculée quand elle ne se mesure pas | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | `npm test`, puis ce que la représentation garde du réseau | 1 |
| Coût de mise en oeuvre | lignes à écrire, ce qu'il faut refaire quand le réseau change | 1 |

Les poids sont ceux imposés par l'atelier 9. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `matrice`, la structure du legacy. Option B : `listes`. Option C : `compacts`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (matrice) | 1 | 1 | 4 | 2 | 4 | 20 |
| B (listes) | 5 | 4 | 4 | 5 | 4 | 43 |
| C (compacts) | 5 | 5 | 2 | 5 | 3 | 42 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Les barèmes, fixés avant de mesurer (ceux de la fiche atelier 9), pour la métropole entière :

- Mémoire : 5 sous 10 Mo, 4 sous 100 Mo, 3 sous 1 Go, 2 sous 4 Go, 1 au-delà ; `memoire_ko` est un ordre de grandeur, deux options à moins d'un facteur 2 l'une de l'autre ont la même note.
- Temps : 5 sous 10 ms, 4 sous 100 ms, 3 sous 1 s, 2 sous 10 s, 1 au-delà ou impossible.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour dire ce que fait la variante, comment elle lit les voisins d'un carrefour et où retirer une rue.
- Robustesse : 5 si la représentation garde toutes les arêtes, y compris deux tronçons parallèles entre les mêmes carrefours ; 3 si elle en perd mais le dit ; 2 si elle en perd en silence ; 1 si `npm test` échoue.
- Coût : 5 si rien n'est à écrire ; 4 pour quelques lignes sans donnée à reconstruire ; 3 pour quelques lignes et une donnée à reconstruire quand le réseau change ; 2 pour une structure nouvelle dans l'équipe ; 1 si une dépendance s'ajoute.

Mesures : `bench/resultats/2026-11-12T14-41-53-graphe.csv` (matrice et listes, 1 000 à 5 000 carrefours, médiane de 3 répétitions, 2 tours d'échauffement) et `bench/resultats/2026-11-12T14-42-54-graphe.csv` (listes et compacts, 5 000 à 46 565 carrefours, médiane de 5 répétitions, 5 tours d'échauffement).

Justification rapide des notes :

- Mémoire A : non mesurable à 46 565 carrefours, Node s'arrête à court de mémoire. Calculée (`npm run graphe`) : 2,17 milliards de cases, 16,2 Go, au-delà de 4 Go, note 1. Le calcul s'appuie sur la mesure : 191,5 Mo à 5 000 carrefours, soit 7,8 octets la case.
- Mémoire B : 21,8 Mo, sous 100 Mo, note 4. Mémoire C : 6,6 Mo, sous 10 Mo, note 5. Les listes prennent 3,3 fois plus que les tableaux compacts, au-delà du facteur 2 : les deux notes sont distinctes.
- Temps A : impossible à l'échelle de la métropole, note 1 ; déjà 56,6 ms à 5 000 carrefours. Temps B : 6,9 ms, note 5. Temps C : 1,7 ms, note 5 ; quatre fois plus rapide que les listes, mais les deux sont sous 10 ms.
- Lisibilité : A 4, une idée, le tableau à deux dimensions dont on lit toute la ligne. B 4, une idée, le tableau de listes. C 2, trois idées : les trois tableaux rangés bout à bout, le tableau `debut` qui indexe les deux autres, la lecture de `debut[u]` à `debut[u + 1] - 1` ; retirer une rue oblige à décaler tout ce qui suit.
- Robustesse : `npm test` passe pour les deux tests du réseau. A 2 : une seule case par paire de carrefours, le second de deux tronçons parallèles écrase le premier, en silence. B 5 et C 5 : une entrée par arête, les 111 288 sont gardées.
- Coût : A 4, la variante est écrite, quelques lignes pour la brancher, et fermer une rue revient à remettre une case à zéro. B 4, quelques lignes, et fermer une rue revient à retirer une entrée d'une liste. C 3 : quelques lignes, mais les trois tableaux se reconstruisent quand le réseau change (un pont qui se lève).

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 4, robustesse 1, coût 1) : A 19, B 54, C 55. La décision change : les tableaux compacts passent devant les listes d'un point.

La matrice est écartée quels que soient les poids. Entre B et C, le temps et la robustesse ne départagent pas : l'écart vaut 2 x poids de la lisibilité + poids du coût - poids de la mémoire, soit + 1 pour B avec les poids de l'atelier. Il suffit d'un point de lisibilité en moins, ou d'un point de mémoire en plus pris sur le coût, pour que C égale ou dépasse B. La décision est fragile et l'ADR le dit : elle tient à la lisibilité, pas à une mesure.
