# ADR-005 - Retrouver l'adresse officielle d'une saisie fautive avec un index de trigrammes

## 1. Contexte

Ticket T-0488 : le support tape "ste catherine 33000 bordeaux" et ne trouve pas la rue Sainte-Catherine. Rejoué avec `npm run exactitude -- --saisie "ste catherine 33000 bordeaux"` : la force brute du legacy rend "110 rue heron 33000 bordeaux" en 1,6 s, l'index de trigrammes et PostgreSQL rendent "2 rue sainte catherine 33000 bordeaux" en 33 ms et 295 ms. L'étape 1 du batch de nuit compare chaque saisie à toutes les adresses du référentiel avec la distance de Levenshtein (229 329 adresses pour la métropole, 730 137 pour la Gironde). La contrainte est le temps d'une saisie sur la Gironde, puis l'exactitude ; la construction de l'index se paie une fois par version du référentiel.

## 2. Options comparées

- Option A (legacy, `brute`) : Levenshtein contre toutes les adresses du référentiel, à chaque saisie (`legacy/src/adresses.ts`, lignes 43 à 45). Complexité annoncée : O(N x L²) par saisie, N adresses de longueur L.
- Option B (`trigrammes`) : un index en mémoire, trigramme par trigramme, qui compte pour chaque adresse les trigrammes partagés avec la saisie ; Levenshtein ne départage que les dix meilleures. Complexité annoncée : O(N x L) à la construction, puis par saisie la somme des longueurs des listes des trigrammes de la saisie (au pire N par trigramme) plus 10 x L².
- Option C (`postgres`) : le même principe confié à PostgreSQL, extension pg_trgm et index GiST (PGlite en atelier). Complexité annoncée : O(N x L) à la construction, recherche en pratique très inférieure à N, sans borne garantie.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : jeu `petite`, référentiel de la métropole (229 329 adresses) ; nombre de saisies : 1 à 3 pour la force brute, 10 à 50 pour les index, 300 pour l'exactitude ; référentiel de la Gironde (730 137 adresses) sur 100 saisies.
- Répétitions et échauffement : 3 répétitions ; 0 tour d'échauffement pour la force brute, 1 pour les index.
- Statistique retenue : la médiane.
- Ce qui est mesuré : la durée d'une saisie, l'exactitude par sorte de saisie, la taille de l'index (`index_mo`, jamais `memoire_ko`) et la construction. CSV : `bench/resultats/2026-11-12T11-22-02-adresses.csv` (brute), `bench/resultats/2026-11-12T13-00-23-adresses.csv` (index), `bench/resultats/2026-11-12T11-26-52-exactitude.csv` (exactitude), `bench/resultats/2026-11-12T13-01-10-adresses-index.csv` (construction).

| Option | Une saisie | Saisies justes sur 300 | Taille de l'index | Construction (229 329 adresses) |
| --- | --- | --- | --- | --- |
| A (`brute`) | 2 080 ms | 10 sur 10 (dix saisies seulement) | aucun | aucune |
| B (`trigrammes`) | 11,2 ms | 288 sur 300 (96,0 %) | 50,8 Mo en mémoire | 1,4 s |
| C (`postgres`) | 133 ms | 288 sur 300 (96,0 %) | 42,2 Mo sur le disque de PostgreSQL | 6,4 s |

Courbe : `bench/resultats/2026-11-12T13-00-23-adresses.svg`. Les durées d'une saisie sont constantes entre 10, 20 et 50 saisies : le coût est proportionnel au nombre de saisies. Les 12 échecs de B et C sont les mêmes : 9 saisies sans numéro (0 sur 9), 2 fautes sur 24, 1 commune sur 4.

Mesure directe sur la Gironde (`bench/resultats/2026-11-12T14-31-19-exactitude.csv`, 100 saisies, 2 pour la force brute) : A 7 036 ms par saisie ; B 42,1 ms, construction 5,5 s, index 163,1 Mo ; C 438,2 ms, construction 22,7 s, index 137,4 Mo ; B et C 96 sur 100.

## 4. Décision

Nous adoptons l'option B (`trigrammes`), total pondéré 39 contre 35 pour `postgres` et 31 pour le legacy (`adr/GRILLE-ADR-005.md`), parce qu'une saisie sur la Gironde y prend 42 ms contre 7 s pour la force brute et 438 ms pour PostgreSQL, à exactitude égale (96,0 %), et que le temps et la robustesse pèsent 3 chacun.

## 5. Conséquences et limites

L'index de 163 Mo (Gironde) vit dans le processus du batch et se reconstruit en 5,5 s à chaque lancement ou nouvelle version du référentiel ; le code demande de connaître les trigrammes et la remise à zéro des compteurs entre deux saisies. `postgres` n'ajoute rien au processus, mais demande une extension à activer, une table et un index à entretenir ; l'autre option n'est donc pas indéfendable : si la mémoire du site devenait le critère principal, elle repasserait devant. Les 4 % ratés (saisies sans numéro, quelques fautes) ne sont retrouvés par aucune méthode : ils demandent un traitement à part. Non mesuré : le PostgreSQL 14 d'Efrei (pièce 03), seul PGlite a été essayé, et le comportement de pg_trgm y peut différer ; la mémoire du processus entier ; la force brute n'a été essayée que sur 10 saisies (2 sur la Gironde).

Estimation pour la nuit : une nuit ordinaire de 600 adresses coûte 70 min à la force brute (7 s x 600), 25 s à B et 4 min à C ; la nuit du 24 septembre, 6 412 adresses, 12 h 30 à la force brute, 4 min 30 à B et 47 min à C. L'estimation "trois fois la métropole" (35 ms et 400 ms par saisie, 152 Mo) est une estimation haute pour les deux index ; la mesure directe est un peu au-dessus pour le temps (42 ms, 438 ms).

Domaine de validité : nous avons fait varier le nombre de saisies (1 à 300) et la taille du référentiel (10 000, 50 000, 229 329 pour la construction ; 229 329 et 730 137 pour une saisie). Nous n'avons pas fait varier le type de saisie hors des sept sortes du jeu ni le nombre de candidats (10). L'index de trigrammes passerait 500 Mo, la note 4 de mémoire, vers 2,2 millions d'adresses (163 Mo pour 730 137, soit 0,22 Mo par millier), trois fois la Gironde.

## 6. En trois phrases pour la directrice des opérations

Quand un client tape mal son adresse, le programme de nuit la compare une par une à toutes les adresses officielles du département, ce qui prend plusieurs secondes par colis et l'a conduit à répondre une rue sans rapport pour « ste catherine ». Nous retenons une méthode qui repère d'abord les adresses qui partagent le plus de morceaux de lettres avec ce que le client a tapé, puis ne compare que les dix plus proches : elle retrouve la bonne rue en une fraction de seconde, et les 6 412 colis de la nuit du 24 septembre passeraient en quelques minutes au lieu d'une douzaine d'heures. Elle retrouve 96 adresses sur 100, jamais celles où le client a oublié le numéro, et l'autre méthode, qui laisse le travail au logiciel de stockage du site, reste défendable si le serveur venait à manquer de place.
