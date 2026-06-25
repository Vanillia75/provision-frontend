/**
 * ════════════════════════════════════════════════════════════════════════
 *  RÉFÉRENTIEL DES RÈGLES DU RÉGIME INTERMITTENT DU SPECTACLE
 * ════════════════════════════════════════════════════════════════════════
 *
 *  Ce fichier est l'UNIQUE source de vérité pour tous les paramètres
 *  réglementaires utilisés par Hector. Aucun chiffre "magique" ne doit
 *  vivre ailleurs dans le code : tout passe par ici.
 *
 *  Chaque règle porte :
 *    - valeur      : la valeur appliquée
 *    - libelle     : nom humain de la règle
 *    - source      : texte officiel d'où elle vient
 *    - version     : version de la réglementation appliquée
 *    - dateAppli   : date d'entrée en vigueur connue
 *    - verifie     : true seulement si validé par un expert du régime.
 *                    false = valeur issue de lectures officielles mais
 *                    PAS encore confirmée par un conseiller / juriste.
 *    - commentaire : à quoi sert la règle, en langage clair.
 *
 *  OBJECTIF : quand Hector donne un résultat, il peut citer la règle,
 *  sa source et sa version. La confiance est dans l'architecture.
 *
 *  ⚠️  Tant que verifie=false, Hector doit rester prudent dans sa
 *      formulation (pas d'affirmation définitive sur les montants).
 *
 *  Dernière revue documentaire : 2026-06 (sources : Unédic, France Travail
 *  Guide Intermittent, Circulaire Unédic n°2018-04).
 * ════════════════════════════════════════════════════════════════════════
 */

export const VERSION_REFERENTIEL = {
  version: "2026.06",
  revue: "2026-06-25",
  note: "Revue documentaire. Validation experte du régime non encore réalisée.",
};

export const REGLES = {

  // ─────────────────────────────────────────────────────────────
  //  OUVERTURE / RENOUVELLEMENT DES DROITS
  // ─────────────────────────────────────────────────────────────

  seuilHeures: {
    valeur: 507,
    libelle: "Seuil d'ouverture de droits",
    source: "Annexes 8 et 10 au règlement d'assurance chômage ; Unédic",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "Nombre minimal d'heures de travail (ou assimilées) à réunir pour ouvrir des droits. " +
      "Condition centrale du régime.",
  },

  periodeReferenceJours: {
    valeur: 365,
    libelle: "Période de référence (première admission)",
    source: "Annexes 8 et 10 ; Unédic",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "Les 507h se cherchent sur les 12 mois (365 jours) précédant la dernière fin " +
      "de contrat retenue pour l'ouverture des droits.",
  },

  periodeReferenceReadmissionJours: {
    valeur: 304, // ~10 mois
    libelle: "Période de référence (réadmission)",
    source: "France Travail — Guide Intermittent",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "Lors d'une réadmission, les 507h se recherchent sur les 10 mois précédant la fin " +
      "de contrat. ⚠️ Valeur en jours à confirmer (10 mois ≈ 304 j, mais le décompte exact " +
      "peut différer selon les cas).",
  },

  dureeIndemnisationJours: {
    valeur: 365,
    libelle: "Durée d'indemnisation",
    source: "Unédic ; France Travail",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "Une fois les droits ouverts, l'indemnisation court 12 mois jusqu'à la 'date " +
      "anniversaire' (lendemain du dernier jour travaillé ayant ouvert les droits).",
  },

  // ─────────────────────────────────────────────────────────────
  //  CONVERSION CACHETS → HEURES
  // ─────────────────────────────────────────────────────────────

  cachetHeures: {
    valeur: 12,
    libelle: "Forfait d'un cachet (artiste, annexe 10)",
    source: "France Travail — Guide Intermittent ; ipresta.fr (annexe 10)",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    statut: "validé provisoirement — à confirmer par expert terrain",
    commentaire:
      "RÈGLE ACTUELLE retenue par Hector : un cachet d'artiste (annexe 10) compte pour 12h " +
      "dans le décompte des droits. 43 cachets = 516h. Les techniciens (annexe 8) sont " +
      "décomptés à l'heure réelle. Hector applique 12h à TOUS les cachets, par prudence, " +
      "tant qu'aucun expert n'a confirmé un autre forfait.",
  },

  cachetGroupeHeures_HISTORIQUE: {
    valeur: 8,
    libelle: "Cachet groupé = 8h — RÈGLE HISTORIQUE, NE PAS UTILISER",
    source: "Wikipédia (source secondaire) — convention ancienne",
    version: "obsolète",
    dateAppli: "ancienne convention",
    verifie: false,
    aValiderUrgent: true,
    nePasUtiliser: true,
    commentaire:
      "⚠️ HISTORIQUE — conservé uniquement pour mémoire. La règle 'cachet groupé consécutif = 8h' " +
      "provient d'une source secondaire et correspond vraisemblablement à une convention " +
      "antérieure. Elle N'EST PAS utilisée dans le calcul actuel d'Hector (décision : tous " +
      "les cachets à 12h). À clarifier avec un conseiller France Travail Spectacle avant " +
      "toute réintroduction.",
  },

  // ─────────────────────────────────────────────────────────────
  //  CLAUSE DE RATTRAPAGE
  // ─────────────────────────────────────────────────────────────

  rattrapageSeuilMin: {
    valeur: 338,
    libelle: "Seuil minimal de la clause de rattrapage",
    source: "Circulaire Unédic n°2018-04 du 07/02/2018",
    version: "2026.06",
    dateAppli: "2018-02-07",
    verifie: false,
    commentaire:
      "Si à la date anniversaire l'intermittent a entre 338h et 506h, la clause de " +
      "rattrapage peut prolonger la période pour compléter les heures manquantes.",
  },

  rattrapageDureeMois: {
    valeur: 6,
    libelle: "Durée maximale de la clause de rattrapage",
    source: "Circulaire Unédic n°2018-04",
    version: "2026.06",
    dateAppli: "2018-02-07",
    verifie: false,
    commentaire:
      "6 mois maximum pour compléter les heures manquantes. La date anniversaire reste " +
      "inchangée. Décision irrévocable une fois activée.",
  },

  rattrapageOuverturesMin: {
    valeur: 5,
    libelle: "Condition d'éligibilité — ouvertures de droits",
    source: "Circulaire Unédic n°2018-04",
    version: "2026.06",
    dateAppli: "2018-02-07",
    verifie: false,
    commentaire:
      "Éligibilité stricte à la clause : avoir au moins 338h ET 5 ouvertures de droits " +
      "sur les 10 dernières années.",
  },

  // ─────────────────────────────────────────────────────────────
  //  HEURES ASSIMILÉES (maladie, maternité, formation)
  // ─────────────────────────────────────────────────────────────

  formationPlafondNouvelleAdmission: {
    valeur: 338,
    libelle: "Plafond d'heures de formation assimilées (nouvelle admission)",
    source: "France Travail ; Unédic",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "Les heures de formation comptent comme assimilées jusqu'à 2/3 du total requis, " +
      "soit 338h pour une nouvelle admission. Exclues si indemnisées par l'assurance chômage.",
  },

  // ─────────────────────────────────────────────────────────────
  //  ALLOCATION JOURNALIÈRE (AJ) — ⚠️ NON UTILISÉ PAR HECTOR POUR L'INSTANT
  //  Hector ne calcule pas les montants en euros (choix produit).
  //  Ces paramètres sont documentés ici pour le jour où on les ajoutera,
  //  mais ils sont TOUS à valider par un expert avant tout usage.
  // ─────────────────────────────────────────────────────────────

  ajMinimale: {
    valeur: 31.96,
    libelle: "Allocation journalière minimale (paramètre de calcul)",
    source: "Unédic — Paramètres Utiles, avril 2025",
    version: "2026.06",
    dateAppli: "2025-04",
    verifie: false,
    commentaire:
      "Paramètre fixe entrant dans la formule de l'AJ (parties A, B, C). Confirmé à 31,96 € " +
      "dans les paramètres Unédic d'avril 2025 (partie fixe annexe 8 = 0,4 × 31,96 = 12,78 € ; " +
      "annexe 10 = 0,7 × 31,96 = 22,37 €). Évolue avec le SMIC. ⚠️ Hector ne calcule pas " +
      "les euros : ne pas utiliser sans validation experte.",
  },

  ajPlancherAnnexe8: {
    valeur: 38,
    libelle: "Plancher de l'AJ — annexe 8",
    source: "Unédic",
    version: "2026.06",
    dateAppli: "à confirmer",
    verifie: false,
    commentaire: "Montant journalier minimum, ouvriers et techniciens. À valider.",
  },

  ajPlancherAnnexe10: {
    valeur: 44,
    libelle: "Plancher de l'AJ — annexe 10",
    source: "Unédic",
    version: "2026.06",
    dateAppli: "à confirmer",
    verifie: false,
    commentaire: "Montant journalier minimum, artistes. À valider.",
  },

  // ─────────────────────────────────────────────────────────────
  //  FRANCHISES & SEUILS MENSUELS
  // ─────────────────────────────────────────────────────────────

  franchiseCongesParJours: {
    valeur: { jours: 2.5, parTravailles: 24, plafond: 30 },
    libelle: "Franchise congés payés",
    source: "Unédic — Dossier de synthèse",
    version: "2026.06",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire:
      "2,5 jours non indemnisés tous les 24 jours travaillés, plafonnés à 30 jours. " +
      "Ne prolonge pas le droit.",
  },

  seuilJoursTravaillesAnnexe8: {
    valeur: 26,
    libelle: "Seuil de jours travaillés mensuel — annexe 8",
    source: "Wikipédia / réforme ; à confirmer Unédic",
    version: "2026.06",
    dateAppli: "à confirmer",
    verifie: false,
    commentaire: "Plafond de jours travaillés par mois, annexe 8. À valider.",
  },

  seuilJoursTravaillesAnnexe10: {
    valeur: 27,
    libelle: "Seuil de jours travaillés mensuel — annexe 10",
    source: "Wikipédia / réforme ; à confirmer Unédic",
    version: "2026.06",
    dateAppli: "à confirmer",
    verifie: false,
    commentaire: "Plafond de jours travaillés par mois, annexe 10. À valider.",
  },
};

/**
 * Indique si les règles-clés du calcul des heures (seuil, conversion cachet,
 * période de référence) ont toutes été validées par un expert.
 * Tant que ce n'est pas le cas, le badge de confiance reste "fiable" (pas "certain").
 * Le jour où tu passes ces règles à verifie:true, le badge bascule tout seul.
 */
export function moteurHeuresValide() {
  const clesCles = ["seuilHeures", "cachetHeures", "periodeReferenceJours"];
  return clesCles.every((c) => REGLES[c] && REGLES[c].verifie === true);
}

/**
 * Renvoie une règle avec sa traçabilité complète.
 * Usage : const seuil = getRegle("seuilHeures");  → { valeur, source, version, ... }
 */
export function getRegle(cle) {
  const r = REGLES[cle];
  if (!r) {
    console.warn(`[regles_intermittent] Règle inconnue : "${cle}"`);
    return null;
  }
  return r;
}

/**
 * Renvoie juste la valeur d'une règle (raccourci pour les calculs).
 * Usage : seuilHeures = valeurDe("seuilHeures");  → 507
 */
export function valeurDe(cle) {
  const r = REGLES[cle];
  return r ? r.valeur : null;
}

/**
 * Construit une phrase de traçabilité pour le bouton "Pourquoi ?".
 * Usage : tracer("seuilHeures")
 *   → "Règle : Seuil d'ouverture de droits (507). Source : Annexes 8 et 10…,
 *      version 2026.06."
 */
export function tracer(cle) {
  const r = REGLES[cle];
  if (!r) return "";
  const valeurTxt = typeof r.valeur === "object" ? JSON.stringify(r.valeur) : r.valeur;
  const fiabilite = r.verifie ? "" : " (valeur documentée, validation experte en cours)";
  return `${r.libelle} : ${valeurTxt}. Source : ${r.source}, version ${r.version}${fiabilite}.`;
}
