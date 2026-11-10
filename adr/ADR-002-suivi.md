# ADR-002 - Retrouver le dernier scan d'un colis avec la variante `map`

## 1. Contexte

La page « Où est mon colis » cherche un numéro de suivi parmi les scans gardés six mois, 13 millions en production, 70 000 de plus par jour (pièce 06). Elle est ouverte 40 000 fois par jour. Le legacy de 2024 relit tous les scans à chaque consultation. La contrainte est le temps de réponse, pas le temps de construction : la structure se prépare une fois, quand les scans arrivent.

## 2. Options comparées

- Option A (legacy, `tableau`) : rien à construire, chaque consultation parcourt tous les scans et garde le plus récent (`plusRecent`). Complexité annoncée : O(n) par consultation.
- Option B (`set`) : un ensemble des numéros connus refuse tout de suite un numéro inconnu ; un numéro connu parcourt encore tous les scans. Complexité annoncée : O(n) pour construire, O(1) si le numéro est inconnu, O(n) s'il est connu.
- Option C (`map`) : une table du numéro vers son scan le plus récent ; chaque consultation lit une case. Complexité annoncée : O(n) pour construire, O(1) par consultation.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeux : `data/jeux/grande`, tailles 10 000, 100 000 et 996 844 scans. Chaque appel chronométré enchaîne 100 consultations (quatre numéros existants sur cinq, un mal tapé, graine 2026).
- Répétitions et échauffement : 5 répétitions, 3 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : le temps de 100 consultations, structure déjà construite (`bench/resultats/2026-11-10T09-34-05-suivi.csv`), puis le temps et la mémoire de la construction seule (`bench/resultats/2026-11-10T09-36-07-suivi-construction.csv`). Somme de contrôle identique pour les trois options à chaque taille.

| Option | 10 000 | 100 000 | 996 844 | Mémoire |
| --- | --- | --- | --- | --- |
| A | 22,5 ms | 201,2 ms | 1 488,5 ms | 1 Ko |
| B | 8,2 ms | 87,5 ms | 964,4 ms | 5 122 Ko |
| C | 0,04 ms | 0,06 ms | 0,06 ms | 7 170 Ko |

Les temps sont ceux de 100 consultations. La mémoire est celle de la construction à 996 844 scans : 1 Ko, 5 122 Ko et 7 170 Ko. Construire coûte alors 0,015 ms, 290,3 ms et 764,9 ms. Une consultation, à cette taille, dure donc 14,9 ms, 9,6 ms et 0,0006 ms.

Courbe : `bench/resultats/2026-11-10T09-34-05-suivi.svg`.

## 4. Décision

Nous adoptons l'option C (`map`), total pondéré 39 contre 34 pour le tableau et 30 pour le Set (`adr/GRILLE-ADR-002.md`), parce que le temps, qui pèse 4, fait passer 100 consultations de 1 488,5 ms à 0,06 ms sur 996 844 scans.

## 5. Conséquences et limites

La Map occupe 7 170 Ko à 996 844 scans et se construit en 764,9 ms, une fois. Aucune dépendance : le code garde le scan le plus récent avec `plusRecent`, comme le legacy. La mémoire du Set et de la Map est identique à 100 000 et à 996 844 scans : les scans sont presque rangés par heure, et le premier passage de chaque colis est déjà dans les 100 000 premiers. Ce qui grandit ensuite, c'est le temps de les relire, pas la taille de la table. Non mesuré : les 13 millions de scans de production, une mise à jour au fil des 70 000 arrivées quotidiennes, le délai vu par le client une fois la page servie sur le réseau.

Domaine de validité : nous avons fait varier le nombre de scans (10 000, 100 000, 996 844). Nous n'avons pas fait varier les 13 000 000 de scans, les 70 000 arrivées par jour, ni la part de numéros mal tapés (un sur cinq). La Map, construction comprise, devient moins chère que le tableau à partir de 52 consultations (764,9 ms de construction contre 14,9 ms par consultation, à 996 844 scans). En dessous, si l'on reconstruisait la table à chaque consultation, le tableau resterait moins cher. La page en fait 40 000 par jour : la décision tient. Si les temps restent proportionnels au nombre de scans, le seuil reste d'environ 52 consultations à 13 millions de scans, et une reconstruction complète y prendrait environ 10 secondes.

## 6. En trois phrases pour la directrice des opérations

La page « Où est mon colis », ouverte 40 000 fois par jour, relit aujourd'hui tout l'historique à chaque fois : sur le million de passages d'une grosse journée, le client attend environ un centième et demi de seconde, et sur les 13 millions de passages gardés six mois ce serait environ un cinquième de seconde. Nous préparons une fiche par numéro, une seule fois : la réponse devient immédiate, et cette préparation prend moins d'une seconde pour un million de passages. Elle est rentable dès 52 consultations entre deux mises à jour, très en dessous des 40 000 ouvertures quotidiennes, même avec 70 000 passages de plus chaque jour.
