# Grille comparative - ADR-006 : ranger le réseau routier de la métropole

Ticket : recalculer les tournées sur les vraies rues (préalable de T-0733). Le réseau tient dans le processus qui sert aussi le site et l'API. 46 565 carrefours, 111 288 rues orientées.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | construire la représentation et la parcourir, à 46 565 carrefours | 2 |
| Mémoire | mémoire ajoutée au processus du site, à 46 565 carrefours | 4 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | toutes les rues sont gardées, y compris deux tronçons entre les mêmes carrefours | 1 |
| Coût de mise en oeuvre | lignes à écrire, et ce qu'il faut refaire quand un pont se lève | 1 |

Les poids sont ceux de la fiche. La mémoire pèse 4 : le réseau partage la machine du site. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `matrice`. Option B : `listes`. Option C : `compacts`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (matrice) | 1 | 1 | 5 | 2 | 5 | 23 |
| B (listes) | 5 | 4 | 4 | 5 | 4 | 43 |
| C (compacts) | 5 | 5 | 3 | 5 | 3 | 44 |

Total pondéré = 2 x Temps + 4 x Mémoire + 2 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barème du temps, à 46 565 carrefours : 5 sous 10 ms, 4 sous 100 ms, 3 sous 1 s, 2 sous 10 s, 1 au-delà ou impossible. Barème de la mémoire : 5 sous 10 Mo, 4 sous 100 Mo, 3 sous 1 Go, 2 sous 4 Go, 1 au-delà. Deux options à moins d'un facteur 2 l'une de l'autre prennent la même note. La matrice ne se mesure pas à cette taille : 46 565 × 46 565 cases à 8 octets, soit 16,2 Go (`npm run graphe`).

Mesures : `bench/resultats/2026-11-13T08-12-22-graphe.csv` (1 000, 2 000, 5 000) et `bench/resultats/2026-11-13T08-12-23-graphe.csv` (5 000, 20 000, 46 565).

Justification des notes :

- Temps : listes 5,9 ms et compacts 2,2 ms, tous les deux sous 10 ms, note 5. La matrice est impossible à cette taille, note 1. À 5 000 carrefours elle met déjà 78 ms ; au carré du rapport des tailles, la métropole vaudrait environ 6,8 s, mais les 16,2 Go ne s'allouent pas.
- Mémoire : listes 17 799 Ko, soit 17,4 Mo, note 4. Compacts 6 808 Ko, soit 6,6 Mo, note 5. Le rapport est 2,6, au-dessus de 2 : les notes diffèrent. La matrice, 16,2 Go calculés, note 1.
- Lisibilité, on part de 5 et une idée à connaître coûte un point : matrice 5, une case par paire de carrefours se lit telle quelle ; listes 4, une idée, un tableau de listes ; compacts 3, deux idées, le tableau `debut` et la lecture de `debut[u]` à `debut[u + 1] - 1`.
- Robustesse : les trois parcourent le même sous-graphe (`npm test`). La matrice n'a qu'une case par paire de carrefours : un second tronçon écrase le premier en silence, note 2. Les listes et les compacts gardent chaque rue, note 5.
- Coût : matrice 5, rien à écrire, retirer une rue est une case. Listes 4, quelques lignes, retirer une rue ne reconstruit pas le reste. Compacts 3, quand le réseau change il faut reconstruire les trois tableaux.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 21, B = 54 et C = 56 : la décision ne change pas, les compacts restent premiers, d'un écart de 2 au lieu de 1.

Elle est fragile autour des poids choisis. Les compacts ne devancent les listes que d'un point (44 contre 43), et seulement parce que 6,6 Mo et 17,4 Mo ne sont pas à moins d'un facteur 2. Un point déplacé de la mémoire vers la lisibilité (mémoire 3, lisibilité 3) retourne la décision : B = 43, C = 42. La matrice, à 16,2 Go, ne revient pas.
