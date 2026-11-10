# Grille comparative - gabarit

La grille sert à décider, pas à classer par vitesse. Les poids dépendent du ticket : un traitement de nuit
qui tient sa fenêtre supporte d'être lent, un traitement qui en déborde ne le supporte plus, une page appelée
40 000 fois par jour ne l'a jamais supporté. Les poids et le barème de chaque note se fixent avant de mesurer.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | ce que la production paiera : durée des requêtes répétées 40 000 fois par jour, plus le coût de construction de l'index | 4 |
| Mémoire | mémoire supplémentaire nécessaire pour conserver la structure de recherche à l'échelle du jeu grande | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | comportement sur les doublons, les vides et les numéros invalides | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées et données à préparer | 1 |

Gardez les cinq lignes. Un critère qui ne compte pas pour ce ticket reçoit le poids 0 : c'est une décision, écrivez pourquoi.

## 2. Les options, note de 1 à 5 par critère

Une note est un chiffre seul, de 1 à 5, par case : "4", pas "4/5" ni "4 (lisible)". La justification va sous le tableau.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 1 | 5 | 5 | 5 | 5 | 34 |
| B | 2 | 3 | 4 | 5 | 3 | 30 |
| C | 5 | 2 | 4 | 5 | 2 | 39 |

Total pondéré = 4 × Temps + 2 × Mémoire + 2 × Lisibilité + 1 × Robustesse + 1 × Coût. Une note de temps ne se donne pas sans une mesure dans `bench/resultats/` : le CSV du harness et celui de `npm run couples` quand la production paie des requêtes.

Barème de la note de temps, fixé avant la mesure sur le budget d'une page interactive : 5 pour au plus 10 ms, 4 pour au plus 100 ms, 3 pour au plus 500 ms, 2 pour au plus 1 000 ms et 1 au-delà. À 996 844 scans, le tableau obtient 1 (1 488,5 ms), le Set 2 (964,4 ms) et la Map 5 (0,1 ms). Le coût de construction est également pris en compte dans la justification : 0,02 ms pour le tableau, 290,31 ms pour le Set et 764,89 ms pour la Map.

Justification des notes :

- A (legacy) : le tableau est le plus lisible, le plus robuste et le moins coûteux à mettre en oeuvre. Il n'ajoute toutefois aucune structure de recherche et son temps de requête croît linéairement : 1 488,5 ms à 996 844 scans. Sa mémoire de construction est négligeable (1 à 4 Ko).
- B (Set) : le Set refuse rapidement un numéro inconnu, mais les numéros connus parcourent encore tous les scans. Il atteint 964,4 ms à 996 844 scans et sa construction consomme 290,31 ms et 5 122 Ko. La logique reste simple, mais elle duplique une partie de l'information sans stocker directement le dernier scan.
- C (Map) : la Map associe chaque numéro au dernier scan et permet une lecture en temps quasi constant : 0,1 ms à 996 844 scans. Elle est correcte sur les doublons grâce à `plusRecent`, mais sa construction est la plus coûteuse (764,89 ms) et sa mémoire atteint 7 170 Ko. Le code reste court et ne nécessite aucune dépendance.

## 3. La sensibilité

Avec un poids du temps à 5 et celui de la lisibilité à 1, les totaux deviennent A = 30, B = 28 et C = 40 : la décision ne change pas, la Map reste retenue. La décision n'est donc pas fragile autour des poids choisis ; même le coût de construction plus élevé de la Map ne compense pas son avantage sur 40 000 requêtes quotidiennes.
