/**
 * ════════════════════════════════════════════════════════════════════════
 *  RÉFÉRENTIEL DES RÈGLES DU RÉGIME INTERMITTENT DU SPECTACLE (frontend)
 * ════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  FICHIER GÉNÉRÉ AUTOMATIQUEMENT — NE PAS ÉDITER À LA MAIN.
 *  Source unique : regles_intermittent.py (backend). Ce fichier est produit
 *  par generer_regles_js.py. Pour changer une règle, modifie le .py.
 *  Toute édition manuelle ici sera écrasée à la prochaine génération.
 * ════════════════════════════════════════════════════════════════════════
 */

export const VERSION_REFERENTIEL = {
  version: "2026.07",
  revue: "2026-06-26",
  note: "Règles-clés du décompte des heures validées (source officielle + intermittente 20 ans). Montants et dispositifs annexes encore à valider.",
};

export const REGLES = {

  seuilHeures: {
    valeur: 507,
    libelle: "Seuil d'ouverture de droits",
    source: "Annexes 8 et 10 au règlement d'assurance chômage ; ARTCENA ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Heures minimales (ou assimilées) à réunir pour ouvrir des droits. Confirmé France Travail et ARTCENA.",
  },

  periodeReferenceJours: {
    valeur: 365,
    libelle: "Période de référence (première admission et réadmission)",
    source: "ARTCENA (annexes VIII et X) ; France Travail Guide Intermittent ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Les 507h se cherchent sur les 12 mois (365 jours) glissants précédant la dernière fin de contrat retenue. Vaut aussi pour la réadmission (date anniversaire au terme d'un délai de 12 mois). En réadmission, si les 507h ne sont pas atteintes, la période PEUT être allongée avec majoration (42h/30j au-delà du 365e jour) — cas spécial NON géré par le moteur pour l'instant.",
  },

  dureeIndemnisationJours: {
    valeur: 365,
    libelle: "Durée d'indemnisation",
    source: "Unédic ; France Travail ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Droits ouverts jusqu'à une date anniversaire (terme d'un délai de 12 mois après la fin de contrat ayant ouvert les droits), avec réexamen des droits à cette date.",
  },

  cachetHeures: {
    valeur: 12,
    libelle: "Forfait d'un cachet (artiste, annexe 10)",
    source: "Article 3 de l'annexe X ; ARTCENA ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Chaque cachet d'artiste (annexe 10) est systématiquement converti en 12h par France Travail (article 3 de l'annexe X). Il n'existe PLUS de distinction entre cachets isolés et groupés : tous comptent 12h. 43 cachets = 516h. Les techniciens (annexe 8) sont décomptés à l'heure réelle.",
  },

  cachetGroupeHeures_HISTORIQUE: {
    valeur: 8,
    libelle: "Cachet groupé = 8h — RÈGLE HISTORIQUE, NE PAS UTILISER",
    source: "Convention ancienne (abrogée) — conservée pour mémoire",
    version: "obsolète",
    dateAppli: "ancienne convention",
    verifie: false,
    aValiderUrgent: false,
    nePasUtiliser: true,
    commentaire: "⚠️ HISTORIQUE — conservé pour mémoire uniquement. La distinction 'cachet groupé = 8h' a été SUPPRIMÉE : France Travail convertit désormais TOUS les cachets à 12h (article 3 annexe X, confirmé ARTCENA). Cette règle n'est PAS utilisée dans le calcul.",
  },

  rattrapageSeuilMin: {
    valeur: 338,
    libelle: "Seuil minimal de la clause de rattrapage (filet)",
    source: "ARTCENA (annexes VIII et X) ; Circulaire Unédic n°2018-04 ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "2018-02-07",
    verifie: true,
    commentaire: "Au moins 338h au cours des 12 derniers mois précédant la date anniversaire : c'est UNE des deux conditions de la clause de rattrapage (voir rattrapageOuverturesMin pour la seconde). Avoir 338h NE SUFFIT PAS à lui seul.",
  },

  rattrapageDureeMois: {
    valeur: 6,
    libelle: "Durée maximale de la clause de rattrapage",
    source: "ARTCENA ; Circulaire Unédic n°2018-04 ; validé par intermittente (20 ans)",
    version: "2026.07",
    dateAppli: "2018-02-07",
    verifie: true,
    commentaire: "Période d'indemnisation maximale de 6 mois au titre de la clause. Date anniversaire inchangée. Décision irrévocable une fois activée.",
  },

  rattrapageOuverturesMin: {
    valeur: 5,
    libelle: "Condition d'éligibilité — ouvertures de droits (clause de rattrapage)",
    source: "ARTCENA (Précis juridique annexes VIII et X) ; Circulaire Unédic n°2018-04",
    version: "2026.07",
    dateAppli: "2018-02-07",
    verifie: true,
    commentaire: "SECONDE condition de la clause, CUMULATIVE avec les 338h : justifier d'au moins 5 années d'affiliation (5 × 507h) OU 5 ouvertures de droits au cours des 10 années précédant la fin de contrat. Le moteur ne dispose pas de l'historique des ouvertures : il ne doit donc PAS affirmer le filet acquis sur la seule base des 338h.",
  },

  formationPlafondNouvelleAdmission: {
    valeur: 338,
    libelle: "Plafond d'heures de formation assimilées (nouvelle admission)",
    source: "France Travail ; Unédic — à confirmer expert",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: false,
    frontOnly: true,
    commentaire: "Les heures de formation comptent comme assimilées jusqu'à 2/3 du total requis (≈338h pour une nouvelle admission). À confirmer par un expert avant tout usage.",
  },

  ajMinimale: {
    valeur: 31.96,
    libelle: "Allocation journalière minimale (paramètre de calcul)",
    source: "Unédic — Paramètres Utiles — à confirmer expert",
    version: "2026.07",
    dateAppli: "à confirmer",
    verifie: false,
    frontOnly: true,
    commentaire: "Paramètre fixe de la formule de l'AJ. Évolue avec le SMIC. Hector ne calcule pas les euros : ne pas utiliser sans validation experte.",
  },

  franchiseCongesParJours: {
    valeur: { jours: 2.5, parTravailles: 24, plafond: 30 },
    libelle: "Franchise congés payés",
    source: "Unédic ; ARTCENA — à confirmer expert",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: false,
    frontOnly: true,
    commentaire: "2,5 jours non indemnisés par tranche de 24 jours travaillés, plafonnés à 30 jours. À confirmer par un expert avant tout usage.",
  },

};

/**
 * Indique si les règles-clés du calcul des heures (seuil, conversion cachet,
 * période de référence) sont toutes validées. Si oui, le badge de confiance
 * peut basculer de "fiable" à "certain".
 */
export function moteurHeuresValide() {
  const clesCles = ["seuilHeures", "cachetHeures", "periodeReferenceJours"];
  return clesCles.every((c) => REGLES[c] && REGLES[c].verifie === true);
}

/** Renvoie une règle avec sa traçabilité complète, ou null. */
export function getRegle(cle) {
  const r = REGLES[cle];
  if (!r) {
    console.warn(`[regles_intermittent] Règle inconnue : "${cle}"`);
    return null;
  }
  return r;
}

/** Renvoie juste la valeur d'une règle (raccourci pour les calculs). */
export function valeurDe(cle) {
  const r = REGLES[cle];
  return r ? r.valeur : null;
}

/** Construit une phrase de traçabilité pour le bouton "Pourquoi ?". */
export function tracer(cle) {
  const r = REGLES[cle];
  if (!r) return "";
  const valeurTxt = typeof r.valeur === "object" ? JSON.stringify(r.valeur) : r.valeur;
  const fiabilite = r.verifie ? "" : " (valeur documentée, validation experte en cours)";
  return `${r.libelle} : ${valeurTxt}. Source : ${r.source}, version ${r.version}${fiabilite}.`;
}
