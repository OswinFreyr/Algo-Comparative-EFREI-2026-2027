# ADR-005 - Rapprocher une adresse mal saisie avec un index de trigrammes

## 1. Contexte

Le support tape « ste catherine 33000 bordeaux » et ne trouve pas la rue Sainte-Catherine (ticket T-0488). Le référentiel de la métropole compte 229 329 adresses, celui de la Gironde 730 137, environ trois fois plus. Le legacy de 2019 compare chaque saisie à toutes les adresses. Sur cette saisie, il répond « 110 rue heron » en 1 702 ms ; les deux index répondent « 2 rue sainte catherine », en 37 ms et 341 ms. La contrainte est le temps d'une saisie, sans se tromper de rue.

## 2. Options comparées

- Option A (legacy, `brute`) : distance de Levenshtein entre la saisie et chaque adresse du référentiel, à chaque fois. Rien à construire. Complexité annoncée : O(n) par saisie, n adresses.
- Option B (`trigrammes`) : un index inversé des groupes de trois lettres, puis Levenshtein sur les dix adresses les plus semblables. Complexité annoncée : O(1) pour l'essentiel de la recherche, la construction en O(n).
- Option C (`postgres`) : le même principe, confié à l'extension pg_trgm et à un index GiST, dans PGlite pour la mesure. La base d'Efrei est un PostgreSQL 14 (pièce 03). Complexité annoncée : celle de l'index de la base.

## 3. Mesures

- Machine : Apple M1 Pro (8 coeurs), 16 Go, Darwin 24.6.0, Node v22.22.3.
- Jeu : `data/jeux/petite`, référentiel `adresses-metropole.csv` (229 329 adresses). La Gironde n'a pas été mesurée : les temps et la taille de l'index de trigrammes sont multipliés par trois, estimation haute.
- Répétitions et échauffement : force brute, 3 répétitions sans échauffement, 1, 2 et 3 saisies ; index, 3 répétitions et 1 tour d'échauffement, 10, 20 et 50 saisies ; construction, 3 répétitions, 10 000, 50 000 et 229 329 adresses.
- Statistique retenue : la médiane pour le harness, la moyenne d'une passe pour l'exactitude.
- Mesuré : le temps d'une saisie, les saisies justes, la taille de l'index (colonne `index_mo`, pas `memoire_ko`) et la construction. Les trois variantes ne rendent pas toujours la même adresse : la somme de contrôle du harness ne porte que sur le nombre de saisies.

| Option | Une saisie | Justes | Index | Construction |
| --- | --- | --- | --- | --- |
| A | 2 209 ms | 10/10, sur 10 saisies | rien | rien |
| B | 18,0 ms | 288/300 | 50,8 Mo | 1 314 ms |
| C | 161 ms | 288/300 | 42,2 Mo, hors du site | 8 053 ms |

Les deux index ratent les mêmes saisies : 22/24 fautes, 0/9 sans numéro, 3/4 communes. Estimation Gironde, fois trois : 6,6 s, 54 ms et 484 ms ; l'index de trigrammes passerait à environ 152 Mo. La construction du tableau est la médiane du harness à 229 329 adresses ; l'exactitude, en une passe, mesure 2,0 s et 10,7 s.

Mesures : `bench/resultats/2026-11-12T11-15-39-exactitude.csv`, `bench/resultats/2026-11-12T11-13-46-adresses.csv`, `bench/resultats/2026-11-12T11-16-22-adresses-index.csv`.

## 4. Décision

Nous adoptons l'option B (`trigrammes`), total pondéré 40 contre 36 pour PostgreSQL et 32 pour la force brute (`adr/GRILLE-ADR-005.md`) : les deux index retrouvent la même part des saisies, 288 sur 300, et le temps, qui pèse 3, les sépare, 54 ms contre 484 ms sur l'estimation Gironde.

## 5. Conséquences et limites

L'index de trigrammes occupe 50,8 Mo dans le processus du site, à reconstruire à chaque version du référentiel (1,3 s sur la métropole). Celui de PostgreSQL, 42,2 Mo, vit sur le serveur de la base : il n'ajoute rien au processus du site, même si PGlite tourne dans Node pour la mesure. Nous n'avons pas mesuré le PostgreSQL d'Efrei. PostgreSQL reste défendable, même exactitude et aucune mémoire en plus sur le site, mais une saisie y est environ neuf fois plus lente, et il faut activer une extension, une table et un index. La décision n'est pas fragile aux poids choisis : les trois options ne s'égalent, à 38, que si le temps tombe à 1 et la mémoire monte à 3.

Domaine de validité : nous avons fait varier le nombre de saisies (1 à 50) et la taille de l'index (10 000, 50 000, 229 329). Nous n'avons pas mesuré les 730 137 adresses de la Gironde : le facteur trois est une estimation haute pour les deux index. À ce facteur, une nuit ordinaire de 600 adresses prendrait 32 s avec les trigrammes, 4,8 min avec PostgreSQL et 66 min avec la force brute ; la nuit du 24 septembre, 6 412 adresses, 5,8 min, 52 min et 11,8 h. La décision tient sur la métropole et sur cette estimation. Elle serait à revoir si le fichier dépassait largement trois fois la métropole, ou si le PostgreSQL d'Efrei se montrait bien plus rapide que PGlite.

## 6. En trois phrases pour la directrice des opérations

Quand quelqu'un écrit mal une adresse, le programme d'aujourd'hui la compare à toutes les adresses connues : cela prend plusieurs secondes, et pour la rue Sainte-Catherine il propose une autre rue. Nous préparons une fois une liste des groupes de trois lettres : la bonne adresse sort alors en une petite fraction de seconde, et elle est la bonne 96 fois sur 100. La recherche dans la base déjà installée est juste aussi souvent, mais elle est environ neuf fois plus lente et demande un entretien à chaque nouvelle version du fichier d'adresses.
