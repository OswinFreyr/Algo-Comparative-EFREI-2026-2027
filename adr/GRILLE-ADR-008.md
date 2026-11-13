# Grille comparative - ADR-008 : ordonner les arrêts d'une tournée de Noël (ticket T-0531)

La grille sert à décider, pas à classer par vitesse. Les poids viennent du ticket ; les barèmes sont écrits avant de lire les mesures.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | médiane du harness pour 20 tournées de 40 arrêts (le recuit avec son budget de 60 000 pas) | 3 |
| Mémoire | pic mémoire du harness, matrice des distances comprise | 1 |
| Lisibilité | un développeur qui n'a pas écrit le code le comprend-il en cinq minutes | 2 |
| Robustesse | écart moyen à l'optimum sur neuf arrêts (`npm run noel -- --arrets 9`) : la qualité de la tournée rendue | 3 |
| Coût de mise en oeuvre | longueur de la fonction, réglages à tenir, dépendance | 1 |

Aucun critère à 0 : les cinq comptent. La robustesse pèse autant que le temps (3) parce que le ticket est une tournée 40 % trop longue : c'est la qualité de l'ordre qui compte, et le temps de calcul, lui, tient dans la seconde.

## 2. Les options, note de 1 à 5 par critère

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy, ordre d'affectation) | 5 | 5 | 5 | 1 | 5 | 38 |
| B (plus proche voisin) | 5 | 5 | 4 | 2 | 4 | 38 |
| C (2-opt) | 5 | 5 | 2 | 5 | 4 | 43 |
| D (recuit simulé) | 5 | 5 | 1 | 5 | 2 | 39 |

Total pondéré = somme des notes multipliées par les poids (3, 1, 2, 3, 1) : A = 15 + 5 + 10 + 3 + 5 = 38 ; B = 15 + 5 + 8 + 6 + 4 = 38 ; C = 15 + 5 + 4 + 15 + 4 = 43 ; D = 15 + 5 + 2 + 15 + 2 = 39.

Barèmes fixés avant la mesure :

- Temps (médiane à 20 tournées) : 5 sous 100 ms, 4 sous 1 s, 3 sous 10 s, 2 sous 1 min, 1 au-delà.
- Robustesse (écart moyen à l'optimum sur neuf arrêts) : 5 sous 1 %, 4 sous 3 %, 3 sous 10 %, 2 sous 25 %, 1 au-delà.
- Mémoire (pic du harness) : 5 sous 10 Mo, 4 sous 50 Mo, 3 au-delà ; si un relevé bouge d'un facteur 2 ou plus entre deux lancements, la mémoire ne départage pas ; deux options à moins d'un facteur 2 ont la même note.
- Lisibilité : on part de 5, chaque idée à connaître pour répondre à trois questions (que fait la fonction, que se passe-t-il quand un échange n'améliore pas, où changer la graine) coûte un point.
- Coût : 5 rien ne change ; 4 une fonction courte sans réglage ; 3 une fonction longue ou un réglage à tenir ; 2 les deux ; 1 une dépendance.

Justification des notes :

- **Temps 5 pour les quatre** : médianes à 20 tournées de 0,23 ms pour le voisin et 1,21 ms pour le 2-opt, 78,5 ms pour le recuit (`bench/resultats/2026-11-13T15-19-23-tournees.csv`, même ordre de grandeur dans `bench/resultats/2026-11-13T15-19-21-tournees.csv` : 78,4 ms), tous sous 100 ms. Le legacy ne calcule rien : l'ordre d'affectation est déjà là, il n'a pas de ligne dans le harness. Le recuit est à 78 ms d'une marge de 100 ms.
- **Mémoire 5 pour les quatre** : le pic du harness reste sous 10 Mo (recuit 3,0 Mo à 5 tournées, 63 ko à 20 ; voisin 18 ko et 2-opt 38 ko à 20) ; le relevé du recuit bouge de plus d'un facteur 2 selon la taille, la mémoire ne départage pas.
- **Lisibilité** : A, rien à connaître, 5 ; B, la matrice des distances et le hub en position 0, 4 ; C, la matrice, l'inversion d'un segment, le gain d'un échange (arêtes retirées moins arêtes ajoutées), l'arrêt au minimum local, 2 ; D, la matrice, l'inversion d'un segment et son allongement, l'acceptation d'un mauvais échange selon la température, la graine et le budget de pas, 1 (5 moins 4 idées).
- **Robustesse** : sur neuf arrêts (`bench/resultats/2026-11-13T15-19-25-noel.csv`), le legacy est à +67,2 % de l'optimum (1), le voisin à +10,2 % (2, juste au-dessus du seuil de 10 %), le 2-opt à +0,4 % (5), le recuit à +0,0 %, optimum trouvé 60 fois sur 60 (5).
- **Coût** : A est le code existant, 5 ; B et C sont des fonctions sans réglage (le C est plus longue, avec un garde-fou), 4 ; D est une fonction longue avec trois réglages à tenir (température, budget de pas, graine), 2.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (les autres inchangés), les totaux deviennent A = 43, B = 44, C = 51, D = 48 : le 2-opt reste devant. La décision est cependant fragile entre le 2-opt et le recuit : sur neuf arrêts leur robustesse est la même (note 5), alors que sur les 60 tournées de 40 arrêts le recuit est plus court de 1,9 % (4 873,8 km contre 4 966,6 km). Si la robustesse se lisait sur 40 arrêts par rapport au meilleur, le 2-opt tomberait à 4 (sous 3 %) et l'écart ne tiendrait plus qu'à un point (40 contre 39) ; le CTO doit le savoir.
