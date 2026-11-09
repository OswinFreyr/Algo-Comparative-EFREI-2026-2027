# ADR-001 - Affecter les colis aux livreurs avec la variante `map`

## 1. Contexte

L'étape 2 du batch de nuit (affectation des colis aux livreurs) doit tenir un budget de 43 minutes en décembre, à 15 000 colis. Le legacy de 2019 a été écrit pour 150 colis par jour : à 100 000 colis il a mis 425 s (`bench/resultats/j1-chrono.csv`). En production, chaque couple colis-livreur examiné coûte une requête à la base, 3,26 ms la nuit (1 490 s pour 457 300 requêtes). La contrainte est la durée de la nuit, pas la mémoire.

## 2. Options comparées

- Option A (legacy, `naive`) : file d'attente, liste des numéros déjà vus parcourue pour chaque colis, tournée retriée à chaque ajout, les 85 livreurs examinés pour chaque colis. Complexité annoncée : O(n²).
- Option B (`tri`) : doublons repérés en triant les numéros, tournées triées une fois à la fin, mais les 85 livreurs toujours examinés pour chaque colis. Complexité annoncée : O(n log n) pour le calcul, O(n x livreurs) pour les requêtes.
- Option C (`map`) : Set des numéros vus, livreurs regroupés par hub, hubs parcourus, un hub étant abandonné dès qu'il est plus loin que le meilleur livreur déjà trouvé. Complexité annoncée : O(n) pour le calcul, moins de requêtes que B.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/moyenne`, tailles 1 000, 2 000, 5 000 et 10 000 colis ; couples comptés sur `data/jeux/grande` jusqu'à 20 000 colis ; 100 000 colis pour le legacy seul (atelier 2, jeu `grande`).
- Répétitions et échauffement : 5 répétitions, 200 tours d'échauffement (plafonnés à 5 s).
- Statistique retenue : la médiane.
- Mesuré : durée par appel (`bench/resultats/2026-11-09T15-08-17-affectation.csv`), tas à 10 000 colis, couples colis-livreur (`bench/resultats/2026-11-09T14-02-13-couples.csv`, `...14-02-06`, `...14-02-18`, `...14-02-24`). Somme de contrôle identique pour les trois options à chaque taille.

| Option | 1 000 | 10 000 | 100 000 | Mémoire |
| --- | --- | --- | --- | --- |
| A | 24,9 ms | 2 089,7 ms | 424 999 ms (1 mesure) | 4,4 Mo |
| B | 4,1 ms | 27,4 ms | non mesuré | 2,4 Mo |
| C | 0,7 ms | 9,6 ms | non mesuré | 5,2 Mo |

À 15 000 colis la nuit : A et B 1 271 770 couples, soit 69,2 minutes ; C 651 031 couples, soit 35,4 minutes (budget : 43).

Courbe : `bench/resultats/2026-11-09T15-08-17-affectation.svg`.

## 4. Décision

Nous adoptons l'option C (`map`), total pondérée 39 contre 37 pour le legacy et 33 pour `tri` (`adr/GRILLE-ADR-001.md`), parce que le critère du temps, qui pèse 4, est le seul qui fasse passer l'étape 2 sous les 43 minutes (35,4 contre 69,2).

## 5. Conséquences et limites

Le code est un peu moins direct à lire (un Set et une Map à connaître) et la mémoire reste de quelques Mo ; la mémoire n'a pas été relancée une seconde fois, ses relevés varient trop pour départager. La décision est fragile aux poids : avec un poids du temps de 3, C et le legacy sont à égalité. Non mesuré : l'étape 2 en production réelle, la nuit réelle.

Domaine de validité : nous avons fait varier le volume (couples comptés à 12 000, 15 000, 18 000 et 20 000 colis). Nous n'avons pas fait varier les 85 livreurs, les 3 hubs, le coût de 3,26 ms par requête (nuit), ni le taux de doublons. `map` dépasse les 43 minutes entre 15 000 (35,4 min) et 18 000 colis (49,2 min), soit vers 16 700 colis par interpolation ; le legacy et `tri` les dépassent dès 9 300 colis environ. Hors de ce domaine : sous une trentaine de livreurs `tri` calcule plus vite que `map`, et avec un hub par livreur l'avantage de `map` disparaît.

## 6. En trois phrases pour la directrice des opérations

Chaque nuit, le programme qui distribue les colis aux livreurs prendrait environ 69 minutes pour 15 000 colis, alors qu'on lui en accorde 43. Nous retenons la méthode qui, pour chaque colis, ne regarde que les livreurs des dépôts proches au lieu des 85 : la nuit tombe à environ 35 minutes. Elle tient jusqu'à environ 16 700 colis par nuit ; au-delà, il faudra y retoucher.
