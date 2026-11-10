# Grille comparative - ADR-004 : les cent premiers clients du rapport de 6h

Ticket : le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients fait tomber le serveur, mémoire saturée. Il faut sortir les cent premiers sans ranger les trois millions de lignes du mois (1 900 clients, octobre 2026).

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée du rapport à 3 000 000 de lignes, une fois par mois à 6h | 2 |
| Mémoire | pic mémoire du calcul à 3 000 000 de lignes, ce qui fait tomber le serveur | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | le classement exact, y compris à total égal et quand il y a moins de clients que 100, avec un pire cas garanti | 1 |
| Coût de mise en oeuvre | lignes changées, structure à écrire ou déjà fournie, dépendance | 1 |

Les poids sont ceux du ticket. La mémoire pèse 4 : le rapport ne rate pas son horaire, il sature la machine du site. Le temps pèse 2, une fois par mois. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tri`). Option B : `tas` de taille 100. Option C : `quickselect`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (tri) | 4 | 3 | 5 | 5 | 5 | 40 |
| B (tas) | 5 | 5 | 3 | 5 | 4 | 45 |
| C (quickselect) | 5 | 5 | 2 | 3 | 4 | 41 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barème du temps, fixé avant la mesure : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà. Barème de la mémoire, à 3 000 000 de lignes : 5 sous 10 Mo, 4 sous 50 Mo, 3 sous 200 Mo, 2 sous 1 Go, 1 au-delà. `memoire_ko` est un ordre de grandeur : deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.

Mesures : médianes du harness, jeu `mois`, 5 répétitions, échauffement 2 (`bench/resultats/2026-11-10T15-09-39-rapport.csv`). Les notes se lisent à 3 000 000 de lignes.

Justification des notes :

- Temps : le tri met 1 221 ms (note 4), le tas 80 ms (note 5), le quickselect 79 ms (note 5). Le tri est 15 fois plus lent que le tas. Le tas et le quickselect sont dans le bruit l'un de l'autre.
- Mémoire : 66 516 Ko pour le tri (65 Mo, note 3), 301 Ko pour le tas (0,3 Mo, note 5), 234 Ko pour le quickselect (0,2 Mo, note 5). Le tri dépasse le tas d'un facteur 221 : c'est l'écart qui répond au ticket. Les cinq relevés du quickselect à 3 000 000 de lignes sont tous à 234 Ko, ceux du tas entre 296 et 310 Ko : même note, les deux restent sous 10 Mo. Le tri copie les trois millions de lignes ; les deux autres ne gardent que les totaux des 1 900 clients.
- Lisibilité, on part de 5 et une idée à connaître coûte un point : tri 5, trier puis regrouper se lit tel quel ; tas 3, deux idées, le tas et son sommet qui est le moins bon des cent gardés ; quickselect 2, trois idées, le pivot, la descente dans une seule moitié et le tirage à graine fixe.
- Robustesse : les trois donnent le même classement (`1f2ec5a2` à 3 000 000 de lignes), y compris à total égal et quand il y a moins de clients que 100. Le tri et le tas ont un pire cas garanti, note 5. Le quickselect est exact, mais son pire cas est quadratique, rendu improbable par le pivot tiré à graine fixe : note 3, la note 4 n'est pas utilisée.
- Coût : tri 5, rien ne change. Tas 4, quelques lignes sur le tas déjà écrit à l'atelier 6. Quickselect 4, la fonction est déjà fournie, aucune dépendance.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 47, B = 57 et C = 54 : la décision ne change pas, le tas reste premier.

Elle ne bascule pas près des poids choisis. Le tas est au moins aussi bien noté que le quickselect sur chaque critère, et mieux sur la lisibilité et la robustesse : aucun jeu de poids ne fait passer le quickselect devant. Le tri ne repasse devant que si la mémoire cesse d'être le critère du ticket. En baissant son poids de 4 à 2 et en reportant ces deux points sur la lisibilité (poids 4), les totaux deviennent A = 44, B = 41 et C = 35. À un seul point de là (mémoire 3, lisibilité 3), le tas mène encore, 43 contre 42.
