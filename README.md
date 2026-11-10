# Efrei Logistique - cellule performance

Dépôt de travail du module Algorithmie comparative (M2 Dev Manager Full Stack, EFREI Bordeaux, 2026-2027).
Il contient le code de 2019 tel qu'il tourne en production, le générateur des jeux de données et le banc de mesure.
Vous y travaillez du 1er octobre au 5 mars. Le carnet d'ADR et le projet en sortent.

## Installation (une fois, dans PowerShell)

Prérequis : Node.js LTS (la version indiquée dans le mail de rentrée) et Git.

```powershell
git clone https://github.com/Alexandre-stoppini/Algo-Comparative-EFREI-2026-2027.git efrei-logistique-perf
cd efrei-logistique-perf
git remote rename origin cours    # le dépôt du cours s'appelle cours ; origin reste libre pour le dépôt du binôme
npm install
npm run ban                       # vérifie l'archive du module (adresses-33.csv.gz) et prépare les référentiels
npm run data -- --echelle petite  # génère le premier jeu de données
npm run chrono                    # chronomètre l'affectation du legacy sur ce jeu
```

Avant `npm run ban`, copiez `adresses-33.csv.gz` (Moodle, Journée 2, version du 29 octobre 2026) dans
`data/referentiel/`. Toute la promotion travaille sur cette archive : vos sommes de contrôle sont celles de vos voisins.
`npm run ban -- --telecharger` prendrait la version du jour ; déconseillé, vos chiffres ne seraient plus comparables.

## Le dépôt du cours grandit chaque soir

Le code des ateliers arrive jour après jour sur le dépôt du cours,
<https://github.com/Alexandre-stoppini/Algo-Comparative-EFREI-2026-2027>. La veille de chaque journée, il reçoit un commit et un
tag avec les fichiers du lendemain : `j2` pour le lundi 9 novembre, `j3` pour le mardi 10, `j4` pour le jeudi 12, `j5` pour le
vendredi 13 (`j1` est l'état du 1er octobre). Un apport ajoute les fichiers du jour et met à jour ceux du cours, README compris ;
il ne touche jamais à vos ADR, à vos grilles, à vos résultats ni aux fichiers que vous avez complétés les jours précédents.

Une fois, à la racine du dépôt cloné le 1er octobre, après avoir commité votre travail (`git add -A` puis
`git commit -m "avant j2"`) :

```
git remote add cours https://github.com/Alexandre-stoppini/Algo-Comparative-EFREI-2026-2027.git
git pull --no-rebase --no-edit --allow-unrelated-histories -X theirs cours j2
```

Cette première fois, Git relie l'historique de votre clone à celui du dépôt du cours : les fichiers du cours prennent la version
du cours, les vôtres restent les vôtres. Puis chaque matin, avec le tag du jour (`j3` le mardi 10 novembre, `j4` le jeudi 12,
`j5` le vendredi 13) :

```
git pull --no-rebase --no-edit cours j3
```

Les commandes sont les mêmes sous Windows, macOS et Linux. Si `git pull` refuse parce que des fichiers sont modifiés, commitez
d'abord. La même mise à jour est aussi sur Moodle, en zip (`maj-J3.zip`, à décompresser à la racine du dépôt) : les deux donnent
exactement les mêmes fichiers.

## Les commandes

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run ban` | Prépare `data/referentiel/adresses-gironde.csv` (730 137 adresses) et `adresses-metropole.csv` (229 329) |
| `npm run data -- --echelle petite` | Génère un jeu de 1 000 colis dans `data/jeux/petite/` (aussi `moyenne` : 10 000, `grande` : 100 000, ou `--n 250000`) |
| `npm run chrono -- --jeu petite --etape affectation --repetitions 3` | Chronomètre une étape du batch de nuit sur un jeu |
| `npm run chrono -- --jeu petite --repetitions 3 --csv` | Idem, et ajoute chaque répétition de l'affectation à `bench/resultats/j1-chrono.csv` |
| `npm run batch -- --jeu petite --limite-adresses 20` | Enchaîne les quatre étapes avec les logs de production |
| `npm run bench` | Le harness : mesure les variantes d'un sujet sur des lots croissants (`--sujet`, par défaut affectation ; `--liste` pour les voir) |
| `npm run bench:naif` | Le benchmark du CTO. À lire avant de le croire |
| `npm run couples -- --tailles 6412,9000,15000` | Compte les couples colis-livreur examinés par tri et map (ce que la base paie en production), sans chronomètre |
| `npm run courbe -- --log --ouvrir` | Trace en SVG la courbe du CSV le plus récent de `bench/resultats/`, affiche les médianes et ouvre la courbe (`--log` : axe des temps logarithmique ; un chemin de CSV peut être donné) |
| `npm test` | Vérifie que les variantes donnent le même résultat que le legacy |

Toutes les commandes s'exécutent depuis la racine du dépôt. Dans `npm run data` et `npm run chrono`, `--jeu` et
`--echelle` sont synonymes ; une option inconnue ou sans sa valeur arrête la commande au lieu de retomber sur le jeu petite.

Sous PowerShell, le chronomètre externe est `Measure-Command { npm run chrono -- --jeu petite }`.

## L'arborescence

```
legacy/         le monolithe "Quai" de 2019, en TypeScript : ne le modifiez pas, lisez-le
  src/          modeles, csv, geo, affectation (étape 2), adresses (étape 1), tournees (étape 3), chargement (étape 4), batch
  bin/chrono.ts le chronomètre d'une étape
data/
  generateur/   generer.ts (jeux de données à graine fixe), ban.ts (référentiel d'adresses), alea.ts
  referentiel/  adresses BAN préparées (Licence Ouverte 2.0)
  jeux/         les jeux générés : hubs, livreurs, clients, colis, scans, verite, MANIFESTE.json
bench/
  harness.ts    le banc de mesure du binôme (atelier 3)
  bench-naif.ts le benchmark piégé
  couples.ts    le compte des couples colis-livreur examinés, sans chronomètre
  variantes/    les variantes d'une même fonction, à mesurer
  courbe.ts     la courbe SVG
  resultats/    vos CSV et vos courbes (une mesure sans CSV n'est pas une mesure)
adr/            les gabarits : fiche problème (journée 1), ADR et grille comparative (journée 2)
tests/          les tests d'égalité entre variantes
outils/         les correcteurs des ateliers : npm run verifier -- <atelier>
```

## Les fichiers d'un jeu de données

Séparateur `;`, encodage UTF-8, aucun champ ne contient de `;`.

| Fichier | Colonnes | Remarques |
| --- | --- | --- |
| `hubs.csv` | id, nom, lat, lon | Le hub de Brienne et les deux micro-hubs |
| `livreurs.csv` | id, nom, vehicule, capacite_kg, capacite_l, vagues_par_jour, hub_id, debut_service, fin_service | 60 vélos cargo (80 kg, 450 l, 4 vagues), 25 utilitaires (700 kg, 4 000 l, 3 vagues) |
| `clients.csv` | id, nom, type_client, adresse_id, adresse, code_postal, commune | Les destinataires connus |
| `colis.csv` | id, numero_suivi, client_id, destinataire, adresse_saisie, code_postal, commune, lat, lon, poids_kg, volume_l, priorite, creneau_debut, creneau_fin, type_client, cree_le | L'adresse saisie est celle du formulaire client, avec ses fautes. Le fichier contient des doublons de numéro de suivi, comme le vrai |
| `scans.csv` | id, numero_suivi, horodatage, type, lieu, livreur_id | Une dizaine d'événements par colis, presque triés par heure |
| `verite.csv` | colis_id, adresse_ban_id, sorte_saisie | L'adresse officielle de chaque colis, pour évaluer un rapprochement |
| `MANIFESTE.json` | | Graine, comptes, sommes de contrôle : deux jeux générés avec la même graine sont identiques |

Le jour de livraison des jeux est le jeudi 24 septembre 2026. Ce n'est pas un hasard.

## Journée 2 (lundi 9 novembre) : mesurer avant de décider

Le référentiel figé, le harness du binôme, la grille comparative et la première ADR. Les commandes des fiches 2, 3 et 4 :

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run chrono -- --jeu petite --repetitions 3 --csv` | Atelier 2 : chronomètre le legacy (aussi `moyenne` ; `grande` avec `--repetitions 1`, une dizaine de minutes sur secteur, le double sur batterie) |
| `npm run courbe -- bench/resultats/j1-chrono.csv --log --ouvrir` | Atelier 2 : la courbe du chrono |
| `npm run bench:naif` | Atelier 3 : le benchmark du CTO, à lire avec le gabarit des biais |
| `npm run bench -- --sujet temoin --repetitions 5 --echauffement 3` | Atelier 3 : le sujet témoin, pour vérifier votre harness |
| `npm run bench -- --variantes tri,map --repetitions 5 --echauffement 200` | Atelier 3 : l'affectation, échauffement réglé (la chauffe s'arrête d'elle-même au bout de 5 secondes) |
| `npm run bench -- --repetitions 5 --echauffement 200` | Atelier 4 : les trois variantes, naive comprise |
| `npm run couples`, puis `npm run couples -- --tailles 12000,15000,18000,20000` | Atelier 4 : les couples colis-livreur que la production paie en requêtes |
| `npm run verifier -- 2` | Le correcteur de l'atelier 2 (aussi 3 et 4) |

Les gabarits à copier avant de les remplir : `bench/BIAIS-bench-naif-gabarit.md` en `bench/BIAIS-bench-naif.md`,
`adr/grille-comparative.md` en `adr/GRILLE-ADR-001.md`, `adr/ADR-000-gabarit.md` en `adr/ADR-001-affectation.md`.

## Journée 3 (mardi 10 novembre) : ce que coûte une structure

Trois sujets de plus pour le harness, un nouveau jeu de données, et trois "À COMPLÉTER" (un par atelier).

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run mois` | Génère le mois de facturation d'octobre 2026 : 3 000 000 de lignes dans `data/jeux/mois/` (quelques secondes, 110 Mo environ) |
| `npm run bench -- --sujet suivi --repetitions 5 --echauffement 3` | Atelier 5 : 100 requêtes de la page "Où est mon colis" sur 10 000, 100 000 et 996 844 scans (tableau, set, map) |
| `npm run bench -- --sujet suivi-construction --repetitions 5 --echauffement 3` | Atelier 5 : le coût de construire la structure de recherche, mémoire comprise |
| `npm run bench -- --sujet priorite --repetitions 5 --echauffement 2` | Atelier 6 : la file du quai un soir, à 1 000, 9 000 et 15 000 colis (tableau, tas, seaux) |
| `npm run bench -- --sujet priorite-arrivees --repetitions 3` | Atelier 6 : la même soirée, colis arrivés dans le désordre |
| `npm run bench -- --sujet rapport --repetitions 5 --echauffement 2` | Atelier 7 : les cent premiers clients du mois sur 100 000, 1 000 000 et 3 000 000 de lignes (tri, tas, quickselect) |
| `npm run bench -- --liste` | Les sujets du harness et leurs variantes |
| `npm run verifier -- 5` | Le correcteur de l'atelier 5 (aussi 6 et 7) |

Les fichiers de la journée :

```
legacy/src/suivi.ts          la page "Où est mon colis" (2024) : elle relit tous les scans à chaque requête
legacy/src/quai.ts           la file du quai (2019) : retriée à chaque arrivée
legacy/src/rapport.ts        le rapport de 6h (2020) : trie toutes les lignes du mois
data/generateur/mois.ts      le générateur du mois de facturation
bench/variantes/suivi.ts     tableau, set, map (À COMPLÉTER : construireMap) et dichotomie
bench/variantes/tas.ts       le tas binaire (À COMPLÉTER : remonter et descendre), resservi aux ateliers 7 et 10
bench/variantes/priorite.ts  tableau, tas, seaux
bench/variantes/rapport.ts   tri, tas de taille K (À COMPLÉTER : topKParTas), quickselect
bench/sujets/                suivi, suivi-construction, priorite, priorite-arrivees, rapport
```

Le fichier `mois/facturation.csv` : `id;jour;client_id;type;montant_centimes`, une ligne par prestation facturée
(suivi, livraison, prise en charge, retour, supplément), pour les 1 900 comptes professionnels d'Efrei (pièce 01), graine 2026.

## Règles

- Le dossier `legacy/` ne se modifie pas : c'est la référence, on la mesure et on la compare.
- Une mesure se fait avec le harness, se répète, et laisse un CSV dans `bench/resultats/`.
- Aucune IA générative sur ce dépôt, sauf indication contraire donnée en cours.
