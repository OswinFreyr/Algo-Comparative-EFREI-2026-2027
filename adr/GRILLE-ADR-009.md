# Grille comparative - ADR-009 : charger la première vague d'un vélo cargo

Ticket T-0655 : des vélos partent à moitié vides, et l'article 3 du contrat veut les pharmacies livrées avant 10h00. Quels colis mettre dans la première vague (80 kg, 450 l) pour le plus de points d'urgence (pharmacie 10, express 3, standard 1) ?

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | médiane du harness pour charger 20 tournées | 2 |
| Mémoire | pic du harness à 20 tournées ; calculée pour la table, que le harness ne voit pas | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | `npm test`, puis les points laissés sur le quai sur 60 tournées | 3 |
| Coût de mise en oeuvre | longueur de la fonction, réglages à tenir, dépendances | 1 |

Les poids sont ceux imposés par le ticket. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : `legacy`, premier arrivé, premier chargé. Option B : `glouton`. Option C : `dynamique`, la programmation dynamique. Option D : `backtracking`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 5 | 5 | 5 | 1 | 5 | 38 |
| B (glouton) | 5 | 5 | 4 | 4 | 4 | 44 |
| C (dynamique) | 4 | 5 | 2 | 5 | 3 | 40 |
| D (backtracking) | 5 | 5 | 2 | 5 | 2 | 41 |

Total pondéré = 2 x Temps + 2 x Mémoire + 2 x Lisibilité + 3 x Robustesse + 1 x Coût.

Barèmes, fixés avant de mesurer (fiche atelier 12) : temps à 20 tournées, 5 sous 100 ms, 4 sous 1 s, 3 sous 10 s, 2 sous 1 min, 1 au-delà. Mémoire, 5 sous 10 Mo, 4 sous 50 Mo, 3 sous 200 Mo, 2 sous 1 Go. Robustesse, points laissés sur 60 tournées : 5 si aucun, 4 sous 1 %, 3 sous 5 %, 2 sous 15 %, 1 au-delà. Lisibilité : on part de 5, une idée coûte un point. Coût : 5 si rien ne change ; 4 pour une fonction courte sans réglage ; 3 pour une fonction longue ou un réglage ; 2 pour les deux ; 1 pour une dépendance.

Mesures : `bench/resultats/2026-11-26T08-54-59-chargement.csv` (temps et mémoire), relancée une fois (`bench/resultats/2026-11-26T08-55-03-chargement.csv`) ; `bench/resultats/2026-11-26T08-55-05-cargo.csv` (points sur 60 tournées).

Justification des notes :

- Temps, à 20 tournées : glouton 0,26 ms, backtracking 37 ms, note 5 ; table 648 ms, note 4. Le legacy ne calcule rien, note 5.
- Mémoire : glouton 0,35 Mo et backtracking 3,5 Mo au harness, stables à la relance. La table se calcule : deux couches de 801 x 451 cases (2,8 Mo) et un bit par case pour chaque colis (44 Ko par colis), soit 6,7 Mo pour la tournée la plus chargée (91 colis). Tout est sous 10 Mo, note 5.
- Lisibilité, pour dire ce que fait la fonction, ce qui se passe quand un colis ne rentre pas et où changer le barème : legacy 5, rien à connaître. Glouton 4, une idée, le tri par points rapportés à l'encombrement. Table 2, trois idées : la case qui garde le meilleur avec ou sans le colis, les deux couches qu'on échange, les marques qu'on remonte pour retrouver les colis. Backtracking 2, trois idées : prendre ou laisser chaque colis, la borne qui coupe une branche, les deux ordres (par poids, par volume) qui en font une vraie borne.
- Robustesse : `npm test` passe (25 sur 25). Points laissés sur 60 tournées : legacy 953 sur 5 764 (16,5 %), note 1 ; glouton 12 (0,2 %, un colis pharmacie), note 4 ; table et backtracking, aucun, note 5.
- Coût : legacy 5. Glouton 4, une fonction courte sans réglage. Table 3, une fonction courte et l'arrondi à tenir. Backtracking 2, une fonction longue et le plafond de noeuds à tenir.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres inchangés : A 48, B 55, C 50, D 54. La décision ne change pas, mais le backtracking n'est plus qu'à un point.

Entre le glouton et le backtracking, l'écart vaut 2 x lisibilité + 2 x coût - robustesse, soit + 3 avec les poids du ticket. Il bascule dès que la robustesse pèse plus que deux fois la lisibilité et le coût réunis : avec temps 1, mémoire 2, lisibilité 1, robustesse 5, coût 1, le backtracking passe devant, 44 contre 43. La décision tient aux poids imposés et l'ADR le dit.
