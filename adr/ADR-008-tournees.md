# ADR-008 - Ordonner les quarante arrêts d'une tournée de Noël par 2-opt

## 1. Contexte

Les tournées calculées font 40 % de kilomètres de plus que celles que les livreurs tracent à la main (ticket T-0531). Le pic de Noël loue dix utilitaires (pièce 06) et le scénario fait passer les vélos cargo à 40 arrêts par vague. Sur cinq tournées, l'ordre d'affectation fait 1 152,7 km et le plus proche voisin 432,1 km, soit 16,8 % de trop (`npm run noel -- --tournees 5`). Sur les 60 tournées du jeu moyenne, l'ordre d'affectation fait 16 267,5 km par jour, 271,1 km par tournée. La contrainte est ces kilomètres, pas le temps : essayer tous les ordres est déjà hors de portée à 15 arrêts.

## 2. Options comparées

- Option A (`legacy`) : visiter les arrêts dans l'ordre d'affectation, celui du code actuel. Aucune recherche. Complexité annoncée : un seul passage pour additionner les distances.
- Option B (`voisin`) : depuis le dépôt, aller à l'arrêt le plus proche pas encore visité, et ainsi de suite. Complexité annoncée : O(n²).
- Option C (`deuxopt`) : partir de cet ordre, puis inverser un morceau de tournée tant que l'échange raccourcit. On retire deux liens et on en ajoute deux autres ; on s'arrête quand plus aucun échange ne gagne. Complexité annoncée : O(n²) par passe, une passe par échange ; quelques dizaines d'échanges sur 40 arrêts.
- Option D (`recuit`) : le même point de départ, des échanges tirés au hasard, acceptés s'ils raccourcissent et sinon avec une probabilité qui baisse. Protocole rejouable : graine 20261213, 60 000 pas, température de départ 2 000 m, multipliée par 0,99985 à chaque pas. On rend le meilleur trajet rencontré. Complexité annoncée : 60 000 pas par tournée.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeu : `data/jeux/moyenne`, 60 tournées de vélo cargo, distances par la route gardées dans `cache-tournees-40.json` (41 recherches par tournée, 11,7 s la première fois).
- Répétitions et échauffement : 3 répétitions et 1 tour, à 1, 5 et 20 tournées. La mesure est relancée une fois pour la mémoire. Qualité : les 60 tournées à 40 arrêts, puis les 9 premiers arrêts contre l'optimum.
- Statistique retenue : la médiane. Recuit : graine 20261213, 60 000 pas, température 2 000 m, facteur 0,99985.
- Mesuré : le temps et la mémoire à 20 tournées ; les kilomètres sur 60 tournées ; l'écart moyen à l'optimum sur neuf arrêts.

| Option | 1 | 5 | 20 | km sur 60 | écart sur 9 arrêts |
| --- | --- | --- | --- | --- | --- |
| A | - | - | - | 16 267,5 | +67,2 % |
| B | 0,05 ms | 0,21 ms | 0,16 ms | 5 706,7 | +10,2 % |
| C | 0,41 ms | 0,25 ms | 0,95 ms | 4 966,6 | +0,4 % |
| D | 5,9 ms | 14,6 ms | 48 ms | 4 873,8 | +0,0 % |

Le second lancement donne 0,24 ms, 0,94 ms et 48 ms, et 18 Ko, 38 Ko, 63 Ko : la mémoire ne bouge pas d'un facteur 2. Le 2-opt économise 11 301 km par jour sur l'ordre d'affectation, le recuit 11 394 km. Sur neuf arrêts, le 2-opt trouve l'optimum 47 fois sur 60 (au pire +5,5 %), le recuit 60 fois sur 60.

Mesures : `bench/resultats/2026-11-13T14-49-07-tournees.csv`, `bench/resultats/2026-11-13T14-49-08-tournees.csv`, `bench/resultats/2026-11-13T14-49-08-noel.csv`, `bench/resultats/2026-11-13T14-49-09-noel.csv`.

## 4. Décision

Nous adoptons l'option C (`deuxopt`), total pondéré 45 contre 41 pour le recuit, 38 pour le plus proche voisin et 38 pour l'ordre d'affectation (`adr/GRILLE-ADR-008.md`) : il reste à 0,4 % de l'optimum sur neuf arrêts, sans réglage à tenir, et les 93 km que le recuit enlève encore par jour ne changent pas cette note.

## 5. Conséquences et limites

Le 2-opt s'arrête au premier trajet qu'aucun échange ne raccourcit. Le recuit en sort parfois : sur les 60 tournées il est plus court 45 fois, plus long 14 fois, égal 1 fois. L'écart est de 93 km par jour, 1,9 % du meilleur total, pour 160 ms au lieu de 5 ms. On changerait de méthode si cet écart dépassait 3 % du meilleur total, soit environ 146 km par jour. À 200 000 pas, le recuit descend à 4 827,2 km en 480 ms, et l'écart passe à 2,9 % : le seuil n'est toujours pas atteint (`bench/resultats/2026-11-13T14-50-02-noel.csv`).

Domaine de validité : nous avons fait varier le nombre de tournées (1, 5, 20) et le nombre d'arrêts (9, 11 et 40). Nous n'avons pas mesuré les créneaux horaires, ni les arrêts de décembre au-delà de 40, ni les dix utilitaires loués. L'optimum des tournées à 40 arrêts reste inconnu : la note de robustesse vient des neuf arrêts, où tous les ordres ont été essayés. À 11 arrêts, le plus loin où ils s'essaient encore, l'écart moyen du 2-opt passe de 0,4 % à 1,0 % (optimum trouvé 37 fois sur 60, au pire +12,3 %) quand le recuit reste à +0,0 % : l'écart grandit avec le nombre d'arrêts (`bench/resultats/2026-11-13T14-52-37-noel.csv`, relevé sur un autre poste du trinôme ; les kilomètres ne dépendent pas du poste).

## 6. En trois phrases pour la directrice des opérations

Les tournées calculées aujourd'hui font quarante pour cent de chemin en plus que celles que les livreurs tracent à la main, et à Noël chaque vélo aura quarante arrêts. Partir du dépôt vers l'arrêt le plus proche, puis décroiser la route tant qu'un échange la raccourcit, enlève onze mille kilomètres par jour sur la flotte. Aller plus loin, en acceptant parfois un détour qui se corrige ensuite, n'enlève qu'une petite part de plus, et seulement si l'on garde trois réglages.
