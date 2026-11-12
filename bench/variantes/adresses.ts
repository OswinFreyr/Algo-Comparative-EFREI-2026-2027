// Trois façons de retrouver l'adresse officielle d'une adresse mal saisie (atelier 8, ADR-005).
//
//   brute       le legacy (legacy/src/adresses.ts) : la distance de Levenshtein contre toutes les adresses
//               du référentiel, à chaque saisie. Rien à construire, tout à payer à chaque requête.
//   trigrammes  un index de trigrammes en mémoire : pour chaque groupe de trois lettres, la liste des
//               adresses qui le contiennent. On ne compare la saisie qu'aux adresses qui partagent le plus
//               de trigrammes avec elle, puis Levenshtein départage les dix meilleures.
//   postgres    le même principe, confié à PostgreSQL : l'extension pg_trgm et un index GiST, dans PGlite
//               (PostgreSQL compilé pour tourner dans Node, sans installation). La base de production
//               d'Efrei est un PostgreSQL 14 (pièce 03).
//
// Un trigramme est un groupe de trois caractères consécutifs d'un mot, le mot étant entouré de deux espaces
// devant et d'un espace derrière : "ste" donne "  s", " st", "ste", "te ". C'est la règle de pg_trgm,
// reprise ici à l'identique pour que les deux index comparent la même chose.
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { levenshtein, libelle, normaliser, rapprocherAdresses } from "../../legacy/src/adresses.js";
import type { AdresseReferentiel, Colis } from "../../legacy/src/modeles.js";

// Les trigrammes distincts d'une chaîne déjà normalisée (minuscules, sans accents, mots séparés par une espace).
export function trigrammes(s: string): string[] {
  const vus = new Set<string>();
  for (const mot of s.split(" ")) {
    if (!mot) continue;
    const p = "  " + mot + " ";
    for (let i = 0; i + 3 <= p.length; i++) vus.add(p.slice(i, i + 3));
  }
  return [...vus];
}

// La similarité de pg_trgm : trigrammes communs divisés par trigrammes de l'union, calculée en flottant
// 32 bits comme PostgreSQL.
export function similarite(communs: number, nA: number, nB: number): number {
  return Math.fround(communs / (nA + nB - communs));
}

// Parmi les candidats (rangs dans le référentiel), celui dont le libellé est le plus proche de la saisie au sens
// de Levenshtein ; à égalité, le premier rang. Les trois variantes finissent de la même façon.
function departager(saisie: string, candidats: number[], libelles: string[]): number {
  let meilleur = -1, meilleure = Number.POSITIVE_INFINITY;
  for (const r of candidats) {
    const d = levenshtein(saisie, libelles[r]);
    if (d < meilleure || (d === meilleure && r < meilleur)) { meilleure = d; meilleur = r; }
  }
  return meilleur;
}

export const CANDIDATS = 10;

// Range (rang, sim) dans `meilleurs`, liste triée par similarité décroissante puis rang croissant, sans dépasser k.
export function garderMeilleurs(meilleurs: { rang: number; sim: number }[], rang: number, sim: number, k: number): void {
  const dernier = meilleurs[meilleurs.length - 1];
  if (meilleurs.length === k && (sim < dernier.sim || (sim === dernier.sim && rang > dernier.rang))) return;
  let j = meilleurs.length;
  meilleurs.push({ rang, sim });
  while (j > 0 && (meilleurs[j - 1].sim < sim || (meilleurs[j - 1].sim === sim && meilleurs[j - 1].rang > rang))) { meilleurs[j] = meilleurs[j - 1]; j--; }
  meilleurs[j] = { rang, sim };
  if (meilleurs.length > k) meilleurs.pop();
}

// ---------- variante "trigrammes" : l'index en mémoire ----------
export class IndexTrigrammes {
  readonly libelles: string[];
  readonly ids: string[];
  private readonly numero = new Map<string, number>();   // trigramme -> son numéro
  private readonly listes: Int32Array[] = [];             // numéro de trigramme -> rangs des adresses qui le contiennent
  private readonly nbTrigrammes: Uint16Array;             // rang -> nombre de trigrammes distincts de l'adresse
  private readonly compteurs: Uint16Array;                // compteurs de travail d'une requête, remis à zéro après

  constructor(referentiel: AdresseReferentiel[]) {
    this.libelles = referentiel.map(a => normaliser(libelle(a)));
    this.ids = referentiel.map(a => a.id);
    this.nbTrigrammes = new Uint16Array(referentiel.length);
    this.compteurs = new Uint16Array(referentiel.length);
    const provisoires: number[][] = [];
    for (let r = 0; r < this.libelles.length; r++) {
      const ts = trigrammes(this.libelles[r]);
      this.nbTrigrammes[r] = ts.length;
      for (const t of ts) {
        let k = this.numero.get(t);
        if (k === undefined) { k = provisoires.length; this.numero.set(t, k); provisoires.push([]); }
        provisoires[k].push(r);
      }
    }
    for (const l of provisoires) this.listes.push(Int32Array.from(l));
  }

  get taille(): number { return this.libelles.length; }
  get nombreDeTrigrammes(): number { return this.listes.length; }

  // Les rangs des `k` adresses les plus semblables à la saisie (similarité de trigrammes décroissante).
  candidats(saisieNormalisee: string, k = CANDIDATS): number[] {
    const ts = trigrammes(saisieNormalisee);
    const touches: number[] = [];
    const meilleurs: { rang: number; sim: number }[] = [];

    ts.forEach(t => {
      const numero = this.numero.get(t);
      if(numero === undefined) return;
      for(const rang of this.listes[numero]) {
        if(this.compteurs[rang] === 0) touches.push(rang);
        this.compteurs[rang]++;
      }
    })
    for(const rang of touches) {
        garderMeilleurs(meilleurs, rang, similarite(this.compteurs[rang], ts.length, this.nbTrigrammes[rang]), k);
        this.compteurs[rang] = 0;
    }
    // À COMPLÉTER (atelier 8) : compter, pour chaque adresse, les trigrammes qu'elle partage avec la saisie.
    // 1. Pour chaque trigramme t de la saisie connu de l'index (this.numero.get(t) rend son numéro), parcourir
    //    la liste this.listes[numéro] : à la première rencontre d'un rang (compteur à 0), l'ajouter à `touches` ;
    //    dans tous les cas, augmenter this.compteurs[rang] de 1.
    // 2. Pour chaque rang de `touches` : garderMeilleurs(meilleurs, rang, similarite(compteur, ts.length,
    //    this.nbTrigrammes[rang]), k), puis remettre son compteur à zéro pour la requête suivante.

    return meilleurs.map(m => m.rang);
  }

  // L'identifiant BAN de l'adresse retenue pour une saisie brute (avec ses fautes).
  chercher(saisie: string): string | null {
    const s = normaliser(saisie);
    const r = departager(s, this.candidats(s), this.libelles);
    return r < 0 ? null : this.ids[r];
  }
}

// ---------- variante "postgres" : pg_trgm dans PGlite ----------
export class BaseAdresses {
  private constructor(private readonly db: PGlite, readonly libelles: string[], readonly ids: string[]) {}

  // Crée la base, charge le référentiel et construit l'index GiST de trigrammes.
  static async construire(referentiel: AdresseReferentiel[]): Promise<BaseAdresses> {
    const db = await PGlite.create({ extensions: { pg_trgm } });
    await db.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE TABLE adresses (rang int PRIMARY KEY, libelle text NOT NULL);");
    const libelles = referentiel.map(a => normaliser(libelle(a)));
    const lignes = libelles.map((l, r) => `${r}\t${l}`).join("\n") + "\n";
    await db.query("COPY adresses (rang, libelle) FROM '/dev/blob'", [], { blob: new Blob([lignes]) });
    await db.exec("CREATE INDEX adresses_trgm ON adresses USING gist (libelle gist_trgm_ops);");
    return new BaseAdresses(db, libelles, referentiel.map(a => a.id));
  }

  // La taille de la table et de l'index sur le disque de PostgreSQL, en octets.
  async tailles(): Promise<{ table: number; index: number }> {
    const r = await this.db.query<{ t: number; i: number }>("SELECT pg_relation_size('adresses') AS t, pg_relation_size('adresses_trgm') AS i");
    return { table: Number(r.rows[0].t), index: Number(r.rows[0].i) };
  }

  async candidats(saisieNormalisee: string, k = CANDIDATS): Promise<number[]> {
    // <-> est la distance de pg_trgm (1 - similarité) ; l'index GiST sait rendre les plus proches d'abord.
    const r = await this.db.query<{ rang: number }>(
      "SELECT rang FROM adresses ORDER BY libelle <-> $1, rang LIMIT $2", [saisieNormalisee, k]);
    return r.rows.map(x => Number(x.rang));
  }

  async chercher(saisie: string): Promise<string | null> {
    const s = normaliser(saisie);
    const r = departager(s, await this.candidats(s), this.libelles);
    return r < 0 ? null : this.ids[r];
  }

  async fermer(): Promise<void> { await this.db.close(); }
}

// ---------- variante "brute" : le legacy ----------
export function brute(requetes: Colis[], referentiel: AdresseReferentiel[]): (string | null)[] {
  return rapprocherAdresses(requetes, referentiel).map(r => r.adresseId);
}

// Somme de contrôle d'une liste de réponses (identifiants BAN, null pour "rien trouvé").
export function controleReponses(reponses: (string | null)[]): string {
  let h = 0;
  for (const id of reponses) {
    const s = id ?? "-";
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    h = (Math.imul(h, 31) + 59) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
