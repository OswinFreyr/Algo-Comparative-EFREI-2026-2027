# ADR-005 - Rapprocher une adresse mal saisie du référentiel avec la variante `trigrammes`

## 1. Contexte

Ticket T-0488 : le support tape "ste catherine 33000 bordeaux" et ne trouve pas la rue Sainte-Catherine. Le legacy compare chaque saisie à toutes les adresses du référentiel : 229 329 pour la métropole, 730 137 pour la Gironde. Une nuit ordinaire apporte 600 adresses à rapprocher, celle du 24 septembre 6 412 (pièces 04 et 06). La contrainte est double : rendre la bonne adresse d'abord, la rendre vite ensuite.

Ce que répond chaque méthode à la saisie du ticket (`npm run exactitude -- --saisie "ste catherine 33000 bordeaux"`) : la force brute rend "110 rue heron 33000 bordeaux" en 1 243 ms, l'index de trigrammes rend "2 rue sainte catherine 33000 bordeaux" en 35 ms, PostgreSQL rend la même adresse en 215 ms. Les deux index proposent les mêmes cinq premiers candidats.

## 2. Options comparées

`n` est le nombre d'adresses du référentiel, L la longueur d'une adresse.

- Option A (legacy, `brute`) : la distance de Levenshtein entre la saisie et chaque adresse du référentiel (lignes 43 à 45 de `legacy/src/adresses.ts`). Complexité annoncée : O(n x L²) par saisie, rien à construire.
- Option B (`trigrammes`) : un index inversé en mémoire, qui donne pour chaque groupe de trois lettres la liste des adresses qui le contiennent ; on compte les trigrammes partagés, on garde les dix adresses les plus semblables, Levenshtein les départage. Complexité annoncée : O(n x L) pour construire ; par saisie, la somme des longueurs des listes parcourues, O(n x L) au pire, bien moins en pratique.
- Option C (`postgres`) : le même principe confié à PostgreSQL, extension `pg_trgm` et index GiST, mesuré dans PGlite. Complexité annoncée : O(n log n) pour construire, sous-linéaire par saisie, sans garantie au pire.

## 3. Mesures

- Machine : Apple M3 Pro, 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : les saisies du jeu `petite` contre le référentiel de la métropole (229 329 adresses), puis contre celui de la Gironde (730 137).
- Répétitions et échauffement : 3 répétitions ; 1 tour d'échauffement pour les deux index, aucun pour la force brute ni pour la construction.
- Statistique retenue : la médiane.
- Mesuré : le temps d'une saisie, index déjà construit ; les saisies justes comparées à la vérité du jeu ; la taille de chaque index, lue dans la colonne `index_mo` et non dans `memoire_ko` ; la durée de construction.

| Option | Une saisie (ms) | Saisies justes sur 300 | Taille de l'index | Construction sur 229 329 adresses |
| --- | --- | --- | --- | --- |
| A (`brute`) | 1 625 | 10 sur 10 essayées | aucun | aucune |
| B (`trigrammes`) | 11,9 | 288 (96,0 %) | 50,8 Mo en mémoire | 0,9 s |
| C (`postgres`) | 198,5 | 288 (96,0 %) | 42,2 Mo sur le disque de PostgreSQL | 4,2 s |

Fichiers : `bench/resultats/2026-11-12T11-19-56-exactitude.csv` (une saisie, saisies justes, taille de l'index) et `bench/resultats/2026-11-12T12-56-58-adresses-index.csv` (construction : 46 ms, 218 ms et 864 ms pour `trigrammes` à 10 000, 50 000 et 229 329 adresses ; 675 ms, 1 391 ms et 4 188 ms pour `postgres`).

Le coût d'une saisie mesuré par le harness, sur d'autres saisies (les premiers colis du jeu) : `bench/resultats/2026-11-12T11-18-08-adresses.csv` pour la force brute, 1,5 s pour une saisie, 1,7 s par saisie pour deux, 3,3 s pour trois ; `bench/resultats/2026-11-12T12-56-25-adresses.csv` pour les index, 41,8, 42,3 et 39,1 ms par saisie pour `trigrammes` à 10, 20 et 50 saisies, 464, 470 et 100 ms pour `postgres`. Les deux protocoles ne donnent pas le même temps par saisie (12 contre 40 ms pour `trigrammes`) : nous retenons l'ordre de grandeur et l'écart entre les options, qui est le même dans les deux, la force brute étant 40 à 140 fois plus lente que `trigrammes`. Le relevé de `postgres` à 50 saisies, plus rapide au total qu'à 20, n'est pas expliqué.

Les deux index retrouvent les mêmes saisies et ratent les mêmes : les neuf sans numéro (0/9), deux fautes de frappe sur 24, une commune sur 4. La force brute n'a été essayée que sur dix saisies, exactes ou presque, et rate le ticket T-0488.

Sur la Gironde (`bench/resultats/2026-11-12T13-01-31-exactitude.csv`, 100 saisies, 2 pour la force brute) : 9 772 ms par saisie pour la force brute, 139,7 ms pour `trigrammes` (96 justes sur 100, index de 164,2 Mo, construction 13,6 s), 1 432,9 ms pour `postgres` (96 sur 100, index de 137,6 Mo, construction 66,9 s).

Pas de courbe : la taille du harness est ici un nombre de saisies, pas un volume.

## 4. Décision

Nous adoptons l'option B (`trigrammes`), total pondéré 36 contre 32 pour `postgres` et 31 pour le legacy (`adr/GRILLE-ADR-005.md`), parce qu'elle retrouve 288 saisies sur 300, dont celle du ticket que la force brute rate, et qu'à justesse égale avec `postgres` c'est le temps qui tranche : 0,14 s par saisie sur la Gironde contre 1,43 s.

## 5. Conséquences et limites

La décision coûte 164 Mo de mémoire dans le processus du site sur la Gironde, un index à reconstruire à chaque version du référentiel (13,6 s) et un code qui demande de connaître trois idées. Les 4 % de saisies ratées restent à traiter à la main : une saisie sans numéro est ambiguë par nature, aucun des deux index ne la retrouve.

Non mesuré : le PostgreSQL d'Efrei. L'option C a été mesurée dans PGlite, un PostgreSQL qui tourne dans Node sur notre poste ; le PostgreSQL 14 de la VM (pièce 03) peut répondre plus vite. C'est pourquoi `postgres` n'est pas retenu, ou pas encore : si une saisie y descend sous 0,1 s sur la Gironde, son total passe à 38 et il repasse devant, sans rien ajouter à la mémoire du site. La force brute, elle, n'est pas défendable : elle se trompe sur le ticket.

Domaine de validité : nous avons fait varier le référentiel (229 329 et 730 137 adresses), le nombre de saisies (1 à 50 au harness, 100 et 300 à l'exactitude) et la taille de l'index à construire (10 000 à 229 329). Nous n'avons fait varier ni le nombre de candidats (10), ni le jeu de saisies (`petite`). La règle de la fiche, multiplier par trois les mesures de la métropole, n'est pas une estimation haute sur notre poste : le temps d'une saisie de `trigrammes` est multiplié par 12 (11,9 à 139,7 ms), celui de `postgres` par 7, la taille de l'index par 3,2 ; la grille est donc notée sur la mesure de la Gironde. À ce temps, une nuit ordinaire de 600 adresses prend 84 s et celle du 24 septembre, 6 412 adresses, 15 minutes, contre 1 h 38 et 17 h 24 pour la force brute. La note 4 de temps tient jusqu'à 1 s par saisie et celle de mémoire jusqu'à 500 Mo, soit environ trois fois la Gironde si la taille de l'index reste proportionnelle au référentiel ; au-delà, la décision se rejoue.

## 6. En trois phrases pour la directrice des opérations

Quand le support tape une adresse avec une abréviation ou une faute, comme "ste catherine" pour la rue Sainte-Catherine, la recherche actuelle relit toutes les adresses du département une par une, met près de dix secondes et propose parfois une mauvaise rue. Nous retenons une méthode qui prépare à l'avance un répertoire des petits morceaux de mots de chaque adresse, ce qui lui permet de ne relire que les adresses qui ressemblent à ce qui a été tapé : elle répond en moins d'une seconde et retrouve la bonne adresse 96 fois sur 100. Les adresses tapées sans numéro de rue restent à vérifier à la main, et il faudra refaire ce répertoire à chaque nouvelle version de la liste officielle des adresses.
