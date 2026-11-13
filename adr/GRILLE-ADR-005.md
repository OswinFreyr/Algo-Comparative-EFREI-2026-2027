# Grille comparative - ADR-005 : rapprocher une adresse mal saisie du référentiel

Ticket T-0488 : le support tape "ste catherine 33000 bordeaux" et ne trouve pas la rue Sainte-Catherine. Deux contraintes : rendre la bonne adresse d'abord, la rendre vite ensuite, sur le référentiel de la Gironde (730 137 adresses).

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée d'une saisie sur le référentiel de la Gironde, trois fois plus d'adresses que la métropole | 3 |
| Mémoire | mémoire ajoutée au processus du site par la méthode, à l'échelle de la Gironde | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | `npm test`, puis part des saisies retrouvées sur trois cents, par sorte de saisie | 3 |
| Coût de mise en oeuvre | lignes à écrire, dépendances ajoutées en production, données à préparer et à entretenir | 2 |

Les poids sont ceux imposés par le ticket ADR-005. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`brute`). Option B : `trigrammes`, l'index en mémoire. Option C : `postgres`, l'extension `pg_trgm` et son index.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 5 | 4 | 2 | 5 | 31 |
| B (trigrammes) | 5 | 4 | 2 | 4 | 3 | 39 |
| C (postgres) | 4 | 5 | 2 | 4 | 2 | 35 |

Total pondéré = 3 x Temps + 1 x Mémoire + 1 x Lisibilité + 3 x Robustesse + 2 x Coût.

Les barèmes, fixés avant de mesurer (ceux de la fiche atelier 8) :

- Temps (une saisie sur la Gironde) : 5 sous 0,1 s, 4 sous 1 s, 3 sous 5 s, 2 sous 10 s, 1 au-delà.
- Mémoire (ajoutée au processus du site) : 5 si rien, 4 sous 500 Mo, 3 sous 2 Go, 2 sous 8 Go, 1 au-delà.
- Lisibilité : on part de 5, un point de moins par idée à connaître pour dire ce que fait la fonction, ce qui se passe sur une saisie sans numéro et où changer le nombre de candidats.
- Robustesse : 5 si toutes les saisies sont retrouvées ; 4 si au moins 95 % le sont et si les échecs s'expliquent ; 3 entre 80 et 95 % ; 2 si la méthode se trompe sur le ticket T-0488 ou n'a été mesurée que sur dix saisies ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes sans donnée à préparer ; 3 pour quelques lignes et une donnée à reconstruire à chaque version du référentiel ; 2 pour une structure nouvelle à tenir dans la base ; 1 si une dépendance s'ajoute en production.

Mesures du 13 novembre, poste au repos : `bench/resultats/2026-11-13T08-21-44-exactitude.csv` (Gironde, 100 saisies, 2 pour la force brute), `bench/resultats/2026-11-13T08-20-39-exactitude.csv` (métropole, 300 saisies, 10 pour la force brute), `bench/resultats/2026-11-13T08-18-37-adresses.csv` et `bench/resultats/2026-11-13T08-19-17-adresses.csv` (coût d'une saisie), `bench/resultats/2026-11-13T08-19-48-adresses-index.csv` (construction). La série du 12 novembre après-midi, prise sur un poste chargé, est écartée.

Justification rapide des notes :

- Temps : mesuré sur la Gironde plutôt qu'estimé par trois. A : 5,3 s par saisie, sous 10 s, note 2 (l'estimation, 1,54 s x 3 = 4,6 s, aurait donné 3). B : 34 ms, sous 0,1 s, note 5 (l'estimation donne 34 ms aussi). C : 324 ms dans PGlite, sous 1 s, note 4 (l'estimation, 86 ms x 3 = 259 ms, donne la même note).
- Mémoire : A 5, rien n'est ajouté, le référentiel est déjà chargé. B 4 : l'index pèse 50,8 Mo sur la métropole et 164,2 Mo mesurés sur la Gironde, sous 500 Mo. C 5 : l'index (137,7 Mo sur la Gironde) est rangé sur le serveur de la base, il n'ajoute rien au processus du site.
- Lisibilité : A 4, une idée, la distance d'édition. B 2, trois idées : la règle des trigrammes, l'index inversé et ses compteurs remis à zéro, la distance d'édition qui départage les dix candidats. C 2, trois idées : la règle des trigrammes, l'extension SQL et son opérateur de distance, la distance d'édition qui départage.
- Robustesse : `npm test` passe pour les trois tests des adresses. A 2 : elle rend "110 rue heron" sur le ticket T-0488 et n'a été essayée que sur dix saisies, toutes exactes ou presque ; son 10/10 ne dit rien de sa robustesse. B 4 et C 4 : 288 saisies justes sur 300 (96,0 %), les mêmes pour les deux ; les douze échecs s'expliquent, neuf saisies sans numéro (0/9, ambiguës par nature), deux fautes de frappe sur 24 et une commune sur 4.
- Coût : A 5, rien ne change. B 3 : la variante est écrite, quelques lignes pour la brancher, et un index à reconstruire à chaque version du référentiel (0,8 s sur la métropole, 2,9 s sur la Gironde). C 2 : une extension à activer, une table et un index à entretenir dans la base (construction 4,0 s sur la métropole, 14,9 s sur la Gironde dans PGlite) ; PostgreSQL est déjà sur la VM d'Efrei, aucune dépendance ne s'ajoute.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 1, robustesse 3, coût 2) : A 35, B 49, C 43. La décision ne change pas, B reste premier.

La bascule est loin des poids choisis. Avec un poids du temps w, B vaut 5w + 24, C 4w + 23 et A 2w + 25 : B est devant quel que soit w. B et C ne diffèrent que sur le temps (+ 1 pour B), le coût (+ 1 pour B) et la mémoire (+ 1 pour C) : C ne passe devant que si la mémoire pèse plus que le temps et le coût réunis, par exemple temps 1, mémoire 4, lisibilité 1, robustesse 2, coût 2, où C l'emporte 38 contre 37. Reste ce que nous n'avons pas mesuré, le PostgreSQL d'Efrei : même avec la note 5 pour son temps, C monte à 38 et reste derrière B, 39. La décision est solide.
