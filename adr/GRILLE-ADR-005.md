# Grille comparative - ADR-005 : rapprocher une adresse mal saisie

Ticket : le support tape « ste catherine 33000 bordeaux » et ne trouve pas la rue Sainte-Catherine (T-0488). Le temps se note pour une saisie sur la Gironde, trois fois la métropole mesurée. C'est une estimation haute.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | une saisie sur la Gironde : durée mesurée sur la métropole, multipliée par trois | 3 |
| Mémoire | mémoire ajoutée au processus du site, pas celle du serveur de la base | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | part des saisies retrouvées, et le ticket T-0488 lui-même | 3 |
| Coût de mise en oeuvre | lignes à écrire, index à reconstruire, extension à tenir dans la base | 2 |

Les poids sont ceux de la fiche. La robustesse pèse autant que le temps : une méthode rapide qui se trompe livre au mauvais endroit. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`brute`). Option B : `trigrammes`. Option C : `postgres`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (brute) | 2 | 5 | 5 | 2 | 5 | 32 |
| B (trigrammes) | 5 | 4 | 3 | 4 | 3 | 40 |
| C (postgres) | 4 | 5 | 3 | 4 | 2 | 36 |

Total pondéré = 3 x Temps + 1 x Mémoire + 1 x Lisibilité + 3 x Robustesse + 2 x Coût.

Barème du temps, pour une saisie sur la Gironde : 5 sous 0,1 s, 4 sous 1 s, 3 sous 5 s, 2 sous 10 s, 1 au-delà. Barème de la mémoire ajoutée au processus du site : 5 si rien, 4 sous 500 Mo, 3 sous 2 Go, 2 sous 8 Go, 1 au-delà.

Mesures : métropole, 229 329 adresses. Une saisie (`bench/resultats/2026-11-12T11-15-39-exactitude.csv`) : brute 2 209 ms (10 saisies), trigrammes 18,0 ms et postgres 161 ms (300 saisies). Le harness confirme l'ordre (`bench/resultats/2026-11-12T11-12-39-adresses.csv`, `bench/resultats/2026-11-12T11-13-46-adresses.csv`) : 1 969 ms pour une saisie brute, 14 ms et 157 ms par saisie à 50 requêtes. Gironde estimée : fois trois.

Justification des notes :

- Temps : 6,6 s pour la force brute (2 209 ms × 3), note 2. 54 ms pour les trigrammes (18,0 × 3), note 5. 484 ms pour PostgreSQL (161 × 3), note 4.
- Mémoire : la force brute n'ajoute aucune structure, note 5. L'index de trigrammes fait 50,8 Mo sur la métropole, environ 152 Mo sur la Gironde, sous 500 Mo, note 4. L'index PostgreSQL fait 42,2 Mo sur le disque de la base : il n'ajoute rien au processus du site, note 5.
- Lisibilité, on part de 5 et une idée à connaître coûte un point : brute 5, la comparaison à tout le référentiel se lit telle quelle ; trigrammes 3, deux idées, la règle des trigrammes et l'index inversé ; postgres 3, deux idées, la règle des trigrammes et une extension SQL.
- Robustesse : les deux index retrouvent 288 saisies sur 300, soit 96 %, et ratent les mêmes, dont les 9 saisies sans numéro. Note 4. La force brute n'a été mesurée que sur 10 saisies, et sur le ticket elle rend « 110 rue heron » au lieu de la rue Sainte-Catherine. Note 2.
- Coût : brute 5, rien ne change. Trigrammes 3, quelques lignes et un index à reconstruire à chaque version du référentiel (2,0 s sur la métropole, 1,3 s de médiane au harness). Postgres 2, une extension à activer, une table et un index à entretenir. PostgreSQL est déjà sur la VM ; PGlite ne sert qu'à mesurer.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, les autres poids inchangés, les totaux deviennent A = 36, B = 50 et C = 44 : la décision ne change pas, les trigrammes restent premiers, et l'écart avec PostgreSQL passe de 4 à 6.

Elle ne bascule pas près des poids choisis. Les deux index sont à égalité de robustesse ; les trigrammes gagnent sur le temps (54 ms contre 484 ms, estimation Gironde) et sur le coût. Les trois options n'arrivent à égalité, 38 partout, que si le poids du temps tombe à 1 et celui de la mémoire monte à 3.
