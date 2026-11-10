# ADR-003 - Tenir la file du quai avec un tas binaire

## 1. Contexte

Quand l'extension du contrat des pharmacies reprendra, le quai recevra 9 000 colis par soir, dont 3 000 pour les pharmacies, et 15 000 au pic de décembre. La file du quai (2019) retrie tous les colis à chaque arrivée : à 15 000 colis, une soirée coûte 6,8 s de calcul au processus de Quai, qui sert aussi le site et l'API. La contrainte est l'ordre exact du contrat quel que soit l'ordre d'arrivée, puis le temps de calcul.

## 2. Options comparées

- Option A (legacy, `tableau`) : tableau retrié en entier à chaque arrivée, `shift` à chaque prise. Complexité annoncée : O(n log n) par arrivée, soit O(n² log n) pour la soirée.
- Option B (`tas`) : tas binaire, avec le rang d'arrivée pour départager les égalités complètes. Complexité annoncée : O(log n) par arrivée et par prise.
- Option C (`seaux`) : une file d'attente par priorité, servies dans l'ordre d'arrivée. Complexité annoncée : O(1) par arrivée et par prise, à condition que les colis arrivent dans l'ordre de leur création et qu'une priorité n'ait qu'une fin de créneau.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/grande`, une soirée de 1 000, 9 000 (le volume du 9 novembre) et 15 000 colis (le pic de décembre).
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement ; 3 répétitions pour l'épreuve des arrivées.
- Statistique retenue : la médiane.
- Mesuré : durée et mémoire d'une soirée (`bench/resultats/2026-11-10T11-22-15-priorite.csv`), sommes de contrôle concordantes pour les trois files. Épreuve : les colis arrivent dans l'ordre du fichier, pas tout à fait celui de leur création (`bench/resultats/2026-11-10T11-22-41-priorite-arrivees.csv`).

| Option | 1 000 | 9 000 | 15 000 | Mémoire à 15 000 |
| --- | --- | --- | --- | --- |
| A (tableau) | 28,6 ms | 2 450 ms | 6 837 ms | 11,0 Mo |
| B (tas) | 1,7 ms | 21,5 ms | 35,3 ms | 2,2 Mo |
| C (seaux) | 0,25 ms | 1,7 ms | 2,7 ms | 0,9 Mo |

Épreuve des arrivées dans le désordre : à 1 000 colis, `seaux` donne `bc776f41` alors que le legacy donne `89c52d41` ; le `tas` donne la même somme que le legacy à 1 000 et à 9 000 colis (`89c52d41` et `cfa0b5e5`). Le harness s'arrête sur `seaux`.

Courbe : `bench/resultats/2026-11-10T11-22-15-priorite.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 44 contre 43 pour le legacy et 38 pour les seaux (`adr/GRILLE-ADR-003.md`) ; la grille hésitant entre A et B, c'est la pente qui tranche : le legacy double presque chaque fois que le volume est multiplié par 1,5 et dépasse 10 s dès 18 000 colis, alors que le tas reste sous 40 ms.

## 5. Conséquences et limites

Le tas est un peu moins direct à lire (un arbre rangé dans un tableau et ses deux gestes) et c'est du code à tester ; en échange, 35 ms au lieu de 6,8 s à 15 000 colis. La décision est fragile aux poids : avec un poids du temps de 2 au lieu de 3, le legacy passe devant (40 contre 39). Non mesuré : le tas en production réelle, avec les autres services du processus de Quai.

Domaine de validité : nous avons fait varier le volume (1 000, 9 000 et 15 000 colis) ; nous n'avons pas fait varier la part de pharmacies (3 000 sur 9 000) ni les heures limites. Le legacy passe 10 s (sa note de temps tombe à 2) vers 18 100 colis : 6,84 s x (volume / 15 000)², soit 15 000 x racine(10 / 6,84). Les seaux ne tiennent pas chez Efrei pour deux raisons : le harness montre que les colis n'arrivent pas dans l'ordre de leur création (l'ordre de sortie est faux dès 1 000 colis), et l'article 3 du contrat donne deux heures limites aux pharmacies (10h avant 19h, 12h entre 19h et 23h), alors que les seaux supposent une fin de créneau par priorité. Ils redeviendraient justes avec des arrivées dans l'ordre de création et une file par heure limite (au moins quatre files).

## 6. En trois phrases pour la directrice des opérations

Le soir, le quai remet à jour la liste des colis à préparer chaque fois qu'un colis arrive, et cela devient très long quand il y en a beaucoup : près de 7 secondes pour 15 000 colis, et plus de 10 secondes vers 18 000. Nous retenons une méthode de rangement qui place le colis au bon endroit sans tout reclasser : la soirée tombe à moins d'une demi-seconde et les pharmacies passent toujours en premier, même quand les colis arrivent dans le désordre. Une méthode plus rapide encore existe mais elle se trompe dès que les colis n'arrivent pas dans l'ordre, ce qui arrive chaque soir.
