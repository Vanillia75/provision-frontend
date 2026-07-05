// ─────────────────────────────────────────────────────────────────────────────
//  francetravail.adapter.js — Source de données réelle du module.
//
//  Le front NE parle QU'À NOTRE backend (`/intermittent/offres`), jamais à France
//  Travail directement, et ne voit jamais aucun credential (ils restent côté serveur).
//  Le backend fait l'OAuth, interroge FT, mappe vers JobOffer et cache le résultat.
//
//  FALLBACK : si le backend renvoie une erreur, on LÈVE — l'écran affiche son état
//  d'erreur. On ne retombe JAMAIS sur des mocks présentés comme de vraies offres.
// ─────────────────────────────────────────────────────────────────────────────
import { API_BASE } from "../../config";

/**
 * Récupère les offres réelles via notre backend. Signature identique au mock.
 *
 * @param {Object} [filtres]
 * @param {"artiste"|"technicien"|"admin"} [filtres.roleType]
 * @param {"cachet"|"CDDU"|"heures"|"mission"} [filtres.contractType]
 * @param {string} [filtres.lieu]   Ville ou département tapé par l'utilisateur.
 * @param {number} [filtres.rayon]  Rayon en km autour de la ville.
 * @returns {Promise<import("./jobOffers.mock").JobOffer[]>}
 */
export async function fetchOffresFranceTravail(filtres = {}) {
  const q = new URLSearchParams();
  if (filtres.roleType) q.set("role_type", filtres.roleType);
  if (filtres.contractType) q.set("contract_type", filtres.contractType);
  if (filtres.lieu) q.set("lieu", filtres.lieu);
  if (filtres.rayon) q.set("rayon", String(filtres.rayon));

  const resp = await fetch(`${API_BASE}/intermittent/offres?${q.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    // Erreur backend/FT → on laisse remonter (l'UI montrera son état d'erreur).
    throw new Error(`Offres indisponibles (${resp.status}).`);
  }
  const data = await resp.json();
  return Array.isArray(data?.offres) ? data.offres : [];
}
