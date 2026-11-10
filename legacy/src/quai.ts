// La file du quai : les colis arrivent toute la soirée, les préparateurs prennent toujours le plus urgent.
// On garde la file triée : à chaque arrivée on retrie ; on sert toujours le premier de la file. (J. B., 2019)
import type { Colis } from "./modeles.js";

const ORDRE_PRIORITE: Record<string, number> = { pharmacie: 0, express: 1, standard: 2 };

// Les urgents d'abord, puis par fin de créneau, puis par heure de création.
export function parEcheance(a: Colis, b: Colis): number {
  const p = ORDRE_PRIORITE[a.priorite] - ORDRE_PRIORITE[b.priorite];
  if (p !== 0) return p;
  if (a.creneauFin !== b.creneauFin) return a.creneauFin < b.creneauFin ? -1 : 1;
  return a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : 0;
}

export class FileQuai {
  private colis: Colis[] = [];

  ajouter(c: Colis): void {
    this.colis.push(c);
    this.colis.sort(parEcheance); // la file reste toujours triée, les pharmacies en tête
  }

  prendre(): Colis | undefined {
    return this.colis.shift(); // le premier de la file est le plus urgent
  }

  get taille(): number { return this.colis.length; }
}
