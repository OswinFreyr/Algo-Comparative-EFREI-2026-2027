# ADR-008 - Ordonner les quarante arrêts d'une tournée de Noël avec la variante `deuxopt`

## 1. Contexte

Ticket T-0531 : les tournées calculées font 40 % de kilomètres de plus que celles que les livreurs tracent à la main. Le legacy visite les arrêts dans l'ordre d'affectation (`legacy/src/tournees.ts`), et le scénario de Noël fait passer les vélos cargo à quarante arrêts par vague, pendant que le pic loue dix utilitaires (pièce 06). Sur les 60 tournées de 40 arrêts du jeu `moyenne`, distances par la route et retour au hub compris (`npm run noel`), l'ordre d'affectation fait 16 267,5 km, soit 271,1 km par tournée ; le plus proche voisin en fait déjà 5 706,7. Essayer tous les ordres est exclu dès 15 arrêts (ADR-007) : il faut un ordre court sans tout essayer. La contrainte : les kilomètres d'abord, le temps de calcul ensuite.

## 2. Options comparées

`n` est le nombre d'arrêts d'une tournée.

- Option A (legacy) : les arrêts dans l'ordre d'affectation. Complexité annoncée : O(n), rien à calculer.
- Option B (`voisin`) : le plus proche voisin ; depuis le hub, aller à l'arrêt non visité le plus proche, et ainsi de suite. Complexité annoncée : O(n²).
- Option C (`deuxopt`) : le 2-opt ; partir du plus proche voisin et décroiser deux arêtes tant qu'un échange raccourcit la tournée. Complexité annoncée : O(n²) par passe, autant de passes que d'échanges.
- Option D (`recuit`) : le recuit simulé ; partir du plus proche voisin, inverser un morceau tiré au hasard, accepter aussi des échanges qui allongent, de moins en moins souvent. Complexité annoncée : proportionnelle au budget de pas, quel que soit n. Son protocole : 60 000 pas, température de départ 2 000 m, multipliée par 0,99985 à chaque pas, graine 20261213 ; sans la graine et le budget, la mesure n'est pas rejouable.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : les 60 tournées de vélo cargo du jeu `moyenne`, à 40 arrêts, distances par la route calculées une fois par le Dijkstra avec tas de l'ADR-007 ; les mêmes tournées réduites à leurs 9 premiers arrêts pour l'écart à l'optimum.
- Répétitions et échauffement : au harness, 3 répétitions et 1 tour d'échauffement, pour 1, 5 et 20 tournées ; à la qualité, une seule passe, le résultat ne dépend pas du poste.
- Statistique retenue : la médiane pour le temps ; pour la qualité, le total des kilomètres et la moyenne des écarts à l'optimum.
- Mesuré : le temps pour ordonner les tournées, matrice des distances déjà prête ; les kilomètres de chaque méthode ; sur neuf arrêts, l'écart à l'optimum trouvé par force brute.

| Option | 1 tournée | 5 tournées | 20 tournées | Kilomètres sur 60 tournées | Écart à l'optimum sur 9 arrêts |
| --- | --- | --- | --- | --- | --- |
| A (legacy) | rien à calculer | rien à calculer | rien à calculer | 16 267,5 km | + 67,2 % |
| B (`voisin`) | 0,05 ms | 0,15 ms | 0,11 ms | 5 706,7 km | + 10,2 % |
| C (`deuxopt`) | 0,33 ms | 0,20 ms | 0,65 ms | 4 966,6 km | + 0,4 % |
| D (`recuit`) | 3,4 ms | 11,5 ms | 32,6 ms | 4 873,8 km | + 0,0 % |

Fichiers : `bench/resultats/2026-11-13T14-48-14-tournees.csv` (temps), `bench/resultats/2026-11-13T14-48-34-noel.csv` (kilomètres, 40 arrêts) et `bench/resultats/2026-11-13T14-48-43-noel.csv` (écart à l'optimum, 9 arrêts). Une relance du harness (`bench/resultats/2026-11-13T14-50-24-tournees.csv`) donne les mêmes temps pour le voisin et le 2-opt, 40,6 ms pour le recuit à 20 tournées.

Sous la milliseconde, les temps du voisin et du 2-opt sont du bruit autant que de la mesure : le 2-opt est plus rapide à 5 tournées qu'à 1, un seul tour d'échauffement ne suffit pas à ces durées. Seul l'ordre de grandeur se lit : le recuit est 50 fois plus lent que le 2-opt, et les trois ordonnent 20 tournées en moins de 100 ms.

Sur les 60 tournées, le 2-opt fait 1 114 échanges et enlève 740 km au voisin ; la flotte roule 11 301 km de moins par jour que dans l'ordre d'affectation, 82,8 km par tournée au lieu de 271,1. Le recuit en enlève encore 93 (11 394 km de moins), soit 1,5 km par tournée, mais pas partout : il est plus court que le 2-opt sur 45 tournées, plus long sur 14, égal sur 1. Sur neuf arrêts, le 2-opt trouve l'optimum 47 fois sur 60 (au pire + 5,5 %), le recuit 60 fois sur 60, le voisin 3 fois (au pire + 29,0 %).

Courbe : `bench/resultats/2026-11-13T14-48-14-tournees.svg` (`npm run courbe -- bench/resultats/2026-11-13T14-48-14-tournees.csv --log`).

## 4. Décision

Nous adoptons l'option C (`deuxopt`), total pondéré 45 contre 40 pour le recuit et 38 pour le voisin comme pour le legacy (`adr/GRILLE-ADR-008.md`) : à 0,4 % de l'optimum sur neuf arrêts, il enlève 11 301 km par jour à la flotte en moins d'une milliseconde par tournée, et le recuit ne lui reprend que 1,9 % au prix de trois réglages à tenir.

## 5. Conséquences et limites

La décision laisse 93 km par jour sur la table, ceux que le recuit gagnerait, et ne coûte ni temps ni mémoire mesurables ; le code demande de connaître l'échange qui décroise deux arêtes. Le 2-opt s'arrête sur un ordre qu'aucun échange n'améliore, pas sur le plus court : nous ne connaissons pas l'optimum au-delà de 11 arrêts.

Non mesuré : les créneaux horaires (un ordre court peut arriver hors créneau, aucune des trois méthodes ne les connaît), les arrêts réels de décembre (le jeu `moyenne` en tient lieu), les utilitaires (seuls les vélos cargo sont ordonnés), une autre graine ou une autre température pour le recuit, la VM du site et son Node 18. La matrice est supposée symétrique : avec des sens uniques comptés, inverser un morceau changerait aussi sa longueur.

Domaine de validité : nous avons fait varier le nombre de tournées (1, 5, 20 au harness, 60 à la qualité), le nombre d'arrêts (9, 11 et 40) et le budget du recuit (60 000 et 200 000 pas). Le seuil tient en un nombre : le 2-opt reste retenu tant que son écart moyen à l'optimum est sous 3 % ; au-delà, si le recuit reste sous 1 %, la grille donne 40 au recuit contre 39. Cet écart grandit avec les arrêts : 0,4 % à 9 arrêts, 1,0 % à 11 (`bench/resultats/2026-11-13T14-52-37-noel.csv`), où le 2-opt garde la décision à 42 contre 40. À 40 arrêts l'optimum est inconnu, mais le 2-opt est déjà 1,9 % au-dessus du recuit, et 2,9 % quand le recuit reçoit 200 000 pas (`bench/resultats/2026-11-13T14-51-21-noel.csv` : 4 827,2 km en 395 ms pour les 60 tournées, 139 km de moins que le 2-opt, 2,3 km par tournée). La décision est donc fragile à 40 arrêts : au-delà de 40 arrêts par vague, ou dès que 2 km par tournée valent trois réglages à tenir, le recuit vaut son temps, qui reste de quelques millisecondes par tournée.

## 6. En trois phrases pour la directrice des opérations

Aujourd'hui, les livreurs visitent leurs arrêts dans l'ordre où les colis leur ont été attribués, ce qui fait faire à une tournée de quarante arrêts plus de trois fois le chemin nécessaire. Nous retenons une façon de faire en deux temps, aller d'abord toujours à l'arrêt le plus proche, puis défaire un à un les croisements du trajet tant qu'il raccourcit : sur soixante tournées, la flotte roule onze mille kilomètres de moins par jour, et le calcul est instantané. Une autre façon, qui essaie aussi des détours au hasard, gagne encore un à deux kilomètres par tournée mais demande des réglages à surveiller, et nous y reviendrons si les tournées dépassent quarante arrêts ou si les livraisons doivent respecter des horaires.
