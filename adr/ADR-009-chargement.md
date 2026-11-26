# ADR-009 - Charger la première vague d'un vélo cargo avec le glouton

## 1. Contexte

Ticket T-0655 : des vélos partent à moitié vides. Le legacy charge dans l'ordre d'arrivée et ferme la première vague au premier colis qui déborde (`legacy/src/chargement.ts`) ; l'article 3 du contrat veut les pharmacies livrées avant 10h00, donc dans la première vague, celle de 7h00. Sur cinq tournées (`npm run cargo -- --tournees 5`), le legacy emporte 393 points et 88 colis sur 335, le glouton 476 points et 175 colis ; 8 express sur 48 attendent une vague suivante avec le legacy. Sur les 60 tournées de vélo cargo du jeu `moyenne`, le legacy emporte 4 811 points, l'optimum 5 764. La contrainte : le plus de points d'urgence dans la première vague (80 kg, 450 l).

## 2. Options comparées

`n` est le nombre de colis de la tournée, P et V les capacités arrondies (800 hectogrammes, 450 litres).

- Option A (`legacy`) : premier arrivé, premier chargé. Complexité annoncée : O(n).
- Option B (`glouton`) : les colis triés par points rapportés à l'encombrement, pris dans cet ordre tant qu'ils rentrent. Complexité annoncée : O(n log n).
- Option C (`dynamique`) : une table du meilleur nombre de points pour chaque poids et chaque volume, remplie colis par colis. Exacte sur les valeurs arrondies. Complexité annoncée : O(n x P x V), quelles que soient les données.
- Option D (`backtracking`) : prendre ou laisser chaque colis, une borne coupant les branches qui ne peuvent pas battre le meilleur connu. Exacte. Complexité annoncée : O(2^n) au pire, son temps dépend des données.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeu : `data/jeux/moyenne`, les 60 tournées de vélo cargo (50 à 91 colis), poids arrondis au-dessus à l'hectogramme, volumes au litre.
- Répétitions et échauffement : 3 répétitions et 1 tour, à 1, 5 et 20 tournées, mesure relancée une fois pour la mémoire. Qualité : une passe sur les 60 tournées, barème 10-3-1.
- Statistique retenue : la médiane.
- Mesuré : le temps et la mémoire au harness ; la mémoire de la table, calculée ; les points emportés en première vague.

| Option | 1 | 5 | 20 | Points sur 60 tournées | Mémoire |
| --- | --- | --- | --- | --- | --- |
| A | - | - | - | 4 811 | - |
| B | 0,03 ms | 0,09 ms | 0,26 ms | 5 752 | 0,35 Mo |
| C | 39 ms | 175 ms | 648 ms | 5 764 | 6,7 Mo, calculée |
| D | 0,34 ms | 3,1 ms | 37 ms | 5 764 | 3,5 Mo |

Mesures : `bench/resultats/2026-11-26T08-54-59-chargement.csv` (temps et mémoire, relancée dans `bench/resultats/2026-11-26T08-55-03-chargement.csv`) et `bench/resultats/2026-11-26T08-55-05-cargo.csv` (points). Sur les 60 tournées, le backtracking visite 2 819 365 noeuds en 310 ms, la table met 2,1 s. Le glouton laisse 12 points sur le quai, un colis pharmacie.

## 4. Décision

Nous adoptons l'option B (`glouton`), total pondéré 44 contre 41 pour le backtracking, 40 pour la table et 38 pour le legacy (`adr/GRILLE-ADR-009.md`) : il emporte 0,2 % de points de moins que l'optimum, en une fonction courte sans réglage ; les deux méthodes exactes ne lui reprennent ces 12 points qu'au prix de trois idées à connaître et d'un réglage à tenir.

## 5. Conséquences et limites

Le glouton laisse un colis pharmacie sur le quai, sur 60 tournées : il partira dans une vague suivante, hors du délai de l'article 3. Le barème 10-3-1 ne protège pas non plus les pharmacies : l'optimum en laisse trois, les plus encombrantes (30 kg, 16 kg et 10,8 kg), et emporte 338 pharmacies sur 341 quand le legacy en emporte 340. À 50 points la pharmacie (`npm run cargo -- --points 50,3,1`, `bench/resultats/2026-11-26T08-55-53-cargo.csv`), les trois méthodes emportent 340 pharmacies sur 341 : c'est le barème, pas la méthode, qui fait respecter le contrat.

Les poids sont arrondis au-dessus à l'hectogramme et les volumes au litre : une vague faisable sur les valeurs arrondies l'est sur les vraies, mais peut laisser moins de 100 g et 1 l inutilisés par colis. Non mesuré : les vagues suivantes, les créneaux horaires des clients, les utilitaires.

Domaine de validité : nous avons fait varier le nombre de tournées (1, 5, 20, 60) et le barème des pharmacies (10 et 50). La décision tient à un point de robustesse : si le glouton laissait 1 % des points ou plus, il tomberait à 3 et finirait à égalité avec le backtracking, 41 contre 41 ; au-delà de 5 %, le backtracking passerait devant. Ici il en laisse 0,2 %. La table ne tient que sur l'arrondi actuel : au décilitre, ses cases sont dix fois plus nombreuses, 67 Mo et environ 6,5 s pour 20 tournées ; au gramme, cent fois, 668 Mo et plus d'une minute (calculé, non mesuré).

## 6. En trois phrases pour la directrice des opérations

Aujourd'hui, le vélo se charge dans l'ordre d'arrivée des colis et part dès qu'un colis ne rentre plus, en laissant derrière lui des colis urgents qui auraient tenu. Nous retenons une façon de charger qui place d'abord les colis qui rapportent le plus d'urgence pour la place qu'ils prennent : le vélo emporte deux fois plus de colis, presque autant d'urgence qu'en essayant toutes les combinaisons, et la réponse est instantanée. Sur soixante tournées, un seul colis de pharmacie reste au dépôt, et pour n'en laisser aucun il faudra compter les pharmacies bien plus haut que les autres colis.
