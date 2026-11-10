# Grille comparative - ADR-002 : retrouver un colis par son numéro de suivi

Ticket : la page "Où est mon colis" cherche le dernier scan d'un numéro parmi les 13 millions de scans gardés six mois en base (70 000 de plus par jour). Elle est appelée 40 000 fois par jour : la contrainte est le temps de réponse d'une requête, pas le temps de construction.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | ce que la production paiera : temps de réponse d'une requête à 13 millions de scans (coût mesuré à 996 844 scans, extrapolé en proportion du nombre de scans), croissance quand le volume grandit | 5 |
| Mémoire | pic mémoire de la structure de recherche à l'échelle de production | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | comportement sur les doublons, les vides, les entrées invalides | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Aucun critère à 0. Le temps pèse le plus : la page est appelée 40 000 fois par jour et un client qui attend plus d'une demi-seconde recharge la page. La mémoire pèse 2 parce que la Map garde une entrée par colis. Lisibilité, robustesse et coût restent à 1 : le code est court dans les trois cas.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `set`. Option C : `map`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 5 | 5 | 5 | 5 | 35 |
| B (set) | 3 | 4 | 4 | 5 | 4 | 36 |
| C (map) | 5 | 3 | 4 | 5 | 3 | 43 |

Total pondéré = 5 x Temps + 2 x Mémoire + 1 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barème de la note de temps (fixé sur le temps de réponse attendu d'une page web, pas sur la plus rapide des options), pour une requête à 13 millions de scans : 5 sous 10 ms, 4 sous 100 ms, 3 sous 500 ms, 2 sous 2 s, 1 au-delà. Les durées sont celles de `bench/resultats/2026-11-10T09-31-36-suivi.csv` (médiane de 5 répétitions, 100 requêtes par répétition, à 996 844 scans), divisées par 100 puis multipliées par 13,04 (13 millions / 996 844).

Justification rapide des notes :

- Temps A : 4 522 ms pour 100 requêtes à 996 844 scans, soit 45 ms par requête, soit 590 ms à 13 millions de scans (la durée croît avec le nombre de scans : 37 ms, 320 ms puis 4 522 ms pour 100 requêtes à 10 000, 100 000 et 996 844 scans). Entre 500 ms et 2 s, note 2 (c'est aussi 6,6 heures de calcul cumulées par jour sur 40 000 requêtes).
- Temps B : 2 960 ms pour 100 requêtes, soit 30 ms par requête et 386 ms à 13 millions : le Set refuse tout de suite les numéros mal tapés, mais un numéro connu parcourt encore tous les scans. Entre 100 et 500 ms, note 3.
- Temps C : 0,125 ms pour 100 requêtes à 996 844 scans, soit environ 1 microseconde par requête, et la même durée à 10 000, 100 000 et 996 844 scans (une lecture de case ne dépend pas du volume). Sous 10 ms à n'importe quel volume, note 5. Construction : 1 181 ms à 996 844 scans (`bench/resultats/2026-11-10T09-36-32-suivi-construction.csv`), soit environ 15 secondes à 13 millions, une fois quand les scans arrivent : hors du temps de réponse, donc hors de cette note.
- Mémoire : mesures de construction à 996 844 scans, A environ 1 Ko, B 4,8 Mo, C 7,2 Mo. Ces relevés du tas ne se lisent pas comme une tendance (C affiche 7 170 Ko à 100 000 comme à 996 844 scans, le ramasse-miettes brouille la lecture), et aucun n'a été fait à 13 millions de scans. A ne garde rien (note 5), B garde un Set de numéros (note 4), C garde une entrée par colis avec son scan, la plus grosse (note 3) : un ordre de grandeur de quelques dizaines de Mo à 13 millions, non mesuré.
- Lisibilité (on part de 5, une idée à connaître coûte un point) : A 5, un filtre puis un maximum, aucune idée à connaître ; B 4, une idée : le Set qui refuse les numéros inconnus avant de chercher ; C 4, une idée : l'index qui garde le dernier scan de chaque numéro.
- Robustesse : les trois sommes de contrôle sont identiques aux trois tailles (`6a26f0a8`, `93435caf`, `5a720532`), donc les trois options rendent le même scan pour chaque numéro, y compris pour les 20 % de numéros mal tapés (réponse vide). Départage à horodatage égal par `plusRecent` (comparaison des identifiants), pour les trois. Une liste de scans vide donne une réponse vide pour les trois (lu dans le code, non exécuté). Note 5 pour les trois.
- Coût : A 5, rien ne change. B 4, quelques lignes et un Set à construire quand les scans arrivent. C 3, une fonction de construction d'une dizaine de lignes avec la règle du plus récent, et un index à reconstruire ou à mettre à jour avec les 70 000 scans qui arrivent chaque jour.

## 3. La sensibilité

Avec les autres poids gardés (mémoire 2, lisibilité 1, robustesse 1, coût 1), C dépasse A dès que le poids du temps passe 2,33 (à 2 : A 29 contre C 28 ; à 3 : A 31 contre C 33), et dépasse B dès que le poids du temps passe 1,5 environ ; le poids retenu, 5, est loin de la bascule : la décision tient. Elle s'inverse seulement si la mémoire pèse beaucoup plus que le temps, ce qu'aucun chiffre du ticket ne justifie. B passe devant A dès un poids du temps de 4 (à 4 : 33 contre 33, égalité) : le choix entre A et B est fragile, mais ni l'un ni l'autre n'est retenu.
