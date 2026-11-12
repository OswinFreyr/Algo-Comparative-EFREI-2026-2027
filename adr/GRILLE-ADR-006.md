# Grille comparative - ADR-006 : ranger le réseau routier de la métropole en mémoire

Ticket T-0733 (préalable) : recalculer les tournées sur les vraies rues demande le réseau routier de Bordeaux Métropole en mémoire, dans le processus qui sert aussi le site et l'API : 46 565 carrefours, 111 288 arêtes orientées. Les poids sont ceux de la fiche atelier 9 : temps 2, mémoire 4, lisibilité 2, robustesse 1, coût 1.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée d'un parcours du réseau entier (46 565 carrefours) depuis le hub, lignes déjà construites ; la construction est comprise dans la mesure | 2 |
| Mémoire | mémoire de la structure à 46 565 carrefours, dans un processus qui sert aussi le site et l'API | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | ce que la représentation garde du réseau : toutes les arêtes, ou en perd-elle | 1 |
| Coût de mise en oeuvre | lignes à écrire et ce qu'il faut refaire quand le réseau change (un pont qui se lève) | 1 |

Aucun critère à 0. La mémoire pèse le plus : le réseau partage le processus du site, et la matrice de toute la métropole demande 16,2 Go. Le temps ne pèse que 2 : le parcours se fait une fois par recalcul, pas à chaque requête de page. La robustesse ne pèse que 1 : les écarts du réseau se règlent à la lecture des données.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy, la `matrice` d'adjacence (celle de `legacy/src/tournees.ts`). Option B : les `listes` d'adjacence. Option C : les tableaux `compacts` (debut, cible, poids).

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (matrice) | 1 | 1 | 5 | 2 | 5 | 23 |
| B (listes) | 4 | 4 | 4 | 5 | 4 | 41 |
| C (compacts) | 5 | 5 | 2 | 5 | 3 | 42 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Les barèmes (fiche atelier 9, écrits avant de noter) :

- Temps, pour la métropole entière : 5 sous 10 ms, 4 sous 100 ms, 3 sous 1 s, 2 sous 10 s, 1 au-delà ou impossible.
- Mémoire, colonne `memoire_ko` du harness à 46 565 carrefours, lue comme un ordre de grandeur : 5 sous 10 Mo, 4 sous 100 Mo, 3 sous 1 Go, 2 sous 4 Go, 1 au-delà. Deux options à moins d'un facteur 2 l'une de l'autre ont la même note. La matrice ne se mesure pas à cette taille : sa mémoire se calcule (`npm run graphe`).
- Lisibilité : on part de 5, un point de moins par idée à connaître (un tableau de listes, le tableau `debut` qui indexe les deux autres, la lecture de `debut[u]` à `debut[u + 1] - 1`) pour répondre à trois questions : que fait la variante, comment lit-elle les voisins d'un carrefour, où retirer une rue.
- Robustesse : 5 si la représentation garde toutes les arêtes, y compris deux tronçons parallèles entre les mêmes carrefours ; 3 si elle en perd mais le dit ; 2 si elle en perd en silence ; 1 si `npm test` échoue.
- Coût : 5 si rien n'est à écrire ; 4 pour quelques lignes sans donnée à reconstruire ; 3 pour quelques lignes et une donnée à reconstruire quand le réseau change ; 2 pour une structure nouvelle dans l'équipe ; 1 si une dépendance s'ajoute.

Mesures (médiane) : `bench/resultats/2026-11-12T14-51-54-graphe.csv` (matrice et listes de 1 000 à 5 000 carrefours, 3 répétitions, 2 tours d'échauffement) et `bench/resultats/2026-11-12T14-52-05-graphe.csv` (listes et compacts jusqu'à 46 565 carrefours, 5 répétitions, 5 tours d'échauffement).

Justification des notes :

- Temps : A impossible à 46 565 carrefours (la matrice fait 2,17 milliards de cases, Node s'arrête à court de mémoire) et 91,4 ms déjà à 5 000 carrefours, en croissance quadratique : note 1. B 12,4 ms, entre 10 et 100 ms : note 4. C 2,9 ms, sous 10 ms : note 5.
- Mémoire : A 16,2 Go calculés (46 565² cases à 8 octets), la mesure à 5 000 carrefours donne 196 Mo pour 25 millions de cases : note 1. B 17,4 Mo (17 775 ko), sous 100 Mo : note 4. C 6,6 Mo (6 808 ko), sous 10 Mo : note 5 ; B et C sont à un facteur 2,6, ce qui justifie deux notes.
- Lisibilité : A 5, un tableau à deux entrées, aucune idée de plus. B 4, une idée : le tableau de listes. C 2, deux idées de plus que A : le tableau `debut` qui indexe `cible` et `poids`, et la lecture de `debut[u]` à `debut[u + 1] - 1` ; sa construction demande en plus un cumul des comptes.
- Robustesse : `npm test` passe pour la représentation du réseau (le seul test en échec, Dijkstra avec tas, attend l'atelier 10). La matrice n'a qu'une case par paire de carrefours : sur le réseau entier elle perd en silence 1 034 arêtes sur 111 288 (111 288 arêtes, 110 254 paires distinctes), les tronçons parallèles : note 2. B et C gardent les 111 288 arêtes : note 5.
- Coût : A 5, la matrice existe dans le legacy. B 4, trois lignes ; lever un pont, c'est retirer des éléments d'une liste, sans rien reconstruire. C 3, quelques lignes, et les trois tableaux sont à reconstruire quand le réseau change (un pont qui se lève).

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 4, robustesse 1, coût 1) : A 21, B 49, C 55. La décision ne change pas, C reste premier.

La bascule est proche, dans l'autre sens : B et C ne diffèrent que de +1 sur le temps, +1 sur la mémoire, -2 sur la lisibilité et -1 sur le coût, soit un écart de 1 point (42 contre 41). En passant un seul point de la mémoire à la lisibilité (temps 2, mémoire 3, lisibilité 3, robustesse 1, coût 1), B passe devant, 41 contre 39. La décision entre listes et tableaux compacts est donc fragile : elle tient parce que la mémoire pèse 4. La matrice, elle, reste très en dessous dans les deux essais (21, puis 27).
