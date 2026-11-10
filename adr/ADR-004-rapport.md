# ADR-004 - Sortir les cent premiers clients du mois avec le tas

## 1. Contexte

Le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients par chiffre d'affaires fait tomber le serveur : la mémoire est saturée. Octobre 2026 compte 3 000 000 de lignes de facturation, 1 900 clients et 1 071 429 euros, à graine fixe. Le legacy de 2020 trie toutes les lignes pour les regrouper, puis trie tous les clients et n'en garde que cent. Le rapport ne tourne qu'une fois par mois : la contrainte qui compte est la mémoire de pointe du calcul, pas la durée.

## 2. Options comparées

- Option A (legacy, `tri`) : copie des lignes, tri par client, addition, tri de tous les clients, les cent premiers. Complexité annoncée : O(n log n) pour n lignes.
- Option B (`tas`) : une passe qui additionne par client, puis un tas de taille 100 dont le sommet est le moins bon des cent gardés. Un client n'entre que s'il bat ce sommet. Complexité annoncée : O(n) pour les totaux, O(m log 100) pour m clients.
- Option C (`quickselect`) : les mêmes totaux, puis placement du 100e meilleur sans trier le reste, et tri des seuls cent premiers. Complexité annoncée : O(m) en moyenne, O(m²) dans le pire cas, rendu improbable par un pivot tiré à graine fixe.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeu : `data/jeux/mois/facturation.csv`, les 100 000, 1 000 000 et 3 000 000 premières lignes. Le chargement du fichier est hors chronomètre.
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : la durée du rapport et le supplément de mémoire pendant l'appel. Somme de contrôle identique pour les trois options à chaque taille (`d2bc0a0e`, `5e35a342`, `1f2ec5a2`).

| Option | 100 000 | 1 000 000 | 3 000 000 |
| --- | --- | --- | --- |
| A | 38,6 ms, 2,5 Mo | 389,8 ms, 24,3 Mo | 1 221,2 ms, 65,0 Mo |
| B | 3,7 ms, 0,3 Mo | 27,9 ms, 0,3 Mo | 80,1 ms, 0,3 Mo |
| C | 2,9 ms, 0,2 Mo | 26,9 ms, 0,2 Mo | 79,0 ms, 0,2 Mo |

À 3 000 000 de lignes, les cinq relevés du tri sont à 66 516 Ko, ceux du tas entre 296 et 310 Ko, ceux du quickselect à 234 Ko. Un second lancement complet donne les mêmes ordres (`bench/resultats/2026-11-10T15-15-55-rapport.csv`). Relancé seul, le quickselect a pour médiane 238 Ko (`bench/resultats/2026-11-10T15-57-45-rapport.csv`). Node v22.22.3, Apple M1 Pro, dans les JSON à côté des CSV. L'exemple de la fiche donne 19 459 Ko pour le quickselect : ce serait la note 4 et un total de 37, pas une autre décision. Nos trois lancements restent vers 230 Ko. Le tri, lui, est à 66 516 Ko comme l'exemple. Le tri dépasse le tas d'un facteur 221 en mémoire et d'un facteur 15 en temps. Le tas et le quickselect sont dans le bruit l'un de l'autre sur le temps.

Mesures : `bench/resultats/2026-11-10T15-09-39-rapport.csv`. Courbe : `bench/resultats/2026-11-10T15-09-39-rapport.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 45 contre 41 pour le quickselect et 40 pour le tri (`adr/GRILLE-ADR-004.md`) : le facteur 221 en mémoire répond au ticket, et, le tas et le quickselect se valant sur le temps comme sur la mémoire, c'est le pire cas garanti du tas qui les départage.

## 5. Conséquences et limites

Le tas coûte deux idées à lire et environ 0,3 Mo à 3 000 000 de lignes, sans dépendance. Il s'appuie sur le tas écrit à l'atelier 6. La décision ne bascule pas près des poids choisis : le quickselect n'est jamais mieux noté que le tas, et le tri ne repasse devant que si le poids de la mémoire tombe à 2. Non mesuré : le chargement des lignes, fait avant le chronomètre, et la mémoire déjà prise par ces lignes une fois en mémoire. Le supplément mesuré est celui du calcul seul.

Domaine de validité : nous avons fait varier le nombre de lignes (100 000, 1 000 000, 3 000 000). Nous n'avons pas fait varier les 1 900 clients du mois, ni les cent places du rapport. Le tas occupe 301 Ko pour ces 1 900 clients, soit 0,16 Ko par client. La note 5 de mémoire s'arrête sous 10 Mo, soit 10 240 Ko : 10 240 / (301 / 1 900) donne environ 64 600 clients. En dessous, le supplément du tas reste négligeable devant celui du tri ; au-delà, la table des totaux elle-même quitterait la note 5. Nous en sommes loin.

## 6. En trois phrases pour la directrice des opérations

Le premier jour ouvré du mois, à six heures, le rapport des cent plus gros clients reclasse les trois millions de lignes du mois : cela prend un peu plus d'une seconde et occupe 65 mégaoctets de plus, assez pour faire tomber le serveur. Nous ne gardons qu'une liste courte des cent meilleurs clients déjà vus : le même rapport tombe à huit centièmes de seconde et à trois dixièmes de mégaoctet. Cette liste resterait sous les 10 mégaoctets jusqu'à environ 65 000 clients, très au-dessus des 1 900 comptes actuels.
