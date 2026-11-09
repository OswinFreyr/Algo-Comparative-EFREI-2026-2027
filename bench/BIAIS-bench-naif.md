# Les biais du benchmark du CTO (bench/bench-naif.ts)

Copiez ce fichier en bench/BIAIS-bench-naif.md. Une ligne par biais, au moins trois, sur ce modèle :
la ligne du fichier où il se voit, la question (1 à 8) qu'il rate, puis ce qu'il fausse en une phrase.

Format d'une entrée : un tiret, puis au moins un numéro de ligne et au moins un numéro de question.
Plusieurs lignes ou plusieurs questions s'écrivent aussi : "lignes N à M", "questions P et Q".

- biais 1 - ligne 26 - question Q6 : Le chronomètre externe de PowerShell n'est pas utilisé, le temps mesuré est celui du processus Node.js, qui inclut le démarrage de Node et la compilation du TypeScript.
- biais 2 - ligne 17 - question Q2 : Le jeu de données est trop petit (300 colis) pour que la mesure reflète la production (6 412 colis le 24 septembre, 9 000 le 9 novembre, 15 000 au pic de décembre).
- biais 3 - ligne 38 - question Q1 : Le benchmark est écrit par le CTO, qui défend sa variante, et non par un binôme impartial.
- biais 3 - ligne 37 - question Q7 : Le résultat n'est pas lu ni comparé entre variantes, il est seulement affiché à l'écran.
- biais 4 - lignes 21 à 32 - question Q3 : Le benchmark ne fait qu'une seule répétition, sans échauffement, ce qui fausse la mesure.
- biais 5 - lignes 21 à 32 - question Q8 : L'ordre des variantes n'est pas aléatoire, la variante du CTO est toujours mesurée en premier, ce qui fausse le classement.

## Les huit questions à poser à tout benchmark

Sur le protocole :

> Q1 : Qui l'a écrit, et pour prouver quoi ?
> Q2 : Sur quelle taille ? Ressemble-t-elle à la production ?
> Q3 : Combien de fois, après combien de tours d'échauffement ?
> Q4 : Quelle statistique : une valeur, la moyenne, la médiane ?

Sur la mesure elle-même :

> Q5 : Qu'y a-t-il entre les deux relevés du chrono ?
> Q6 : Quelle horloge, quelle résolution ?
> Q7 : Le résultat est-il lu, et comparé entre les variantes ?
> Q8 : L'ordre des variantes change-t-il le classement ?
