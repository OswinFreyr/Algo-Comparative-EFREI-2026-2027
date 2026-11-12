"""Prépare le graphe routier de Bordeaux Métropole à partir de l'extrait OpenStreetMap de la Gironde.

Usage : python3 preparer_graphe.py gironde-latest.osm.pbf <dossier de sortie>

Sorties (séparateur ;, UTF-8) :
  noeuds.csv   id;lat;lon                      un noeud par intersection ou extrémité de voie
  aretes.csv   de;vers;metres;velo;utilitaire;type;nom;pont
               une ligne par sens de circulation ; velo et utilitaire valent 1 si le sens est permis
               metres : longueur le long de la voie, arrondie au mètre supérieur (jamais plus courte
               que la ligne droite, ce qui garde l'heuristique à vol d'oiseau admissible)
Données : OpenStreetMap (c) les contributeurs d'OpenStreetMap, licence ODbL 1.0.
"""
import collections, csv, math, sys
import osmium

SOURCE, SORTIE = sys.argv[1], sys.argv[2]
# Les adresses de la métropole (BAN) tiennent dans ce rectangle, avec une marge d'environ un kilomètre.
LAT_MIN, LAT_MAX, LON_MIN, LON_MAX = 44.733, 45.043, -0.846, -0.448

ROUTES = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
          "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "cycleway", "road"}
INTERDIT_VELO = {"motorway", "motorway_link"}
SANS_MOTEUR = {"cycleway"}


def dedans(lat, lon):
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX


def haversine(a, b):
    r = math.pi / 180
    dla, dlo = (b[0] - a[0]) * r, (b[1] - a[1]) * r
    h = math.sin(dla / 2) ** 2 + math.cos(a[0] * r) * math.cos(b[0] * r) * math.sin(dlo / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def acces(tags):
    hw = tags.get("highway")
    a = tags.get("access", "")
    velo = hw not in INTERDIT_VELO and tags.get("bicycle", "") != "no"
    if a in ("no", "private") and tags.get("bicycle", "") not in ("yes", "designated", "permissive"):
        velo = False
    util = hw not in SANS_MOTEUR and a not in ("no", "private", "delivery") \
        and tags.get("motor_vehicle", "") not in ("no", "private") and tags.get("vehicle", "") not in ("no", "private") \
        and tags.get("motorcar", "") not in ("no",) and tags.get("goods", "") != "no"
    if tags.get("motor_vehicle") in ("destination", "delivery", "yes") or tags.get("goods") in ("yes", "delivery", "destination"):
        util = hw not in SANS_MOTEUR
    sens = tags.get("oneway", "no")
    sens_velo = tags.get("oneway:bicycle", sens)
    if hw in ("motorway", "motorway_link") or tags.get("junction") == "roundabout":
        if sens == "no":
            sens = "yes"
    return velo, util, sens, sens_velo


class Voies(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.voies = []

    def way(self, w):
        hw = w.tags.get("highway")
        # Les chemins et trottoirs ouverts aux vélos comptent comme des pistes cyclables.
        cyclable = hw in ("path", "footway", "pedestrian", "bridleway") and w.tags.get("bicycle") in ("designated", "yes")
        if (hw not in ROUTES and not cyclable) or w.tags.get("area") == "yes":
            return
        try:
            pts = [(n.ref, n.location.lat, n.location.lon) for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if not any(dedans(p[1], p[2]) for p in pts):
            return
        tags = {k: v for k, v in w.tags}
        if cyclable:
            tags["highway"] = "cycleway"
        self.voies.append((w.id, tags, pts))


h = Voies()
h.apply_file(SOURCE, locations=True)
print(f"voies retenues : {len(h.voies)}")

# Les noeuds gardés : extrémités de voies et noeuds partagés par plusieurs voies (intersections).
usage = collections.Counter()
for _, _, pts in h.voies:
    for i, p in enumerate(pts):
        usage[p[0]] += 2 if i in (0, len(pts) - 1) else 1
garde = {ref for ref, k in usage.items() if k >= 2}

position = {}
segments = []  # (a, b, metres, velo_ab, velo_ba, util_ab, util_ba, type, nom, pont)
for wid, tags, pts in h.voies:
    velo, util, sens, sens_velo = acces(tags)
    hw = tags.get("highway")
    nom = tags.get("name", "").replace(";", ",")
    pont = ""
    if tags.get("bridge") not in (None, "no"):
        pont = (tags.get("bridge:name") or tags.get("name") or "pont sans nom").replace(";", ",")
        if tags.get("bridge") == "movable" or tags.get("bridge:movable"):
            pont += " (levant)"
    debut, longueur = pts[0], 0.0
    for p in pts:
        position[p[0]] = (p[1], p[2])
    for i in range(1, len(pts)):
        longueur += haversine((pts[i - 1][1], pts[i - 1][2]), (pts[i][1], pts[i][2]))
        if pts[i][0] in garde or i == len(pts) - 1:
            a, b = debut[0], pts[i][0]
            if a != b:
                m = max(1, math.ceil(longueur))
                avant = sens in ("no", "yes", "1", "true")
                arriere = sens in ("no", "-1", "reverse")
                if sens == "-1":
                    avant = False
                va = sens_velo in ("no",) or avant
                vr = sens_velo in ("no", "-1") or arriere
                segments.append((a, b, m, velo and va, velo and vr, util and avant, util and arriere, hw, nom, pont))
            debut, longueur = pts[i], 0.0

# La plus grande composante connexe (sans tenir compte des sens), dans le rectangle.
voisins = collections.defaultdict(list)
for s in segments:
    if dedans(*position[s[0]]) and dedans(*position[s[1]]):
        voisins[s[0]].append(s[1])
        voisins[s[1]].append(s[0])
vu, meilleure = set(), set()
for depart in list(voisins):
    if depart in vu:
        continue
    comp, pile = {depart}, [depart]
    vu.add(depart)
    while pile:
        x = pile.pop()
        for y in voisins[x]:
            if y not in vu:
                vu.add(y); comp.add(y); pile.append(y)
    if len(comp) > len(meilleure):
        meilleure = comp
print(f"plus grande composante : {len(meilleure)} noeuds")

# Numérotation compacte, dans l'ordre des latitudes puis longitudes (stable et lisible).
ordre = sorted(meilleure, key=lambda r: (position[r][0], position[r][1], r))
num = {r: i for i, r in enumerate(ordre)}
import os
os.makedirs(SORTIE, exist_ok=True)
with open(os.path.join(SORTIE, "noeuds.csv"), "w", encoding="utf-8", newline="") as f:
    f.write("id;lat;lon\n")
    for r in ordre:
        la, lo = position[r]
        f.write(f"{num[r]};{la:.6f};{lo:.6f}\n")
n_aretes = 0
ponts = collections.Counter()
# Les ponts de la Garonne, repérés par leur position : les pistes cyclables posées sur un pont n'ont souvent pas
# de nom dans OpenStreetMap, et un pont levé doit les couper aussi.
GARONNE = {"Pont Jacques Chaban-Delmas": (44.8593, -0.5513), "Pont de Pierre": (44.8380, -0.5620)}
def pont_nomme(a, b, pont):
    if not pont:
        return pont
    m = ((position[a][0] + position[b][0]) / 2, (position[a][1] + position[b][1]) / 2)
    for nom, centre in GARONNE.items():
        if haversine(m, centre) < 300:
            return nom
    return pont
with open(os.path.join(SORTIE, "aretes.csv"), "w", encoding="utf-8", newline="") as f:
    f.write("de;vers;metres;velo;utilitaire;type;nom;pont\n")
    for a, b, m, vab, vba, uab, uba, hw, nom, pont in segments:
        if a not in num or b not in num:
            continue
        pont = pont_nomme(a, b, pont)
        if vab or uab:
            f.write(f"{num[a]};{num[b]};{m};{int(vab)};{int(uab)};{hw};{nom};{pont}\n"); n_aretes += 1
        if vba or uba:
            f.write(f"{num[b]};{num[a]};{m};{int(vba)};{int(uba)};{hw};{nom};{pont}\n"); n_aretes += 1
        if pont:
            ponts[pont] += 1
print(f"noeuds : {len(ordre)}, arêtes orientées : {n_aretes}")
for p, k in ponts.most_common(40):
    print(f"  pont : {p} ({k} tronçons)")
