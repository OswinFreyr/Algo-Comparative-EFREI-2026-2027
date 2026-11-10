# Grille comparative - ADR-004 : sortir les cent premiers clients du mois sans ranger trois millions de lignes

Ticket : le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients (par chiffre d'affaires) fait tomber le serveur : mémoire saturée. Le mois d'octobre 2026 compte 3 000 000 de lignes de facturation et 1 900 clients. Le ticket a deux contraintes : la mémoire de pointe, puis le temps.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée du rapport à 3 000 000 de lignes | 2 |
| Mémoire | pic mémoire du rapport à 3 000 000 de lignes | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | classement exact sur les trois tests (mêmes cent clients que le legacy, égalités départagées, moins de clients que K), pire cas de la variante | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux du ticket ADR-004. Aucun critère à 0. La mémoire pèse le plus : c'est elle qui fait tomber le serveur.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tri`). Option B : `tas` (totaux par Map, puis tas de taille K). Option C : `quickselect`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 4 | 3 | 5 | 5 | 5 | 40 |
| B (tas) | 5 | 5 | 3 | 5 | 4 | 45 |
| C (quickselect) | 5 | 5 | 2 | 3 | 4 | 41 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barèmes fixés avant de lire les mesures (ceux de la fiche atelier 7).
- Temps (3 000 000 de lignes) : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà.
- Mémoire (3 000 000 de lignes) : 5 sous 10 Mo, 4 sous 50, 3 sous 200, 2 sous 1 Go, 1 au-delà ; `memoire_ko` est un ordre de grandeur, et deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.
- Lisibilité : on part de 5 et on retire un point par idée qu'il faut connaître pour lire la variante (le tas et son sommet qui est le moins bon ; le pivot, la descente dans une seule moitié et le tirage à graine fixe).
- Robustesse : 5 si le classement est exact sur les trois tests avec un pire cas garanti ; 3 si le classement est exact mais le pire cas quadratique, rendu improbable par un pivot tiré au hasard (la note 4 n'est pas utilisée) ; 2 si un cas courant (moins de clients que K, deux totaux égaux) donne un classement faux en silence ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes et une structure déjà écrite ou fournie ; 3 pour une structure à écrire et à tester ; 2 pour une donnée à préparer à chaque lancement ; 1 pour une dépendance ajoutée.

Les mesures sont celles de `bench/resultats/2026-11-10T14-55-06-rapport.csv` (médiane de 5 répétitions, échauffement de 2, jeu `mois`).

Justification rapide des notes :

- Temps A : 1 351 ms à 3 000 000 de lignes, entre 0,5 s et 2 s, note 4. Temps B : 78 ms, note 5. Temps C : 76 ms, note 5.
- Mémoire A : 66 516 Ko, soit 65 Mo, entre 50 et 200 Mo, note 3. Mémoire B : 304 Ko, note 5. Mémoire C : 234 Ko, note 5. Le tri dépasse le tas de 219 fois en mémoire et de 17 fois en temps : c'est l'écart de mémoire qui répond au ticket.
- Lisibilité : A 5, un tri, un regroupement, un second tri, aucune idée à connaître. B 3, deux idées : le tas, et son sommet qui est le moins bon des K gardés. C 2, trois idées : le pivot, la descente dans une seule moitié et le tirage à graine fixe.
- Robustesse A : `npm test` passe, c'est la référence, pire cas garanti en O(n log n), note 5. Robustesse B : `npm test` passe (mêmes cent clients que le legacy, égalité de totaux départagée par le numéro de client, moins de clients que K), pire cas garanti en O(m log K), note 5. Robustesse C : classement exact aux trois tests, mais le pire cas est quadratique, rendu improbable par le pivot tiré à graine fixe, note 3. Les trois sommes de contrôle sont identiques à chaque taille.
- Coût : A 5, rien ne change. B 4, quelques lignes et un tas déjà écrit (atelier 6). C 4, quelques lignes et un quickselect fourni, écrit en entier dans `bench/variantes/rapport.ts`.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (les autres poids gardés) : A 47, B 57, C 54. B reste premier et l'écart avec C passe de 4 à 3 points. La décision ne change pas. B - A = poids du temps + 2 x poids de la mémoire - 2 x poids de la lisibilité - poids du coût, soit 5 aux poids du ticket : A repasse devant B seulement si le poids de la mémoire tombe sous 1,5 environ (il est de 4). B - C = poids de la lisibilité + 2 x poids de la robustesse, positif dès que l'un des deux pèse quelque chose. La décision est solide aux poids.
