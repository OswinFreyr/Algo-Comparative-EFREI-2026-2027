# ADR-003 - Garder le colis le plus urgent en tête de la file du quai avec la variante `tas`

## 1. Contexte

Sur le quai, les préparateurs prennent toujours le colis le plus urgent : pharmacies, puis express, puis standard ; à priorité égale par fin de créneau, puis par heure de création. Quand l'extension du contrat des pharmacies reprendra, le quai recevra 9 000 colis par soir, dont 3 000 pour les pharmacies, et 15 000 au pic de décembre. Le legacy de 2019 retrie toute la file à chaque arrivée, dans le seul processus de Quai, qui sert aussi le site et l'API. La contrainte est double : l'ordre exact du contrat quel que soit l'ordre d'arrivée, et le temps de calcul d'une soirée.

## 2. Options comparées

- Option A (legacy, `tableau`) : un tri complet de la file à chaque arrivée (`sort`, ligne 20 de `legacy/src/quai.ts`), un retrait en tête qui décale toute la file à chaque prise (`shift`, ligne 24). Complexité annoncée : O(n log n) par arrivée et O(n) par prise, soit O(n² log n) pour la soirée.
- Option B (`tas`) : un tas binaire ordonné par la comparaison du legacy, puis par rang d'arrivée. Complexité annoncée : O(log n) par arrivée et par prise, soit O(n log n) pour la soirée.
- Option C (`seaux`) : trois files, une par priorité, servies dans l'ordre d'arrivée. Complexité annoncée : O(1) par arrivée et par prise, soit O(n) pour la soirée.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : `data/jeux/grande`, colis uniques dans l'ordre de création, 1 000, 9 000 et 15 000 colis.
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : une soirée entière par appel (après chaque arrivée, 0 ou 1 prise tirée à graine fixe, puis la file est vidée), durée et pic mémoire : `bench/resultats/2026-11-10T11-14-17-priorite.csv`. Somme de contrôle de l'ordre de sortie identique pour les trois files à chaque taille.

| Option | 1 000 | 9 000 | 15 000 | Mémoire à 15 000 |
| --- | --- | --- | --- | --- |
| A (`tableau`) | 77,2 ms | 9 071 ms | 27 734 ms | 35,0 Mo |
| B (`tas`) | 5,6 ms | 64,4 ms | 108,5 ms | 2,2 Mo |
| C (`seaux`) | 0,8 ms | 6,4 ms | 10,4 ms | 0,9 Mo |

De 9 000 à 15 000 colis, le legacy est multiplié par 3,06 (carré de 15 / 9 : 2,78), le tas par 1,68.

L'épreuve (`bench/resultats/2026-11-10T11-15-03-priorite-arrivees.csv`, arrivées dans l'ordre du fichier et non de création) : le tas rend la somme de contrôle du legacy à 1 000 et 9 000 colis, le harness s'arrête sur la file à seaux dès 1 000 colis (`bc776f41` contre `89c52d41`).

Courbe : `bench/resultats/2026-11-10T11-14-17-priorite.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 44 contre 40 pour le legacy et 38 pour `seaux` (`adr/GRILLE-ADR-003.md`) : elle rend l'ordre exact du contrat quel que soit l'ordre d'arrivée, comme le legacy, et sa durée suit le volume au lieu de son carré (0,1 s contre 27,7 s à 15 000 colis) ; elle reste juste tant que la comparaison du contrat et le rang d'arrivée lui sont fournis.

## 5. Conséquences et limites

Le tas est une structure à écrire, à tester et à relire (`bench/variantes/tas.ts`, deux idées à connaître), et il garde une table des rangs d'arrivée à côté de la file. La décision est fragile aux poids : un seul point passé du temps à la lisibilité (temps 2, lisibilité 3) remet le legacy devant, 43 contre 42 ; c'est la pente qui tranche. Les durées ont été relevées sur un poste chargé par d'autres programmes : elles sont plus longues que celles de la fiche (27,7 s contre 4,5 s pour le legacy), les rapports entre files, eux, sont du même ordre. Non mesuré : le quai réel, les prises réelles des préparateurs, les volumes au-delà de 15 000 colis.

Domaine de validité : nous avons fait varier le volume (1 000, 9 000 et 15 000 colis) et l'ordre d'arrivée (ordre de création, ordre du fichier). Nous n'avons pas fait varier le rythme des prises ni la part des pharmacies, et le jeu n'a qu'une heure limite par priorité. Par la règle du carré (27,7 s x (volume / 15 000)²), une soirée du legacy passe 10 s vers 9 000 colis, ce que la mesure confirme (9,07 s à 9 000) : sur ce poste sa note de temps est déjà à 2 au volume de décembre, et elle tombe à 1 (60 s) vers 22 000 colis. Sous 2 000 colis environ, le legacy tient sous 0,5 s et le tas n'apporte rien.

Ce qui rendrait la file à seaux juste : que les colis arrivent toujours dans l'ordre de leur création, ce que l'épreuve dément, et qu'une priorité n'ait qu'une heure limite, ce que l'article 3 du contrat dément (avant 10h00 pour une commande passée avant 19h00, avant 12h00 entre 19h00 et 23h00). Une file à quatre seaux, deux pour les pharmacies, réglerait la seconde hypothèse mais pas la première : l'épreuve échoue sur un jeu qui n'a qu'une heure limite par priorité, donc à cause du seul ordre d'arrivée (raisonnement, non mesuré).

## 6. En trois phrases pour la directrice des opérations

Chaque soir, le quai doit sortir les colis des pharmacies en premier, dans l'ordre exact du contrat, et la méthode actuelle range toute la file d'attente à chaque arrivée : pour 15 000 colis, cela occupe près de 28 secondes l'ordinateur qui sert aussi le site, et presque trois fois plus dès que le volume augmente de moitié. Nous retenons une méthode qui ne déplace que quelques colis à chaque arrivée : la même soirée lui prend un dixième de seconde et l'ordre de sortie reste exactement celui d'aujourd'hui, même quand un camion arrive en retard. La méthode encore plus rapide, une file par type de colis, est écartée parce qu'elle sert les colis dans le mauvais ordre, sans prévenir, dès qu'ils n'arrivent pas dans l'ordre de leur création.
