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
    libelle: "Plafond d'heures de formation suivie assimilées",
    source: "Unédic — annexes VIII et X au règlement d'assurance chômage (heures de formation assimilées dans la limite des 2/3 du nombre d'heures requis) ; ARTCENA, Précis juridique annexes VIII et X. Sourcé le 2026-07-03.",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Les heures de formation SUIVIE comptent comme des heures de travail dans la limite des 2/3 du seuil requis : 2/3 × 507 = 338h. Plafond GLOBAL sur la fenêtre de 12 mois (pas par formation). Conséquence : la formation seule ne peut jamais ouvrir des droits (338 < 507). NB : l'enseignement DISPENSÉ (70h, 120h si ≥50 ans) est une règle distincte, volontairement NON codée pour l'instant.",
  },

  enseignementPlafond: {
    valeur: 70,
    libelle: "Plafond d'heures d'enseignement dispensé assimilées",
    source: "Guide France Travail Intermittents p.8-9 (enseignement limité à 70h, 120h si ≥50 ans ; total formation + enseignement ≤ 338h). Sourcé le 2026-07-03.",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "Heures d'enseignement dispensé comptées heure pour heure, plafonnées à 70h, ET plafond partagé de 338h avec la formation. Cas 120h (≥50 ans) HORS V1 (pas de date de naissance). Estimation (conditions FT non vérifiables).",
  },
  congesSpectaclesTaux: {
    valeur: 0.10,
    libelle: "Taux de l'indemnité Congés Spectacles (ICP) — % des bruts de l'exercice",
    source: "Audiens ; backtesté sur 2 bordereaux réels (2023-2024, 2024-2025) : ICP brut = 10 % des bruts au centime. Cf. CONGES_SPECTACLES_ETUDE.md.",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "ICP = 10 % des salaires bruts cumulés sur l'exercice (1er avril → 31 mars). Validé au centime sur 2 années. Estimation à l'écran (dépend de la complétude des bruts saisis).",
  },
  congesSpectaclesRatioNetSocial: {
    valeur: 0.7695,
    libelle: "Ratio net social / brut de l'ICP Congés Spectacles",
    source: "Bordereaux Audiens 2023-2024 et 2024-2025 : net/brut = 76,95 % (identique les 2 années). Cf. CONGES_SPECTACLES_ETUDE.md.",
    version: "2026.07",
    dateAppli: "2025",
    verifie: true,
    commentaire: "Net social (avant impôts) ≈ 76,95 % de l'ICP brute. PÉREMPTION ANNUELLE (les taux peuvent bouger). Net-net (après PAS) jamais estimé. Prudence : afficher « ~ ».",
  },
  assimilationArretParJour: {
    valeur: 5,
    libelle: "Heures assimilées par jour d'arrêt (maternité, adoption, AT/MP, ALD, suspension de contrat)",
    source: "Guide France Travail Intermittents p.8 et p.9 ; matermittentes.com. Sourcé le 2026-07-03 — cf. MOTEUR_ARRETS_SOURCES.md.",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "5h par jour calendaire (week-ends inclus), SANS plafond, pour les arrêts INDEMNISÉS assimilés. Maladie ordinaire hors contrat et paternité : hors périmètre V1 (neutralisation). Conditions non vérifiables par le moteur → apport marqué ESTIMATION.",
  },
  ajMinimale: {
    valeur: 31.96,
    libelle: "Allocation journalière minimale (paramètre de calcul)",
    source: "Unédic — Paramètres utiles avril 2025 ; Guide France Travail Intermittents (31,96 € depuis le 01/07/2023). Cf. MOTEUR_AJ_SOURCES.md.",
    version: "2026.07",
    dateAppli: "2023-07-01",
    verifie: true,
    commentaire: "Paramètre fixe des formules A, B, C de l'AJ. Évolue avec le SMIC : à réviser à chaque revalorisation (dernier contrôle 2026-07-03). Validé par backtest réel à 0,00 € d'écart (cf. MOTEUR_AJ_SOURCES.md §6).",
  },

  // ── MOTEUR ALLOCATION JOURNALIÈRE (chantier AJ — cf. MOTEUR_AJ_SOURCES.md backend) ──
  // Jumeau des règles Python. Source : Guide officiel France Travail Intermittents
  // p.11/12/16-17 ; Unédic Paramètres utiles avril 2025. Backtest réel n°1 : 0,00 € d'écart.
  allocationParametresAnnexe8: {
    valeur: {
      coefSR: 0.42, plafondSR: 14400, coefSRAuDela: 0.05, diviseurA: 5000,
      coefNHT: 0.26, seuilNHT: 720, coefNHTAuDela: 0.08, diviseurB: 507,
      coefC: 0.40, plancherAJ: 38.0, diviseurSJM: 8,
      seuilJoursMois: 26, coefDecalage: 1.4,
    },
    libelle: "Paramètres de l'allocation journalière — annexe 8 (techniciens)",
    source: "Guide France Travail Intermittents p.11, 12, 16-17 (exemples 6 et 12 vérifiés)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "A = AJmin×[0,42×SR(≤14400)+0,05×au-delà]/5000 ; B = AJmin×[0,26×NHT(≤720h)+0,08×au-delà]/507 ; C = AJmin×0,40. Plancher 38 €. SJM = SR/(NHT/8). Mois : jours travaillés = heures/8, seuil 26 j, décalage ×1,4.",
  },
  allocationParametresAnnexe10: {
    valeur: {
      coefSR: 0.36, plafondSR: 13700, coefSRAuDela: 0.05, diviseurA: 5000,
      coefNHT: 0.26, seuilNHT: 690, coefNHTAuDela: 0.08, diviseurB: 507,
      coefC: 0.70, plancherAJ: 44.0, diviseurSJM: 10,
      seuilJoursMois: 27, coefDecalage: 1.3,
    },
    libelle: "Paramètres de l'allocation journalière — annexe 10 (artistes)",
    source: "Guide France Travail Intermittents p.11, 12, 16-17 ; backtest réel 0,00 € d'écart (2026-07-03)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "A = AJmin×[0,36×SR(≤13700)+0,05×au-delà]/5000 ; B = AJmin×[0,26×NHT(≤690h)+0,08×au-delà]/507 ; C = AJmin×0,70. Plancher 44 €. SJM = SR/(NHT/10). Mois : jours travaillés = heures/10, seuil 27 j, décalage ×1,3.",
  },
  allocationPlafondAJ: {
    valeur: 174.80,
    libelle: "Plafond de l'allocation journalière (annexes 8 et 10)",
    source: "Guide France Travail Intermittents p.11 (depuis le 01/01/2024)",
    version: "2026.07",
    dateAppli: "2024-01-01",
    verifie: true,
    commentaire: "L'AJ calculée ne peut dépasser ce montant. Revalorisé périodiquement : à réviser.",
  },
  allocationRetenueRetraiteComp: {
    valeur: { taux: 0.0093, seuilExoneration: 31.96, seuilCsg: 60.0 },
    libelle: "Retenue retraite complémentaire sur l'AJ (0,93 % du SJM)",
    source: "Guide France Travail Intermittents p.12 ; validé par backtest réel (retenue 1,25 € exacte)",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: true,
    commentaire: "AJ ≤ 31,96 € : aucune retenue. 31,96 < AJ ≤ 60 € : retenue 0,93 % × SJM. AJ > 60 € : s'ajoutent CSG et CRDS (cf. allocationCsgCrds).",
  },
  allocationCsgCrds: {
    valeur: { csgPlein: 0.062, csgReduit: 0.038, crds: 0.005, assiette: 0.9825 },
    libelle: "CSG/CRDS sur l'AJ au-delà de 60 €",
    source: "Guide France Travail p.12 (taux) ; assiette 98,25 % = règle générale CSG — À CONFIRMER pour l'ARE spectacle",
    version: "2026.07",
    dateAppli: "en vigueur",
    verifie: false,
    commentaire: "Taux sourcés (6,2 % ou 3,8 % selon revenu fiscal, CRDS 0,5 %) mais l'assiette exacte et les arrondis ne sont pas confirmés par un cas réel : le moteur doit marquer le net comme ESTIMATION quand l'AJ dépasse 60 €, tant qu'un backtest réel n'a pas validé cette branche.",
  },
  pmssMensuel: {
    valeur: { montant: 3925.0, annee: 2025, coefPlafondCumul: 1.18 },
    libelle: "Plafond mensuel de la sécurité sociale (pour le plafond de cumul ARE + salaires)",
    source: "Unédic — Paramètres utiles avril 2025 (PMSS 2025 = 3 925 €) ; guide FT p.17 (cumul ≤ 118 % du PMSS)",
    version: "2026.07",
    dateAppli: "2025-01-01",
    verifie: true,
    commentaire: "Cumul mensuel ARE + rémunérations brutes plafonné à 118 % du PMSS. Valeur 2025 — à réviser chaque 1er janvier (l'exemple 12 du guide utilise le PMSS 2024 = 3 864 € → plafond 4 559,52 €, vérifié).",
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
