# Grille comparative - ADR-008 : ordonner les quarante arrêts d'une tournée de Noël

Ticket T-0531 : les tournées calculées font 40 % de kilomètres de plus que celles que les livreurs tracent à la main, et le scénario de Noël fait passer les vélos cargo à quarante arrêts par vague. Essayer tous les ordres est exclu dès 15 arrêts (ADR-007). La contrainte : des tournées courtes d'abord, calculées vite ensuite.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | médiane du harness pour ordonner 20 tournées de 40 arrêts | 3 |
| Mémoire | pic du harness à 20 tournées, matrice comprise, lu comme un ordre de grandeur | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | `npm test`, puis l'écart moyen à l'optimum sur neuf arrêts | 3 |
| Coût de mise en oeuvre | longueur de la fonction, réglages à tenir, dépendances | 1 |

Les poids sont ceux imposés par le ticket. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy, l'ordre d'affectation. Option B : `voisin`, le plus proche voisin. Option C : `deuxopt`, le 2-opt parti du plus proche voisin. Option D : `recuit`, le recuit simulé parti du plus proche voisin (60 000 pas, graine 20261213).

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 5 | 5 | 5 | 1 | 5 | 38 |
| B (voisin) | 5 | 5 | 4 | 2 | 4 | 38 |
| C (deuxopt) | 5 | 5 | 3 | 5 | 4 | 45 |
| D (recuit) | 5 | 5 | 1 | 5 | 3 | 40 |

Total pondéré = 3 x Temps + 1 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Les barèmes, fixés avant de mesurer (ceux de la fiche atelier 11) :

- Temps (médiane à 20 tournées) : 5 sous 100 ms, 4 sous 1 s, 3 sous 10 s, 2 sous 1 min, 1 au-delà.
- Robustesse (écart moyen à l'optimum sur neuf arrêts) : 5 sous 1 %, 4 sous 3 %, 3 sous 10 %, 2 sous 25 %, 1 au-delà.
- Mémoire (pic du harness, matrice comprise) : 5 sous 10 Mo, 4 sous 50 Mo, 3 au-delà ; si un relevé bouge d'un facteur 2 ou plus entre deux lancements, la mémoire ne départage pas ; deux options à moins d'un facteur 2 l'une de l'autre ont la même note.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour dire ce que fait la fonction, ce qui se passe quand un échange n'améliore pas et où changer la graine.
- Coût : 5 si rien ne change ; 4 pour une fonction courte sans réglage ; 3 pour une fonction longue ou un réglage à tenir ; 2 pour les deux ; 1 pour une dépendance.

Mesures du 13 novembre : `bench/resultats/2026-11-13T14-48-14-tournees.csv` (temps et mémoire, 1, 5 et 20 tournées, médiane de 3 répétitions, 1 tour d'échauffement), relancée une fois (`bench/resultats/2026-11-13T14-50-24-tournees.csv`) ; `bench/resultats/2026-11-13T14-48-34-noel.csv` (les kilomètres sur 60 tournées de 40 arrêts) ; `bench/resultats/2026-11-13T14-48-43-noel.csv` (l'écart à l'optimum sur neuf arrêts).

Justification rapide des notes :

- Temps : A 5, rien à calculer. B 0,11 ms, C 0,65 ms, D 32,6 ms pour 20 tournées (40,6 ms à la relance) : les trois sous 100 ms, note 5. Le recuit est 50 fois plus lent que le 2-opt, sans changer de tranche.
- Mémoire : B 18 Ko puis 97 Ko à la relance, C 38 Ko, D 3,7 Mo puis 4,1 Mo. Le relevé du voisin bouge d'un facteur 5 entre les deux lancements : la mémoire ne départage pas, et tout reste sous 10 Mo, note 5 pour les quatre.
- Lisibilité : A 5, rien à connaître, les arrêts restent dans l'ordre où ils arrivent. B 4, une idée : aller à l'arrêt non visité le plus proche. C 3, deux idées : ce départ, et l'échange qui décroise deux arêtes en inversant le morceau entre elles, répété jusqu'à la première passe sans gain. D 1, quatre idées : ce départ, la même inversion tirée au hasard, la température qui fait accepter de moins en moins souvent un échange qui allonge, et le générateur à graine qui rend le résultat rejouable.
- Robustesse : `npm test` passe pour les tests des tournées. Écart moyen à l'optimum sur neuf arrêts, 60 tournées : A + 67,2 %, note 1. B + 10,2 % (optimum trouvé 3 fois sur 60, au pire + 29,0 %), au-dessus de 10 %, note 2. C + 0,4 % (47 fois sur 60, au pire + 5,5 %), note 5. D + 0,0 % (60 fois sur 60), note 5.
- Coût : A 5, rien ne change. B 4 et C 4 : une fonction courte, aucun réglage. D 3 : une fonction courte, mais trois réglages à tenir, la température, le budget de pas et la graine.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 1, robustesse 3, coût 1) : A 43, B 44, C 52, D 49. La décision ne change pas, le 2-opt reste premier.

Entre C et D, aucun poids ne retourne la décision : mêmes notes de temps, de mémoire et de robustesse, et le 2-opt est devant sur la lisibilité (+ 2) et le coût (+ 1), soit 5 points avec les poids du ticket. Ce qui peut la retourner est une mesure, pas un poids : la robustesse est lue sur neuf arrêts, où le 2-opt est à 0,4 % de l'optimum. S'il perd une note (écart de 1 % à 3 %), il reste devant, 42 contre 40 ; s'il en perd deux (écart de 3 % ou plus) pendant que le recuit garde la sienne, le recuit passe devant, 40 contre 39. Or l'écart du 2-opt grandit avec le nombre d'arrêts : 1,0 % à 11 arrêts, et sur 40 arrêts il est déjà 1,9 % au-dessus du recuit, 2,9 % quand le recuit reçoit 200 000 pas. La décision est fragile à 40 arrêts et l'ADR le dit.
