// Le tas binaire : une file de priorité qui sert toujours le plus petit élément (au sens de `avant`),
// en O(log n) par ajout et par retrait.
// Atelier 6 (journée 3) : complétez remonter et descendre. Le même tas sert ensuite au rapport de 6h
// (atelier 7) et au calcul des plus courts chemins (journée 4).
//
// Le tas est rangé dans un tableau : le parent de la case i est en (i - 1) >> 1, ses enfants en 2i + 1
// et 2i + 2. La seule règle : un parent passe toujours avant ses enfants. La case 0 est donc le sommet.
export class TasBinaire<T> {
  private t: T[] = [];
  // avant(a, b) < 0 quand a doit sortir avant b.
  constructor(private readonly avant: (a: T, b: T) => number) { }

  get taille(): number { return this.t.length; }
  sommet(): T | undefined { return this.t[0]; }

  ajouter(x: T): void {
    this.t.push(x);
    this.remonter(this.t.length - 1);
  }

  retirer(): T | undefined {
    const t = this.t;
    if (t.length === 0) return undefined;
    const sommet = t[0];
    const dernier = t.pop()!;
    if (t.length > 0) { t[0] = dernier; this.descendre(0); }
    return sommet;
  }

  private echanger(i: number, j: number): void { const x = this.t[i]; this.t[i] = this.t[j]; this.t[j] = x; }

  // Fait remonter l'élément de la case i tant qu'il doit passer avant son parent.
  private remonter(i: number): void {
    // À COMPLÉTER (1/2) : tant que i n'est pas le sommet et que t[i] passe avant son parent,
    // échanger t[i] avec son parent, puis continuer depuis la case du parent.
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.avant(this.t[i], this.t[parent]) >= 0) break;
      this.echanger(i, parent);
      i = parent;
    }
  }

  // Fait descendre l'élément de la case i tant qu'un de ses enfants doit passer avant lui.
  private descendre(i: number): void {
    // À COMPLÉTER (2/2) : tant que i a au moins un enfant, choisir celui des deux enfants qui passe
    // en premier ; s'il passe avant t[i], les échanger et continuer depuis sa case, sinon s'arrêter.
    const n = this.t.length;
    while (true) {
      const gauche = 2 * i + 1;
      if (gauche >= n) break;
      const droite = gauche + 1;
      let premier = gauche;
      if (droite < n && this.avant(this.t[droite], this.t[gauche]) < 0) premier = droite;
      if (this.avant(this.t[premier], this.t[i]) >= 0) break;
      this.echanger(i, premier);
      i = premier;
    }
  }
}
