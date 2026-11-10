# Grille comparative - ADR-004 : sortir les cent premiers clients du mois

Ticket : le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients fait tomber le serveur, mémoire saturée. Il porte sur trois millions de lignes de facturation et 1 900 clients. Deux contraintes : la mémoire de pointe d'abord, le temps ensuite.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée du calcul du rapport à trois millions de lignes, croissance quand le volume grandit | 2 |
| Mémoire | mémoire relevée pendant le calcul à trois millions de lignes, lue comme un ordre de grandeur | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | classement exact sur les trois tests, pire cas garanti ou non | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux imposés par le ticket ADR-004. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tri`). Option B : `tas`. Option C : `quickselect`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 4 | 3 | 5 | 5 | 5 | 40 |
| B (tas) | 5 | 5 | 3 | 5 | 4 | 45 |
| C (quickselect) | 5 | 4 | 2 | 3 | 4 | 37 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Les barèmes, fixés avant de mesurer :

- Mémoire (à trois millions de lignes) : 5 sous 10 Mo, 4 sous 50 Mo, 3 sous 200 Mo, 2 sous 1 Go, 1 au-delà ; `memoire_ko` est un ordre de grandeur, deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.
- Temps (à trois millions de lignes) : 5 sous 0,5 s, 4 sous 2 s, 3 sous 10 s, 2 sous 60 s, 1 au-delà.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour lire la variante.
- Robustesse : 5 si le classement est exact sur les trois tests avec un pire cas garanti ; 3 si le classement est exact mais le pire cas quadratique, rendu improbable par un pivot tiré au hasard (la note 4 n'est pas utilisée) ; 2 si un cas courant (moins de clients que K, deux totaux égaux) donne un classement faux en silence ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes et une structure déjà écrite ou fournie ; 3 pour une structure à écrire et à tester ; 2 pour une donnée à préparer à chaque lancement ; 1 pour une dépendance ajoutée.

Mesure : `bench/resultats/2026-11-10T14-46-34-rapport.csv` (médiane de 5 répétitions, 2 tours d'échauffement).

Justification rapide des notes :

- Mémoire A : 63,7 Mo, sous 200 Mo, note 3. Le legacy copie les trois millions de lignes pour les trier.
- Mémoire B : 0,3 Mo, note 5. Le tri le dépasse 208 fois : c'est cet écart qui répond au ticket.
- Mémoire C : 19,5 Mo, sous 50 Mo, note 4. Un second lancement complet (`bench/resultats/2026-11-10T15-44-04-rapport.csv`) relève la même valeur, 19 459 ko aux cinq répétitions : sur ce poste le relevé se reproduit. Une relance du tas et du quickselect seuls (`bench/resultats/2026-11-10T14-46-57-rapport.csv`) a relevé 52 Mo pour les deux : relevé jugé absurde, on garde la plus petite valeur positive, comme la fiche le demande. L'écart de mémoire entre B et C reste peu sûr ; avec la note 5 pour C, son total passerait à 41, toujours derrière B.
- Temps A : 1,17 s, sous 2 s, note 4. Temps B : 0,078 s, note 5 (le tri le dépasse 15 fois). Temps C : 0,100 s, note 5.
- Lisibilité : A 5, deux tris et une addition, aucune idée à connaître. B 3, deux idées : le tas, et son sommet qui est le moins bon des K gardés. C 2, trois idées : le pivot, la descente dans une seule moitié, le tirage à graine fixe.
- Robustesse : `npm test` passe pour les trois (même classement, égalité de totaux, moins de clients que K). A 5 et B 5 : pire cas garanti. C 3 : classement exact, mais pire cas quadratique, rendu improbable par le pivot tiré au hasard.
- Coût : A 5, rien ne change. B 4, quelques lignes et le tas déjà écrit à l'atelier 6. C 4, quelques lignes et un quickselect fourni, écrit en entier dans `bench/variantes/rapport.ts`.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 4, robustesse 1, coût 1) : A 47, B 57, C 50. La décision ne change pas, B reste premier.

La bascule : il faut passer deux points de la mémoire à la lisibilité (temps 2, mémoire 2, lisibilité 4, robustesse 1, coût 1) pour que le legacy repasse devant, 44 contre 41 ; avec un seul point (mémoire 3, lisibilité 3), B tient encore, 43 contre 42. La décision est solide tant que la mémoire reste le premier critère, ce que le ticket impose.
