// ============================================================================
//  fiscalite.js — Règles fiscales et sociales des micro-entrepreneurs
// ============================================================================
//  RÈGLE D'OR : Hector ne doit JAMAIS inventer en fiscalité.
//  Toutes les valeurs ici sont sourcées. Si une situation sort du cadre micro
//  (dépassement de seuil, ACRE incertaine, activité mixte, CIPAV, régime réel),
//  le moteur doit afficher "À vérifier selon ton régime exact" plutôt que deviner.
//
//  Pour mettre à jour Hector chaque année : modifier UNIQUEMENT ce fichier.
//  Le moteur de décision (App.jsx) lit ces règles, il ne les code jamais en dur.
// ============================================================================

export const FISCALITE = {
  version: "2026.1",
  dateValidite: "2026-01-01",
  derniereVerification: "2026-06-24",
  avertissement:
    "Ces calculs sont des estimations basées sur le régime micro-entrepreneur. " +
    "Ils ne remplacent pas l'avis d'un expert-comptable. Certaines situations " +
    "(ACRE, activité mixte, CIPAV, DOM, dépassement de seuil) peuvent modifier ces montants.",

  // ──────────────────────────────────────────────────────────────────────
  //  RÉGIMES : cotisations sociales, abattement fiscal, plafond CA, seuil TVA
  // ──────────────────────────────────────────────────────────────────────
  regimes: {
    vente: {
      id: "vente",
      label: "Vente de marchandises (BIC)",
      // Cotisations sociales URSSAF 2026
      tauxCotisations: 0.123, // 12,3 %
      sourceCotisations: "URSSAF / Service-Public.fr — vérifié 01/2026",
      // Abattement forfaitaire pour le calcul de l'impôt sur le revenu
      abattementFiscal: 0.71, // 71 %
      sourceAbattement: "service-public.fr (abattement micro-BIC vente)",
      // Plafond de chiffre d'affaires annuel (régime micro)
      plafondCA: 203100, // € — valeur 2026
      sourcePlafond: "economie.gouv.fr — seuils micro 2026",
      // Seuil de franchise en base de TVA (au-delà : TVA à facturer)
      seuilTVA: 85000, // €
      sourceTVA: "Franchise en base TVA — seuil vente 2026",
      // Versement libératoire de l'IR (option) : taux ajouté au CA
      tauxVersementLiberatoire: 0.01, // 1 %
    },
    services: {
      id: "services",
      label: "Prestations de services (BIC)",
      tauxCotisations: 0.212, // 21,2 %
      sourceCotisations: "URSSAF / Service-Public.fr — vérifié 01/2026",
      abattementFiscal: 0.50, // 50 %
      sourceAbattement: "service-public.fr (abattement micro-BIC services)",
      plafondCA: 83600, // € — valeur 2026
      sourcePlafond: "economie.gouv.fr — seuils micro 2026",
      seuilTVA: 37500, // €
      sourceTVA: "Franchise en base TVA — seuil services 2026",
      tauxVersementLiberatoire: 0.017, // 1,7 %
    },
    bnc: {
      id: "bnc",
      label: "Profession libérale (BNC)",
      // ⚠️ Hausse 2026 : passé de 24,6 % (2025) à 25,6 % au 01/01/2026
      tauxCotisations: 0.256, // 25,6 %
      sourceCotisations:
        "URSSAF — autoentrepreneur.urssaf.fr : taux BNC porté de 24,6 % à 25,6 % au 01/01/2026",
      abattementFiscal: 0.34, // 34 %
      sourceAbattement: "service-public.fr (abattement micro-BNC)",
      plafondCA: 83600, // € — valeur 2026
      sourcePlafond: "economie.gouv.fr — seuils micro 2026",
      seuilTVA: 37500, // €
      sourceTVA: "Franchise en base TVA — seuil BNC 2026",
      tauxVersementLiberatoire: 0.022, // 2,2 %
    },
  },

  // ──────────────────────────────────────────────────────────────────────
  //  ACRE : exonération partielle de cotisations la 1re année
  //  ⚠️ Changement au 01/07/2026 : exonération de 50 % → 25 %
  // ──────────────────────────────────────────────────────────────────────
  acre: {
    tauxExoneration_avant_01_07_2026: 0.50, // 50 % des cotisations exonérées
    tauxExoneration_apres_01_07_2026: 0.25, // 25 % seulement
    source: "economie.gouv.fr — ACRE : taux minoré porté de 50 % à 75 % au 01/07/2026",
    note: "L'ACRE dépend de la date de création. À vérifier selon le cas exact de l'utilisateur.",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  FORMATION : CFP versée (calculable) + droits ouverts (informatif)
  //  ⚠️ Hector estime la CFP versée (CA × taux), mais ne peut PAS donner le
  //  solde exact des droits CPF/FAF (visible seulement sur les plateformes
  //  officielles). Il informe et oriente, il n'invente jamais un montant.
  // ──────────────────────────────────────────────────────────────────────
  cfp: {
    vente: 0.001, // 0,1 % (commerçants)
    services: 0.002, // 0,2 % (prestations de services / libéral non réglementé)
    bnc: 0.002, // 0,2 % (professions libérales)
    artisan: 0.003, // 0,3 % (artisans)
    source: "URSSAF / service-public.fr — taux CFP 2026 (0,1 % à 0,3 % selon secteur)",
    note: "La CFP est prélevée avec les cotisations. Elle ouvre des droits formation.",
  },
  formation: {
    // Droits CPF (Compte Personnel de Formation) — plateforme moncompteformation.gouv.fr
    cpfCreditAnnuel: 500, // € crédités par an (année pleine, CA > 0)
    cpfPlafond: 5000, // € plafond total
    cpfResteACharge: 103.20, // € reste à charge par formation (réforme 2026)
    // Droits FAF (Fonds d'Assurance Formation) selon l'activité
    fafParActivite: {
      vente: "AGEFICE",
      services: "AGEFICE",
      bnc: "FIF-PL",
      artisan: "FAFCEA",
    },
    fafFourchette: "600 € à 1 400 € selon l'activité (parfois plus pour les formations certifiantes)",
    source: "service-public.fr, moncompteformation.gouv.fr — droits formation 2026",
    note: "Le solde EXACT n'est visible que sur moncompteformation.gouv.fr (CPF) et auprès du FAF. " +
      "Les droits FAF se remettent à zéro chaque année (à utiliser avant le 31 décembre).",
    plateformeCPF: "moncompteformation.gouv.fr",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  Helpers de lecture (le moteur n'accède jamais aux taux en dur)
  // ──────────────────────────────────────────────────────────────────────
};

// Récupère un régime par son id, avec fallback sûr sur "services"
export function getRegime(activiteId) {
  return FISCALITE.regimes[activiteId] || FISCALITE.regimes.services;
}

// Cotisations sociales URSSAF sur un CA donné
export function calcUrssaf(activiteId, ca) {
  const r = getRegime(activiteId);
  return Math.round(ca * r.tauxCotisations * 100) / 100;
}

// Revenu imposable après abattement forfaitaire
export function calcRevenuImposable(activiteId, ca) {
  const r = getRegime(activiteId);
  return Math.round(ca * (1 - r.abattementFiscal) * 100) / 100;
}

// Impôt estimé : versement libératoire OU barème via TMI
export function calcImpot(activiteId, ca, { versementLiberatoire = false, tmiPct = 0 } = {}) {
  const r = getRegime(activiteId);
  if (versementLiberatoire) {
    return Math.round(ca * r.tauxVersementLiberatoire * 100) / 100;
  }
  const imposable = calcRevenuImposable(activiteId, ca);
  return Math.round(imposable * (tmiPct / 100) * 100) / 100;
}

// Position vs plafond CA : { depasse, proche, restant, pct }
export function statutPlafond(activiteId, caAnnuel) {
  const r = getRegime(activiteId);
  const pct = r.plafondCA > 0 ? caAnnuel / r.plafondCA : 0;
  return {
    plafond: r.plafondCA,
    restant: Math.max(0, r.plafondCA - caAnnuel),
    pct,
    proche: pct >= 0.8 && pct < 1, // alerte à 80 %
    depasse: caAnnuel > r.plafondCA,
  };
}

// Position vs seuil TVA : { depasse, proche, restant }
export function statutTVA(activiteId, caAnnuel) {
  const r = getRegime(activiteId);
  return {
    seuil: r.seuilTVA,
    restant: Math.max(0, r.seuilTVA - caAnnuel),
    proche: caAnnuel >= r.seuilTVA * 0.9 && caAnnuel < r.seuilTVA,
    depasse: caAnnuel > r.seuilTVA,
  };
}
