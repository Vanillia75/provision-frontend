// ─────────────────────────────────────────────────────────────────────────────
//  Tests de src/format.js : mise en forme des montants, des dates,
//  et conversion des activités en heures (le coeur du compteur des 507h).
//
//  Ce qu'on vérifie ici, ce n'est PAS l'apparence : c'est le comportement qui
//  coûte de l'argent ou de la confiance à l'utilisateur.
//    · un montant ne doit jamais afficher "NaN" ni "undefined" ;
//    · un cachet vaut 12 h (et plus jamais 8 h) ;
//    · une date civile ne doit pas changer de jour à cause du fuseau horaire ;
//    · une heure travaillée ne doit pas disparaître du compteur.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  formatEUR,
  formatDate,
  heuresDe,
  formatPeriode,
  normEmployeur,
  historiqueEmployeur,
  heuresFenetre,
} from "./format";
import { valeurDe } from "./regles_intermittent";

// ─── Outils communs ──────────────────────────────────────────────────────────

// Intl produit des espaces INSÉCABLES (fine ou normale selon la version d'ICU)
// et parfois un vrai signe moins typographique. On compare donc sur une version
// « normalisée » : ce qui compte est le groupement des milliers, la virgule
// décimale et la place du symbole euro, pas le code exact de l'espace.
const lisible = (s) => s.replace(/[   ]/g, " ").replace(/−/g, "-");

// Le tiret long est interdit dans les textes du projet, on ne l'écrit donc pas
// en clair ici : c'est pourtant ce que formatDate renvoie quand la date manque.
const TIRET_LONG = String.fromCharCode(0x2014);

// Les tests de dates doivent donner le même résultat sur n'importe quelle
// machine : on fixe le fuseau sur Paris pendant toute la durée du fichier.
let fuseauInitial;
beforeAll(() => {
  fuseauInitial = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = "Europe/Paris";
});
afterAll(() => {
  process.env.TZ = fuseauInitial;
});

// Exécute une fonction en se plaçant temporairement dans un autre fuseau.
function sousFuseau(fuseau, fn) {
  const precedent = process.env.TZ;
  process.env.TZ = fuseau;
  try {
    return fn();
  } finally {
    process.env.TZ = precedent;
  }
}

// Construit une date civile "AAAA-MM-JJ" décalée de N jours, sans jamais passer
// par toISOString sur une date locale (règle du projet : une date civile n'a pas
// d'heure, la convertir en UTC la fait changer de jour).
function dateCivile(base, decalageJours) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + decalageJours);
  const deuxChiffres = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  formatEUR : les montants affichés à l'utilisateur
// ═════════════════════════════════════════════════════════════════════════════
describe("formatEUR", () => {
  it("affiche zéro sans décimales", () => {
    expect(lisible(formatEUR(0))).toBe("0 €");
  });

  it("ne produit jamais NaN ni undefined pour une valeur absente", () => {
    // Cas très courants : un champ vide, une réponse serveur incomplète,
    // un calcul qui a raté. À l'écran, ça doit rester un montant lisible.
    for (const valeurAbsente of [null, undefined, "", NaN, 0]) {
      const affiche = formatEUR(valeurAbsente);
      expect(affiche).not.toMatch(/NaN|undefined|null/);
      expect(lisible(affiche)).toBe("0 €");
    }
  });

  it("groupe les milliers à la française", () => {
    expect(lisible(formatEUR(1234))).toBe("1 234 €");
    expect(lisible(formatEUR(1234567))).toBe("1 234 567 €");
  });

  it("utilise la virgule comme séparateur décimal", () => {
    expect(lisible(formatEUR(1234.5))).toBe("1 234,50 €");
    expect(lisible(formatEUR(0.5))).toBe("0,50 €");
  });

  it("n'ajoute pas de ,00 inutile sur un montant rond", () => {
    // Choix assumé du fichier : un montant entier s'affiche court (507 €),
    // ce qui allège les cartes du cockpit.
    expect(lisible(formatEUR(507))).toBe("507 €");
    expect(formatEUR(507)).not.toContain(",");
  });

  it("affiche toujours 2 décimales dès qu'il y a des centimes", () => {
    expect(lisible(formatEUR(9.9))).toBe("9,90 €");
    expect(lisible(formatEUR(44.99))).toBe("44,99 €");
  });

  it("gère les montants négatifs (solde débiteur, avoir)", () => {
    expect(lisible(formatEUR(-5.5))).toBe("-5,50 €");
    expect(lisible(formatEUR(-1234))).toBe("-1 234 €");
  });

  it("arrondit au centime le plus proche", () => {
    expect(lisible(formatEUR(2.345))).toBe("2,35 €");
    expect(lisible(formatEUR(0.005))).toBe("0,01 €");
    expect(lisible(formatEUR(0.004))).toBe("0,00 €");
    // Un montant qui remonte à l'euro garde ses deux décimales.
    expect(lisible(formatEUR(1.999))).toBe("2,00 €");
  });

  it("absorbe les imprécisions du calcul en virgule flottante", () => {
    // 0,1 + 0,2 vaut 0,30000000000000004 en JavaScript : l'utilisateur ne doit
    // jamais voir ça.
    expect(lisible(formatEUR(0.1 + 0.2))).toBe("0,30 €");
  });

  it("garde le symbole euro collé au montant (espace insécable)", () => {
    // Sinon le montant peut se couper en fin de ligne : "1 234" d'un côté,
    // "€" de l'autre.
    const rendu = formatEUR(1234.5);
    const avantEuro = rendu[rendu.indexOf("€") - 1];
    expect([" ", " "]).toContain(avantEuro);
  });

  it("reste lisible sur un très gros montant", () => {
    expect(lisible(formatEUR(1234567.891))).toBe("1 234 567,89 €");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  formatDate : la date longue affichée dans les cartes
// ═════════════════════════════════════════════════════════════════════════════
describe("formatDate", () => {
  it("affiche un tiret quand la date est absente", () => {
    for (const rien of [null, undefined, "", 0]) {
      expect(formatDate(rien)).toBe(TIRET_LONG);
    }
  });

  it("n'interprète pas 0 comme le 1er janvier 1970", () => {
    // Piège classique : new Date(0) est une date valide. Ici on veut le tiret.
    expect(formatDate(0)).toBe(TIRET_LONG);
  });

  it("écrit la date en toutes lettres à la française", () => {
    expect(formatDate("2026-03-05")).toBe("5 mars 2026");
    expect(formatDate("2026-12-25")).toBe("25 décembre 2026");
  });

  it("accepte aussi un objet Date", () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe("1 janvier 2026");
  });

  it("garde le 1er janvier au 1er janvier (fuseau de la métropole)", () => {
    expect(formatDate("2026-01-01")).toBe("1 janvier 2026");
    expect(formatDate("2026-12-31")).toBe("31 décembre 2026");
  });

  it("ne plante pas sur une chaîne qui n'est pas une date", () => {
    expect(() => formatDate("bonjour")).not.toThrow();
    expect(formatDate("bonjour")).not.toContain("undefined");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  RÈGLE DATE CIVILE : une date ne doit pas changer de jour selon le fuseau
//
//  Une date d'AEM, une échéance de facture ou une date limite URSSAF sont des
//  dates CIVILES : elles n'ont pas d'heure. new Date("2026-01-01") les lit
//  pourtant comme minuit UTC, puis toLocaleDateString les réaffiche dans le
//  fuseau de l'utilisateur. Résultat : à l'ouest de Greenwich (Antilles,
//  Guyane, Polynésie française), tout recule d'un jour.
// ═════════════════════════════════════════════════════════════════════════════
describe("règle date civile (fuseaux à l'ouest de Greenwich)", () => {
  it("DÉFAUT CONNU : le 1er janvier devient le 31 décembre en Polynésie", () => {
    const affiche = sousFuseau("Pacific/Tahiti", () => formatDate("2026-01-01"));
    expect(affiche).toBe("1 janvier 2026");
  });

  it("DÉFAUT CONNU : la période courte recule aussi d'un jour aux Antilles", () => {
    const affiche = sousFuseau("America/Guadeloupe", () =>
      formatPeriode({ date: "2026-03-05" })
    );
    expect(affiche).toBe("05/03");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  formatPeriode : la date courte, ou la période "JJ/MM → JJ/MM"
// ═════════════════════════════════════════════════════════════════════════════
describe("formatPeriode", () => {
  it("renvoie une chaîne vide quand il n'y a rien à afficher", () => {
    expect(formatPeriode(null)).toBe("");
    expect(formatPeriode(undefined)).toBe("");
    expect(formatPeriode({})).toBe("");
    expect(formatPeriode({ date: "" })).toBe("");
  });

  it("affiche la date courte sur deux chiffres", () => {
    expect(formatPeriode({ date: "2026-03-05" })).toBe("05/03");
    expect(formatPeriode({ date: "2026-01-09" })).toBe("09/01");
    expect(formatPeriode({ date: "2026-11-30" })).toBe("30/11");
  });

  it("n'affiche pas de flèche quand la date de fin est la même", () => {
    expect(formatPeriode({ date: "2026-03-05", date_fin: "2026-03-05" })).toBe("05/03");
  });

  it("n'affiche pas de flèche quand la date de fin est absente", () => {
    expect(formatPeriode({ date: "2026-03-05", date_fin: null })).toBe("05/03");
  });

  it("affiche la période quand l'AEM couvre plusieurs jours", () => {
    expect(formatPeriode({ date: "2026-03-05", date_fin: "2026-03-07" })).toBe("05/03 → 07/03");
  });

  it("renvoie la date brute en format long", () => {
    expect(formatPeriode({ date: "2026-03-05" }, false)).toBe("2026-03-05");
    expect(formatPeriode({ date: "2026-03-05", date_fin: "2026-03-07" }, false))
      .toBe("2026-03-05 → 2026-03-07");
  });

  it("retombe sur la valeur brute si la date est illisible", () => {
    // Repli documenté dans le code : mieux vaut montrer la donnée telle quelle
    // qu'un "Invalid Date" ou un NaN.
    const rendu = formatPeriode({ date: "date-cassee" });
    expect(rendu).toBe("date-cassee");
    expect(rendu).not.toMatch(/NaN|undefined/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  heuresDe : la conversion d'une ligne d'activité en heures
//  C'est le calcul qui alimente le compteur des 507h : la donnée la plus
//  sensible du produit côté intermittent.
// ═════════════════════════════════════════════════════════════════════════════
describe("heuresDe", () => {
  it("renvoie 0 quand l'activité est absente", () => {
    expect(heuresDe(null)).toBe(0);
    expect(heuresDe(undefined)).toBe(0);
    expect(heuresDe({})).toBe(0);
  });

  it("compte les heures d'un technicien heure pour heure", () => {
    expect(heuresDe({ type_activite: "heures", nombre: 7 })).toBe(7);
    expect(heuresDe({ type_activite: "heures", nombre: 7.5 })).toBe(7.5);
  });

  it("convertit TOUS les cachets à 12 h, isolés comme groupés", () => {
    // Règle métier centrale : la distinction "cachet groupé = 8 h" est abandonnée.
    // Si un jour ce test tombe à 8, c'est le compteur des 507h qui est faux.
    expect(heuresDe({ type_activite: "cachet_isole", nombre: 1 })).toBe(12);
    expect(heuresDe({ type_activite: "cachet_groupe", nombre: 1 })).toBe(12);
    expect(heuresDe({ type_activite: "cachet", nombre: 1 })).toBe(12);
  });

  it("suit le référentiel plutôt qu'une valeur écrite en dur", () => {
    expect(heuresDe({ type_activite: "cachet", nombre: 1 })).toBe(valeurDe("cachetHeures"));
  });

  it("43 cachets font 516 h, donc au-dessus du seuil de 507 h", () => {
    const heures = heuresDe({ type_activite: "cachet", nombre: 43 });
    expect(heures).toBe(516);
    expect(heures).toBeGreaterThan(valeurDe("seuilHeures"));
  });

  it("ne renvoie jamais d'heures négatives", () => {
    // Une saisie négative ne doit pas pouvoir retirer des heures au compteur.
    expect(heuresDe({ type_activite: "heures", nombre: -10 })).toBe(0);
    expect(heuresDe({ type_activite: "cachet", nombre: -3 })).toBe(0);
  });

  it("renvoie 0 quand le nombre est absent ou illisible", () => {
    expect(heuresDe({ type_activite: "heures" })).toBe(0);
    expect(heuresDe({ type_activite: "heures", nombre: null })).toBe(0);
    expect(heuresDe({ type_activite: "heures", nombre: "" })).toBe(0);
    expect(heuresDe({ type_activite: "heures", nombre: "abc" })).toBe(0);
    expect(heuresDe({ type_activite: "cachet", nombre: "abc" })).toBe(0);
  });

  it("accepte un nombre saisi sous forme de texte", () => {
    // Les champs de saisie renvoient des chaînes.
    expect(heuresDe({ type_activite: "heures", nombre: "7.5" })).toBe(7.5);
    expect(heuresDe({ type_activite: "cachet", nombre: "2" })).toBe(24);
  });

  it("compte la formation suivie heure pour heure sur une ligne", () => {
    // Le plafond des 338 h est GLOBAL sur la fenêtre : il ne doit surtout pas
    // être appliqué ligne par ligne ici.
    expect(heuresDe({ type_activite: "formation", nombre: 400 })).toBe(400);
  });

  it("compte l'enseignement dispensé heure pour heure sur une ligne", () => {
    expect(heuresDe({ type_activite: "enseignement", nombre: 100 })).toBe(100);
  });

  it("assimile 5 h par jour d'arrêt indemnisé", () => {
    for (const type of ["arret_maternite", "arret_accident", "arret_ald", "arret_suspension"]) {
      expect(heuresDe({ type_activite: type, nombre: 10 })).toBe(50);
    }
  });

  it("n'assimile aucune heure pour un arrêt neutralisé", () => {
    // Maladie ordinaire et paternité allongent la fenêtre côté serveur,
    // mais n'ajoutent pas d'heures.
    expect(heuresDe({ type_activite: "arret_maladie_ordinaire", nombre: 30 })).toBe(0);
    expect(heuresDe({ type_activite: "arret_paternite", nombre: 25 })).toBe(0);
  });

  it("ne devine pas les heures d'un type inconnu", () => {
    expect(heuresDe({ type_activite: "bricolage", nombre: 100 })).toBe(0);
    expect(heuresDe({ nombre: 100 })).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  normEmployeur : rapprochement souple des noms d'employeurs
// ═════════════════════════════════════════════════════════════════════════════
describe("normEmployeur", () => {
  it("renvoie une chaîne vide quand le nom est absent", () => {
    expect(normEmployeur(null)).toBe("");
    expect(normEmployeur(undefined)).toBe("");
    expect(normEmployeur("")).toBe("");
  });

  it("rapproche deux écritures du même employeur", () => {
    expect(normEmployeur("ÉTOILE DE RÊVE")).toBe(normEmployeur("etoile de reve"));
    expect(normEmployeur("Théâtre du Châtelet")).toBe("theatre du chatelet");
  });

  it("écrase les espaces en trop, y compris aux extrémités", () => {
    expect(normEmployeur("  Théâtre   du  Nord  ")).toBe("theatre du nord");
    expect(normEmployeur("Scène\tNationale\nDe Test")).toBe("scene nationale de test");
  });

  it("ne confond pas deux employeurs réellement différents", () => {
    expect(normEmployeur("Théâtre du Nord")).not.toBe(normEmployeur("Théâtre du Sud"));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  historiqueEmployeur : le repère "tu as déjà travaillé ici"
//  Ne doit JAMAIS inventer : que des données réellement enregistrées.
// ═════════════════════════════════════════════════════════════════════════════
describe("historiqueEmployeur", () => {
  const activites = [
    { date: "2026-01-10", employeur: "Théâtre du Nord", type_activite: "cachet", nombre: 7 },
    { date: "2026-02-15", employeur: "THEATRE DU NORD", type_activite: "cachet_isole", nombre: 8 },
    { date: "2026-03-20", employeur: "  théâtre du   nord ", type_activite: "cachet_groupe", nombre: 10 },
    { date: "2026-04-01", employeur: "Théâtre du Sud", type_activite: "cachet", nombre: 50 },
    { date: "2026-04-05", employeur: "Théâtre du Nord", type_activite: "heures", nombre: 35 },
  ];

  it("renvoie null quand il n'y a pas de nom d'employeur", () => {
    expect(historiqueEmployeur(activites, "", "cachet")).toBeNull();
    expect(historiqueEmployeur(activites, null, "cachet")).toBeNull();
  });

  it("renvoie null quand la liste d'activités n'en est pas une", () => {
    expect(historiqueEmployeur(null, "Théâtre du Nord", "cachet")).toBeNull();
    expect(historiqueEmployeur(undefined, "Théâtre du Nord", "cachet")).toBeNull();
  });

  it("renvoie null quand cet employeur est inconnu", () => {
    expect(historiqueEmployeur(activites, "Opéra de Lille", "cachet")).toBeNull();
  });

  it("compte les contrats passés malgré la casse et les accents", () => {
    const histo = historiqueEmployeur(activites, "theatre du nord", "cachet");
    expect(histo.count).toBe(3);
  });

  it("calcule la moyenne arrondie au dixième", () => {
    // (7 + 8 + 10) / 3 = 8,333... → 8,3
    const histo = historiqueEmployeur(activites, "Théâtre du Nord", "cachet");
    expect(histo.moyenne).toBe(8.3);
  });

  it("classe les derniers contrats du plus récent au plus ancien", () => {
    const histo = historiqueEmployeur(activites, "Théâtre du Nord", "cachet");
    expect(histo.derniers.map((d) => d.date)).toEqual(["2026-03-20", "2026-02-15", "2026-01-10"]);
    expect(histo.derniers[0]).toEqual({ date: "2026-03-20", nombre: 10, type: "cachet_groupe" });
  });

  it("regroupe tous les cachets dans la même famille", () => {
    // cachet, cachet_isole et cachet_groupe doivent se répondre entre eux.
    const histo = historiqueEmployeur(activites, "Théâtre du Nord", "cachet_groupe");
    expect(histo.count).toBe(3);
  });

  it("ne mélange pas les heures et les cachets", () => {
    const enHeures = historiqueEmployeur(activites, "Théâtre du Nord", "heures");
    expect(enHeures.count).toBe(1);
    expect(enHeures.moyenne).toBe(35);
    // Et un employeur qui n'a que des cachets n'a pas d'historique en heures.
    expect(historiqueEmployeur(activites, "Théâtre du Sud", "heures")).toBeNull();
  });

  it("ignore les lignes vides ou à zéro", () => {
    const avecVides = [
      { date: "2026-01-01", employeur: "Le Lieu", type_activite: "cachet", nombre: 0 },
      { date: "2026-01-02", employeur: "Le Lieu", type_activite: "cachet", nombre: null },
      { date: "2026-01-03", employeur: "Le Lieu", type_activite: "cachet", nombre: 4 },
    ];
    const histo = historiqueEmployeur(avecVides, "Le Lieu", "cachet");
    expect(histo.count).toBe(1);
    expect(histo.moyenne).toBe(4);
  });

  it("ne propose jamais plus de 3 repères", () => {
    const beaucoup = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-0${i + 1}-01`,
      employeur: "Le Lieu",
      type_activite: "cachet",
      nombre: i + 1,
    }));
    const histo = historiqueEmployeur(beaucoup, "Le Lieu", "cachet");
    expect(histo.count).toBe(6);
    expect(histo.derniers).toHaveLength(3);
    expect(histo.derniers[0].date).toBe("2026-06-01");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  heuresFenetre : le total sur les 365 jours glissants
//  C'est le chiffre qui dit à l'intermittent s'il atteint ses 507 h.
// ═════════════════════════════════════════════════════════════════════════════
describe("heuresFenetre", () => {
  // Un "aujourd'hui" fixe, à midi UTC : les comparaisons restent identiques
  // quel que soit le fuseau de la machine qui lance les tests.
  const AUJ = new Date("2026-08-06T12:00:00Z");
  const dans = (jours) => dateCivile(AUJ, jours);

  it("renvoie 0 quand il n'y a aucune activité", () => {
    expect(heuresFenetre([], AUJ)).toBe(0);
    expect(heuresFenetre(null, AUJ)).toBe(0);
    expect(heuresFenetre(undefined, AUJ)).toBe(0);
  });

  it("additionne les heures et les cachets de la fenêtre", () => {
    const acts = [
      { date: dans(-10), type_activite: "heures", nombre: 35 },
      { date: dans(-40), type_activite: "cachet", nombre: 3 }, // 36 h
    ];
    expect(heuresFenetre(acts, AUJ)).toBe(71);
  });

  it("ignore ce qui est sorti de la fenêtre de 365 jours", () => {
    const acts = [
      { date: dans(-360), type_activite: "heures", nombre: 100 },
      { date: dans(-400), type_activite: "heures", nombre: 999 },
      { date: dans(-1000), type_activite: "cachet", nombre: 50 },
    ];
    expect(heuresFenetre(acts, AUJ)).toBe(100);
  });

  it("suit la période de référence du référentiel", () => {
    expect(valeurDe("periodeReferenceJours")).toBe(365);
  });

  it("ignore les activités à venir", () => {
    const acts = [
      { date: dans(-1), type_activite: "heures", nombre: 8 },
      { date: dans(1), type_activite: "heures", nombre: 8 },
      { date: dans(30), type_activite: "cachet", nombre: 10 },
    ];
    expect(heuresFenetre(acts, AUJ)).toBe(8);
  });

  it("ignore une ligne dont la date est illisible", () => {
    const acts = [
      { date: "pas-une-date", type_activite: "heures", nombre: 500 },
      { date: dans(-5), type_activite: "heures", nombre: 12 },
    ];
    expect(heuresFenetre(acts, AUJ)).toBe(12);
  });

  it("plafonne la formation suivie à 338 h sur la fenêtre", () => {
    const acts = [
      { date: dans(-100), type_activite: "formation", nombre: 200 },
      { date: dans(-50), type_activite: "formation", nombre: 300 },
    ];
    // 500 h suivies, mais seules 338 h sont assimilables.
    expect(heuresFenetre(acts, AUJ)).toBe(338);
  });

  it("plafonne l'enseignement dispensé à 70 h", () => {
    const acts = [{ date: dans(-30), type_activite: "enseignement", nombre: 200 }];
    expect(heuresFenetre(acts, AUJ)).toBe(70);
  });

  it("partage le plafond de 338 h entre formation et enseignement", () => {
    const acts = [
      { date: dans(-100), type_activite: "formation", nombre: 300 },
      { date: dans(-50), type_activite: "enseignement", nombre: 100 },
    ];
    // 300 de formation, puis l'enseignement ne peut prendre que les 38 h restantes.
    expect(heuresFenetre(acts, AUJ)).toBe(338);
  });

  it("plafonne pareil quel que soit l'ordre des lignes", () => {
    const formationDabord = [
      { date: dans(-100), type_activite: "formation", nombre: 400 },
      { date: dans(-50), type_activite: "enseignement", nombre: 100 },
    ];
    const enseignementDabord = [
      { date: dans(-100), type_activite: "enseignement", nombre: 100 },
      { date: dans(-50), type_activite: "formation", nombre: 400 },
    ];
    expect(heuresFenetre(formationDabord, AUJ)).toBe(338);
    expect(heuresFenetre(enseignementDabord, AUJ)).toBe(338);
  });

  it("ne plafonne jamais le vrai travail", () => {
    // Le plafond des 338 h ne concerne que formation et enseignement :
    // un technicien qui fait 900 h doit voir ses 900 h.
    const acts = [{ date: dans(-100), type_activite: "heures", nombre: 900 }];
    expect(heuresFenetre(acts, AUJ)).toBe(900);
  });

  it("ne plafonne pas les arrêts assimilés", () => {
    const acts = [{ date: dans(-60), type_activite: "arret_maternite", nombre: 100 }];
    expect(heuresFenetre(acts, AUJ)).toBe(500);
  });

  it("compte une activité datée d'aujourd'hui", () => {
    const acts = [{ date: dans(0), type_activite: "cachet", nombre: 1 }];
    expect(heuresFenetre(acts, AUJ)).toBe(12);
  });

  it("DÉFAUT CONNU : les heures du jour disparaissent entre minuit et 2 h", () => {
    // Cas réel : un technicien saisit sa journée en rentrant, à 0 h 30.
    // La date "2026-08-06" est lue comme minuit UTC (soit 2 h du matin à Paris),
    // donc considérée comme FUTURE par rapport à l'instant présent : la ligne
    // est écartée du compteur, puis réapparaît à 2 h du matin.
    const nuit = new Date("2026-08-06T00:30:00+02:00");
    const acts = [{ date: "2026-08-06", type_activite: "cachet", nombre: 1 }];
    expect(heuresFenetre(acts, nuit)).toBe(12);
  });
});
