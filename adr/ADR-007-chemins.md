# ADR-007 - Recalculer les distances par la route quand le pont se lève

## 1. Contexte

Le 8 septembre à 14h02, le pont Jacques Chaban-Delmas se lève (ticket T-0733) : 23 tournées à recalculer, 11 minutes de recalcul, les tablettes figées. Rejoué sur le jeu moyenne, 75 tournées sont en cours, 21 passaient par le pont, et 23 sont à recalculer, 15 vélos cargo et 8 utilitaires. Il reste 2 465,7 km pont ouvert et 2 562,2 km pont levé, soit 96,6 km de détour ; la tournée L075, en utilitaire, prend 14,1 km de plus (`npm run pont`). La contrainte est le temps de ce recalcul, au mètre près, pendant qu'un livreur attend au feu.

## 2. Options comparées

- Option A (`simple`) : Dijkstra tel qu'en 1959. À chaque tour, le prochain carrefour est le plus proche parmi tous ceux qui ne sont pas encore fixés. Complexité annoncée : O(n²) par départ.
- Option B (`tas`) : le même Dijkstra, le prochain carrefour sortant du tas binaire de l'atelier 6. Un carrefour peut y figurer plusieurs fois ; seule sa première sortie compte. La recherche s'arrête quand tous les arrêts sont fixés. Complexité annoncée : O((n + m) log n) par départ.
- Option C (`astar`) : une recherche par arrêt. La priorité d'un carrefour est la distance déjà parcourue plus le vol d'oiseau jusqu'à l'arrêt. Complexité annoncée : la même que le tas, mais seulement vers l'arrêt visé, et seulement si le vol d'oiseau ne surestime jamais la route.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeu : `data/jeux/moyenne`, scénario du 8 septembre à 14h02, pont déjà retiré. Tailles : 1, 2, 5 et 23 tournées, 15 arrêts restants au plus.
- Répétitions et échauffement : sans tas et avec le tas, 3 répétitions et pas d'échauffement, à 1 et 2 tournées. Tas et A*, 5 répétitions et 3 tours, à 1, 5 et 23 tournées.
- Statistique retenue : la médiane.
- Mesuré : le temps du recalcul et la mémoire. Les sommes de contrôle sont identiques à chaque taille, `c720f156` pour les 23 tournées.

| Option | 1 | 2 | 5 | 23 | Mémoire |
| --- | --- | --- | --- | --- | --- |
| A | 4 390 ms | 7 677 ms | non mesuré | 109 s, extrapolé | 3,4 Mo |
| B | 13,7 ms | 21,8 ms | 38,9 ms | 150 ms | 13,5 Mo |
| C | 11,2 ms | non mesuré | 52,4 ms | 274 ms | 14,2 Mo |

La colonne des 23 tournées pour Dijkstra sans tas vient de `npm run pont -- --simple 2` : 4,7 s par tournée. La mémoire de cette option est celle d'une tournée, 3 518 Ko.

Mesures : `bench/resultats/2026-11-13T10-36-00-chemins.csv`, `bench/resultats/2026-11-13T10-36-06-chemins.csv`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 46 contre 40 pour A* et 38 pour Dijkstra sans tas (`adr/GRILLE-ADR-007.md`) : les 23 tournées se recalculent en 150 ms, et A*, pourtant sous la seconde, n'est juste que si le vol d'oiseau ne surestime jamais la route.

## 5. Conséquences et limites

Une recherche avec le tas sert tous les arrêts d'un livreur. A* en fait une par arrêt. Le temps du tas pour 23 tournées, divisé par 23, fait 6,5 ms par livreur. Celui de A*, divisé par 23 × 15, fait 0,79 ms par arrêt. Le rapport est 8,2 : sous 8,2 arrêts restants, A* passe devant. Le scénario en laisse jusqu'à 15, et à ce nombre le tas reste plus court, 150 ms contre 274 ms. L'hypothèse du vol d'oiseau est à tenir : si l'unité des longueurs change, A* peut rendre une distance trop courte sans le dire.

L'ordre des arrêts, lui, n'est pas recalculé. Les essayer tous sur la tournée de L001 prend 2,2 s pour 11 arrêts (3,99 × 10^7 ordres, meilleur trajet 35,77 km) et, au même rythme, 20,2 heures pour 15 arrêts (1,31 × 10^12 ordres) et 1,44 × 10^33 années pour 40 (`npm run voyageur`). Ce n'est pas une réponse au ticket.

Domaine de validité : nous avons fait varier le nombre de tournées (1, 2, 5, 23), pas la longueur des rues ni le nombre de carrefours. Dijkstra sans tas n'a pas été chronométré sur les 23 tournées, seulement extrapolé. Les distances restent justes tant que les rues ont une longueur positive ; A* ne le reste que tant que le vol d'oiseau ne dépasse pas la route.

## 6. En trois phrases pour la directrice des opérations

Le 8 septembre, le pont s'est levé et vingt-trois tournées ont dû être recalculées pendant que les livreurs attendaient au feu. Relire tous les carrefours à chaque pas prendrait plus d'une minute ; garder le prochain carrefour déjà prêt, du plus proche au plus loin, termine le recalcul avant que le feu passe au vert. L'autre façon rapide, qui vise un arrêt à la fois en ligne droite, cesse d'être la plus courte dès qu'il reste plus de huit arrêts.
