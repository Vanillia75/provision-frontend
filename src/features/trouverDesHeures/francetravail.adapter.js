// ─────────────────────────────────────────────────────────────────────────────
//  francetravail.adapter.js — STUB de la future API France Travail « Offres d'emploi ».
//
//  ⚠️ V1 : CE FICHIER NE FAIT AUCUN APPEL RÉSEAU. Aucun credential, aucun token ici.
//  Il documente seulement la forme du branchement à venir pour que le jour J on
//  n'ait qu'à remplir les trous — SANS toucher à l'UI ni au service mock.
//
//  Le branchement réel est un CHANTIER SÉPARÉ, cadré à part, APRÈS validation de la
//  V1 mockée. Les credentials OAuth existent (variables d'env Railway côté backend) :
//  l'appel devra passer par NOTRE backend (jamais un secret côté navigateur).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mappe une offre BRUTE de l'API France Travail vers notre modèle {@link JobOffer}.
 * (Rempli lors du chantier de branchement — ici, squelette indicatif seulement.)
 *
 * Repères API (pour mémoire, NON câblés) :
 *   - API « Offres d'emploi v2 » ; auth OAuth2 client_credentials (côté backend).
 *   - Recherche par codes ROME du spectacle (ex. L1203, L1304, L1509, L1508…).
 *   - Champ brut → notre champ : intitule→title, lieuTravail.libelle→location,
 *     typeContrat→contractType, dateCreation→publishedAt, origineOffre.urlOrigine→sourceUrl.
 *
 * @param {Object} raw  Offre brute renvoyée par l'API France Travail.
 * @returns {import("./jobOffers.mock").JobOffer}
 */
export function mapOffreFTToJobOffer(raw) {
  // TODO(branchement API) : implémenter le mapping réel à partir du schéma FT.
  throw new Error("mapOffreFTToJobOffer : non implémenté (V1 mockée).");
}

/**
 * Point d'entrée réel — MÊME signature que fetchIntermittentJobOffers du mock, pour
 * pouvoir substituer l'un à l'autre sans changer l'UI. NON câblé en V1.
 *
 * @param {Object} [filtres]
 * @returns {Promise<import("./jobOffers.mock").JobOffer[]>}
 */
export async function fetchOffresFranceTravail(filtres = {}) {
  // TODO(branchement API) : appeler NOTRE backend (qui détient l'OAuth), puis
  // return (reponse.resultats || []).map(mapOffreFTToJobOffer);
  throw new Error("fetchOffresFranceTravail : API non branchée (chantier séparé).");
}
