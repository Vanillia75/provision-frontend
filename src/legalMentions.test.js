// ============================================================================
//  legalMentions.test.js
//  Filet de sécurité sur les mentions légales obligatoires des factures/devis.
//
//  Pourquoi ces tests : une facture à laquelle il manque SA mention obligatoire
//  n'est pas conforme. C'est un risque légal pour l'utilisateur, pas un détail
//  d'affichage. On teste donc le COMPORTEMENT (quelle mention sort dans quelle
//  situation, quels montants) et jamais la mise en forme.
//
//  Le dernier bloc « JUMEAU BACKEND » compare le site au serveur
//  (provision-backend/legal_mentions.py). Les valeurs attendues de ce bloc ont
//  été relevées EN EXÉCUTANT le fichier Python, ce ne sont pas des suppositions.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  franchiseVatMention,
  appendEiMention,
  formatVatRate,
  computeInvoiceTotals,
  b2bLateFeeMention,
  MENTION_HORS_FRANCE,
  MENTION_AUTOLIQUIDATION,
  MENTION_PENALITES_B2B,
} from "./legalMentions.js";

// Le séparateur entre le nom et « EI » est un demi-cadratin (U+2013), pas un
// trait d'union. On l'écrit en code caractère pour qu'aucun copier-coller ne
// puisse le remplacer en douce par un autre signe.
const TIRET_EI = "–";

describe("franchiseVatMention : la mention TVA de l'auto-entrepreneur", () => {
  it("affiche la mention obligatoire de l'article 293 B du CGI", () => {
    expect(franchiseVatMention()).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("ne dépend pas de la date de la facture (signature stable, même texte)", () => {
    const attendu = "TVA non applicable, art. 293 B du CGI";
    expect(franchiseVatMention(null)).toBe(attendu);
    expect(franchiseVatMention("2026-01-01")).toBe(attendu);
    expect(franchiseVatMention(new Date("2027-12-31"))).toBe(attendu);
  });

  it("n'est jamais vide ni undefined (une facture sans mention n'est pas conforme)", () => {
    const m = franchiseVatMention();
    expect(typeof m).toBe("string");
    expect(m.trim().length).toBeGreaterThan(0);
    expect(m).not.toContain("undefined");
  });
});

describe("appendEiMention : le suffixe « EI » de l'entrepreneur individuel", () => {
  it("ajoute la mention EI au nom d'un auto-entrepreneur", () => {
    expect(appendEiMention("Camille Gardereau", "auto_entrepreneur")).toBe(
      `Camille Gardereau ${TIRET_EI} EI`
    );
  });

  it("préserve un nom commercial et lui accole la mention", () => {
    expect(appendEiMention("Studio Vanillia", "auto_entrepreneur")).toBe(
      `Studio Vanillia ${TIRET_EI} EI`
    );
  });

  it("utilise bien un demi-cadratin U+2013 comme séparateur", () => {
    const nom = appendEiMention("Test", "auto_entrepreneur");
    // On isole le caractère placé juste avant « EI » et on vérifie son code.
    const separateur = nom.charAt(nom.length - 4);
    expect(separateur.codePointAt(0)).toBe(0x2013);
  });

  it("ne touche pas au nom d'une société (la mention EI ne concerne qu'eux)", () => {
    expect(appendEiMention("Vanillia SAS", "sasu")).toBe("Vanillia SAS");
    expect(appendEiMention("Vanillia SAS", "societe")).toBe("Vanillia SAS");
    expect(appendEiMention("Vanillia SAS", null)).toBe("Vanillia SAS");
    expect(appendEiMention("Vanillia SAS", undefined)).toBe("Vanillia SAS");
    expect(appendEiMention("Vanillia SAS", "")).toBe("Vanillia SAS");
  });

  it("ne duplique pas la mention si le nom se termine déjà par EI", () => {
    expect(appendEiMention("Studio EI", "auto_entrepreneur")).toBe("Studio EI");
  });

  it("détecte la mention déjà présente même avec des espaces autour", () => {
    expect(appendEiMention("Studio EI  ", "auto_entrepreneur")).toBe("Studio EI  ");
    expect(appendEiMention(`Camille ${TIRET_EI} EI`, "auto_entrepreneur")).toBe(
      `Camille ${TIRET_EI} EI`
    );
  });

  it("est idempotente : l'appliquer deux fois ne double pas la mention", () => {
    const une = appendEiMention("Camille", "auto_entrepreneur");
    const deux = appendEiMention(une, "auto_entrepreneur");
    expect(deux).toBe(une);
  });

  it("ne confond pas un nom commençant par « EI » avec la mention légale", () => {
    // « EIFFEL » contient EI mais ce n'est pas la mention : il faut l'ajouter.
    expect(appendEiMention("Studio EIFFEL", "auto_entrepreneur")).toBe(
      `Studio EIFFEL ${TIRET_EI} EI`
    );
    expect(appendEiMention("EI Conseil", "auto_entrepreneur")).toBe(
      `EI Conseil ${TIRET_EI} EI`
    );
  });

  it("ne fabrique jamais « undefined – EI » ni « null – EI » quand le nom manque", () => {
    expect(appendEiMention(undefined, "auto_entrepreneur")).toBeUndefined();
    expect(appendEiMention(null, "auto_entrepreneur")).toBeNull();
    expect(appendEiMention("", "auto_entrepreneur")).toBe("");
  });
});

describe("b2bLateFeeMention : les pénalités de retard entre professionnels", () => {
  it("sort la mention sur une FACTURE adressée à un professionnel", () => {
    expect(b2bLateFeeMention("professionnel", "facture")).toBe(MENTION_PENALITES_B2B);
  });

  it("considère « facture » par défaut quand le type de document n'est pas précisé", () => {
    expect(b2bLateFeeMention("professionnel")).toBe(MENTION_PENALITES_B2B);
  });

  it("contient les trois éléments légalement obligatoires", () => {
    const m = b2bLateFeeMention("professionnel", "facture");
    expect(m).toContain("trois fois le taux d'intérêt légal"); // taux des pénalités
    expect(m).toContain("40 €"); // indemnité forfaitaire de recouvrement
    expect(m).toContain("L441-10");
    expect(m).toContain("D441-5");
    expect(m).toContain("Pas d'escompte pour paiement anticipé");
  });

  it("ne met AUCUNE pénalité sur un devis (un devis n'est pas exigible)", () => {
    expect(b2bLateFeeMention("professionnel", "devis")).toBeNull();
  });

  it("ne met aucune pénalité pour un client particulier", () => {
    expect(b2bLateFeeMention("particulier", "facture")).toBeNull();
  });

  it("traite un type de client absent comme un particulier (pas de pénalités)", () => {
    expect(b2bLateFeeMention(null, "facture")).toBeNull();
    expect(b2bLateFeeMention(undefined, "facture")).toBeNull();
    expect(b2bLateFeeMention("", "facture")).toBeNull();
  });

  it("ignore un type de client inconnu plutôt que d'inventer des pénalités", () => {
    expect(b2bLateFeeMention("association", "facture")).toBeNull();
  });

  it("renvoie soit null, soit un vrai texte : jamais une chaîne vide ni undefined", () => {
    const combinaisons = [
      ["professionnel", "facture"],
      ["professionnel", "devis"],
      ["particulier", "facture"],
      [null, "facture"],
      [undefined, undefined],
    ];
    for (const [type, kind] of combinaisons) {
      const m = b2bLateFeeMention(type, kind);
      expect(m === null || (typeof m === "string" && m.length > 0)).toBe(true);
      expect(m).not.toBe(undefined);
    }
  });
});

describe("formatVatRate : affichage français d'un taux de TVA", () => {
  it("affiche un taux entier sans décimales inutiles", () => {
    expect(formatVatRate(20)).toBe("20");
    expect(formatVatRate(10)).toBe("10");
    expect(formatVatRate(20.0)).toBe("20");
    expect(formatVatRate(0)).toBe("0");
  });

  it("affiche un taux décimal avec une virgule (jamais un point)", () => {
    expect(formatVatRate(5.5)).toBe("5,5");
    expect(formatVatRate(2.1)).toBe("2,1");
    expect(formatVatRate(8.5)).toBe("8,5");
  });

  it("ne laisse jamais de point décimal à l'écran, quel que soit le taux", () => {
    for (const taux of [0, 2.1, 5.5, 8.5, 10, 13, 20, 100]) {
      expect(formatVatRate(taux)).not.toContain(".");
    }
  });

  it("ne mange pas les zéros significatifs d'un nombre rond", () => {
    // Piège classique du « rstrip des zéros » : 100 ne doit pas devenir « 1 ».
    expect(formatVatRate(100)).toBe("100");
    expect(formatVatRate(200)).toBe("200");
  });
});

describe("computeInvoiceTotals : franchise en base de TVA (cas par défaut)", () => {
  it("retombe en franchise quand aucun réglage fiscal n'est fourni", () => {
    for (const fiscal of [null, undefined, {}]) {
      const r = computeInvoiceTotals(1000, fiscal);
      expect(r.mode).toBe("franchise");
      expect(r.mention).toBe("TVA non applicable, art. 293 B du CGI");
    }
  });

  it("retombe en franchise plutôt que d'inventer une TVA sur un mode inconnu", () => {
    const r = computeInvoiceTotals(1000, { vat_mode: "mode_inexistant", vat_rate: 20 });
    expect(r.mode).toBe("franchise");
    expect(r.tva).toBe(0);
    expect(r.ttc).toBe(1000);
  });

  it("n'ajoute aucune TVA : le TTC est égal au HT", () => {
    const r = computeInvoiceTotals(850.5, { vat_mode: "franchise" });
    expect(r.rate).toBe(0);
    expect(r.tva).toBe(0);
    expect(r.ttc).toBe(850.5);
    expect(r.ht).toBe(850.5);
  });

  it("n'affiche aucun numéro de TVA, même s'il traîne dans les réglages", () => {
    // Un émetteur en franchise ne facture pas de TVA : afficher un numéro serait
    // contradictoire avec la mention 293 B.
    const r = computeInvoiceTotals(100, { vat_mode: "franchise", vat_number: "FR123456789" });
    expect(r.vat_number).toBeNull();
  });
});

describe("computeInvoiceTotals : émetteur assujetti à la TVA", () => {
  it("calcule la TVA et le TTC au taux indiqué", () => {
    const r = computeInvoiceTotals(100, { vat_mode: "assujetti", vat_rate: 20 });
    expect(r.mode).toBe("assujetti");
    expect(r.rate).toBe(20);
    expect(r.tva).toBe(20);
    expect(r.ttc).toBe(120);
  });

  it("applique les taux réduits", () => {
    expect(computeInvoiceTotals(1000, { vat_mode: "assujetti", vat_rate: 5.5 }).tva).toBe(55);
    expect(computeInvoiceTotals(1000, { vat_mode: "assujetti", vat_rate: 2.1 }).tva).toBe(21);
    expect(computeInvoiceTotals(1000, { vat_mode: "assujetti", vat_rate: 10 }).tva).toBe(100);
  });

  it("prend 20 % par défaut quand le taux n'est pas renseigné", () => {
    for (const fiscal of [
      { vat_mode: "assujetti" },
      { vat_mode: "assujetti", vat_rate: null },
      { vat_mode: "assujetti", vat_rate: undefined },
    ]) {
      const r = computeInvoiceTotals(200, fiscal);
      expect(r.rate).toBe(20);
      expect(r.tva).toBe(40);
      expect(r.ttc).toBe(240);
    }
  });

  it("ne colle JAMAIS la mention 293 B sur une facture avec TVA", () => {
    // Afficher « TVA non applicable » à côté d'une ligne de TVA serait une
    // facture fausse. La mention doit être explicitement absente.
    const r = computeInvoiceTotals(100, { vat_mode: "assujetti", vat_rate: 20 });
    expect(r.mention).toBeNull();
  });

  it("reprend le numéro de TVA de l'émetteur", () => {
    const r = computeInvoiceTotals(100, {
      vat_mode: "assujetti",
      vat_rate: 20,
      vat_number: "FR40123456789",
    });
    expect(r.vat_number).toBe("FR40123456789");
  });

  it("accepte un taux à 0 sans repasser en franchise", () => {
    const r = computeInvoiceTotals(500, { vat_mode: "assujetti", vat_rate: 0 });
    expect(r.mode).toBe("assujetti");
    expect(r.tva).toBe(0);
    expect(r.ttc).toBe(500);
    expect(r.mention).toBeNull();
  });

  it("arrondit la TVA au centime", () => {
    const r = computeInvoiceTotals(1234.56, { vat_mode: "assujetti", vat_rate: 20 });
    expect(r.tva).toBe(246.91);
    expect(r.ttc).toBe(1481.47);
  });
});

describe("computeInvoiceTotals : client professionnel à l'étranger", () => {
  it("client dans l'Union européenne : mention 259-1 ET autoliquidation", () => {
    const r = computeInvoiceTotals(2000, { vat_mode: "assujetti_ue", vat_number: "FR40123456789" });
    expect(r.mode).toBe("assujetti_ue");
    expect(r.mention).toBe("TVA non applicable, art. 259-1 du CGI · Autoliquidation");
    expect(r.mention).toContain(MENTION_HORS_FRANCE);
    expect(r.mention).toContain(MENTION_AUTOLIQUIDATION);
  });

  it("client hors Union européenne : mention 259-1 SEULE, sans autoliquidation", () => {
    // L'autoliquidation est une règle interne à l'UE : l'écrire pour un client
    // hors UE serait une mention fausse.
    const r = computeInvoiceTotals(2000, { vat_mode: "assujetti_export" });
    expect(r.mode).toBe("assujetti_export");
    expect(r.mention).toBe("TVA non applicable, art. 259-1 du CGI");
    expect(r.mention).not.toContain("Autoliquidation");
  });

  it("ne facture aucune TVA française dans les deux cas étrangers", () => {
    for (const mode of ["assujetti_ue", "assujetti_export"]) {
      const r = computeInvoiceTotals(1500.75, { vat_mode: mode, vat_rate: 20 });
      expect(r.rate).toBe(0);
      expect(r.tva).toBe(0);
      expect(r.ttc).toBe(1500.75);
    }
  });

  it("garde le numéro de TVA de l'émetteur (obligatoire pour l'autoliquidation)", () => {
    for (const mode of ["assujetti_ue", "assujetti_export"]) {
      const r = computeInvoiceTotals(100, { vat_mode: mode, vat_number: "FR40123456789" });
      expect(r.vat_number).toBe("FR40123456789");
    }
  });

  it("ne remplace pas la mention étrangère par la mention 293 B", () => {
    for (const mode of ["assujetti_ue", "assujetti_export"]) {
      const r = computeInvoiceTotals(100, { vat_mode: mode });
      expect(r.mention).not.toContain("293 B");
    }
  });
});

describe("computeInvoiceTotals : cas limites (zéro, absent, négatif, illisible)", () => {
  it("un montant à zéro donne des totaux à zéro mais garde sa mention", () => {
    const r = computeInvoiceTotals(0, null);
    expect(r.ht).toBe(0);
    expect(r.tva).toBe(0);
    expect(r.ttc).toBe(0);
    expect(r.mention).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("un montant absent est traité comme zéro, pas comme une erreur", () => {
    for (const montant of [null, undefined, "", 0]) {
      expect(computeInvoiceTotals(montant, null).ht).toBe(0);
    }
  });

  it("un montant illisible ne produit jamais NaN sur une facture", () => {
    // Un « NaN € » imprimé sur une facture serait catastrophique.
    const r = computeInvoiceTotals("montant cassé", { vat_mode: "assujetti", vat_rate: 20 });
    expect(Number.isNaN(r.ht)).toBe(false);
    expect(Number.isNaN(r.tva)).toBe(false);
    expect(Number.isNaN(r.ttc)).toBe(false);
    expect(r.ht).toBe(0);
  });

  it("accepte un montant en texte numérique", () => {
    expect(computeInvoiceTotals("1250.50", null).ht).toBe(1250.5);
  });

  it("gère un montant négatif (avoir) sans casser le calcul", () => {
    const r = computeInvoiceTotals(-100, { vat_mode: "assujetti", vat_rate: 20 });
    expect(r.ht).toBe(-100);
    expect(r.tva).toBe(-20);
    expect(r.ttc).toBe(-120);
  });

  it("arrondit le HT au centime", () => {
    expect(computeInvoiceTotals(10.004, null).ht).toBe(10);
    expect(computeInvoiceTotals(10.006, null).ht).toBe(10.01);
  });

  it("ne modifie jamais le HT selon le mode de TVA (c'est lui qui alimente le CA URSSAF)", () => {
    const modes = [
      null,
      { vat_mode: "franchise" },
      { vat_mode: "assujetti", vat_rate: 20 },
      { vat_mode: "assujetti_ue" },
      { vat_mode: "assujetti_export" },
    ];
    for (const fiscal of modes) {
      expect(computeInvoiceTotals(1830.4, fiscal).ht).toBe(1830.4);
    }
  });

  it("aucune situation ne produit une mention vide ou undefined", () => {
    const modes = [
      null,
      {},
      { vat_mode: "franchise" },
      { vat_mode: "assujetti", vat_rate: 20 },
      { vat_mode: "assujetti_ue" },
      { vat_mode: "assujetti_export" },
      { vat_mode: "inconnu" },
    ];
    for (const fiscal of modes) {
      const r = computeInvoiceTotals(500, fiscal);
      expect(Object.keys(r)).toContain("mention");
      // La mention est soit un vrai texte, soit volontairement null (assujetti
      // français). Jamais undefined, jamais une chaîne vide.
      expect(r.mention === null || (typeof r.mention === "string" && r.mention.trim().length > 0)).toBe(true);
      expect(r.mention).not.toBe(undefined);
      expect(r.mention).not.toBe("");
    }
  });

  it("renvoie toujours les sept champs attendus, sans undefined ni NaN", () => {
    const modes = [
      null,
      { vat_mode: "franchise" },
      { vat_mode: "assujetti", vat_rate: 5.5, vat_number: "FR40123456789" },
      { vat_mode: "assujetti_ue", vat_number: "FR40123456789" },
      { vat_mode: "assujetti_export" },
    ];
    for (const fiscal of modes) {
      const r = computeInvoiceTotals(742.3, fiscal);
      for (const champ of ["mode", "ht", "rate", "tva", "ttc", "vat_number", "mention"]) {
        expect(Object.keys(r)).toContain(champ);
        expect(r[champ]).not.toBe(undefined);
      }
      for (const champ of ["ht", "rate", "tva", "ttc"]) {
        expect(Number.isFinite(r[champ])).toBe(true);
      }
    }
  });
});

// ============================================================================
//  JUMEAU BACKEND
//  Le site et le serveur doivent dire EXACTEMENT la même chose : l'aperçu à
//  l'écran et le PDF officiel envoyé au client viennent de deux codes
//  différents. Les valeurs attendues ci-dessous ont été relevées en exécutant
//  provision-backend/legal_mentions.py.
// ============================================================================

describe("JUMEAU BACKEND : les textes doivent être identiques au serveur", () => {
  it("mention de franchise identique au serveur", () => {
    expect(franchiseVatMention()).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("mentions client étranger identiques au serveur", () => {
    expect(MENTION_HORS_FRANCE).toBe("TVA non applicable, art. 259-1 du CGI");
    expect(MENTION_AUTOLIQUIDATION).toBe("Autoliquidation");
    expect(computeInvoiceTotals(100, { vat_mode: "assujetti_ue" }).mention).toBe(
      "TVA non applicable, art. 259-1 du CGI · Autoliquidation"
    );
  });

  it("mention pénalités de retard identique au serveur, au caractère près", () => {
    expect(MENTION_PENALITES_B2B).toBe(
      "En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal " +
        "et indemnité forfaitaire de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce). " +
        "Pas d'escompte pour paiement anticipé."
    );
  });

  it("suffixe EI identique au serveur", () => {
    expect(appendEiMention("Camille Gardereau", "auto_entrepreneur")).toBe(
      "Camille Gardereau – EI"
    );
    expect(appendEiMention("Studio EI", "auto_entrepreneur")).toBe("Studio EI");
    expect(appendEiMention("Studio EIFFEL", "auto_entrepreneur")).toBe(
      "Studio EIFFEL – EI"
    );
    expect(appendEiMention("Ma boite", "sasu")).toBe("Ma boite");
  });

  it("formatage des taux identique au serveur", () => {
    const attenduServeur = [
      [20, "20"],
      [5.5, "5,5"],
      [2.1, "2,1"],
      [10, "10"],
      [0, "0"],
      [8.5, "8,5"],
    ];
    for (const [taux, attendu] of attenduServeur) {
      expect(formatVatRate(taux)).toBe(attendu);
    }
  });

  it("mentions pénalités B2B : mêmes déclenchements que le serveur", () => {
    expect(b2bLateFeeMention("professionnel", "facture")).toBe(MENTION_PENALITES_B2B);
    expect(b2bLateFeeMention("professionnel", "devis")).toBeNull();
    expect(b2bLateFeeMention("particulier", "facture")).toBeNull();
    expect(b2bLateFeeMention(null, "facture")).toBeNull();
  });
});

describe("JUMEAU BACKEND : les montants doivent être identiques au serveur", () => {
  it("montants courants : mêmes totaux que le serveur", () => {
    // Cas relevés sur le serveur, tous en accord aujourd'hui.
    const cas = [
      [100, 20, 100, 20, 120],
      [1234.56, 20, 1234.56, 246.91, 1481.47],
      [1000, 5.5, 1000, 55, 1055],
      [3.75, 10, 3.75, 0.38, 4.13],
      [0, 20, 0, 0, 0],
    ];
    for (const [montant, taux, ht, tva, ttc] of cas) {
      const r = computeInvoiceTotals(montant, { vat_mode: "assujetti", vat_rate: taux });
      expect([r.ht, r.tva, r.ttc]).toEqual([ht, tva, ttc]);
    }
  });

  // ⚠️ Ces deux cas ont RÉVÉLÉ un vrai bug le 06/08/2026 : le serveur utilisait
  // l'arrondi de Python (les demis vers le chiffre pair), donc l'aperçu affiché
  // dans l'app et la facture PDF envoyée au client divergeaient d'un centime.
  // Le serveur a été aligné sur l'arrondi commercial français (les demis montent),
  // qui est celui du site. Ces tests verrouillent maintenant l'ACCORD des jumeaux :
  // s'ils redeviennent rouges, c'est que quelqu'un a retouché un des deux arrondis.
  it("le HT arrondit les demi-centimes vers le haut, comme le serveur", () => {
    // Cas réel : 1,5 heure facturée 8,75 EUR de l'heure = 13,125 EUR.
    expect(computeInvoiceTotals(13.125, null).ht).toBe(13.13);
    expect(computeInvoiceTotals(113.125, null).ht).toBe(113.13);
    expect(computeInvoiceTotals(2.675, null).ht).toBe(2.68);
  });

  it("la TVA arrondit les demi-centimes vers le haut, comme le serveur", () => {
    // Cas réel : 62,55 EUR HT à 10 %. Les deux jumeaux disent 6,26 EUR.
    const r = computeInvoiceTotals(62.55, { vat_mode: "assujetti", vat_rate: 10 });
    expect(r.tva).toBe(6.26);
    expect(r.ttc).toBe(68.81);

    const gros = computeInvoiceTotals(1006.25, { vat_mode: "assujetti", vat_rate: 10 });
    expect(gros.tva).toBe(100.63);
    expect(gros.ttc).toBe(1106.88);
  });
});
