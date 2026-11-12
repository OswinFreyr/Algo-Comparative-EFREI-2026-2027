# Grille comparative - ADR-005 : retrouver l'adresse officielle d'une adresse mal saisie

Ticket T-0488 : le support tape "ste catherine 33000 bordeaux" et le legacy rend "110 rue heron 33000 bordeaux", pas la rue Sainte-Catherine. Les poids sont ceux du ticket (fiche atelier 8) : temps 3, mémoire 1, lisibilité 1, robustesse 3, coût 2.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | ce que la production paiera : durée d'une saisie sur la Gironde (730 137 adresses, trois fois la métropole mesurée), croissance quand le volume grandit | 3 |
| Mémoire | mémoire ajoutée au processus du site | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | exactitude par sorte de saisie sur trois cents saisies, et le cas du ticket | 3 |
| Coût de mise en oeuvre | lignes à écrire, dépendances à ajouter en production, données à préparer et à entretenir | 2 |

La mémoire ne pèse que 1 : le plus gros index (163 Mo pour la Gironde) reste loin de ce que la VM peut absorber. Temps et robustesse pèsent 3 chacun : le ticket est une adresse fausse, rendue après plusieurs secondes.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`brute`), Levenshtein contre toutes les adresses. Option B : `trigrammes`, l'index en mémoire. Option C : `postgres`, pg_trgm et un index GiST.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 5 | 4 | 2 | 5 | 31 |
| B (trigrammes) | 5 | 4 | 2 | 4 | 3 | 39 |
| C (postgres) | 4 | 5 | 2 | 4 | 2 | 35 |

Total pondéré = 3 x Temps + 1 x Mémoire + 1 x Lisibilité + 3 x Robustesse + 2 x Coût.

Les barèmes (ceux de la fiche atelier 8, écrits avant de noter) :

- Temps, pour une saisie sur la Gironde : 5 sous 0,1 s, 4 sous 1 s, 3 sous 5 s, 2 sous 10 s, 1 au-delà.
- Mémoire, celle ajoutée au processus du site : 5 si rien, 4 sous 500 Mo, 3 sous 2 Go, 2 sous 8 Go, 1 au-delà. La taille de l'index se lit dans `index_mo` de `npm run exactitude`, jamais dans `memoire_ko` du harness.
- Lisibilité : on part de 5, un point de moins par idée à connaître (la règle des trigrammes, un index inversé, une extension SQL) pour répondre à trois questions : que fait la fonction, que se passe-t-il sur une saisie sans numéro, où changer le nombre de candidats.
- Robustesse : 5 si toutes les saisies sont retrouvées ; 4 si au moins 95 % le sont et si les échecs s'expliquent ; 3 entre 80 et 95 % ; 2 si la méthode se trompe sur le ticket T-0488 ou n'est mesurée que sur dix saisies ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes sans donnée à préparer ; 3 pour quelques lignes et une donnée à reconstruire à chaque version du référentiel (un index) ; 2 pour une structure nouvelle à tenir dans la base (extension à activer, table et index à entretenir) ; 1 si une dépendance s'ajoute au projet en production. PostgreSQL est déjà sur la VM d'Efrei (pièce 03) ; PGlite ne sert qu'à mesurer.

Mesures (médiane de 3 répétitions pour le harness) : `bench/resultats/2026-11-12T11-22-02-adresses.csv` (brute, 1 à 3 saisies), `bench/resultats/2026-11-12T13-00-23-adresses.csv` (trigrammes et postgres, 10 à 50 saisies, 1 tour d'échauffement), `bench/resultats/2026-11-12T11-26-52-exactitude.csv` (300 saisies, métropole), `bench/resultats/2026-11-12T14-31-19-exactitude.csv` (100 saisies, Gironde), `bench/resultats/2026-11-12T13-01-10-adresses-index.csv` (construction).

Justification des notes :

- Temps : A 7,04 s par saisie sur la Gironde (mesure directe sur 2 saisies, 2,08 s sur la métropole) : sous 10 s, note 2. B 42,1 ms : sous 0,1 s, note 5. C 438 ms : sous 1 s, note 4. L'estimation "trois fois la métropole" donnait 6,2 s, 35 ms et 400 ms : les mêmes notes.
- Mémoire : A 5, aucun index, le référentiel est déjà chargé. B 163,1 Mo pour la Gironde (50,8 Mo x 3,2), sous 500 Mo : note 4. C 5 : l'index de 137,4 Mo est rangé sur le serveur de la base, il n'ajoute rien au processus du site.
- Lisibilité : A 4, une idée : la distance d'édition. B 2, trois idées : la distance d'édition (elle départage les dix meilleures), la règle des trigrammes, l'index inversé avec ses compteurs à remettre à zéro ; le nombre de candidats se change à une seule constante (`CANDIDATS`). C 2, trois idées : la distance d'édition, la règle des trigrammes de pg_trgm, l'extension et son index GiST ; le nombre de candidats est le `LIMIT` de la requête. Sur une saisie sans numéro, aucun des trois ne le devine : A rend la plus proche lettre à lettre, B et C échouent sur les 9 saisies sans numéro de la mesure (0 sur 9).
- Robustesse : `npm test` passe pour les trois options (les deux échecs restants, Dijkstra avec tas et listes d'adjacence, attendent les ateliers 9 et 10). B et C retrouvent 288 saisies sur 300 (96,0 %), les mêmes : les 9 saisies sans numéro (0 sur 9), 2 fautes sur 24 et 1 commune sur 4 ; les échecs s'expliquent par l'ambiguïté (numéro absent, rue fréquente sans commune) : note 4. A n'est mesurée que sur dix saisies, et rate le ticket T-0488 (110 rue heron) : note 2.
- Coût : A 5, rien ne change. B 3, un index à reconstruire à chaque version du référentiel (1,4 s pour la métropole, 5,5 s pour la Gironde). C 2, une extension à activer, une table et un index GiST à entretenir (6,4 s à construire pour la métropole, 22,7 s pour la Gironde) ; pas de dépendance en production, PostgreSQL est déjà là.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (mémoire 1, robustesse 3, coût 2) : A 35, B 49, C 43. La décision ne change pas, B reste premier.

La bascule : B et C ne diffèrent que sur le temps (+1 pour B), la mémoire (+1 pour C) et le coût (+1 pour B). C ne passe devant que si la mémoire pèse plus que le temps et le coût réunis : avec temps 1, mémoire 4, lisibilité 1, robustesse 2, coût 2, C gagne 38 contre 37. Il faut donc faire passer la mémoire de 1 à 4 ; la décision est solide pour les poids du ticket, et ne change que si la mémoire du site devient le critère principal.
