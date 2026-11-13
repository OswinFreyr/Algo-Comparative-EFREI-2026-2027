# ADR-008 - Ordonner les 40 arrêts d'une tournée de Noël avec le 2-opt

## 1. Contexte

Les tournées calculées font 40 % de kilomètres de plus que celles que les livreurs tracent à la main (ticket T-0531), et le pic de Noël loue dix utilitaires ; le scénario fait passer les vélos cargo à 40 arrêts par vague. Le legacy visite les arrêts dans l'ordre d'affectation : sur 5 tournées de 40 arrêts il fait 1 152,7 km, le plus proche voisin 432,1 km (`bench/resultats/2026-11-13T15-19-13-noel.csv`) ; sur les 60 tournées de vélos cargo, 16 267,5 km contre 5 706,7 km. Essayer tous les ordres est exclu dès 15 arrêts (1,31 x 10^12 ordres, atelier 10). La contrainte est la longueur de la tournée, pas le temps de calcul.

## 2. Options comparées

- Option A (legacy) : visiter les arrêts dans l'ordre d'affectation (étape 3 de `legacy/src/tournees.ts`). Complexité annoncée : O(n), aucun calcul d'ordre.
- Option B (plus proche voisin) : depuis le hub, aller à l'arrêt non visité le plus proche, et ainsi de suite. Complexité annoncée : O(n²).
- Option C (2-opt) : partir du plus proche voisin, puis inverser un segment tant que deux arêtes qui se croisent existent (gain strictement positif) ; s'arrête au premier minimum local. Complexité annoncée : O(n²) par passe, plusieurs passes.
- Option D (recuit simulé) : partir du plus proche voisin, inverser un segment tiré au hasard, l'accepter s'il raccourcit ou avec la probabilité exp(-delta / T) sinon, T baissant à chaque pas. Complexité annoncée : O(pas x n), soit 60 000 pas fixés, indépendante de la qualité atteinte. Réglages du protocole : température de départ 2 000 m, facteur 0,99985 par pas, 60 000 pas, graine 20261213 (même tournée, même résultat sur tous les postes).

Grille : `adr/GRILLE-ADR-008.md` (A 38, B 38, C 43, D 39).

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/moyenne`, 60 tournées de vélos cargo à 40 arrêts, distances par la route (Dijkstra avec tas de l'atelier 10), retour au hub compris ; 1, 5 et 20 tournées pour le temps, les 60 pour les kilomètres, 9 arrêts par tournée pour l'optimum (force brute, 9! = 362 880 ordres, 252 762 essayés avec la coupure).
- Répétitions et échauffement : 3 répétitions, 1 tour d'échauffement ; le recuit avec son budget de 60 000 pas et sa graine 20261213.
- Statistique retenue : la médiane.
- Mesuré : le temps et la mémoire par tournée dans `bench/resultats/2026-11-13T15-19-23-tournees.csv` (un premier lancement, `bench/resultats/2026-11-13T15-19-21-tournees.csv`, donne les mêmes ordres de grandeur) ; les kilomètres sur 60 tournées dans `bench/resultats/2026-11-13T15-19-15-noel.csv` ; l'écart à l'optimum sur neuf arrêts dans `bench/resultats/2026-11-13T15-19-25-noel.csv`.

| Option | 1 tournée | 5 tournées | 20 tournées | Km sur 60 tournées | Écart à l'optimum (9 arrêts) |
| --- | --- | --- | --- | --- | --- |
| A (legacy) | pas de calcul | pas de calcul | pas de calcul | 16 267,5 km (+233,8 %) | +67,2 %, jamais l'optimum |
| B (voisin) | 0,10 ms | 0,26 ms | 0,23 ms | 5 706,7 km (+17,1 %) | +10,2 %, optimum 3 fois sur 60 |
| C (2-opt) | 0,65 ms | 0,29 ms | 1,21 ms | 4 966,6 km (+1,9 %) | +0,4 %, optimum 47 fois sur 60 |
| D (recuit) | 11,1 ms | 18,8 ms | 78,5 ms | 4 873,8 km (meilleur) | +0,0 %, optimum 60 fois sur 60 |

Mémoire à 20 tournées : 18 ko pour le voisin, 38 ko pour le 2-opt, 63 ko pour le recuit (3,0 Mo à 5 tournées), tous sous 10 Mo. Les méthodes ne rendent pas le même ordre : la somme de contrôle ne compte que les tournées, la qualité se lit dans les kilomètres.

Courbe : non générée pour ce sujet (trois méthodes sous la milliseconde ou la dizaine de millisecondes par tournée).

## 4. Décision

Nous adoptons l'option C (2-opt), total pondéré 43 contre 39 pour le recuit, 38 pour le plus proche voisin et 38 pour le legacy (`adr/GRILLE-ADR-008.md`), parce que la robustesse, qui pèse 3, y est à 0,4 % de l'optimum pour une fonction sans réglage, alors que le recuit n'y gagne que 1,9 % de route sur 40 arrêts au prix de trois réglages à tenir.

## 5. Conséquences et limites

Sur les 60 tournées, le 2-opt économise 11 301 km par jour par rapport à l'ordre d'affectation (11 394 km pour le recuit), soit 271,1 km par tournée contre 82,8 km. Le code demande de connaître la matrice des distances, l'inversion d'un segment, le gain d'un échange et le minimum local ; il s'appuie sur le Dijkstra avec tas de l'atelier 10 pour la matrice (41 recherches par tournée, une fois, gardées dans `data/jeux/moyenne/cache-tournees-40.json`). Le 2-opt s'arrête au premier minimum local : il n'est pas garanti de trouver l'optimum (+5,5 % au pire sur neuf arrêts). Non mesuré : les créneaux horaires des clients, les arrêts réels de décembre, les dix utilitaires loués (seuls les vélos cargo sont mesurés), la matrice dans le temps (circulation, pont levé).

Domaine de validité : nous avons fait varier le nombre de tournées (1, 5, 20 et 60) et le nombre d'arrêts (9 et 40) ; nous n'avons pas fait varier la graine, le budget de pas (60 000) ni la température. Seuil : le recuit vaut son temps quand il rend plus de route que le 2-opt ne coûte, soit ici 92,8 km de moins sur 60 tournées (1,55 km par tournée, 1,9 %) pour 78,5 ms de plus pour 20 tournées (3,9 ms par tournée) : à 40 arrêts il se justifie si un kilomètre vaut plus de quelques millisecondes de calcul, et il n'apporte rien sur neuf arrêts, où le 2-opt est déjà à 0,4 %. La décision en faveur du 2-opt ne tient plus au-delà de 40 arrêts par livreur ou si l'écart du 2-opt à la meilleure tournée dépasse 3 %, entre 9 et 40 arrêts le seuil exact n'est pas mesuré.

## 6. En trois phrases pour la directrice des opérations

Aujourd'hui les arrêts d'une tournée sont visités dans l'ordre où ils ont été confiés au livreur, ce qui fait faire plus de trois fois la route nécessaire quand une tournée compte quarante arrêts. Nous retenons une façon de réordonner qui part du plus proche et décroise les trajets qui se coupent : sur nos soixante tournées de vélos cargo, elle économise plus de onze mille kilomètres par jour, sans rien attendre. Une méthode plus lente gagnerait encore un peu de route, mais elle demande des réglages à surveiller et nous ne la retenons pas, sachant que nous n'avons pas vérifié les horaires de livraison des clients ni les arrêts réels de décembre.
