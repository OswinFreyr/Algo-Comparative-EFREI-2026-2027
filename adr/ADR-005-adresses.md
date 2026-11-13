# ADR-005 - Rapprocher une adresse mal saisie du référentiel avec la variante `trigrammes`

## 1. Contexte

Ticket T-0488 : le support tape "ste catherine 33000 bordeaux" et ne trouve pas la rue Sainte-Catherine. Le legacy compare chaque saisie à toutes les adresses du référentiel : 229 329 pour la métropole, 730 137 pour la Gironde. Une nuit ordinaire apporte 600 adresses à rapprocher, celle du 24 septembre 6 412 (pièces 04 et 06). La contrainte est double : rendre la bonne adresse d'abord, la rendre vite ensuite.

Ce que répond chaque méthode à la saisie du ticket (`npm run exactitude -- --saisie "ste catherine 33000 bordeaux"`) : la force brute rend "110 rue heron 33000 bordeaux" en 1 200 ms, l'index de trigrammes rend "2 rue sainte catherine 33000 bordeaux" en 33 ms, PostgreSQL rend la même adresse en 209 ms. Les deux index proposent les mêmes cinq premiers candidats.

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
| A (`brute`) | 1 543 | 10 sur 10 essayées | aucun | aucune |
| B (`trigrammes`) | 11,4 | 288 (96,0 %) | 50,8 Mo en mémoire | 0,8 s |
| C (`postgres`) | 86,4 | 288 (96,0 %) | 42,0 Mo sur le disque de PostgreSQL | 4,0 s |

Fichiers : `bench/resultats/2026-11-13T08-20-39-exactitude.csv` (une saisie, saisies justes, taille de l'index) et `bench/resultats/2026-11-13T08-19-48-adresses-index.csv` (construction : 43 ms, 206 ms et 825 ms pour `trigrammes` à 10 000, 50 000 et 229 329 adresses ; 635 ms, 1 264 ms et 4 032 ms pour `postgres`).

Le coût d'une saisie mesuré par le harness, sur d'autres saisies (les premiers colis du jeu), confirme ces temps : `bench/resultats/2026-11-13T08-18-37-adresses.csv` pour la force brute, 1,45 s pour une saisie, 1,65 s par saisie pour deux, 1,61 s pour trois ; `bench/resultats/2026-11-13T08-19-17-adresses.csv` pour les index, 11,7, 12,2 et 12,2 ms par saisie pour `trigrammes` à 10, 20 et 50 saisies, 99,7, 97,1 et 93,1 ms pour `postgres`. Le temps par saisie ne dépend pas du nombre de saisies ; la force brute est environ 130 fois plus lente que `trigrammes`, `postgres` 8 fois.

Ces mesures sont celles du 13 novembre, poste au repos. Une première série, le 12 novembre après-midi sur un poste chargé (`bench/resultats/2026-11-12T12-56-25-adresses.csv`, `bench/resultats/2026-11-12T13-01-31-exactitude.csv`), donnait des temps trois à quatre fois plus longs et un relevé incohérent pour `postgres` : nous l'écartons et la gardons comme trace. L'exactitude et la taille des index y sont identiques.

Les deux index retrouvent les mêmes saisies et ratent les mêmes : les neuf sans numéro (0/9), deux fautes de frappe sur 24, une commune sur 4. La force brute n'a été essayée que sur dix saisies, exactes ou presque, et rate le ticket T-0488.

Sur la Gironde (`bench/resultats/2026-11-13T08-21-44-exactitude.csv`, 100 saisies, 2 pour la force brute) : 5 327 ms par saisie pour la force brute, 33,9 ms pour `trigrammes` (96 justes sur 100, index de 164,2 Mo, construction 2,9 s), 323,6 ms pour `postgres` (96 sur 100, index de 137,7 Mo, construction 14,9 s).

Pas de courbe : la taille du harness est ici un nombre de saisies, pas un volume.

## 4. Décision

Nous adoptons l'option B (`trigrammes`), total pondéré 39 contre 35 pour `postgres` et 31 pour le legacy (`adr/GRILLE-ADR-005.md`), parce qu'elle retrouve 288 saisies sur 300, dont celle du ticket que la force brute rate, et qu'à justesse égale avec `postgres` c'est le temps qui tranche : 34 ms par saisie sur la Gironde contre 324 ms.

## 5. Conséquences et limites

La décision coûte 164 Mo de mémoire dans le processus du site sur la Gironde, un index à reconstruire à chaque version du référentiel (2,9 s) et un code qui demande de connaître trois idées. Les 4 % de saisies ratées restent à traiter à la main : une saisie sans numéro est ambiguë par nature, aucun des deux index ne la retrouve.

Non mesuré : le PostgreSQL d'Efrei. L'option C a été mesurée dans PGlite, un PostgreSQL qui tourne dans Node sur notre poste ; le PostgreSQL 14 de la VM (pièce 03) peut répondre plus vite. `postgres` reste défendable : même justesse, rien d'ajouté à la mémoire du site. Mais même noté 5 sur le temps, sous 0,1 s par saisie sur la Gironde, son total monte à 38 et reste derrière les 39 de `trigrammes`, à cause de l'extension, de la table et de l'index à entretenir dans la base ; il ne passe devant que si la mémoire du site pèse plus que le temps et le coût réunis. La force brute, elle, n'est pas défendable : elle se trompe sur le ticket.

Domaine de validité : nous avons fait varier le référentiel (229 329 et 730 137 adresses), le nombre de saisies (1 à 50 au harness, 100 et 300 à l'exactitude) et la taille de l'index à construire (10 000 à 229 329). Nous n'avons fait varier ni le nombre de candidats (10), ni le jeu de saisies (`petite`). La règle de la fiche, multiplier par trois les mesures de la métropole, tient pour `trigrammes` (11,4 à 33,9 ms, un rapport de 3,0) mais n'est pas une estimation haute pour le reste : 3,7 pour `postgres`, 3,5 pour la force brute, 3,2 pour la taille de l'index ; la grille est donc notée sur la mesure de la Gironde, ce qui ne change que la note de la force brute. À ce temps, une nuit ordinaire de 600 adresses prend 20 s et celle du 24 septembre, 6 412 adresses, 3 min 40, contre 53 min et 9 h 30 pour la force brute. La note 5 de temps tient jusqu'à 0,1 s par saisie et la note 4 de mémoire jusqu'à 500 Mo, soit dans les deux cas environ trois fois la Gironde, 2,2 millions d'adresses, si le temps et la taille de l'index restent proportionnels au référentiel ; au-delà, la décision se rejoue.

## 6. En trois phrases pour la directrice des opérations

Quand le support tape une adresse avec une abréviation ou une faute, comme "ste catherine" pour la rue Sainte-Catherine, la recherche actuelle relit toutes les adresses du département une par une, met plus de cinq secondes et propose parfois une mauvaise rue. Nous retenons une méthode qui prépare à l'avance un répertoire des petits morceaux de mots de chaque adresse, ce qui lui permet de ne relire que les adresses qui ressemblent à ce qui a été tapé : elle répond en une fraction de seconde et retrouve la bonne adresse 96 fois sur 100. Les adresses tapées sans numéro de rue restent à vérifier à la main, et il faudra refaire ce répertoire à chaque nouvelle version de la liste officielle des adresses.
