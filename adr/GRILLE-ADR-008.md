# Grille comparative - ADR-008 : ordonner les quarante arrêts d'une tournée de Noël

Ticket T-0531. Les tournées calculées font 40 % de kilomètres de plus que celles tracées à la main. À Noël, les vélos cargo passent à 40 arrêts par vague (pièce 06). L'ordre d'affectation est l'option A.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | la médiane à 20 tournées | 3 |
| Mémoire | le pic du harness, matrice comprise | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | l'écart moyen à l'optimum sur neuf arrêts | 3 |
| Coût de mise en oeuvre | une fonction courte, ou un réglage à tenir | 1 |

Les poids sont ceux de la fiche. La robustesse pèse 3 : le ticket se joue sur les kilomètres. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `legacy`, l'ordre d'affectation. Option B : `voisin`. Option C : `deuxopt`. Option D : `recuit`, graine 20261213, 60 000 pas, température de départ 2 000 m, facteur 0,99985.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 5 | 5 | 5 | 1 | 5 | 38 |
| B (voisin) | 5 | 5 | 4 | 2 | 4 | 38 |
| C (deuxopt) | 5 | 5 | 3 | 5 | 4 | 45 |
| D (recuit) | 5 | 5 | 2 | 5 | 2 | 41 |

Total pondéré = 3 x Temps + 1 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Barème du temps, à 20 tournées : 5 sous 100 ms, 4 sous 1 s, 3 sous 10 s, 2 sous 1 min, 1 au-delà. Barème de la robustesse, écart moyen sur neuf arrêts : 5 sous 1 %, 4 sous 3 %, 3 sous 10 %, 2 sous 25 %, 1 au-delà. Barème de la mémoire : 5 sous 10 Mo, 4 sous 50 Mo, 3 au-delà. Deux lancements : si un relevé bouge d'un facteur 2 ou plus, la mémoire ne départage pas.

Mesures : `bench/resultats/2026-11-13T14-49-07-tournees.csv`, `bench/resultats/2026-11-13T14-49-08-tournees.csv`, `bench/resultats/2026-11-13T14-49-08-noel.csv`, `bench/resultats/2026-11-13T14-49-09-noel.csv`.

Justification des notes :

- Temps : à 20 tournées, voisin 0,16 ms, 2-opt 0,95 ms, recuit 48 ms. Les trois sont sous 100 ms, note 5. L'ordre d'affectation ne se calcule pas, note 5.
- Mémoire : second lancement, à 20 tournées, 18 Ko, 38 Ko et 63 Ko, les mêmes ordres que le premier. Tout est sous 10 Mo et rien ne bouge d'un facteur 2, note 5. L'ordre d'affectation n'ajoute rien, note 5.
- Lisibilité, on part de 5 et une idée coûte un point : legacy 5, l'ordre est déjà celui de l'affectation. Voisin 4, une idée, toujours l'arrêt le plus proche pas encore visité. 2-opt 3, deux idées, inverser le morceau entre deux liens, et seulement si le trajet raccourcit. Recuit 2, trois idées, accepter parfois un détour selon une température qui baisse, garder le meilleur trajet vu, et la graine.
- Robustesse, sur neuf arrêts : legacy +67,2 %, note 1. Voisin +10,2 %, note 2. 2-opt +0,4 %, note 5 (optimum 47 fois sur 60). Recuit +0,0 %, note 5 (optimum 60 fois sur 60).
- Coût : legacy 5, rien ne change. Voisin 4, une fonction courte sans réglage. 2-opt 4, le gain tient en une expression, aucun réglage. Recuit 2, la fonction et trois réglages à tenir : la température, les 60 000 pas, la graine.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 43, B = 44, C = 52 et D = 49. La décision ne change pas.

Elle ne bascule pas non plus en ramenant la somme à 10 (robustesse 2 à la place de 3) : C = 47, D = 44. Le recuit n'est meilleur sur aucun critère noté. On le préférerait seulement si les kilomètres des quarante arrêts entraient dans la note : il en enlève 93 de plus par jour, et cet écart ne change pas la note de robustesse, déjà 5 pour les deux.
