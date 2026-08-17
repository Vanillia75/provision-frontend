// ─────────────────────────────────────────────────────────────────────────────
//  TESTS DU RÉFÉRENTIEL DES RÈGLES INTERMITTENT
//
//  C'est le fichier le plus sensible du site : ces chiffres décident de ce
//  qu'on affiche à quelqu'un sur ses droits. Le rôle de ces tests est double :
//
//   1) VERROUILLER chaque repère chiffré. Si un chiffre bouge (régénération du
//      fichier depuis un .py périmé, copier-coller malheureux, mise à jour
//      partielle), le test passe au rouge tout de suite, avant le push.
//   2) VÉRIFIER LES COHÉRENCES MÉTIER entre les repères (le plafond de
//      formation vaut bien les 2/3 du seuil, le diviseur des formules est bien
//      le seuil, un artiste ouvre ses droits à 43 cachets, etc.).
//
//  Quand un test échoue ici, on ne "corrige pas le test" : on vérifie d'abord
//  la source officielle. Un chiffre modifié sans source, c'est un bug.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  REGLES,
  VERSION_REFERENTIEL,
  moteurHeuresValide,
  getRegle,
  valeurDe,
  tracer,
} from "./regles_intermittent";

// Arrondi comptable à 2 décimales (ce que fait l'affichage d'un montant en euros).
const arrondi2 = (n) => Math.round(n * 100) / 100;

// ═════════════════════════════════════════════════════════════════════════════
//  1. INTÉGRITÉ DU RÉFÉRENTIEL
// ═════════════════════════════════════════════════════════════════════════════
describe("Intégrité du référentiel", () => {
  it("le référentiel contient exactement les 22 règles attendues", () => {
    // Si ce test casse, c'est qu'une règle a disparu ou est apparue.
    // Une règle qui DISPARAÎT est le scénario le plus dangereux : le code
    // appelant recevra null au lieu d'un chiffre, sans le moindre bruit.
    const attendues = [
      "seuilHeures",
      "periodeReferenceJours",
      "dureeIndemnisationJours",
      "cachetHeures",
      "cachetGroupeHeures_HISTORIQUE",
      "rattrapageSeuilMin",
      "rattrapageDureeMois",
      "rattrapageOuverturesMin",
      "formationPlafondNouvelleAdmission",
      "enseignementPlafond",
      "congesSpectaclesTaux",
      "congesSpectaclesRatioNetSocial",
      "assimilationArretParJour",
      "ajMinimale",
      "allocationParametresAnnexe8",
      "allocationParametresAnnexe10",
      "allocationPlafondAJ",
      "allocationRetenueRetraiteComp",
      "allocationCsgCrds",
      "allocationPlancherNetCsg",
      "pmssMensuel",
      "franchiseCongesParJours",
    ];
    expect(Object.keys(REGLES).sort()).toEqual(attendues.sort());
  });

  it("chaque règle porte sa traçabilité complète (valeur, libellé, source, commentaire)", () => {
    for (const [cle, r] of Object.entries(REGLES)) {
      expect(r.valeur, `règle ${cle} : valeur manquante`).not.toBeUndefined();
      expect(r.valeur, `règle ${cle} : valeur nulle`).not.toBeNull();
      expect(typeof r.libelle, `règle ${cle} : libellé`).toBe("string");
      expect(r.libelle.length, `règle ${cle} : libellé vide`).toBeGreaterThan(0);
      expect(r.source.length, `règle ${cle} : source vide`).toBeGreaterThan(0);
      expect(r.commentaire.length, `règle ${cle} : commentaire vide`).toBeGreaterThan(0);
      expect(typeof r.verifie, `règle ${cle} : drapeau verifie`).toBe("boolean");
      expect(r.dateAppli.length, `règle ${cle} : dateAppli vide`).toBeGreaterThan(0);
    }
  });

  it("la version du référentiel est datée et sa date de revue est une vraie date", () => {
    expect(VERSION_REFERENTIEL.version).toBe("2026.07");
    expect(VERSION_REFERENTIEL.version).toMatch(/^\d{4}\.\d{2}$/);
    expect(VERSION_REFERENTIEL.revue).toBe("2026-06-26");
    expect(Number.isNaN(new Date(VERSION_REFERENTIEL.revue).getTime())).toBe(false);
  });

  it("toutes les règles actives portent la version du référentiel", () => {
    // Une règle restée à une version antérieure = mise à jour partielle,
    // donc un mélange de deux référentiels à l'écran.
    for (const [cle, r] of Object.entries(REGLES)) {
      if (r.nePasUtiliser) continue; // les règles historiques gardent leur propre version
      expect(r.version, `règle ${cle} : version décalée`).toBe(VERSION_REFERENTIEL.version);
    }
  });

  it("la seule règle marquée non vérifiée et réservée au front est la franchise congés", () => {
    // Tout ce qui sert à annoncer des droits doit être vérifié. Si une nouvelle
    // règle arrive à verifie:false, on veut le savoir avant qu'elle serve.
    const nonVerifiees = Object.entries(REGLES)
      .filter(([, r]) => r.verifie !== true)
      .map(([cle]) => cle)
      .sort();
    expect(nonVerifiees).toEqual(["cachetGroupeHeures_HISTORIQUE", "franchiseCongesParJours"]);
    expect(REGLES.franchiseCongesParJours.frontOnly).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  2. LE SEUIL DES 507 HEURES
// ═════════════════════════════════════════════════════════════════════════════
describe("Le seuil des 507 heures", () => {
  it("le seuil d'ouverture de droits vaut 507 heures", () => {
    expect(valeurDe("seuilHeures")).toBe(507);
    expect(REGLES.seuilHeures.verifie).toBe(true);
  });

  it("la période de référence est de 365 jours glissants", () => {
    expect(valeurDe("periodeReferenceJours")).toBe(365);
  });

  it("la durée d'indemnisation est de 365 jours (date anniversaire)", () => {
    expect(valeurDe("dureeIndemnisationJours")).toBe(365);
  });

  // Formule réellement utilisée dans l'app : manque = max(0, seuil - heures).
  // Les droits sont ouverts quand il ne manque plus rien, donc à 507 h PILE.
  const manque = (heures) => Math.max(0, valeurDe("seuilHeures") - heures);

  it("zéro heure : il manque la totalité du seuil, aucun droit ouvert", () => {
    expect(manque(0)).toBe(507);
  });

  it("exactement 507 heures : il ne manque plus rien, les droits sont ouverts", () => {
    // Le seuil est INCLUSIF : 507 h suffisent, on n'exige pas 508 h.
    expect(manque(507)).toBe(0);
  });

  it("506 heures : il manque encore une heure, les droits ne sont pas ouverts", () => {
    expect(manque(506)).toBe(1);
  });

  it("au-delà du seuil, le manque reste à zéro et ne devient jamais négatif", () => {
    expect(manque(600)).toBe(0);
    expect(manque(10000)).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  3. CONVERSION CACHET (ANNEXE 10, ARTISTES)
// ═════════════════════════════════════════════════════════════════════════════
describe("La conversion cachet vers heures (annexe 10, artistes)", () => {
  it("un cachet d'artiste vaut 12 heures", () => {
    expect(valeurDe("cachetHeures")).toBe(12);
  });

  it("43 cachets font 516 heures et ouvrent les droits", () => {
    // Repère cité par le référentiel lui-même : 43 cachets = 516 h.
    expect(43 * valeurDe("cachetHeures")).toBe(516);
    expect(43 * valeurDe("cachetHeures")).toBeGreaterThanOrEqual(valeurDe("seuilHeures"));
  });

  it("42 cachets font 504 heures : il en manque un pour ouvrir les droits", () => {
    // La frontière exacte : 42 cachets ne suffisent PAS.
    expect(42 * valeurDe("cachetHeures")).toBe(504);
    expect(42 * valeurDe("cachetHeures")).toBeLessThan(valeurDe("seuilHeures"));
  });

  // Formule de l'app : cachetsManquants = ceil(manque / cachetHeures).
  const cachetsManquants = (heures) =>
    Math.ceil(Math.max(0, valeurDe("seuilHeures") - heures) / valeurDe("cachetHeures"));

  it("en partant de zéro, il faut 43 cachets (42,25 arrondis au cachet supérieur)", () => {
    expect(cachetsManquants(0)).toBe(43);
  });

  it("à 504 heures il manque un seul cachet, à 507 heures plus aucun", () => {
    expect(cachetsManquants(504)).toBe(1);
    expect(cachetsManquants(507)).toBe(0);
    expect(cachetsManquants(600)).toBe(0);
  });

  it("la règle historique du cachet groupé à 8 h existe encore mais est interdite d'usage", () => {
    // Elle est conservée pour mémoire. Le piège serait qu'un calcul l'utilise :
    // 43 cachets à 8 h ne feraient que 344 h, on refuserait des droits ouverts.
    const historique = getRegle("cachetGroupeHeures_HISTORIQUE");
    expect(historique.valeur).toBe(8);
    expect(historique.nePasUtiliser).toBe(true);
    expect(historique.verifie).toBe(false);
    expect(historique.version).toBe("obsolète");
    // La valeur active n'a surtout pas été contaminée par l'ancienne.
    expect(valeurDe("cachetHeures")).not.toBe(historique.valeur);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  4. ANNEXE 8 (TECHNICIENS) ET ANNEXE 10 (ARTISTES)
// ═════════════════════════════════════════════════════════════════════════════
describe("Distinction annexe 8 (techniciens) et annexe 10 (artistes)", () => {
  const a8 = valeurDe("allocationParametresAnnexe8");
  const a10 = valeurDe("allocationParametresAnnexe10");

  it("les paramètres de l'annexe 8 sont figés", () => {
    expect(a8).toEqual({
      coefSR: 0.42,
      plafondSR: 14400,
      coefSRAuDela: 0.05,
      diviseurA: 5000,
      coefNHT: 0.26,
      seuilNHT: 720,
      coefNHTAuDela: 0.08,
      diviseurB: 507,
      coefC: 0.4,
      plancherAJ: 38.0,
      diviseurSJM: 8,
      seuilJoursMois: 26,
      coefDecalage: 1.4,
    });
  });

  it("les paramètres de l'annexe 10 sont figés", () => {
    expect(a10).toEqual({
      coefSR: 0.36,
      plafondSR: 13700,
      coefSRAuDela: 0.05,
      diviseurA: 5000,
      coefNHT: 0.26,
      seuilNHT: 690,
      coefNHTAuDela: 0.08,
      diviseurB: 507,
      coefC: 0.7,
      plancherAJ: 44.0,
      diviseurSJM: 10,
      seuilJoursMois: 27,
      coefDecalage: 1.3,
    });
  });

  it("les deux annexes ne sont pas confondues (chaque paramètre distinctif diffère)", () => {
    // Copier une annexe sur l'autre est l'erreur la plus facile à commettre.
    expect(a8.coefSR).not.toBe(a10.coefSR);
    expect(a8.plafondSR).not.toBe(a10.plafondSR);
    expect(a8.seuilNHT).not.toBe(a10.seuilNHT);
    expect(a8.coefC).not.toBe(a10.coefC);
    expect(a8.plancherAJ).not.toBe(a10.plancherAJ);
    expect(a8.diviseurSJM).not.toBe(a10.diviseurSJM);
    expect(a8.seuilJoursMois).not.toBe(a10.seuilJoursMois);
    expect(a8.coefDecalage).not.toBe(a10.coefDecalage);
  });

  it("le diviseur de la formule B est le seuil des 507 heures dans les deux annexes", () => {
    expect(a8.diviseurB).toBe(valeurDe("seuilHeures"));
    expect(a10.diviseurB).toBe(valeurDe("seuilHeures"));
  });

  it("le technicien compte 8 h par jour, l'artiste 10 h : c'est la clé du calcul mensuel", () => {
    expect(a8.diviseurSJM).toBe(8);
    expect(a10.diviseurSJM).toBe(10);
    // Un mois plein : 26 jours en annexe 8, 27 en annexe 10.
    expect(a8.seuilJoursMois).toBe(26);
    expect(a10.seuilJoursMois).toBe(27);
  });

  it("le plancher d'allocation de l'artiste est supérieur à celui du technicien", () => {
    expect(a10.plancherAJ).toBeGreaterThan(a8.plancherAJ);
    expect(a8.plancherAJ).toBe(38.0);
    expect(a10.plancherAJ).toBe(44.0);
  });

  it("les planchers restent sous le plafond d'allocation journalière", () => {
    expect(a8.plancherAJ).toBeLessThan(valeurDe("allocationPlafondAJ"));
    expect(a10.plancherAJ).toBeLessThan(valeurDe("allocationPlafondAJ"));
  });

  it("les coefficients de décalage sont bien des majorations (supérieurs à 1)", () => {
    expect(a8.coefDecalage).toBeGreaterThan(1);
    expect(a10.coefDecalage).toBeGreaterThan(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  5. FORMATION, ENSEIGNEMENT, ARRÊTS ASSIMILÉS
// ═════════════════════════════════════════════════════════════════════════════
describe("Heures assimilées : formation, enseignement, arrêts", () => {
  it("le plafond des heures de formation suivie vaut 338 h", () => {
    expect(valeurDe("formationPlafondNouvelleAdmission")).toBe(338);
  });

  it("ce plafond vaut exactement les deux tiers du seuil des 507 heures", () => {
    // 2/3 x 507 = 338 exactement. On l'écrit en produit en croix pour éviter
    // toute imprécision de virgule flottante.
    expect(valeurDe("formationPlafondNouvelleAdmission") * 3).toBe(valeurDe("seuilHeures") * 2);
  });

  it("la formation seule ne peut JAMAIS ouvrir des droits", () => {
    // Conséquence directe du plafond : 338 < 507. Si un jour le plafond
    // dépassait le seuil, on annoncerait des droits ouverts à tort.
    expect(valeurDe("formationPlafondNouvelleAdmission")).toBeLessThan(valeurDe("seuilHeures"));
  });

  it("le plafond d'enseignement dispensé vaut 70 h et tient dans le plafond partagé", () => {
    expect(valeurDe("enseignementPlafond")).toBe(70);
    expect(valeurDe("enseignementPlafond")).toBeLessThanOrEqual(
      valeurDe("formationPlafondNouvelleAdmission"),
    );
  });

  it("formation plus enseignement au maximum ne suffisent toujours pas au seuil", () => {
    // Le plafond de 338 h est PARTAGÉ : le total des deux ne peut pas dépasser
    // 338 h, donc jamais 507 h. Vérifié même dans l'hypothèse la plus large.
    const totalMaxPartage = valeurDe("formationPlafondNouvelleAdmission");
    expect(totalMaxPartage).toBeLessThan(valeurDe("seuilHeures"));
    // Et même en additionnant naïvement les deux plafonds (erreur possible si
    // le partage n'était pas appliqué), on resterait sous le seuil.
    expect(
      valeurDe("formationPlafondNouvelleAdmission") + valeurDe("enseignementPlafond"),
    ).toBeLessThan(valeurDe("seuilHeures"));
  });

  it("un jour d'arrêt assimilé compte 5 heures", () => {
    expect(valeurDe("assimilationArretParJour")).toBe(5);
  });

  it("un congé maternité de 112 jours calendaires apporte 560 heures", () => {
    // Sans plafond, week-ends inclus : 112 jours x 5 h = 560 h, soit à elles
    // seules plus que le seuil. C'est bien le comportement attendu.
    const heures = 112 * valeurDe("assimilationArretParJour");
    expect(heures).toBe(560);
    expect(heures).toBeGreaterThan(valeurDe("seuilHeures"));
  });

  it("zéro jour d'arrêt n'apporte aucune heure", () => {
    expect(0 * valeurDe("assimilationArretParJour")).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  6. CLAUSE DE RATTRAPAGE (LE FILET)
// ═════════════════════════════════════════════════════════════════════════════
describe("Clause de rattrapage", () => {
  it("le seuil minimal du filet vaut 338 h", () => {
    expect(valeurDe("rattrapageSeuilMin")).toBe(338);
  });

  it("le filet se déclenche bien en dessous du seuil normal", () => {
    expect(valeurDe("rattrapageSeuilMin")).toBeLessThan(valeurDe("seuilHeures"));
  });

  it("la durée maximale du filet est de 6 mois", () => {
    expect(valeurDe("rattrapageDureeMois")).toBe(6);
    // Moins d'un an : le filet ne remplace pas une ouverture de droits.
    expect(valeurDe("rattrapageDureeMois") * 30).toBeLessThan(valeurDe("dureeIndemnisationJours"));
  });

  it("la seconde condition cumulative est de 5 ouvertures de droits", () => {
    expect(valeurDe("rattrapageOuverturesMin")).toBe(5);
  });

  it("les 338 h ne suffisent pas seules : la condition des 5 ouvertures existe bien", () => {
    // Loi de prudence : le moteur n'a pas l'historique des ouvertures, il ne
    // doit donc jamais affirmer le filet acquis sur les seules 338 h.
    // Ce test garantit que la seconde condition n'a pas été supprimée du référentiel.
    expect(getRegle("rattrapageOuverturesMin")).not.toBeNull();
    expect(REGLES.rattrapageSeuilMin.commentaire).toContain("NE SUFFIT PAS");
  });

  it("cinq années d'affiliation représentent 2535 heures", () => {
    expect(valeurDe("rattrapageOuverturesMin") * valeurDe("seuilHeures")).toBe(2535);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  7. CONGÉS SPECTACLES
// ═════════════════════════════════════════════════════════════════════════════
describe("Congés Spectacles (Audiens)", () => {
  it("le taux de l'indemnité vaut 10 % des bruts de l'exercice", () => {
    expect(valeurDe("congesSpectaclesTaux")).toBe(0.1);
  });

  it("les deux bordereaux réels du backtest retombent au centime", () => {
    // Exercices 2023-2024 et 2024-2025, cités par la source de la règle.
    expect(arrondi2(7381 * valeurDe("congesSpectaclesTaux"))).toBe(738.1);
    expect(arrondi2(10055 * valeurDe("congesSpectaclesTaux"))).toBe(1005.5);
  });

  it("un exercice sans aucun brut donne une indemnité nulle, jamais NaN", () => {
    const icp = 0 * valeurDe("congesSpectaclesTaux");
    expect(icp).toBe(0);
    expect(Number.isNaN(icp)).toBe(false);
  });

  it("le ratio net social sur brut vaut 76,95 %", () => {
    expect(valeurDe("congesSpectaclesRatioNetSocial")).toBe(0.7695);
  });

  it("le ratio est bien une part du brut (entre 0 et 1) et laisse 23,05 % de cotisations", () => {
    const ratio = valeurDe("congesSpectaclesRatioNetSocial");
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
    expect(arrondi2((1 - ratio) * 100)).toBe(23.05);
  });

  it("le net social se calcule sur le brut, donc reste inférieur au brut", () => {
    const brut = arrondi2(7381 * valeurDe("congesSpectaclesTaux"));
    const net = arrondi2(brut * valeurDe("congesSpectaclesRatioNetSocial"));
    expect(net).toBe(567.97);
    expect(net).toBeLessThan(brut);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  8. ALLOCATION JOURNALIÈRE : PLANCHERS, PLAFOND, PRÉLÈVEMENTS
// ═════════════════════════════════════════════════════════════════════════════
describe("Allocation journalière : les repères qui bornent le montant affiché", () => {
  it("l'allocation journalière minimale vaut 31,96 euros", () => {
    expect(valeurDe("ajMinimale")).toBe(31.96);
  });

  it("le plafond de l'allocation journalière vaut 155,77 euros", () => {
    // VALEUR CRITIQUE, corrigée le 27/07/2026 (on avait 174,80 € périmé).
    // Si ce test repasse à 174,80, un artiste très bien payé verra une
    // allocation SUPÉRIEURE à la réalité : c'est une promesse fausse.
    expect(valeurDe("allocationPlafondAJ")).toBe(155.77);
    expect(valeurDe("allocationPlafondAJ")).not.toBe(174.8);
  });

  it("le plafond est très au dessus du minimum : la fourchette est cohérente", () => {
    expect(valeurDe("allocationPlafondAJ")).toBeGreaterThan(valeurDe("ajMinimale"));
  });

  it("la formule C ne peut pas à elle seule dépasser le plancher de son annexe", () => {
    // C = AJmin x coefC. Annexe 8 : 31,96 x 0,40 = 12,78 €, sous le plancher
    // de 38 €. Annexe 10 : 31,96 x 0,70 = 22,37 €, sous le plancher de 44 €.
    // C'est bien le plancher qui protège l'allocataire, pas la formule.
    const a8 = valeurDe("allocationParametresAnnexe8");
    const a10 = valeurDe("allocationParametresAnnexe10");
    expect(arrondi2(valeurDe("ajMinimale") * a8.coefC)).toBe(12.78);
    expect(arrondi2(valeurDe("ajMinimale") * a10.coefC)).toBe(22.37);
    expect(arrondi2(valeurDe("ajMinimale") * a8.coefC)).toBeLessThan(a8.plancherAJ);
    expect(arrondi2(valeurDe("ajMinimale") * a10.coefC)).toBeLessThan(a10.plancherAJ);
  });

  it("la retenue retraite complémentaire est de 0,93 % avec ses deux seuils", () => {
    expect(valeurDe("allocationRetenueRetraiteComp")).toEqual({
      taux: 0.0093,
      seuilExoneration: 31.96,
      seuilCsg: 60.0,
    });
  });

  it("le seuil d'exonération de la retenue est exactement l'allocation minimale", () => {
    // Les deux repères doivent bouger ensemble à chaque revalorisation du SMIC.
    expect(valeurDe("allocationRetenueRetraiteComp").seuilExoneration).toBe(valeurDe("ajMinimale"));
  });

  it("les seuils de prélèvement s'enchaînent dans le bon ordre", () => {
    const ret = valeurDe("allocationRetenueRetraiteComp");
    // Sous 31,96 € : rien. Entre 31,96 et 60 € : retraite seule.
    // Au dessus de 60 € : retraite + CSG/CRDS.
    expect(ret.seuilExoneration).toBeLessThan(ret.seuilCsg);
  });

  it("les taux CSG/CRDS et l'assiette de 98,25 % sont figés", () => {
    expect(valeurDe("allocationCsgCrds")).toEqual({
      csgPlein: 0.062,
      csgReduit: 0.038,
      crds: 0.005,
      assiette: 0.9825,
    });
  });

  it("CSG pleine plus CRDS font bien les 6,7 % annoncés", () => {
    const c = valeurDe("allocationCsgCrds");
    expect(arrondi2((c.csgPlein + c.crds) * 100)).toBe(6.7);
  });

  it("le taux réduit de CSG est bien inférieur au taux plein", () => {
    const c = valeurDe("allocationCsgCrds");
    expect(c.csgReduit).toBeLessThan(c.csgPlein);
  });

  it("l'assiette est une part de l'allocation, jamais un montant", () => {
    const c = valeurDe("allocationCsgCrds");
    expect(c.assiette).toBeGreaterThan(0);
    expect(c.assiette).toBeLessThan(1);
  });

  it("le plancher net après CSG/CRDS vaut 62,00 euros", () => {
    expect(valeurDe("allocationPlancherNetCsg")).toBe(62.0);
  });

  it("le plancher net se situe au dessus du seuil de déclenchement de la CSG", () => {
    // La CSG ne s'applique qu'au delà de 60 €, et le net ne peut pas tomber
    // sous 62 € : les trois cas réels du backtest (63,27 / 64,64 / 65,99 €)
    // donnent tous 62,00 € net.
    expect(valeurDe("allocationPlancherNetCsg")).toBeGreaterThan(
      valeurDe("allocationRetenueRetraiteComp").seuilCsg,
    );
  });

  it("une allocation déjà sous le plancher net ne subit aucune retenue CSG", () => {
    // Règle du référentiel : si le brut est sous 62 €, la retenue est ZÉRO.
    const plancher = valeurDe("allocationPlancherNetCsg");
    const retenueEcretee = (brut) => Math.max(0, Math.min(brut * 0.067, brut - plancher));
    expect(retenueEcretee(55)).toBe(0);
    expect(retenueEcretee(62)).toBe(0);
    // Juste au dessus, la retenue existe mais ne descend pas sous 62 €.
    expect(arrondi2(62.5 - retenueEcretee(62.5))).toBe(62);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  9. PMSS ET FRANCHISE CONGÉS
// ═════════════════════════════════════════════════════════════════════════════
describe("PMSS et franchise congés payés", () => {
  it("le PMSS 2026 vaut 4 005 euros et le cumul est plafonné à 118 %", () => {
    expect(valeurDe("pmssMensuel")).toEqual({
      montant: 4005.0,
      annee: 2026,
      coefPlafondCumul: 1.18,
    });
  });

  it("le plafond de cumul ARE plus salaires se calcule à 4 725,90 euros en 2026", () => {
    const p = valeurDe("pmssMensuel");
    expect(arrondi2(p.montant * p.coefPlafondCumul)).toBe(4725.9);
  });

  it("l'exemple officiel du guide (PMSS 2024) retombe sur 4 559,52 euros une fois arrondi", () => {
    // Attention : 3864 x 1,18 vaut 4559,5199999... en virgule flottante.
    // Tout montant issu de ce coefficient DOIT être arrondi avant affichage.
    const p = valeurDe("pmssMensuel");
    expect(arrondi2(3864 * p.coefPlafondCumul)).toBe(4559.52);
  });

  it("la franchise congés est de 2,5 jours par tranche de 24 jours, plafonnée à 30", () => {
    expect(valeurDe("franchiseCongesParJours")).toEqual({
      jours: 2.5,
      parTravailles: 24,
      plafond: 30,
    });
  });

  it("la franchise ne dépasse jamais son plafond de 30 jours", () => {
    const f = valeurDe("franchiseCongesParJours");
    const franchise = (joursTravailles) =>
      Math.min(f.plafond, Math.floor(joursTravailles / f.parTravailles) * f.jours);
    expect(franchise(0)).toBe(0);
    expect(franchise(23)).toBe(0); // pas de tranche complète
    expect(franchise(24)).toBe(2.5); // une tranche
    expect(franchise(240)).toBe(25); // dix tranches
    expect(franchise(10000)).toBe(30); // écrêté au plafond
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  10. LES FONCTIONS EXPOSÉES
// ═════════════════════════════════════════════════════════════════════════════
describe("moteurHeuresValide()", () => {
  afterEach(() => {
    // On restaure toujours l'état réel du référentiel après une simulation.
    REGLES.seuilHeures.verifie = true;
    REGLES.cachetHeures.verifie = true;
    REGLES.periodeReferenceJours.verifie = true;
  });

  it("renvoie vrai aujourd'hui : les trois règles clés sont vérifiées", () => {
    expect(moteurHeuresValide()).toBe(true);
  });

  it("redescend à faux dès qu'une des trois règles clés n'est plus vérifiée", () => {
    // Garantit que la fonction lit vraiment le référentiel et ne renvoie pas
    // un "true" en dur : le badge de confiance doit pouvoir redescendre.
    for (const cle of ["seuilHeures", "cachetHeures", "periodeReferenceJours"]) {
      REGLES[cle].verifie = false;
      expect(moteurHeuresValide(), `${cle} non vérifiée devrait invalider le moteur`).toBe(false);
      REGLES[cle].verifie = true;
    }
    expect(moteurHeuresValide()).toBe(true);
  });

  it("ne dépend pas des règles qui ne sont pas des règles clés", () => {
    // La franchise congés est non vérifiée depuis toujours, sans que cela
    // invalide le décompte des heures.
    expect(REGLES.franchiseCongesParJours.verifie).toBe(false);
    expect(moteurHeuresValide()).toBe(true);
  });
});

describe("getRegle()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renvoie la règle complète avec sa traçabilité", () => {
    const r = getRegle("seuilHeures");
    expect(r.valeur).toBe(507);
    expect(r.libelle).toBe("Seuil d'ouverture de droits");
    expect(r.verifie).toBe(true);
    expect(r.source).toContain("ARTCENA");
  });

  it("renvoie null et prévient en console pour une règle inconnue", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getRegle("seuilHeuresBidon")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("seuilHeuresBidon");
  });

  it("ne casse pas si on lui passe une clé vide ou absente", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getRegle("")).toBeNull();
    expect(getRegle(undefined)).toBeNull();
    expect(getRegle(null)).toBeNull();
  });
});

describe("valeurDe()", () => {
  it("renvoie la valeur brute d'une règle simple", () => {
    expect(valeurDe("seuilHeures")).toBe(507);
    expect(valeurDe("cachetHeures")).toBe(12);
  });

  it("renvoie l'objet complet pour une règle composite", () => {
    expect(valeurDe("pmssMensuel").montant).toBe(4005.0);
  });

  it("renvoie null pour une règle inconnue, sans lever d'erreur", () => {
    // Important : le code appelant écrit souvent valeurDe(x) || repli.
    // Un null est rattrapable, une exception ferait un écran blanc.
    expect(valeurDe("regleQuiNexistePas")).toBeNull();
    expect(valeurDe("")).toBeNull();
    expect(valeurDe(undefined)).toBeNull();
  });

  it("aucune règle ne vaut zéro ou une chaîne vide (le repli || serait piégeux)", () => {
    // Le motif valeurDe(x) || 5 utilisé dans l'app confondrait 0 et "absent".
    for (const [cle, r] of Object.entries(REGLES)) {
      expect(r.valeur, `règle ${cle}`).not.toBe(0);
      expect(r.valeur, `règle ${cle}`).not.toBe("");
    }
  });
});

describe("tracer()", () => {
  it("compose une phrase lisible avec valeur, source et version", () => {
    const t = tracer("seuilHeures");
    expect(t).toContain("Seuil d'ouverture de droits");
    expect(t).toContain("507");
    expect(t).toContain("Source :");
    expect(t).toContain("version 2026.07");
  });

  it("sérialise les règles composites au lieu d'afficher [object Object]", () => {
    const t = tracer("pmssMensuel");
    expect(t).not.toContain("[object Object]");
    expect(t).toContain("4005");
    expect(t).toContain("1.18");
  });

  it("ajoute la réserve de prudence sur une règle non vérifiée", () => {
    expect(tracer("franchiseCongesParJours")).toContain("validation experte en cours");
  });

  it("n'ajoute aucune réserve sur une règle vérifiée", () => {
    expect(tracer("seuilHeures")).not.toContain("validation experte en cours");
  });

  it("renvoie une chaîne vide pour une règle inconnue (jamais 'undefined' à l'écran)", () => {
    expect(tracer("regleFantome")).toBe("");
  });

  it("aucune règle ne produit une phrase contenant 'undefined'", () => {
    // Filet global : une règle mal formée se verrait immédiatement à l'écran
    // dans le bouton "Pourquoi ?".
    for (const cle of Object.keys(REGLES)) {
      expect(tracer(cle), `règle ${cle}`).not.toContain("undefined");
    }
  });
});
