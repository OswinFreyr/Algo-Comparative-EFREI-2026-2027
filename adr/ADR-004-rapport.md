# ADR-004 - Sortir les cent premiers clients du mois avec un tas de taille K

## 1. Contexte

Le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients (par chiffre d'affaires) fait tomber le serveur : mémoire saturée. Le mois d'octobre 2026 compte 3 000 000 de lignes de facturation et 1 900 clients. Le legacy (2020) trie les trois millions de lignes par client, puis trie tous les clients. Le ticket a deux contraintes : la mémoire de pointe d'abord, le temps ensuite.

## 2. Options comparées

- Option A (legacy, `tri`) : trier toutes les lignes par client, regrouper, additionner, trier tous les clients et garder les cent premiers. Complexité annoncée : O(n log n) pour n lignes.
- Option B (`tas`) : totaux par client en une passe avec une Map, puis un tas de taille K qui garde les K meilleurs vus jusqu'ici. Complexité annoncée : O(n) pour les totaux, puis O(m log K) pour m clients.
- Option C (`quickselect`) : les mêmes totaux, puis une sélection qui place le K-ième meilleur à sa place sans trier le reste, et un tri des K premiers. Complexité annoncée : O(m) en moyenne, O(m²) au pire.

## 3. Mesures

- Machine : AMD Ryzen 7 7435HS (16 coeurs), 16 Go, Windows_NT 10.0.19045, Node v22.20.0.
- Jeux : `data/jeux/mois`, 100 000, 1 000 000 et 3 000 000 de lignes de facturation.
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : durée et mémoire d'un rapport, lignes déjà chargées en mémoire (`bench/resultats/2026-11-10T14-55-06-rapport.csv`). Somme de contrôle identique pour les trois variantes à chaque taille. Le relevé de mémoire du tas à 100 000 lignes saute au début de la mesure (4 292 Ko aux deux premières répétitions, 296 Ko ensuite) : le ramasse-miettes ; la médiane retient 301 Ko. Le quickselect relève 234 Ko à 3 000 000 de lignes ici, et 245 Ko à deux relances (Node v22.20.0) ; un autre poste relève 19 459 Ko : ordre de grandeur à lire avec prudence, le ramasse-miettes passe ou non.

| Option | 100 000 | 1 000 000 | 3 000 000 | Mémoire à 3 000 000 |
| --- | --- | --- | --- | --- |
| A (tri) | 45,5 ms | 408,5 ms | 1 350,7 ms | 66 516 Ko (65 Mo) |
| B (tas) | 3,2 ms | 26,0 ms | 78,1 ms | 304 Ko |
| C (quickselect) | 2,8 ms | 27,2 ms | 75,7 ms | 234 Ko |

À 3 000 000 de lignes, le tri dépasse le tas de 17 fois en temps et de 219 fois en mémoire : c'est l'écart de mémoire qui répond au ticket.

Courbe : `bench/resultats/2026-11-10T14-55-06-rapport.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 45 contre 41 pour `quickselect` et 40 pour le legacy (`adr/GRILLE-ADR-004.md`), parce que le critère de la mémoire, qui pèse 4, passe de 65 Mo à 0,3 Mo, et que `tas` et `quickselect` se valent sur la mesure (78 ms contre 76 ms) : le tas les départage par un pire cas garanti et un code plus simple à lire.

## 5. Conséquences et limites

Le code ajoute un tas (déjà écrit pour l'atelier 6) et une Map des totaux par client. Non mesuré : le chargement des 3 000 000 de lignes depuis le fichier (110 Mo environ), qui reste en mémoire avant le rapport et qui n'est pas dans les chiffres ci-dessus ; si le serveur sature encore, c'est lui qu'il faudra regarder. La requête SQL qui ferait le même rapport dans la base n'a pas été étudiée.

Domaine de validité : nous avons fait varier le nombre de lignes (100 000, 1 000 000 et 3 000 000) ; nous n'avons pas fait varier le nombre de clients (1 900) ni K (100). La mémoire du tas, 304 Ko pour 1 900 clients, soit environ 0,16 Ko par client, passerait les 10 Mo (la note 5 de mémoire) vers 64 000 clients. Le legacy, à 22 Ko pour 1 000 lignes environ, atteindrait 1 Go (sa note de mémoire tomberait à 1) vers 47 millions de lignes, par extrapolation proportionnelle, non mesurée.

## 6. En trois phrases pour la directrice des opérations

Le premier jour du mois, à 6h, le rapport des cent plus gros clients sature le serveur, parce qu'il range d'abord les trois millions de lignes de facturation de tout le mois. Nous le remplaçons par une méthode qui additionne les montants client par client, puis ne garde sous la main que la liste des cent meilleurs : la place nécessaire passe d'environ 65 Mo à moins de 1 Mo, et le rapport est dix-sept fois plus rapide. Le résultat est strictement le même, et il restera juste tant que le nombre de clients ne dépasse pas plusieurs dizaines de milliers.
