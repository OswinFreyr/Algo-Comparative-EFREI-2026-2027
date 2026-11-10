# Grille comparative - ADR-003 : tenir la file du quai (priorité aux pharmacies)

Ticket : quand l'extension du contrat des pharmacies reprendra, le quai recevra 9 000 colis par soir, dont 3 000 pour les pharmacies, et 15 000 au pic de décembre. La file doit garder le plus urgent devant, dans l'ordre exact du contrat, quel que soit l'ordre d'arrivée des colis.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | temps de calcul d'une soirée de 15 000 colis, pris au seul processus de Quai, qui sert aussi le site et l'API | 3 |
| Mémoire | pic mémoire de la même soirée | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | l'ordre du contrat est-il rendu quel que soit l'ordre d'arrivée et le nombre d'heures limites | 3 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux du ticket ADR-003. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `tas`. Option C : `seaux`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 3 | 4 | 5 | 5 | 5 | 43 |
| B (tas) | 5 | 5 | 3 | 5 | 3 | 44 |
| C (seaux) | 5 | 5 | 4 | 2 | 4 | 38 |

Total pondéré = 3 x Temps + 1 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Barèmes fixés avant de lire les mesures (ceux de la fiche atelier 6).
- Temps (soirée de 15 000 colis) : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà.
- Mémoire (la même soirée) : 5 sous 10 Mo, 4 sous 50, 3 sous 200, 2 sous 1 Go, 1 au-delà ; deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.
- Lisibilité : on part de 5 et on retire un point par idée qu'il faut connaître.
- Robustesse : 5 si l'ordre exact du contrat est rendu quel que soit l'ordre d'arrivée et le nombre d'heures limites ; 4 si seule une égalité complète sort dans un autre ordre que le legacy ; 3 si l'ordre tient à une seule heure limite par priorité ; 2 si l'ordre est faux en silence dès que les colis n'arrivent pas dans l'ordre de création ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes et une structure fournie ; 3 pour une structure à écrire et à tester ; 2 pour une donnée à préparer à chaque lancement ; 1 pour une dépendance ajoutée.

Les durées et mémoires viennent de `bench/resultats/2026-11-10T11-22-15-priorite.csv` (médiane de 5 répétitions, échauffement de 2) et l'épreuve des arrivées dans le désordre de `bench/resultats/2026-11-10T11-22-41-priorite-arrivees.csv`.

Justification rapide des notes :

- Temps A : 6 837 ms pour 15 000 colis, entre 2 s et 10 s, note 3. Temps B : 35 ms, note 5. Temps C : 2,7 ms, note 5.
- Mémoire A : 11,0 Mo à 15 000 colis (13,6 Mo à 9 000), entre 10 et 50 Mo, note 4. Mémoire B : 2,2 Mo, note 5. Mémoire C : 0,9 Mo, note 5.
- Lisibilité : A 5, un tri et un `shift`, aucune idée à connaître. B 3, deux idées : l'arbre rangé dans un tableau et ses deux gestes (remonter, descendre). C 4, une idée : une file par priorité.
- Robustesse A : c'est la référence, `npm test` passe, note 5. Robustesse B : `npm test` passe et, dans l'épreuve des arrivées dans le désordre, la somme de contrôle de B est celle du legacy à 1 000 (`89c52d41`) et à 9 000 colis (`cfa0b5e5`) ; le rang d'arrivée départage les égalités complètes, note 5. Robustesse C : `npm test` passe (ses données arrivent dans l'ordre), mais l'épreuve s'arrête à 1 000 colis (`bc776f41` contre `89c52d41`) : elle rend un ordre faux sans prévenir dès que les colis n'arrivent pas dans l'ordre de création, note 2. L'article 3 du contrat donne en plus deux heures limites aux pharmacies (10h avant 19h, 12h entre 19h et 23h), alors que C suppose une fin de créneau par priorité.
- Coût : A 5, rien ne change. B 3, la structure est à écrire et à tester (`remonter` et `descendre`, plus le rang d'arrivée). C 4, quelques lignes et trois files, sans structure à tester.

## 3. La sensibilité

Avec les autres poids gardés (mémoire 1, lisibilité 2, robustesse 3, coût 1), B dépasse A dès que le poids du temps passe 2,5 (à 2 : A 40 contre B 39 ; à 3 : 43 contre 44) : le poids imposé, 3, est à un demi-point de la bascule. En sens inverse, A repasse devant B dès que le poids de la lisibilité dépasse 2,5. La grille hésite, c'est une décision fragile aux poids. C reste dernier dans tous ces cas : sa robustesse de 2 pèse trop.
