# Grille comparative - ADR-002 : retrouver un colis par son numéro de suivi

Ticket : la page "Où est mon colis" relit tous les scans à chaque requête. Elle est appelée 40 000 fois par jour sur une base qui garde six mois de scans, soit 13 millions. La contrainte est le temps de réponse par requête.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | ce que la production paiera : durée d'une requête projetée sur les six mois de la base (médiane à 996 844 scans, divisée par 100 requêtes, multipliée par 13 pour les options qui relisent tous les scans) | 5 |
| Mémoire | taille de la structure construite au million de scans, lue comme un ordre de grandeur | 2 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 1 |
| Robustesse | réponse sur un numéro connu, inconnu ou mal formé ; structure à tenir à jour ou non | 1 |
| Coût de mise en oeuvre | lignes changées, dépendances ajoutées, données à préparer | 1 |

Les poids sont ceux imposés par le ticket ADR-002. Aucun critère à 0.

## 2. Les options, note de 1 à 5 par critère

Option A : le legacy (`tableau`). Option B : `set`. Option C : `map`.

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (legacy) | 2 | 5 | 5 | 4 | 5 | 34 |
| B (set) | 2 | 4 | 4 | 3 | 4 | 29 |
| C (map) | 5 | 4 | 4 | 3 | 4 | 44 |

Total pondéré = 5 x Temps + 2 x Mémoire + 1 x Lisibilité + 1 x Robustesse + 1 x Coût.

Barème de la note de temps (fixé sur le temps de réponse d'une page, par requête projetée sur les six mois de la base) : 5 sous 1 ms, 4 sous 10 ms, 3 sous 100 ms, 2 sous 1 s, 1 au-delà. Mesure : `bench/resultats/2026-11-10T09-30-26-suivi.csv` (lot de 100 requêtes, médiane de 5 répétitions à 996 844 scans).

Barème de la note de mémoire (structure construite au million de scans, `bench/resultats/2026-11-10T09-32-17-suivi-construction.csv`) : 5 sous 1 Mo, 4 sous 10 Mo, 3 sous 50 Mo, 2 sous 200 Mo, 1 au-delà. Deux relevés à moins d'un facteur 2 l'un de l'autre prennent la même note.

Justification rapide des notes :

- Temps A : médiane 1 621,2 ms pour 100 requêtes, soit 16,2 ms par requête à 996 844 scans ; x 13 = 210,8 ms sur les six mois, sous 1 s, note 2.
- Temps B : médiane 1 101,9 ms pour 100 requêtes, soit 11,0 ms par requête ; x 13 = 143,2 ms, sous 1 s, note 2. Le Set n'épargne que la requête sur cinq dont le numéro est mal tapé ; un numéro connu relit encore tous les scans.
- Temps C : médiane 0,037 ms pour 100 requêtes, soit 0,0004 ms par requête, sans multiplication : la médiane ne bouge pas entre 10 000 scans (0,025 ms) et 996 844 (0,037 ms). Sous 1 ms, note 5.
- Mémoire : A 1 ko (rien à construire), note 5. B 5 122 ko, soit 5,1 Mo, note 4. C 7 170 ko, soit 7,2 Mo, note 4. B et C sont à moins d'un facteur 2 l'un de l'autre : même note.
- Lisibilité (on part de 5, une idée à connaître coûte un point) : A 5, un filtre puis un parcours, aucune idée à connaître ; B 4, une idée : la table de hachage sous le Set ; C 4, une idée : la table de hachage sous la Map.
- Robustesse : `npm test` passe pour les trois options. A 4 : rien à tenir à jour, un numéro inconnu ou mal formé rend null, mais le format du numéro n'est pas vérifié. B 3 et C 3 : la réponse dépend du Set ou de la Map ; un scan arrivé sans y être ajouté rend la réponse périmée sans erreur (colis déclaré inconnu pour B, avant-dernier scan affiché pour C).
- Coût : A 5, rien ne change. B 4 et C 4 : quelques lignes et une structure fournie par le langage.

## 3. La sensibilité

Les poids imposés sont déjà temps 5 et lisibilité 1 : la décision est celle du tableau, C premier avec 44 contre 34 pour le legacy. En gardant les autres poids (mémoire 2, lisibilité 1, robustesse 1, coût 1), le legacy vaut 2t + 24 et C vaut 5t + 19 pour un poids du temps t : le legacy l'emporte à 1 (26 contre 24), C l'emporte dès 2 (29 contre 28). La bascule est entre 1 et 2, loin du poids choisi : la décision est solide aux poids.
