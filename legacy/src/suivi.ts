// La page "Où est mon colis" (mise en ligne en mars 2024) : le client tape son numéro de suivi,
// la page lui rend le dernier scan de son colis.
// On relit tous les scans de la base à chaque requête : c'est simple et toujours à jour. (J. B., mars 2024)
import { lireLignes } from "./csv.js";

export interface Scan {
  id: string;           // "S00000042" : l'ordre d'enregistrement
  numeroSuivi: string;
  horodatage: string;   // ISO 8601, "2026-09-24T07:42:10"
  type: string;         // pris_en_charge, tri, charge, depart_hub, en_approche, livre, absent...
  lieu: string;
  livreurId: string;
}

export function lireScans(chemin: string): Scan[] {
  const { entete, lignes } = lireLignes(chemin);
  const c = (n: string) => { const i = entete.indexOf(n); if (i === -1) throw new Error(`colonne absente : ${n}`); return i; };
  const iId = c("id"), iSuivi = c("numero_suivi"), iH = c("horodatage"), iType = c("type"), iLieu = c("lieu"), iLiv = c("livreur_id");
  return lignes.map(l => ({ id: l[iId], numeroSuivi: l[iSuivi], horodatage: l[iH], type: l[iType], lieu: l[iLieu], livreurId: l[iLiv] }));
}

// Le plus récent de deux scans : l'horodatage le plus grand ; à égalité, celui enregistré en dernier.
export function plusRecent(a: Scan, b: Scan): boolean {
  if (a.horodatage !== b.horodatage) return a.horodatage > b.horodatage;
  return a.id > b.id;
}

// Le dernier scan d'un colis, ou null si le numéro est inconnu.
export function dernierScan(scans: Scan[], numero: string): Scan | null {
  const trouves = scans.filter(s => s.numeroSuivi === numero);
  if (trouves.length === 0) return null;
  let dernier = trouves[0];
  for (const s of trouves) if (plusRecent(s, dernier)) dernier = s;
  return dernier;
}
