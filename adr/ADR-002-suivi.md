# ADR-002 - Retrouver un colis par son numéro de suivi avec la variante `map`

## 1. Contexte

La page "Où est mon colis" rend le dernier scan d'un colis à partir de son numéro de suivi. Le legacy de mars 2024 relit tous les scans à chaque requête. La base garde six mois de scans, soit 13 millions, 70 000 de plus par jour, et la page est appelée 40 000 fois par jour, dont une fois sur cinq avec un numéro mal tapé. La contrainte est le temps de réponse par requête, pas le temps de construction.

## 2. Options comparées

- Option A (legacy, `tableau`) : rien à construire, chaque requête filtre tous les scans puis garde le plus récent. Complexité annoncée : O(n) par requête, n étant le nombre de scans.
- Option B (`set`) : un Set des numéros connus refuse tout de suite un numéro inconnu ; un numéro connu relit encore tous les scans. Complexité annoncée : O(1) pour un numéro inconnu, O(n) pour un numéro connu, O(n) pour construire.
- Option C (`map`) : une Map du numéro de suivi vers son scan le plus récent, chaque requête lit une case. Complexité annoncée : O(1) par requête, O(n) pour construire.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : `data/jeux/grande`, les 10 000, 100 000 et 996 844 premiers scans (98 500 colis distincts au total).
- Répétitions et échauffement : 5 répétitions, 3 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : la durée d'un lot de 100 requêtes à graine fixe, 80 numéros connus et 20 mal tapés, structure construite hors chronomètre (`bench/resultats/2026-11-10T09-30-26-suivi.csv`) ; à part, la durée de construction et la mémoire de la structure (`bench/resultats/2026-11-10T09-32-17-suivi-construction.csv`). Somme de contrôle identique pour les trois options à chaque taille.

Durée du lot de 100 requêtes, mémoire de la structure à 996 844 scans :

| Option | 10 000 | 100 000 | 996 844 | Mémoire |
| --- | --- | --- | --- | --- |
| A | 19,1 ms | 159,5 ms | 1 621,2 ms | 0,001 Mo |
| B | 15,1 ms | 108,8 ms | 1 101,9 ms | 5,1 Mo |
| C | 0,025 ms | 0,036 ms | 0,037 ms | 7,2 Mo |

Par requête à 996 844 scans : A 16,2 ms, B 11,0 ms, C 0,0004 ms. Projeté sur les 13 millions de scans de la base (x 13 pour A et B, qui relisent tous les scans ; C ne grandit pas avec les scans) : A 210,8 ms, B 143,2 ms, C 0,0004 ms. Sur 40 000 requêtes par jour, cela fait 2 h 20 de calcul cumulé pour A, 1 h 35 pour B, moins d'une seconde pour C.

Construction à 996 844 scans : A 0,01 ms, B 151,6 ms, C 495,8 ms, payée une fois au démarrage.

Courbe : `bench/resultats/2026-11-10T09-30-26-suivi.svg`.

## 4. Décision

Nous adoptons l'option C (`map`), total pondéré 44 contre 34 pour le legacy et 29 pour `set` (`adr/GRILLE-ADR-002.md`), parce que le temps par requête, qui pèse 5, est le seul critère où elle se détache : 0,0004 ms contre 210,8 ms projetés pour le legacy.

## 5. Conséquences et limites

La Map coûte 7,2 Mo au million de scans et une demi-seconde de construction au démarrage (environ 6,4 s projetées à 13 millions de scans, non mesuré). Surtout, elle doit être mise à jour à chaque scan qui arrive, 70 000 fois par jour : un scan manqué laisse la page afficher l'avant-dernier scan sans erreur, d'où la robustesse notée 3 contre 4 pour le legacy. Aucune des trois options ne vérifie le format du numéro. Non mesuré : la page en production, la base réelle, la mise à jour de la Map au fil de l'eau.

Domaine de validité : nous avons fait varier le nombre de scans (10 000, 100 000 et 996 844). Nous n'avons pas fait varier le nombre de colis distincts (98 500), la part de numéros mal tapés (20 %), ni mesuré à 13 millions de scans : le facteur 13 est une règle de trois. La mémoire de la Map suit le nombre de colis, pas de scans : à 13 millions de scans, environ 1,3 million de colis, elle pèserait de l'ordre de 93 Mo (note 2 au lieu de 4, total 40, toujours premier). La décision ne tient plus sous 615 000 scans en base environ, neuf jours de scans : le legacy y répond en moins de 10 ms et fait jeu égal à 44 points ; sous 61 000 scans il passe devant.

## 6. En trois phrases pour la directrice des opérations

Aujourd'hui, chaque fois qu'un client demande où est son colis, la page relit les 13 millions de passages enregistrés depuis six mois, ce qui lui prend environ 0,2 seconde et occupe nos machines plus de deux heures par jour pour 40 000 demandes. Nous retenons un carnet tenu à jour qui garde, pour chaque colis, son dernier passage : la réponse devient immédiate, quel que soit le nombre de passages enregistrés. En échange, ce carnet doit être complété à chaque nouveau passage d'un colis, sinon la page afficherait une position en retard.
