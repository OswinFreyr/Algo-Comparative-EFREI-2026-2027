# ADR-002 - Retrouver un colis par son numéro de suivi avec la variante `map`

## 1. Contexte

La page "Où est mon colis" cherche le dernier scan d'un numéro de suivi parmi les 13 millions de scans gardés six mois en base, 70 000 de plus par jour. Elle est appelée 40 000 fois par jour. Le legacy de 2024 relit tous les scans à chaque appel : à 996 844 scans il met 45 ms par appel, soit environ 590 ms à 13 millions. La contrainte est le temps de réponse d'un appel, pas le temps de construction ni la mémoire.

## 2. Options comparées

- Option A (legacy, `tableau`) : filtre tous les scans sur le numéro puis garde le plus récent, à chaque appel. Rien à construire. Complexité annoncée : O(n) par appel.
- Option B (`set`) : un Set des numéros connus refuse tout de suite un numéro mal tapé ; un numéro connu parcourt encore tous les scans. Complexité annoncée : O(1) pour un numéro inconnu, O(n) pour un numéro connu.
- Option C (`map`) : une Map du numéro vers son scan le plus récent, construite une fois quand les scans arrivent ; chaque appel lit une case. Complexité annoncée : O(n) une fois pour construire, O(1) par appel.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/grande`, 10 000, 100 000 et 996 844 scans ; 100 appels par répétition, dont environ un sur cinq avec un numéro mal tapé.
- Répétitions et échauffement : 5 répétitions, 3 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : durée de 100 appels (`bench/resultats/2026-11-10T09-31-36-suivi.csv`), durée et mémoire de construction de la structure (`bench/resultats/2026-11-10T09-36-32-suivi-construction.csv`). Somme de contrôle identique pour les trois options à chaque taille.

| Option | 10 000 | 100 000 | 996 844 | Mémoire |
| --- | --- | --- | --- | --- |
| A | 37,2 ms | 319,5 ms | 4 522,6 ms | environ 0 Mo |
| B | 16,0 ms | 172,7 ms | 2 959,6 ms | 4,8 Mo |
| C | 0,1 ms | 0,1 ms | 0,1 ms | 7,2 Mo |

Les durées sont celles de 100 appels. À 13 millions de scans, par appel : A environ 590 ms, B environ 386 ms, C environ 1 microseconde. Construction de C : 1,2 s à 996 844 scans, environ 15 s à 13 millions (B : 0,56 s ; A : rien).

Courbe : `bench/resultats/2026-11-10T09-31-36-suivi.svg`.

## 4. Décision

Nous adoptons l'option C (`map`), total pondéré 44 contre 34 pour le legacy et 29 pour `set` (`adr/GRILLE-ADR-002.md`), parce que le critère du temps, qui pèse 5, est celui qui fait passer chaque appel de 590 ms à environ une microseconde.

## 5. Conséquences et limites

La Map garde une entrée par colis : 7,2 Mo à 996 844 scans, nettement plus que le legacy, et il faut la reconstruire (environ 15 s) ou la mettre à jour avec les 70 000 scans qui arrivent chaque jour. Le code est un peu moins direct (une fonction de construction et la règle du scan le plus récent). Non mesuré : la mémoire à 13 millions de scans (les relevés du tas sont trop irréguliers pour s'extrapoler), l'accès réel à la base en production, la mise à jour de la Map au fil de l'eau.

Domaine de validité : nous avons fait varier le volume (10 000, 100 000 et 996 844 scans) ; nous n'avons pas fait varier la part de numéros mal tapés (environ 20 %), le nombre d'appels par jour (40 000) ni le nombre de scans par colis. 13 millions de scans est une extrapolation proportionnelle, pas une mesure. La construction de `map` (1,2 s à 996 844 scans) se rembourse dès une trentaine d'appels entre deux constructions (45 ms économisées par appel) : sous cette fréquence le legacy suffit, au-dessus la décision tient largement.

## 6. En trois phrases pour la directrice des opérations

Aujourd'hui, pour dire où est un colis, la page relit tous les passages enregistrés depuis six mois, et elle met plus d'une demi-seconde à répondre quand l'historique grossit. Nous préparons une fois, quand les passages arrivent, une sorte de répertoire où chaque colis retrouve directement son dernier passage : la réponse devient instantanée, quel que soit le nombre de colis. Cela demande un peu plus de place sur le serveur et un quart de minute de préparation, et il faudra tenir ce répertoire à jour avec les 70 000 nouveaux passages de chaque jour.
