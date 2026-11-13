# Grille comparative - ADR-007 : recalculer les distances par la route quand le pont se lève

La grille sert à décider, pas à classer par vitesse. Les poids et le barème sont fixés par le ticket T-0733, avant de lire les mesures.

## 1. Les critères et leur poids pour ce ticket

| Critère | Ce qu'on mesure ou ce qu'on juge | Poids (somme = 10) |
| --- | --- | --- |
| Temps | durée du recalcul des 23 tournées touchées, pendant qu'un livreur attend au feu | 4 |
| Mémoire | pic mémoire à 23 tournées (colonne `memoire_ko` du harness), lu comme un ordre de grandeur | 1 |
| Lisibilité | un développeur qui découvre le code le comprend-il en cinq minutes | 2 |
| Robustesse | distances justes au mètre, sans hypothèse à tenir sur les données | 2 |
| Coût de mise en oeuvre | lignes à écrire, structure à réutiliser et à maintenir, dépendance | 1 |

Aucun critère à 0 : les cinq comptent pour ce ticket. Le temps pèse le plus (4) parce que le recalcul du 8 septembre a duré 11 minutes, tablettes figées.

## 2. Les options, note de 1 à 5 par critère

| Option | Temps | Mémoire | Lisibilité | Robustesse | Coût | Total pondéré |
| --- | --- | --- | --- | --- | --- | --- |
| A (Dijkstra sans tas) | 2 | 5 | 5 | 5 | 5 | 38 |
| B (Dijkstra avec tas) | 5 | 5 | 4 | 5 | 3 | 46 |
| C (A*) | 5 | 5 | 3 | 3 | 3 | 40 |

Total pondéré = somme des notes multipliées par les poids (4, 1, 2, 2, 1) : A = 8 + 5 + 10 + 10 + 5 = 38 ; B = 20 + 5 + 8 + 10 + 3 = 46 ; C = 20 + 5 + 6 + 6 + 3 = 40.

Le legacy du 8 septembre (11 minutes) se cite en rubrique 1 de l'ADR, il ne se note pas.

Barèmes fixés avant la mesure :

- Temps des 23 tournées : 5 sous 1 s, 4 sous 10 s, 3 sous 1 min, 2 sous 11 min (le 8 septembre), 1 au-delà.
- Mémoire à 23 tournées : 5 sous 50 Mo, 4 sous 500 Mo, 3 au-delà ; deux options à moins d'un facteur 2 ont la même note.
- Lisibilité : on part de 5, chaque idée à connaître pour lire la méthode coûte un point.
- Robustesse : 5 mêmes distances que Dijkstra sans hypothèse ; 3 juste sous une hypothèse à tenir ; 2 distances fausses en silence sur le pont ; 1 si `npm test` échoue.
- Coût : 5 rien à écrire ; 4 quelques lignes sans structure à maintenir ; 3 quelques lignes et une structure du dépôt à réutiliser et maintenir ; 2 structure nouvelle ; 1 dépendance ajoutée.

Justification des notes :

- **A, Temps 2** : 3,5 s pour une tournée, 5,2 s pour deux (`bench/resultats/2026-11-13T10-27-49-chemins.csv`) ; `npm run pont` extrapole 79,5 s pour les 23 tournées, sous les 11 minutes du 8 septembre mais au-dessus d'une minute.
- **B, Temps 5** : 134,2 ms pour les 23 tournées (`bench/resultats/2026-11-13T10-32-03-chemins.csv`), sous 1 s.
- **C, Temps 5** : 233,4 ms pour les 23 tournées, même fichier, sous 1 s ; 1,7 fois plus lent que B.
- **Mémoire 5 pour les trois** : 13,9 Mo pour B et 14,7 Mo pour C à 23 tournées, moins de 50 Mo ; A reste à quelques Mo à une et deux tournées. Écart inférieur à un facteur 2 entre B et C, même note.
- **Lisibilité** : A, rien à connaître que Dijkstra lui-même, 5 ; B, le tas et ses entrées périmées (un carrefour peut y être plusieurs fois, seule la première sortie compte), 4 ; C, ces mêmes entrées périmées plus l'heuristique et sa condition (ne jamais dépasser la vraie distance), 3.
- **Robustesse** : A et B rendent les mêmes distances au mètre, même somme de contrôle sur toutes les tailles, aucune hypothèse, 5 ; C est juste seulement si le vol d'oiseau ne dépasse jamais la route (à revoir si l'unité ou les coordonnées changent), 3. Les trois tests des plus courts chemins passent.
- **Coût** : A est le code déjà écrit, 5 ; B demande quatre lignes de relâchement et le tas de l'atelier 6 à maintenir, 3 ; C demande deux priorités à changer, le tas et le vol d'oiseau du dépôt à maintenir, 3.

## 3. La sensibilité

Avec le poids du temps à 5 et celui de la lisibilité à 1 (les autres inchangés), les totaux deviennent A = 35, B = 47, C = 42 : la décision ne change pas. B garde au moins la note de C sur chaque critère, donc il reste devant C quels que soient les poids ; face à A, B passe devant dès que le poids du temps dépasse environ 1,3 contre les 4 choisis, la décision est donc solide.
