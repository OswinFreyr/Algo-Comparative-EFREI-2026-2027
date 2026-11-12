# Grille comparative - ADR-002 : retrouver un colis par son numéro de suivi

Ticket : la page "Où est mon colis" cherche le dernier scan d'un numéro parmi les 13 millions de scans gardés six mois en base (70 000 de plus par jour). Elle est appelée 40 000 fois par jour : la contrainte est le temps de réponse d'une requête, pas le temps de construction.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | temps de réponse d'une requête projetée sur les six mois de la base (13 millions de scans) : médiane mesurée à 996 844 scans divisée par 100, multipliée par 13 pour le tableau et le Set, qui relisent tous les scans ; la Map ne grandit pas avec les scans | 5 |
| Mémoire | la structure construite au million de scans | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | comportement sur les doublons, les vides, les entrées invalides | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Aucun critère à 0. Le temps pèse le plus : la page est appelée 40 000 fois par jour et un client qui attend plus d'une demi-seconde recharge la page. La mémoire pèse 2 parce que la Map garde une entrée par colis. Lisibilité, robustesse et coût restent à 1 : le code est court dans les trois cas.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `set`. Option C : `map`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 5 | 5 | 4 | 5 | 34 |
| B (set) | 2 | 4 | 4 | 3 | 4 | 29 |
| C (map) | 5 | 4 | 4 | 3 | 4 | 44 |

Total pondéré = 5 x Temps + 2 x Mémoire + 1 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barèmes fixés avant de lire les mesures (ceux de la fiche atelier 5).
- Temps, par requête projetée sur les six mois de la base : 5 sous 1 ms, 4 sous 10 ms, 3 sous 100 ms, 2 sous 1 s, 1 au-delà.
- Mémoire, la structure construite au million de scans : 5 sous 1 Mo, 4 sous 10 Mo, 3 sous 50, 2 sous 200, 1 au-delà ; `memoire_ko` est un ordre de grandeur, et deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.
- Lisibilité : on part de 5 et on retire un point par idée qu'il faut connaître pour lire le code (la table de hachage sous le Set et la Map).
- Robustesse : 5 si tout numéro, connu, inconnu ou mal formé, reçoit la bonne réponse ou une erreur claire ; 4 si la structure n'a rien à tenir à jour mais ne vérifie pas le format du numéro ; 3 si la réponse dépend d'une structure à tenir à jour, qu'un scan manqué rend périmée sans erreur ; 2 si un cas courant donne un résultat faux en silence ; 1 si `npm test` échoue.
- Coût : 5 si rien ne change ; 4 pour quelques lignes et une structure fournie par le langage ; 3 pour une structure à écrire et à tester ; 2 pour une donnée à préparer à chaque lancement ; 1 pour une dépendance ajoutée.

Les durées viennent de `bench/resultats/2026-11-10T09-31-36-suivi.csv` (médiane de 5 répétitions, 100 requêtes par répétition, à 996 844 scans) et la mémoire de `bench/resultats/2026-11-10T09-36-32-suivi-construction.csv`.

Justification rapide des notes :

- Temps A : 4 522,6 ms pour 100 requêtes, soit 45 ms, multipliés par 13 : environ 590 ms par requête sur les six mois. Entre 100 ms et 1 s, note 2. Temps B : 2 959,6 ms pour 100 requêtes, soit 30 ms, multipliés par 13 : environ 385 ms. Le Set refuse tout de suite les numéros mal tapés, mais un numéro connu parcourt encore tous les scans : entre 100 ms et 1 s, note 2. Temps C : 0,125 ms pour 100 requêtes, soit environ 1 microseconde par requête, la même à 10 000, 100 000 et 996 844 scans : sous 1 ms, note 5.
- Mémoire au million de scans : A environ 1 Ko (note 5, sous 1 Mo) ; B 4,8 Mo (note 4) ; C 7,2 Mo (note 4). B et C sont à moins d'un facteur 2 l'un de l'autre. Ces relevés du tas sont un ordre de grandeur : C affiche 7 170 Ko à 100 000 comme à 996 844 scans, le ramasse-miettes brouille la lecture. Non mesuré à 13 millions de scans.
- Lisibilité : A 5, un filtre puis un maximum, aucune idée à connaître. B 4 et C 4, une idée chacun : la table de hachage sous le Set et la Map.
- Robustesse : les trois options rendent le même scan pour chaque numéro (sommes de contrôle identiques aux trois tailles : `6a26f0a8`, `93435caf`, `5a720532`), y compris pour les 20 % de numéros mal tapés (réponse vide), et `npm test` passe. A n'a rien à tenir à jour mais ne vérifie pas le format du numéro : note 4. B et C dépendent d'une structure à tenir à jour avec les 70 000 scans du jour : un scan manqué la rend périmée sans erreur, note 3.
- Coût : A 5, rien ne change. B 4, quelques lignes et un Set fourni par le langage. C 4, quelques lignes et une Map fournie par le langage (la fonction `construireMap`).

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1, qui sont déjà les poids de la page, les totaux ne changent pas : 34, 29, 44. On cherche donc le poids du temps à partir duquel la décision bascule, les autres poids gardés (mémoire 2, lisibilité 1, robustesse 1, coût 1) : C dépasse A dès que le poids du temps passe 1,67 environ (à 1 : A 26 contre C 24 ; à 2 : 28 contre 29). Le poids retenu, 5, est loin de la bascule : la décision tient. B reste derrière A à tous les poids (ses notes sont au plus égales à celles de A) et derrière C dès que le poids du temps dépasse 0.
