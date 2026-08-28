// ============================================================================
//  fiscalite.test.js : verrous sur les règles fiscales et sociales des AE
// ============================================================================
//  Ce fichier protège l'ARGENT des utilisateurs. Les taux et les seuils sont
//  des chiffres officiels : si l'un d'eux bouge par accident (faute de frappe,
//  copier-coller, mise à jour partielle), un test doit tomber immédiatement.
//
//  On teste le COMPORTEMENT, pas la présentation : les montants calculés, les
//  arrondis au centime, les cas limites (zéro, dépassement, activité inconnue).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  FISCALITE,
  getRegime,
  calcUrssaf,
  calcRevenuImposable,
  calcImpot,
  statutPlafond,
  statutTVA,
} from "./fiscalite";

// ────────────────────────────────────────────────────────────────────────────
//  1. LES CHIFFRES OFFICIELS (verrous anti-dérive)
// ────────────────────────────────────────────────────────────────────────────
describe("Les taux et seuils officiels 2026", () => {
  it("le référentiel annonce bien la version 2026.1 applicable au 01/01/2026", () => {
    expect(FISCALITE.version).toBe("2026.1");
    expect(FISCALITE.dateValidite).toBe("2026-01-01");
  });

  it("la vente de marchandises : 12,3 % de cotisations et 71 % d'abattement", () => {
    const r = FISCALITE.regimes.vente;
    expect(r.tauxCotisations).toBe(0.123);
    expect(r.abattementFiscal).toBe(0.71);
    expect(r.tauxVersementLiberatoire).toBe(0.01);
  });

  it("les prestations de services : 21,2 % de cotisations et 50 % d'abattement", () => {
    const r = FISCALITE.regimes.services;
    expect(r.tauxCotisations).toBe(0.212);
    expect(r.abattementFiscal).toBe(0.5);
    expect(r.tauxVersementLiberatoire).toBe(0.017);
  });

  it("le BNC applique bien la hausse 2026 : 25,6 % et non plus 24,6 %", () => {
    // Hausse au 01/01/2026. Retomber à 0,246 sous-estimerait les cotisations
    // de 1 point de CA, soit 300 € oubliés sur 30 000 € de chiffre d'affaires.
    const r = FISCALITE.regimes.bnc;
    expect(r.tauxCotisations).toBe(0.256);
    expect(r.tauxCotisations).not.toBe(0.246);
    expect(r.abattementFiscal).toBe(0.34);
    expect(r.tauxVersementLiberatoire).toBe(0.022);
  });

  it("les plafonds micro 2026 sont 83 600 € en services et BNC, 203 100 € en vente", () => {
    expect(FISCALITE.regimes.services.plafondCA).toBe(83600);
    expect(FISCALITE.regimes.bnc.plafondCA).toBe(83600);
    expect(FISCALITE.regimes.vente.plafondCA).toBe(203100);
  });

  it("les seuils de franchise en base de TVA sont 37 500 / 41 250 et 85 000 / 93 500", () => {
    expect(FISCALITE.regimes.services.seuilTVA).toBe(37500);
    expect(FISCALITE.regimes.services.seuilTVAMajore).toBe(41250);
    expect(FISCALITE.regimes.bnc.seuilTVA).toBe(37500);
    expect(FISCALITE.regimes.bnc.seuilTVAMajore).toBe(41250);
    expect(FISCALITE.regimes.vente.seuilTVA).toBe(85000);
    expect(FISCALITE.regimes.vente.seuilTVAMajore).toBe(93500);
  });

  it("le seuil TVA majoré vaut toujours le seuil de base plus 10 %", () => {
    // Règle de construction officielle. Elle rattrape une faute de frappe sur
    // l'un des deux nombres même si chacun reste plausible pris isolément.
    for (const r of Object.values(FISCALITE.regimes)) {
      expect(r.seuilTVAMajore / r.seuilTVA).toBeCloseTo(1.1, 10);
    }
  });

  it("les taux de CFP suivent le secteur : 0,1 % vente, 0,3 % services et artisan, 0,2 % BNC", () => {
    expect(FISCALITE.cfp.vente).toBe(0.001);
    // ⚠️ 15/08/2026 : 0,2 % n'existe pas pour les services BIC (0,1 % commercial,
    //  0,3 % artisanal). L'app ne demande pas laquelle des deux : repli prudent.
    expect(FISCALITE.cfp.services).toBe(0.003);
    expect(FISCALITE.cfp.bnc).toBe(0.002);
    expect(FISCALITE.cfp.artisan).toBe(0.003);
  });

  it("l'ACRE est bien tombée à 25 % d'exonération depuis le 01/07/2026", () => {
    // Verrou de date : avant le 01/07/2026 la moitié des cotisations était
    // exonérée, après seulement un quart. Garder 50 % ferait provisionner
    // beaucoup trop peu à un créateur d'activité récent.
    expect(FISCALITE.acre.tauxExoneration_avant_01_07_2026).toBe(0.5);
    expect(FISCALITE.acre.tauxExoneration_apres_01_07_2026).toBe(0.25);
    expect(FISCALITE.acre.tauxExoneration_apres_01_07_2026)
      .toBeLessThan(FISCALITE.acre.tauxExoneration_avant_01_07_2026);
  });

  it("les droits formation CPF restent cohérents : crédit annuel sous le plafond", () => {
    expect(FISCALITE.formation.cpfCreditAnnuel).toBe(500);
    expect(FISCALITE.formation.cpfPlafond).toBe(5000);
    // 150 € depuis le 02/04/2026 (décret n° 2026-234 du 30/03/2026, service-public F10705).
    expect(FISCALITE.formation.cpfResteACharge).toBe(150.0);
    expect(FISCALITE.formation.cpfCreditAnnuel).toBeLessThan(FISCALITE.formation.cpfPlafond);
  });

  it("chaque régime reste structurellement cohérent (taux entre 0 et 1, TVA sous le plafond)", () => {
    for (const [id, r] of Object.entries(FISCALITE.regimes)) {
      expect(r.id, `id du régime ${id}`).toBe(id);
      expect(r.tauxCotisations).toBeGreaterThan(0);
      expect(r.tauxCotisations).toBeLessThan(1);
      expect(r.abattementFiscal).toBeGreaterThan(0);
      expect(r.abattementFiscal).toBeLessThan(1);
      expect(r.tauxVersementLiberatoire).toBeGreaterThan(0);
      expect(r.tauxVersementLiberatoire).toBeLessThan(0.1);
      // On doit pouvoir facturer la TVA bien avant d'atteindre le plafond micro.
      expect(r.seuilTVA).toBeLessThan(r.seuilTVAMajore);
      expect(r.seuilTVAMajore).toBeLessThan(r.plafondCA);
    }
  });

  it("chaque régime déclare sa source officielle (traçabilité de la RÈGLE D'OR)", () => {
    for (const r of Object.values(FISCALITE.regimes)) {
      expect(typeof r.sourceCotisations).toBe("string");
      expect(r.sourceCotisations.length).toBeGreaterThan(0);
      expect(typeof r.sourcePlafond).toBe("string");
      expect(typeof r.sourceTVA).toBe("string");
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  2. getRegime : la porte d'entrée de tous les calculs
// ────────────────────────────────────────────────────────────────────────────
describe("getRegime : retrouver le bon régime", () => {
  it("rend le régime demandé quand l'identifiant existe", () => {
    expect(getRegime("vente").id).toBe("vente");
    expect(getRegime("services").id).toBe("services");
    expect(getRegime("bnc").id).toBe("bnc");
  });

  it("rend l'objet du référentiel lui-même, jamais une copie approximative", () => {
    expect(getRegime("bnc")).toBe(FISCALITE.regimes.bnc);
  });

  it("retombe sur les prestations de services si l'identifiant est absent ou vide", () => {
    expect(getRegime(undefined).id).toBe("services");
    expect(getRegime(null).id).toBe("services");
    expect(getRegime("").id).toBe("services");
    expect(getRegime("statut_inexistant").id).toBe("services");
  });

  it("ATTENTION : un artisan est silencieusement traité comme un prestataire de services", () => {
    // Le référentiel connaît l'artisan pour la CFP (0,3 %) et le FAF (FAFCEA)
    // mais pas dans regimes. getRegime retombe donc sur services (21,2 %),
    // sans aucun signal. C'est le comportement actuel : on le fige pour que
    // l'ajout d'un vrai régime artisan casse ce test et soit vu.
    expect(FISCALITE.cfp.artisan).toBe(0.003);
    expect(FISCALITE.formation.fafParActivite.artisan).toBe("FAFCEA");
    expect(FISCALITE.regimes.artisan).toBeUndefined();
    expect(getRegime("artisan").id).toBe("services");
  });

  it("ATTENTION : une activité mixte n'existe pas et retombe aussi sur services", () => {
    // L'en-tête du fichier demande d'afficher "À vérifier selon ton régime
    // exact" pour une activité mixte. getRegime ne peut PAS le signaler : il
    // rend services. C'est donc au moteur appelant de traiter le cas.
    expect(FISCALITE.regimes.mixte).toBeUndefined();
    expect(getRegime("mixte").id).toBe("services");
    expect(FISCALITE.avertissement).toContain("activité mixte");
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  3. calcUrssaf : les cotisations sociales, le prélèvement le plus lourd
// ────────────────────────────────────────────────────────────────────────────
describe("calcUrssaf : cotisations sociales sur le chiffre d'affaires", () => {
  it("sur 10 000 € de CA : 1 230 € en vente, 2 120 € en services, 2 560 € en BNC", () => {
    expect(calcUrssaf("vente", 10000)).toBe(1230);
    expect(calcUrssaf("services", 10000)).toBe(2120);
    expect(calcUrssaf("bnc", 10000)).toBe(2560);
  });

  it("un chiffre d'affaires nul ne déclenche aucune cotisation", () => {
    expect(calcUrssaf("vente", 0)).toBe(0);
    expect(calcUrssaf("services", 0)).toBe(0);
    expect(calcUrssaf("bnc", 0)).toBe(0);
  });

  it("le résultat est arrondi au centime, jamais à la fraction de centime", () => {
    // 3 333,33 x 21,2 % = 706,66596 : on doit lire 706,67 € et pas 706,66596 €.
    expect(calcUrssaf("services", 3333.33)).toBe(706.67);
    expect(calcUrssaf("bnc", 2500.55)).toBe(640.14);
    expect(calcUrssaf("vente", 1234.56)).toBe(151.85);
  });

  it("le montant reste strictement proportionnel au chiffre d'affaires", () => {
    expect(calcUrssaf("services", 2000)).toBe(calcUrssaf("services", 1000) * 2);
    expect(calcUrssaf("bnc", 50000)).toBe(12800);
  });

  it("une activité inconnue est facturée au taux services, pas à zéro", () => {
    // Le pire scénario serait de renvoyer 0 : l'utilisateur ne provisionnerait
    // rien du tout. Le repli sur services provisionne au moins quelque chose.
    expect(calcUrssaf("activite_bidon", 10000)).toBe(2120);
    expect(calcUrssaf(undefined, 10000)).toBe(2120);
  });

  it("un chiffre d'affaires négatif produit un montant négatif (avoir, pas de garde-fou)", () => {
    // Comportement actuel assumé : la fonction ne borne pas à zéro. Si un jour
    // on ajoute un garde-fou, ce test tombera et devra être mis à jour.
    expect(calcUrssaf("services", -1000)).toBe(-212);
  });

  it("un chiffre d'affaires manquant propage NaN : l'appelant doit sécuriser sa saisie", () => {
    // App.jsx fait bien `parseFloat(x) || 0` avant d'appeler le moteur.
    // Ce test documente que la protection est chez l'appelant, pas ici.
    expect(Number.isNaN(calcUrssaf("services", undefined))).toBe(true);
    // null vaut 0 en arithmétique JS : pas de NaN, mais 0 € de cotisations.
    expect(calcUrssaf("services", null)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  4. calcRevenuImposable : la base de l'impôt sur le revenu
// ────────────────────────────────────────────────────────────────────────────
describe("calcRevenuImposable : le CA après abattement forfaitaire", () => {
  it("sur 10 000 € de CA : 2 900 € en vente, 5 000 € en services, 6 600 € en BNC", () => {
    expect(calcRevenuImposable("vente", 10000)).toBe(2900);
    expect(calcRevenuImposable("services", 10000)).toBe(5000);
    expect(calcRevenuImposable("bnc", 10000)).toBe(6600);
  });

  it("l'arrondi neutralise l'imprécision des nombres à virgule", () => {
    // 1 - 0,71 vaut 0,29000000000000004 en JavaScript, donc le calcul brut
    // donne 2900,0000000000005. L'arrondi au centime doit effacer ce résidu.
    expect(1 - FISCALITE.regimes.vente.abattementFiscal).not.toBe(0.29);
    expect(calcRevenuImposable("vente", 10000)).toBe(2900);
    expect(String(calcRevenuImposable("vente", 10000))).toBe("2900");
  });

  it("un chiffre d'affaires nul ne dégage aucun revenu imposable", () => {
    expect(calcRevenuImposable("services", 0)).toBe(0);
  });

  it("le revenu imposable est toujours inférieur au chiffre d'affaires encaissé", () => {
    for (const id of ["vente", "services", "bnc"]) {
      expect(calcRevenuImposable(id, 40000)).toBeLessThan(40000);
      expect(calcRevenuImposable(id, 40000)).toBeGreaterThan(0);
    }
  });

  it("c'est la vente qui est la moins imposée et le BNC le plus imposé", () => {
    const ca = 30000;
    expect(calcRevenuImposable("vente", ca)).toBeLessThan(calcRevenuImposable("services", ca));
    expect(calcRevenuImposable("services", ca)).toBeLessThan(calcRevenuImposable("bnc", ca));
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  5. calcImpot : versement libératoire contre barème
// ────────────────────────────────────────────────────────────────────────────
describe("calcImpot : l'impôt sur le revenu estimé", () => {
  it("en versement libératoire, l'impôt se calcule sur le CA brut", () => {
    expect(calcImpot("vente", 10000, { versementLiberatoire: true })).toBe(100);
    expect(calcImpot("services", 10000, { versementLiberatoire: true })).toBe(170);
    expect(calcImpot("bnc", 10000, { versementLiberatoire: true })).toBe(220);
  });

  it("au barème, l'impôt se calcule sur le revenu imposable et la tranche marginale", () => {
    // 10 000 € en services, abattement 50 %, TMI 11 % : 5 000 x 11 % = 550 €.
    expect(calcImpot("services", 10000, { tmiPct: 11 })).toBe(550);
    // 30 000 € en BNC, abattement 34 %, TMI 30 % : 19 800 x 30 % = 5 940 €.
    expect(calcImpot("bnc", 30000, { tmiPct: 30 })).toBe(5940);
  });

  it("sans option, l'impôt estimé vaut zéro (tranche marginale 0 % par défaut)", () => {
    // Correspond au choix "je ne paie pas d'impôt actuellement" du profil.
    expect(calcImpot("services", 10000)).toBe(0);
    expect(calcImpot("bnc", 80000, {})).toBe(0);
    expect(calcImpot("vente", 50000, { tmiPct: 0 })).toBe(0);
  });

  it("le versement libératoire l'emporte sur la tranche marginale si les deux sont fournis", () => {
    // Sécurité anti double comptage : on ne doit jamais additionner les deux.
    expect(calcImpot("services", 10000, { versementLiberatoire: true, tmiPct: 30 })).toBe(170);
  });

  it("un chiffre d'affaires nul ne déclenche aucun impôt, quelle que soit l'option", () => {
    expect(calcImpot("services", 0, { versementLiberatoire: true })).toBe(0);
    expect(calcImpot("services", 0, { tmiPct: 41 })).toBe(0);
  });

  it("à TMI 30 %, le versement libératoire reste nettement moins cher (conseil produit)", () => {
    const ca = 30000;
    const vl = calcImpot("services", ca, { versementLiberatoire: true });
    const bareme = calcImpot("services", ca, { tmiPct: 30 });
    expect(vl).toBe(510);
    expect(bareme).toBe(4500);
    expect(vl).toBeLessThan(bareme);
  });

  it("à TMI 0 %, le versement libératoire coûte au contraire de l'argent", () => {
    // Piège classique : opter pour le libératoire quand on n'est pas imposable
    // revient à payer 510 € pour rien.
    const ca = 30000;
    expect(calcImpot("services", ca, { tmiPct: 0 })).toBe(0);
    expect(calcImpot("services", ca, { versementLiberatoire: true })).toBe(510);
  });

  it("le résultat est arrondi au centime", () => {
    expect(calcImpot("services", 1234.56, { versementLiberatoire: true })).toBe(20.99);
    expect(calcImpot("bnc", 1234.56, { tmiPct: 11 })).toBe(89.63);
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  6. statutPlafond : rester dans le régime micro
// ────────────────────────────────────────────────────────────────────────────
describe("statutPlafond : la position face au plafond du régime micro", () => {
  it("à zéro de CA, tout le plafond reste disponible", () => {
    const s = statutPlafond("services", 0);
    expect(s.plafond).toBe(83600);
    expect(s.restant).toBe(83600);
    expect(s.pct).toBe(0);
    expect(s.proche).toBe(false);
    expect(s.depasse).toBe(false);
  });

  it("l'alerte se déclenche à 80 % du plafond, pas avant", () => {
    const juste = statutPlafond("services", 66880); // exactement 80 %
    expect(juste.pct).toBe(0.8);
    expect(juste.proche).toBe(true);

    const avant = statutPlafond("services", 66879);
    expect(avant.proche).toBe(false);
  });

  it("le dépassement se déclare au premier centime au-dessus du plafond", () => {
    const pile = statutPlafond("services", 83600);
    expect(pile.depasse).toBe(false);

    const unCentime = statutPlafond("services", 83600.01);
    expect(unCentime.depasse).toBe(true);
  });

  it("PIÈGE : pile au plafond, ni alerte de proximité ni alerte de dépassement", () => {
    // proche exige pct < 1 et depasse exige un CA strictement supérieur.
    // À 83 600,00 € exactement, l'utilisateur ne voit donc AUCUN signal alors
    // qu'il est à un centime du basculement. Comportement figé volontairement :
    // si on corrige la borne un jour, ce test doit tomber.
    const pile = statutPlafond("services", 83600);
    expect(pile.pct).toBe(1);
    expect(pile.proche).toBe(false);
    expect(pile.depasse).toBe(false);
  });

  it("au-delà du plafond, il ne reste jamais un montant négatif à facturer", () => {
    const s = statutPlafond("vente", 250000);
    expect(s.depasse).toBe(true);
    expect(s.restant).toBe(0);
    expect(s.pct).toBeCloseTo(1.2309, 4);
  });

  it("le vendeur profite bien du plafond haut : 100 000 € ne le fait pas dépasser", () => {
    // Le même CA dépasserait largement le plafond d'un prestataire.
    expect(statutPlafond("vente", 100000).depasse).toBe(false);
    expect(statutPlafond("services", 100000).depasse).toBe(true);
  });

  it("le restant se calcule bien au centime près", () => {
    expect(statutPlafond("bnc", 60000).restant).toBe(23600);
    expect(statutPlafond("vente", 200000).restant).toBe(3100);
  });

  it("un CA négatif ne fait pas exploser le calcul (aucun dépassement annoncé)", () => {
    const s = statutPlafond("services", -500);
    expect(s.depasse).toBe(false);
    expect(s.proche).toBe(false);
    expect(s.restant).toBe(84100);
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  7. statutTVA : le moment où il faut commencer à facturer la TVA
// ────────────────────────────────────────────────────────────────────────────
describe("statutTVA : la franchise en base de TVA", () => {
  it("à zéro de CA, la franchise est totale", () => {
    const s = statutTVA("services", 0);
    expect(s.seuil).toBe(37500);
    expect(s.seuilMajore).toBe(41250);
    expect(s.restant).toBe(37500);
    expect(s.proche).toBe(false);
    expect(s.depasse).toBe(false);
    expect(s.depasseMajore).toBe(false);
  });

  it("l'alerte de proximité se déclenche à 90 % du seuil de base", () => {
    const juste = statutTVA("services", 33750); // exactement 90 %
    expect(juste.proche).toBe(true);
    expect(statutTVA("services", 33749).proche).toBe(false);
  });

  it("pile sur le seuil de base, la franchise tient encore", () => {
    const s = statutTVA("services", 37500);
    expect(s.depasse).toBe(false);
    // proche exige un CA strictement sous le seuil : pile dessus, plus d'alerte.
    expect(s.proche).toBe(false);
  });

  it("entre le seuil de base et le seuil majoré : TVA au 1er janvier suivant seulement", () => {
    // 40 000 € en services : dépassement du seuil de base mais pas du majoré.
    // La TVA ne s'applique qu'à partir de l'année suivante.
    const s = statutTVA("services", 40000);
    expect(s.depasse).toBe(true);
    expect(s.depasseMajore).toBe(false);
  });

  it("au-delà du seuil majoré : TVA due dès le jour du dépassement", () => {
    const s = statutTVA("services", 41250.01);
    expect(s.depasse).toBe(true);
    expect(s.depasseMajore).toBe(true);
  });

  it("pile sur le seuil majoré, le basculement immédiat ne se déclenche pas encore", () => {
    const s = statutTVA("services", 41250);
    expect(s.depasse).toBe(true);
    expect(s.depasseMajore).toBe(false);
  });

  it("les seuils du vendeur sont bien plus hauts que ceux du prestataire", () => {
    // 50 000 € de CA : le prestataire perd sa franchise, le vendeur la garde.
    expect(statutTVA("services", 50000).depasse).toBe(true);
    expect(statutTVA("vente", 50000).depasse).toBe(false);
    expect(statutTVA("vente", 93500.01).depasseMajore).toBe(true);
  });

  it("le restant ne devient jamais négatif une fois le seuil franchi", () => {
    expect(statutTVA("services", 40000).restant).toBe(0);
    expect(statutTVA("vente", 999999).restant).toBe(0);
  });

  it("le restant se mesure sur le seuil de base, pas sur le seuil majoré", () => {
    // Conséquence : entre 37 500 € et 41 250 € on affiche 0 € de marge, sans
    // indiquer la distance qui reste avant la TVA immédiate.
    expect(statutTVA("services", 30000).restant).toBe(7500);
    expect(statutTVA("services", 38000).restant).toBe(0);
  });

  it("le repli sur le seuil de base ne sert jamais : tous les régimes ont un seuil majoré", () => {
    // statutTVA fait `r.seuilTVAMajore || r.seuilTVA`. Si un régime perdait son
    // seuil majoré, la TVA immédiate se déclencherait trop tôt sans prévenir.
    for (const id of Object.keys(FISCALITE.regimes)) {
      expect(statutTVA(id, 0).seuilMajore).toBe(FISCALITE.regimes[id].seuilTVAMajore);
    }
  });

  it("le seuil TVA se franchit toujours avant le plafond micro", () => {
    // Un CA qui dépasse le plafond micro dépasse forcément le seuil de TVA.
    for (const id of Object.keys(FISCALITE.regimes)) {
      const ca = FISCALITE.regimes[id].plafondCA;
      expect(statutTVA(id, ca).depasse).toBe(true);
      expect(statutTVA(id, ca).depasseMajore).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  8. SCÉNARIOS RÉELS bout en bout
// ────────────────────────────────────────────────────────────────────────────
describe("Scénarios complets d'un auto-entrepreneur", () => {
  it("prestataire à 2 000 € par mois : ce qui reste vraiment dans la poche", () => {
    const ca = 24000; // 2 000 € x 12 mois
    const urssaf = calcUrssaf("services", ca);
    const cfp = Math.round(ca * FISCALITE.cfp.services * 100) / 100;
    const impot = calcImpot("services", ca, { versementLiberatoire: true });

    expect(urssaf).toBe(5088);
    expect(cfp).toBe(72);   // 24 000 x 0,3 % (CFP services corrigee le 15/08/2026)
    expect(impot).toBe(408);
    // Reste net après cotisations, formation et impôt libératoire.
    // 24 000 − 5 088 (21,2 %) − 72 (CFP 0,3 %, corrigée le 15/08/2026) − 408 (1,7 %)
    expect(Math.round((ca - urssaf - cfp - impot) * 100) / 100).toBe(18432);

    // Encore loin des deux plafonds : aucune alerte à ce niveau de CA.
    expect(statutPlafond("services", ca).proche).toBe(false);
    expect(statutTVA("services", ca).depasse).toBe(false);
  });

  it("profession libérale à 36 000 € : proche de la TVA, loin du plafond micro", () => {
    const ca = 36000;
    expect(calcUrssaf("bnc", ca)).toBe(9216);
    expect(calcRevenuImposable("bnc", ca)).toBe(23760);

    const tva = statutTVA("bnc", ca);
    expect(tva.proche).toBe(true); // au-dessus de 33 750 €
    expect(tva.depasse).toBe(false);
    expect(tva.restant).toBe(1500);

    const plafond = statutPlafond("bnc", ca);
    expect(plafond.depasse).toBe(false);
    expect(plafond.proche).toBe(false);
    expect(plafond.restant).toBe(47600);
  });

  it("commerçant à 195 000 € : TVA obligatoire depuis longtemps, plafond micro menacé", () => {
    const ca = 195000;
    expect(calcUrssaf("vente", ca)).toBe(23985);

    const tva = statutTVA("vente", ca);
    expect(tva.depasse).toBe(true);
    expect(tva.depasseMajore).toBe(true);

    const plafond = statutPlafond("vente", ca);
    expect(plafond.proche).toBe(true); // au-dessus de 80 % de 203 100 €
    expect(plafond.depasse).toBe(false);
    expect(plafond.restant).toBe(8100);
  });

  it("une année blanche à 0 € ne produit que des zéros, sans NaN ni alerte", () => {
    for (const id of ["vente", "services", "bnc"]) {
      expect(calcUrssaf(id, 0)).toBe(0);
      expect(calcRevenuImposable(id, 0)).toBe(0);
      expect(calcImpot(id, 0, { versementLiberatoire: true })).toBe(0);
      expect(calcImpot(id, 0, { tmiPct: 30 })).toBe(0);
      expect(statutPlafond(id, 0).depasse).toBe(false);
      expect(statutTVA(id, 0).depasse).toBe(false);
    }
  });

  it("le BNC est bien le régime le plus coûteux en cotisations à CA égal", () => {
    const ca = 40000;
    expect(calcUrssaf("vente", ca)).toBeLessThan(calcUrssaf("services", ca));
    expect(calcUrssaf("services", ca)).toBeLessThan(calcUrssaf("bnc", ca));
    // Écart concret entre un vendeur et un libéral sur le même CA.
    expect(calcUrssaf("bnc", ca) - calcUrssaf("vente", ca)).toBe(5320);
  });
});
