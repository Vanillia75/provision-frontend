// ─────────────────────────────────────────────────────────────────────────────
//  jobOffers.mock.js — Service MOCK des offres pour « Trouver des heures ».
//
//  V1 : 100 % données mockées. AUCUN appel réseau, aucun scraping, aucun credential.
//  La signature de `fetchIntermittentJobOffers(filtres)` est déjà celle de la future
//  API réelle : le jour où on branche France Travail (chantier séparé, cf.
//  francetravail.adapter.js), on remplace le corps de cette fonction par un appel à
//  l'adaptateur — l'UI (TrouverDesHeures.jsx) n'a rien à changer.
//
//  ISOLATION : ce fichier n'importe RIEN (ni moteur 507h, ni cockpit, ni état appli).
//  Une offre ne promet JAMAIS de compter automatiquement pour le renouvellement.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} JobOffer
 * @property {string} id            Identifiant unique de l'offre.
 * @property {string} title         Intitulé du poste / de la mission.
 * @property {"artiste"|"technicien"|"admin"|"autre"} roleType  Famille de métier.
 * @property {"cachet"|"heures"|"CDDU"|"mission"} contractType   Nature du contrat.
 * @property {string} location      Ville / lieu lisible (ex. "Paris 18e").
 * @property {string} region        Région (ex. "Île-de-France").
 * @property {string} source        Nom de la source (ex. "France Travail", "Mock").
 * @property {string} sourceUrl     URL vers l'offre d'origine (ouverte dans un onglet).
 * @property {string} publishedAt   Date de publication au format ISO "YYYY-MM-DD".
 * @property {string} [description] Description optionnelle, courte.
 */

/** @type {JobOffer[]} — jeu d'exemples représentatif (métiers, contrats, régions variés). */
const MOCK_OFFERS = [
  {
    id: "mock-1",
    title: "Comédien·ne pour spectacle jeune public",
    roleType: "artiste",
    contractType: "cachet",
    location: "Paris 11e",
    region: "Île-de-France",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-07-02",
    description: "Série de représentations en tournée régionale, 8 cachets sur 3 semaines.",
  },
  {
    id: "mock-2",
    title: "Régisseur·se lumière, festival d'été",
    roleType: "technicien",
    contractType: "CDDU",
    location: "Avignon",
    region: "Provence-Alpes-Côte d'Azur",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-07-01",
    description: "Montage, exploitation et démontage sur 10 jours. Expérience plateau demandée.",
  },
  {
    id: "mock-3",
    title: "Technicien·ne son, captation concert",
    roleType: "technicien",
    contractType: "heures",
    location: "Lyon",
    region: "Auvergne-Rhône-Alpes",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-06-28",
    description: "Une journée de captation multipistes en salle. Matériel fourni.",
  },
  {
    id: "mock-4",
    title: "Danseur·se contemporain·e, création",
    roleType: "artiste",
    contractType: "cachet",
    location: "Nantes",
    region: "Pays de la Loire",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-06-25",
    description: "Résidence de création puis 5 dates. Répétitions rémunérées.",
  },
  {
    id: "mock-5",
    title: "Chargé·e de production, compagnie théâtrale",
    roleType: "admin",
    contractType: "mission",
    location: "Bordeaux",
    region: "Nouvelle-Aquitaine",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-06-24",
    description: "Suivi administratif d'une tournée. Connaissance des annexes appréciée.",
  },
  {
    id: "mock-6",
    title: "Machiniste·plateau, opéra",
    roleType: "technicien",
    contractType: "CDDU",
    location: "Paris 9e",
    region: "Île-de-France",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-06-20",
    description: "Renfort plateau sur une production lyrique. Plusieurs services.",
  },
  {
    id: "mock-7",
    title: "Musicien·ne intermittent·e, bal / événementiel",
    roleType: "artiste",
    contractType: "cachet",
    location: "Toulouse",
    region: "Occitanie",
    source: "Mock",
    sourceUrl: "https://www.francetravail.fr/spectacle/",
    publishedAt: "2026-06-18",
    description: "Prestations ponctuelles en formation variable. Répertoire varié.",
  },
];

/**
 * Récupère les offres utiles à un·e intermittent·e.
 *
 * Signature FIGÉE, identique à la future API réelle : le branchement France Travail
 * (francetravail.adapter.js) se fera ici, sans toucher à l'UI.
 *
 * @param {Object} [filtres]
 * @param {"artiste"|"technicien"|"admin"|"autre"} [filtres.roleType]  Filtre métier.
 * @param {string} [filtres.region]                                    Filtre région (libellé exact).
 * @param {"cachet"|"heures"|"CDDU"|"mission"} [filtres.contractType]  Filtre type de contrat.
 * @param {"empty"|"error"} [filtres._simulate]  DEV UNIQUEMENT : force un état vide/erreur pour tester l'UI.
 * @returns {Promise<JobOffer[]>}
 */
export async function fetchIntermittentJobOffers(filtres = {}) {
  // Pas de latence simulée : un setTimeout peut être GELÉ par Chrome en onglet
  // d'arrière-plan et bloquer le spinner indéfiniment. On renvoie directement
  // (la fonction reste async → signature identique à la future API réelle).

  // Crochets de test des états de l'écran (jamais utilisés en usage normal).
  if (filtres._simulate === "error") {
    throw new Error("Impossible de récupérer les offres pour le moment.");
  }
  if (filtres._simulate === "empty") {
    return [];
  }

  const { roleType, region, contractType } = filtres;
  return MOCK_OFFERS.filter((o) => {
    if (roleType && o.roleType !== roleType) return false;
    if (region && o.region !== region) return false;
    if (contractType && o.contractType !== contractType) return false;
    return true;
  });
}

/** Régions présentes dans le jeu mock — sert à alimenter le filtre région. */
export function regionsDisponibles() {
  return [...new Set(MOCK_OFFERS.map((o) => o.region))].sort((a, b) => a.localeCompare(b, "fr"));
}
