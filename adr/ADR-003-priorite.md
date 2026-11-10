# ADR-003 - Servir les colis les plus urgents d'abord avec le tas

## 1. Contexte

Quand l'extension du contrat des pharmacies reprendra, le quai recevra 9 000 colis par soir, dont 3 000 pour les pharmacies (pièces 05 et 06), et 15 000 au pic de décembre. Le legacy de 2019 retrie toute la file à chaque arrivée, puis retire le premier à chaque prise. Ce calcul tourne dans le processus de Quai, qui sert aussi le site et l'API (pièce 03). La contrainte est double : une soirée de 15 000 colis doit rester courte, et l'ordre rendu doit être celui du contrat, quel que soit l'ordre d'arrivée.

## 2. Options comparées

- Option A (legacy, `tableau`) : à chaque arrivée, tri complet de la file (pharmacies, puis express, puis standard ; à priorité égale, fin de créneau, puis heure de création) ; à chaque prise, retrait du premier. Complexité annoncée : O(n²) pour la soirée.
- Option B (`tas`) : un tas binaire, O(log n) par arrivée et par prise, donc O(n log n) pour la soirée. Le même ordre que le legacy, et le rang d'arrivée départage une égalité complète, comme le tri stable.
- Option C (`seaux`) : trois files, une par priorité, servies dans l'ordre d'arrivée. O(1) par arrivée et par prise, donc O(n) pour la soirée. Elle ne regarde ni la fin de créneau ni l'heure de création.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeux : `data/jeux/grande`, colis uniques. Soirée dans l'ordre de création : 1 000, 9 000 et 15 000 colis. Épreuve des arrivées dans l'ordre du fichier : 1 000 et 9 000 colis.
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement. Épreuve : 3 répétitions, sans échauffement.
- Statistique retenue : la médiane.
- Mesuré : la durée de toute la soirée et la mémoire, sans requête à la base. Somme de contrôle identique pour les trois options à chaque taille de la soirée ordonnée (`e851643b`, `cf42b773`, `ca48eff0`).

| Option | 1 000 | 9 000 | 15 000 | Mémoire |
| --- | --- | --- | --- | --- |
| A | 21,0 ms | 1 623,8 ms | 4 513,9 ms | 10,8 Mo |
| B | 1,2 ms | 15,9 ms | 26,0 ms | 2,1 Mo |
| C | 0,2 ms | 0,9 ms | 2,3 ms | 0,9 Mo |

De 9 000 à 15 000 colis, le legacy passe de 1 623,8 ms à 4 513,9 ms, un facteur 2,78, le carré de 15 / 9. Épreuve : dès 1 000 colis arrivés dans le désordre, les seaux donnent `bc776f41` et le tableau `89c52d41`, le tas reste sur `89c52d41` (`bench/resultats/2026-11-10T11-18-27-priorite-arrivees.csv`).

Mesures : `bench/resultats/2026-11-10T11-16-37-priorite.csv`. Courbe : `bench/resultats/2026-11-10T11-16-37-priorite.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 44 contre 43 pour le tableau et 38 pour les seaux (`adr/GRILLE-ADR-003.md`) : le temps et la robustesse pèsent 3 chacun, les seaux perdent l'ordre du contrat dès que l'arrivée n'est plus celle de la création, et la pente du legacy (4,5 s à 15 000 colis, au-delà de 10 s vers 22 300) départage le point qui le sépare du tas.

## 5. Conséquences et limites

Le tas coûte deux idées à lire (l'arbre rangé dans un tableau, remonter et descendre) et environ 2 Mo à 15 000 colis, sans dépendance. La décision est fragile aux poids : le tas ne mène que d'un point, et avec un poids du temps à 2 reporté sur la robustesse (poids 4) le tableau passe devant, 45 contre 44. Non mesuré : une soirée au-dessus de 15 000 colis, le vrai quai, et un jeu où les pharmacies ont vraiment deux fins de créneau. Le jeu `grande` n'en a qu'une par priorité.

Domaine de validité : nous avons fait varier le volume (1 000, 9 000, 15 000) et l'ordre d'arrivée (création, puis ordre du fichier). Nous n'avons pas fait varier le nombre d'heures limites, ni le tirage des prises (0 ou 1, graine 2026). La note de temps du legacy tombe à 2 vers 22 300 colis : 4 514 ms × (22 300 / 15 000)² ≈ 9 980 ms, au seuil des 10 s. Les seaux ne redeviennent justes que si les colis d'une priorité arrivent dans l'ordre de création et ne partagent qu'une heure limite. Les deux manquent chez Efrei : l'épreuve casse déjà la première, et l'article 3 du contrat donne aux pharmacies 10 h et 12 h. Deux seaux de pharmacies couvriraient ces deux heures, pas un camion en retard à l'intérieur d'un même seau.

## 6. En trois phrases pour la directrice des opérations

Le soir sur le quai, les préparateurs doivent toujours prendre d'abord les pharmacies, puis les express, puis le reste, et cet ordre doit rester le bon même quand un colis arrive en retard. Aujourd'hui, pour 15 000 colis, remettre toute la file en ordre à chaque arrivée prend quatre secondes et demie, et vers 22 300 colis la même soirée dépasserait dix secondes, sur la machine qui sert aussi le site. Nous gardons une file qui place le plus urgent devant sans tout recommencer : la soirée de 15 000 colis tombe à environ un quarantième de seconde, et les heures limites du contrat restent respectées.
