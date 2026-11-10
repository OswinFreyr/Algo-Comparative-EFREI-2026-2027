# Grille comparative - ADR-003 : garder le colis le plus urgent en tête de la file du quai

Ticket : quand l'extension du contrat des pharmacies reprendra, le quai recevra 9 000 colis par soir, dont 3 000 pour les pharmacies, et 15 000 au pic de décembre. La file doit servir le plus urgent d'abord, dans l'ordre exact du contrat, quel que soit l'ordre d'arrivée.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | temps de calcul d'une soirée de 15 000 colis, pris au seul processus de Quai, qui sert aussi le site et l'API ; croissance quand le volume grandit | 3 |
| Mémoire | pic mémoire de la même soirée, lu comme un ordre de grandeur | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | l'ordre du contrat est-il rendu quel que soit l'ordre d'arrivée et le nombre d'heures limites | 3 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux imposés par le ticket ADR-003. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `tas`. Option C : `seaux`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 4 | 5 | 5 | 5 | 40 |
| B (tas) | 5 | 5 | 3 | 5 | 3 | 44 |
| C (seaux) | 5 | 5 | 4 | 2 | 4 | 38 |

Total pondéré = 3 x Temps + 1 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Les barèmes, fixés avant de mesurer :

- Temps (une soirée de 15 000 colis) : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà.
- Mémoire (la même soirée) : 5 sous 10 Mo, 4 sous 50 Mo, 3 sous 200 Mo, 2 sous 1 Go, 1 au-delà ; deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour lire la variante.
- Robustesse : 5 si l'ordre exact du contrat est rendu quel que soit l'ordre d'arrivée et le nombre d'heures limites ; 4 si seule une égalité complète sort dans un autre ordre que le legacy ; 3 si l'ordre tient à une seule heure limite par priorité ; 2 si l'ordre est faux en silence dès que les colis n'arrivent pas dans l'ordre de création ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes et une structure fournie ; 3 pour une structure à écrire et à tester ; 2 pour une donnée à préparer à chaque lancement ; 1 pour une dépendance ajoutée.

Mesures : `bench/resultats/2026-11-10T11-14-17-priorite.csv` (médiane de 5 répétitions) et `bench/resultats/2026-11-10T11-15-03-priorite-arrivees.csv` (l'épreuve).

Justification rapide des notes :

- Temps A : 27,7 s à 15 000 colis, sous 60 s, note 2. De 9 000 à 15 000 colis la durée est multipliée par 3,06, pour un carré de 15 / 9 égal à 2,78 : la pente est celle d'un carré.
- Temps B : 0,108 s, note 5. De 9 000 à 15 000 colis, x 1,68 pour un volume x 1,67.
- Temps C : 0,010 s, note 5.
- Mémoire : A 35,0 Mo, note 4 ; B 2,2 Mo et C 0,9 Mo, note 5.
- Lisibilité : A 5, un tri et un retrait en tête, aucune idée à connaître. B 3, deux idées : l'arbre rangé dans un tableau, et ses deux gestes (remonter, descendre). C 4, une idée : une file par priorité.
- Robustesse : A 5, le tri par priorité, fin de créneau puis heure de création est refait à chaque arrivée. B 5, même somme de contrôle que le legacy dans l'ordre de création et dans le désordre (`89c52d41` à 1 000 colis, `cfa0b5e5` à 9 000), le rang d'arrivée départage les égalités complètes comme le tri stable. C 2 : dans le désordre, le harness s'arrête, `seaux` donne `bc776f41` quand `tableau` donnait `89c52d41` à 1 000 colis, sans aucune erreur ; `npm test` passe pourtant, son jeu arrive dans l'ordre. De plus l'article 3 du contrat donne deux heures limites aux pharmacies (10h00 et 12h00), ce que la file à seaux ne regarde pas.
- Coût : A 5, rien ne change. B 3, le tas est une structure à écrire et à tester. C 4, quelques lignes et trois tableaux du langage.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 1, robustesse 3, coût 1) : A 39, B 51, C 44. La décision ne change pas, B reste premier.

Le jeu de poids qui fait basculer : temps 2, mémoire 1, lisibilité 3, robustesse 3, coût 1, soit un seul point passé du temps à la lisibilité. Le legacy vaut alors 43, le tas 42, les seaux 37. La décision est donc fragile aux poids, et c'est la pente qui tranche : la durée du legacy suit le carré du volume, celle du tas suit le volume. La file à seaux ne passe devant le tas que si la robustesse tombe à 1 (temps 3, mémoire 1, lisibilité 4, robustesse 1, coût 1 : seaux 42, tas 40, legacy 40), ce que le ticket exclut.
