# ADR-004 - Sortir les cent premiers clients du mois avec la variante `tas`

## 1. Contexte

Le premier jour ouvré du mois, à 6h, un cron lance sur la VM du site le rapport des cent premiers clients par chiffre d'affaires. Il fait tomber le serveur : mémoire saturée. Le mois d'octobre 2026 compte trois millions de lignes de facturation pour 1 900 clients. Le legacy de 2020 trie toutes les lignes par client, additionne, puis trie tous les clients pour n'en garder que cent. La contrainte est la mémoire de pointe d'abord, le temps ensuite.

## 2. Options comparées

- Option A (legacy, `tri`) : copier et trier les lignes par client (ligne 32 de `legacy/src/rapport.ts`), additionner, trier tous les clients et garder les cent premiers (lignes 39 et 40). Complexité annoncée : O(n log n) en temps, O(n) en mémoire, n étant le nombre de lignes.
- Option B (`tas`) : les totaux par client en une passe avec une Map, puis un tas de taille K dont le sommet est le moins bon des K gardés. Complexité annoncée : O(n + m log K) en temps, O(m + K) en mémoire, m étant le nombre de clients.
- Option C (`quickselect`) : les mêmes totaux par Map, puis le K-ième client placé à sa place par pivot, et un tri des K premiers seulement. Complexité annoncée : O(n + m) en moyenne, O(m²) au pire, O(m) en mémoire.

## 3. Mesures

- Machine : Apple M3 Pro (11 coeurs), 18 Go, Darwin 27.3.0, Node v24.14.1.
- Jeux : `data/jeux/mois` (`npm run mois`, graine 2026), les 100 000, 1 000 000 et 3 000 000 premières lignes.
- Répétitions et échauffement : 5 répétitions, 2 tours d'échauffement.
- Statistique retenue : la médiane.
- Mesuré : la durée du calcul du rapport, lignes déjà chargées, et la mémoire prise pendant l'appel après un passage forcé du garbage collector : `bench/resultats/2026-11-10T14-46-34-rapport.csv`. Somme de contrôle identique pour les trois options à chaque taille.

| Option | 100 000 | 1 000 000 | 3 000 000 |
| --- | --- | --- | --- |
| A (`tri`) | 33,1 ms, 6,5 Mo | 341,6 ms, 24,8 Mo | 1 167,4 ms, 63,7 Mo |
| B (`tas`) | 5,2 ms, 0,4 Mo | 26,6 ms, 0,3 Mo | 78,1 ms, 0,3 Mo |
| C (`quickselect`) | 2,7 ms, 0,2 Mo | 38,6 ms, 6,9 Mo | 100,0 ms, 19,5 Mo |

À trois millions de lignes, le tri dépasse le tas 208 fois en mémoire et 15 fois en temps : c'est l'écart de mémoire qui répond au ticket.

Un second lancement complet (`bench/resultats/2026-11-10T15-44-04-rapport.csv`) redonne les mêmes ordres de grandeur à trois millions de lignes : tri 1 077,3 ms et 66,5 Mo, tas 80,4 ms et 0,3 Mo, quickselect 100,5 ms et 19,5 Mo.

Relance du tas et du quickselect seuls, 9 répétitions (`bench/resultats/2026-11-10T14-46-57-rapport.csv`) : 97,8 ms contre 97,4 ms. Leur écart de temps des lancements complets (80 contre 100 ms) ne tient donc pas d'une configuration de lancement à l'autre : nous les tenons pour équivalents en temps. Cette relance a relevé 52 Mo pour les deux, relevé jugé absurde (le tas ne garde que 1 900 totaux et cent cases) : nous gardons la plus petite valeur positive, 0,3 Mo pour le tas et 19,5 Mo pour le quickselect.

Courbe : `bench/resultats/2026-11-10T14-46-34-rapport.svg`.

## 4. Décision

Nous adoptons l'option B (`tas`), total pondéré 45 contre 40 pour le legacy et 37 pour `quickselect` (`adr/GRILLE-ADR-004.md`), parce que la mémoire, qui pèse 4, est le critère du ticket et qu'il y prend 208 fois moins que le tri ; face au quickselect, qui le vaut sur le temps, c'est le pire cas garanti et la lisibilité qui départagent.

## 5. Conséquences et limites

Le code demande de connaître le tas et son sommet inversé, et s'appuie sur le tas de l'atelier 6. Le chargement des lignes n'est pas mesuré : le banc les charge toutes avant le chronomètre, soit quelques centaines de Mo, et le legacy fait de même ; si c'est ce chargement qui sature la VM, changer le calcul ne suffira pas, il faudra aussi lire le fichier en flux et additionner au passage. Le relevé de mémoire dépend de la configuration du lancement (0,3 Mo pour le tas dans les deux lancements complets, 52 Mo quand il est lancé seul avec le quickselect) : l'écart avec le tri repose aussi sur la lecture du code, le tri copie trois millions de lignes, le tas non. Non mesuré : la VM du site, la mémoire de pointe du processus entier.

Domaine de validité : nous avons fait varier le nombre de lignes (100 000, 1 000 000 et 3 000 000). Nous n'avons pas fait varier le nombre de clients (1 900) ni K (100). La mémoire du tas suit le nombre de clients, pas de lignes : 306 ko pour 1 900 clients, soit 0,16 ko par client ; la Map des totaux passerait 10 Mo, et la note 5 de mémoire, vers 62 000 clients, 33 fois le portefeuille actuel.

La requête qui ferait le même rapport dans la base (nom de table supposé) :

```sql
SELECT client_id, SUM(montant_centimes) AS total_centimes, COUNT(*) AS lignes
FROM facturation
WHERE jour >= '2026-10-01' AND jour < '2026-11-01'
GROUP BY client_id
ORDER BY total_centimes DESC, client_id ASC
LIMIT 100;
```

Elle supprimerait le chargement des trois millions de lignes dans le processus du site et les trois variantes : seules cent lignes de résultat quitteraient la base. Non mesuré.

## 6. En trois phrases pour la directrice des opérations

Le premier jour ouvré du mois, à 6h, le rapport des cent premiers clients range les trois millions de lignes de facturation avant de compter, ce qui demande au serveur plus de mémoire qu'il n'en a. Nous retenons une méthode qui additionne les lignes client par client et ne garde à tout moment que les cent meilleurs : le même classement sort en moins d'un dixième de seconde au lieu d'un peu plus d'une seconde, avec environ deux cents fois moins de mémoire pour le calcul. Il restera à vérifier que la lecture des lignes elle-même ne sature pas le serveur, ce que nous n'avons pas mesuré.
