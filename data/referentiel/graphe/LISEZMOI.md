# Le graphe routier de Bordeaux Métropole

Deux fichiers, compressés, lus directement par le code (bench/graphe/graphe.ts) :

| Fichier | Colonnes | Contenu |
| --- | --- | --- |
| `noeuds.csv.gz` | id;lat;lon | 46 565 noeuds : les intersections et les extrémités des voies |
| `aretes.csv.gz` | de;vers;metres;velo;utilitaire;type;nom;pont | 111 288 arêtes orientées, une ligne par sens de circulation |

- `metres` : la longueur du tronçon le long de la voie, arrondie au mètre supérieur. Elle n'est jamais plus courte
  que la ligne droite entre ses deux bouts : l'heuristique à vol d'oiseau de A* reste admissible.
- `velo`, `utilitaire` : 1 si le vélo cargo ou l'utilitaire électrique peut emprunter ce sens (voies à sens unique,
  pistes cyclables, voies interdites aux voitures, autoroutes interdites aux vélos).
- `type` : la catégorie OpenStreetMap de la voie (residential, primary, cycleway...).
- `pont` : vide, ou le nom du pont. Le pont Jacques Chaban-Delmas et le Pont de Pierre sont nommés, pistes
  cyclables comprises. Le Pont de Pierre est réservé aux vélos (travaux, octobre 2026) ; le pont Chaban-Delmas
  se lève pour les bateaux.

Comment il a été préparé (une fois, pour tout le module) : `data/generateur/preparer_graphe.py`, à partir de
l'extrait OpenStreetMap de la Gironde du 29 octobre 2026. Les voies carrossables et cyclables du rectangle de la
métropole sont gardées, coupées aux intersections, puis seule la plus grande partie connexe est conservée.
Les chemins piétons, les voies privées et les parkings ne sont pas dans le graphe.

Licence : voir LICENCE_OSM.txt (ODbL 1.0, (c) les contributeurs d'OpenStreetMap).
