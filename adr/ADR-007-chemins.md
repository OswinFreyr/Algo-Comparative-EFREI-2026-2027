# ADR-007 - Recalculer les distances par la route des 23 tournées quand le pont se lève

## 1. Contexte

Le 8 septembre à 14h02, le pont Jacques Chaban-Delmas se lève (ticket T-0733). Sur le jeu moyenne, 75 tournées sont en cours, 21 passaient par le pont : avec deux autres à vérifier, 23 tournées sont à recalculer (15 vélos cargo, 8 utilitaires). Le détour représente 96,6 km (2 465,7 km restants pont ouvert, 2 562,2 km pont levé), 14,1 km de plus pour la tournée la plus touchée (L075). Le legacy a mis 11 minutes à tout recalculer, tablettes figées (`npm run pont`). La contrainte est le temps de recalcul des 23 tournées, pendant qu'un livreur attend au feu.

## 2. Options comparées

- Option A (legacy, Dijkstra sans tas) : à chaque tour, parcourir tous les carrefours pour trouver le plus proche non fixé (`dijkstraSimple`, `bench/variantes/chemins.ts`). Complexité annoncée : O(n²) par départ, n étant le nombre de carrefours.
- Option B (Dijkstra avec tas) : le tas binaire de l'atelier 6 garde les carrefours en attente, le plus proche sort au sommet ; la recherche s'arrête quand tous les arrêts sont fixés. Complexité annoncée : O((n + m) log n) par départ, m étant le nombre de rues.
- Option C (A*) : une recherche par arrêt, guidée par la distance à vol d'oiseau jusqu'à l'arrêt visé. Complexité annoncée : même ordre que B par recherche, mais k recherches pour k arrêts, et moins de carrefours fixés par recherche.

La grille et les notes sont dans `adr/GRILLE-ADR-007.md` : A 38, B 46, C 40.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/moyenne`, réseau routier de Bordeaux, 23 tournées à recalculer, pont levé retiré ; tailles 1, 2, 5 et 23 tournées.
- Répétitions et échauffement : A, 3 répétitions sans échauffement (une tournée prend déjà plusieurs secondes) ; B et C, 5 répétitions et 3 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : la durée du calcul des distances et la mémoire prise pendant l'appel, dans `bench/resultats/2026-11-13T10-27-49-chemins.csv` (A et B, 1 et 2 tournées) et `bench/resultats/2026-11-13T10-32-03-chemins.csv` (B et C, 1, 5 et 23 tournées). Même somme de contrôle pour toutes les options à chaque taille : les distances sont identiques au mètre.

| Option | 1 tournée | 2 tournées | 5 tournées | 23 tournées | Mémoire à 23 tournées |
| --- | --- | --- | --- | --- | --- |
| A (Dijkstra sans tas) | 3 509,7 ms | 5 196,3 ms | non mesuré | 79,5 s (extrapolé par `npm run pont`, non mesuré) | quelques Mo (mesuré à 1 et 2 tournées) |
| B (Dijkstra avec tas) | 14,5 ms | 19,1 ms | 43,6 ms | 134,2 ms | 13,9 Mo |
| C (A*) | 11,3 ms | non mesuré | 48,2 ms | 233,4 ms | 14,7 Mo |

Les chiffres de B à 1 et 5 tournées sont ceux du second fichier ; à 2 tournées, ceux du premier (19,1 ms). `npm run pont` redonne 123 ms pour B et 234 ms pour C sur les 23 tournées, et 3,5 s par tournée pour A, soit 79,5 s au total.

Courbe : `bench/resultats/2026-11-13T10-32-03-chemins.svg`.

## 4. Décision

Nous adoptons l'option B (Dijkstra avec tas), total pondéré 46 contre 40 pour A* et 38 pour le legacy (`adr/GRILLE-ADR-007.md`), parce que le temps des 23 tournées, qui pèse 4, tombe de 79,5 s à 134 ms ; A*, plus lent (233 ms), exige en plus une hypothèse sur le vol d'oiseau et deux idées de plus à comprendre.

## 5. Conséquences et limites

Le code demande de connaître le tas et ses entrées périmées (un carrefour peut y entrer plusieurs fois, seule la première sortie compte), et s'appuie sur le tas de l'atelier 6 : s'il est faux, les distances le sont aussi, d'où le garde-fou `verifierDijkstraTas`. Les distances sont recalculées, pas l'ordre des arrêts : essayer tous les ordres des 15 arrêts qui restent à un livreur fait 1,31 x 10^12 ordres, soit 18,8 heures à notre rythme (11 arrêts : 3,99 x 10^7 ordres en 2 063 ms, `npm run voyageur`) ; l'ordre ne se recalcule donc pas par essai exhaustif (travelling salesman problem), un autre travail. Non mesuré : A à 5 et 23 tournées (extrapolé), la mémoire de A à 23 tournées, les tablettes et le réseau des livreurs.

Domaine de validité : nous avons fait varier le nombre de tournées (1, 2, 5 et 23) sur un seul jeu (moyenne), avec jusqu'à 15 arrêts par livreur ; nous n'avons pas fait varier la taille du réseau ni le nombre d'arrêts par livreur. A* passerait devant B sous 8,6 arrêts par livreur : B coûte 134,2 / 23 = 5,83 ms par livreur, A* 233,4 / (23 x 15) = 0,68 ms par arrêt, soit un rapport de 8,6. La décision ne tient plus pour une tournée de moins de 9 arrêts en moyenne.

## 6. En trois phrases pour la directrice des opérations

Quand le pont se lève, il faut refaire le chemin de 23 tournées, et l'ancienne façon de faire demandait plus d'une minute alors que le 8 septembre elle a bloqué les tablettes pendant 11 minutes. Nous retenons une façon de chercher qui garde de côté les carrefours les plus proches et ne regarde jamais deux fois le même : les 23 tournées sont refaites en une fraction de seconde, avec exactement les mêmes distances au mètre. Elle ne dit pas dans quel ordre passer les arrêts, ce qu'on ne peut pas refaire à la main pendant qu'un livreur attend, et c'est un autre chantier.
