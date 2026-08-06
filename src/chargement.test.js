// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
//  chargement.test.js : LA GARDE CONTRE LES ÉCRANS BLANCS
//
//  Pourquoi ce fichier existe :
//  l'application a connu trois écrans blancs en production, toujours de la même
//  famille. Du code exécuté AU CHARGEMENT d'un fichier (une constante calculée
//  tout en haut, une valeur figée trop tôt) allait chercher quelque chose qui
//  n'existait pas encore. Le navigateur s'arrête net à cet instant, React ne
//  démarre jamais, et l'utilisateur voit une page blanche. Ce n'est pas un
//  bouton cassé : c'est TOUTE l'application qui disparaît.
//
//  Ce que fait ce fichier : il charge chaque fichier du site, un par un, comme
//  le ferait le navigateur au démarrage. Si l'un d'eux explose au chargement,
//  le test devient rouge ICI, avant le push, au lieu de devenir un écran blanc
//  chez les utilisateurs.
//
//  ⚠️ RÈGLE : tout nouveau fichier ajouté dans src/ gagne sa ligne ici.
//
//  Pourquoi la première ligne force « jsdom » alors que la configuration du
//  projet utilise « node » : un écran blanc est un accident de NAVIGATEUR. Le
//  décor jsdom est un navigateur de laboratoire (il fournit window, document,
//  localStorage), donc il reproduit fidèlement le moment où ça casse en vrai.
//  Sous « node » ces trois-là n'existent pas : App.jsx échouerait toujours,
//  pour une raison d'outillage et non pour un vrai défaut, et le test ne
//  voudrait plus rien dire. Cette ligne ne concerne QUE ce fichier de test :
//  la configuration du projet n'est pas touchée.
//
//  ── Ce qui n'est PAS couvert, et pourquoi ────────────────────────────────
//  main.jsx : son unique travail est d'accrocher l'application à la balise
//  <div id="root"> de la page. Hors d'une vraie page, cette balise n'existe
//  pas. Le charger reviendrait à tester un décor fabriqué pour l'occasion,
//  ce qui ne prouverait rien. Il ne contient d'ailleurs aucun calcul : quatre
//  lignes d'accrochage, revues à chaque fois qu'on y touche.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
//  1. Les fichiers de calcul et de données (JavaScript pur)
//     Ce sont les plus dangereux : ils sont pleins de constantes évaluées au
//     chargement, exactement le terrain des trois écrans blancs passés.
// ─────────────────────────────────────────────────────────────────────────────
describe("Chargement des modules de calcul", () => {
  it("config.js se charge sans exploser", async () => {
    await expect(import("./config.js")).resolves.toBeDefined();
  });

  it("format.js se charge sans exploser", async () => {
    await expect(import("./format.js")).resolves.toBeDefined();
  });

  it("fiscalite.js se charge sans exploser", async () => {
    await expect(import("./fiscalite.js")).resolves.toBeDefined();
  });

  it("regles_intermittent.js se charge sans exploser", async () => {
    await expect(import("./regles_intermittent.js")).resolves.toBeDefined();
  });

  it("legalMentions.js se charge sans exploser", async () => {
    await expect(import("./legalMentions.js")).resolves.toBeDefined();
  });

  it("theme.js se charge sans exploser", async () => {
    await expect(import("./theme.js")).resolves.toBeDefined();
  });

  it("appleAuthWeb.js se charge sans exploser", async () => {
    await expect(import("./appleAuthWeb.js")).resolves.toBeDefined();
  });

  it("l'adaptateur France Travail se charge sans exploser", async () => {
    await expect(
      import("./features/trouverDesHeures/francetravail.adapter.js"),
    ).resolves.toBeDefined();
  });

  it("le jeu d'offres d'exemple se charge sans exploser", async () => {
    await expect(
      import("./features/trouverDesHeures/jobOffers.mock.js"),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2. Les écrans (fichiers .jsx)
//     Charger un écran n'est PAS l'afficher : on vérifie seulement que le
//     fichier tient debout tout seul. Mais les constantes posées en haut de
//     ces fichiers (styles, listes de textes) sont, elles, bel et bien
//     évaluées au chargement, et c'est précisément là que ça a cassé.
// ─────────────────────────────────────────────────────────────────────────────
describe("Chargement des écrans", () => {
  it("Nouveautes.jsx se charge sans exploser", async () => {
    await expect(import("./Nouveautes.jsx")).resolves.toBeDefined();
  });

  it("LegalPage.jsx se charge sans exploser", async () => {
    await expect(import("./LegalPage.jsx")).resolves.toBeDefined();
  });

  it("SimulateurPublic.jsx se charge sans exploser", async () => {
    await expect(import("./SimulateurPublic.jsx")).resolves.toBeDefined();
  });

  it("PourquoiHector.jsx se charge sans exploser", async () => {
    await expect(import("./PourquoiHector.jsx")).resolves.toBeDefined();
  });

  it("MontantInput.jsx se charge sans exploser", async () => {
    await expect(import("./MontantInput.jsx")).resolves.toBeDefined();
  });

  it("HectorRunnerGame.jsx se charge sans exploser", async () => {
    await expect(import("./HectorRunnerGame.jsx")).resolves.toBeDefined();
  });

  it("TrouverDesHeures.jsx se charge sans exploser", async () => {
    await expect(
      import("./features/trouverDesHeures/TrouverDesHeures.jsx"),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3. App.jsx : LE test qui compte
//     C'est le fichier où les trois écrans blancs se sont produits. Il tire
//     tous les autres derrière lui : s'il se charge, l'application démarre.
// ─────────────────────────────────────────────────────────────────────────────
describe("Chargement de l'application principale", () => {
  it("App.jsx se charge sans exploser et fournit bien son écran", async () => {
    // __BUILD_ID__ est le numéro de version que l'outil de construction (Vite)
    // écrit dans le code au moment du build, pour étiqueter les rapports
    // d'erreur. Hors build il n'existe pas : on en pose un faux, sinon on
    // testerait l'absence de l'outil au lieu de tester le code.
    globalThis.__BUILD_ID__ = "test";
    const mod = await import("./App.jsx");
    // Sans cet écran par défaut, il n'y a rien à afficher : page blanche.
    expect(mod.default).toBeDefined();
    expect(mod.default).toBeTypeOf("function");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  4. Le contrat d'exports entre les fichiers
//     Deuxième famille d'écran blanc, cousine de la première : le fichier se
//     charge très bien, mais il ne fournit plus le nom qu'un autre lui
//     demande (renommage, suppression, faute de frappe). Le demandeur récupère
//     alors « rien du tout » et casse à la première utilisation, souvent au
//     tout premier affichage, donc en écran blanc.
// ─────────────────────────────────────────────────────────────────────────────
describe("Exports attendus par le reste de l'application", () => {
  const attendus = [
    ["fiscalite.js", () => import("./fiscalite.js"),
      ["FISCALITE", "getRegime", "calcUrssaf", "calcRevenuImposable", "calcImpot", "statutPlafond", "statutTVA"]],
    ["legalMentions.js", () => import("./legalMentions.js"),
      ["franchiseVatMention", "appendEiMention", "formatVatRate", "computeInvoiceTotals", "b2bLateFeeMention",
        "MENTION_PENALITES_B2B", "MENTION_HORS_FRANCE", "MENTION_AUTOLIQUIDATION"]],
    ["appleAuthWeb.js", () => import("./appleAuthWeb.js"),
      ["connexionApple", "AppleAnnule", "STYLE_BOUTON_APPLE"]],
    ["regles_intermittent.js", () => import("./regles_intermittent.js"),
      ["REGLES", "VERSION_REFERENTIEL", "valeurDe", "getRegle", "tracer", "moteurHeuresValide"]],
    ["format.js", () => import("./format.js"),
      ["formatEUR", "formatDate", "heuresDe", "formatPeriode", "normEmployeur", "historiqueEmployeur", "heuresFenetre"]],
    ["theme.js", () => import("./theme.js"), ["INK", "ACCENT", "PAPER", "CSS", "S"]],
    ["config.js", () => import("./config.js"), ["API_BASE"]],
    ["LegalPage.jsx", () => import("./LegalPage.jsx"), ["LegalPageView"]],
    ["Nouveautes.jsx", () => import("./Nouveautes.jsx"), ["NouveautesPage"]],
    ["SimulateurPublic.jsx", () => import("./SimulateurPublic.jsx"), ["SimulateurPublic"]],
    ["PourquoiHector.jsx", () => import("./PourquoiHector.jsx"), ["PourquoiHector"]],
    ["MontantInput.jsx", () => import("./MontantInput.jsx"), ["default"]],
    ["HectorRunnerGame.jsx", () => import("./HectorRunnerGame.jsx"), ["default"]],
    ["TrouverDesHeures.jsx", () => import("./features/trouverDesHeures/TrouverDesHeures.jsx"), ["default"]],
    ["francetravail.adapter.js", () => import("./features/trouverDesHeures/francetravail.adapter.js"),
      ["fetchOffresFranceTravail"]],
    ["jobOffers.mock.js", () => import("./features/trouverDesHeures/jobOffers.mock.js"),
      ["fetchIntermittentJobOffers", "regionsDisponibles"]],
  ];

  for (const [nom, charger, noms] of attendus) {
    it(`${nom} fournit bien tout ce qu'on lui demande`, async () => {
      const mod = await charger();
      for (const n of noms) {
        // « toBeDefined » suffit : un export absent vaut « rien du tout », et
        // c'est exactement ce « rien du tout » qui provoque l'écran blanc.
        expect(mod[n], `export manquant : ${n} dans ${nom}`).toBeDefined();
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  5. Les valeurs figées au chargement arrivent-elles réellement remplies ?
//     C'est le cœur du bug historique : une constante évaluée trop tôt existe
//     bien (le fichier se charge donc sans bruit), mais elle est vide. Le
//     fichier passe, l'écran casse plus loin. On vérifie donc que les grosses
//     constantes de données arrivent PLEINES à la fin du chargement.
// ─────────────────────────────────────────────────────────────────────────────
describe("Les constantes évaluées au chargement arrivent remplies", () => {
  it("le référentiel des règles intermittent n'est pas vide", async () => {
    const { REGLES } = await import("./regles_intermittent.js");
    expect(Object.keys(REGLES).length).toBeGreaterThan(0);
    // Les trois règles dont dépend TOUT le moteur des 507 heures : si l'une
    // manquait, les compteurs d'heures partiraient sur des valeurs nulles.
    for (const cle of ["seuilHeures", "cachetHeures", "periodeReferenceJours"]) {
      expect(REGLES[cle], `règle manquante : ${cle}`).toBeDefined();
      expect(REGLES[cle].valeur).toBeTypeOf("number");
      expect(REGLES[cle].valeur).toBeGreaterThan(0);
    }
  });

  it("les trois régimes fiscaux sont présents avec leurs taux", async () => {
    const { FISCALITE } = await import("./fiscalite.js");
    for (const id of ["vente", "services", "bnc"]) {
      const r = FISCALITE.regimes[id];
      expect(r, `régime manquant : ${id}`).toBeDefined();
      expect(r.tauxCotisations).toBeTypeOf("number");
      expect(r.tauxCotisations).toBeGreaterThan(0);
      expect(r.plafondCA).toBeGreaterThan(0);
      expect(r.seuilTVA).toBeGreaterThan(0);
    }
  });

  it("le thème fournit ses couleurs et son catalogue de styles", async () => {
    const { INK, ACCENT, PAPER, CSS, S } = await import("./theme.js");
    // Charte graphique du projet : ces codes sont contractuels.
    expect(INK).toBe("#0A2540");
    expect(ACCENT).toBe("#378ADD");
    expect(PAPER).toBe("#F0F4F8");
    // Le CSS est fabriqué par assemblage de morceaux au chargement : s'il
    // arrivait vide, l'application s'afficherait entièrement sans style.
    expect(CSS.length).toBeGreaterThan(0);
    expect(CSS).toContain(PAPER);
    expect(Object.keys(S).length).toBeGreaterThan(0);
  });

  it("l'adresse du serveur est bien une adresse https complète", async () => {
    const { API_BASE } = await import("./config.js");
    // Une adresse vide au chargement donne une application qui démarre mais
    // ne montre jamais la moindre donnée.
    expect(API_BASE).toMatch(/^https:\/\/.+/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  6. Les fonctions appelées dès le premier affichage
//     Un écran blanc n'arrive pas qu'au chargement des fichiers : il arrive
//     aussi quand la toute première fonction du premier affichage lève une
//     erreur. Ces fonctions-là reçoivent souvent des données absentes
//     (compte tout neuf, chargement en cours) : elles doivent encaisser.
// ─────────────────────────────────────────────────────────────────────────────
describe("Les fonctions du premier affichage encaissent les données absentes", () => {
  it("le formatage d'un montant absent ou nul ne lève pas", async () => {
    const { formatEUR } = await import("./format.js");
    for (const cas of [undefined, null, 0, NaN, ""]) {
      expect(() => formatEUR(cas)).not.toThrow();
    }
  });

  it("le formatage d'une date absente ne lève pas", async () => {
    const { formatDate, formatPeriode } = await import("./format.js");
    expect(() => formatDate(undefined)).not.toThrow();
    expect(() => formatDate(null)).not.toThrow();
    expect(() => formatPeriode(undefined)).not.toThrow();
    expect(() => formatPeriode(null)).not.toThrow();
    expect(() => formatPeriode({})).not.toThrow();
  });

  it("le compteur d'heures encaisse une liste vide ou absente", async () => {
    const { heuresFenetre, heuresDe } = await import("./format.js");
    expect(() => heuresFenetre(undefined)).not.toThrow();
    expect(heuresFenetre([])).toBe(0);
    expect(heuresDe(undefined)).toBe(0);
    expect(heuresDe({})).toBe(0);
  });

  it("l'historique employeur encaisse une liste absente", async () => {
    const { historiqueEmployeur, normEmployeur } = await import("./format.js");
    expect(historiqueEmployeur(undefined, "Une compagnie", "heures")).toBeNull();
    expect(historiqueEmployeur([], "", "heures")).toBeNull();
    expect(normEmployeur(undefined)).toBe("");
  });

  it("les totaux de facture encaissent un montant et un profil absents", async () => {
    const { computeInvoiceTotals } = await import("./legalMentions.js");
    expect(() => computeInvoiceTotals(undefined, undefined)).not.toThrow();
    expect(() => computeInvoiceTotals(null, null)).not.toThrow();
    expect(computeInvoiceTotals(undefined, undefined).ht).toBe(0);
  });

  it("les calculs auto-entrepreneur encaissent un régime inconnu", async () => {
    const { getRegime, calcUrssaf, statutPlafond, statutTVA } = await import("./fiscalite.js");
    // Régime inconnu : le code retombe volontairement sur « services ».
    expect(getRegime("regime_qui_nexiste_pas").id).toBe("services");
    expect(() => calcUrssaf(undefined, 0)).not.toThrow();
    expect(() => statutPlafond(undefined, 0)).not.toThrow();
    expect(() => statutTVA(undefined, 0)).not.toThrow();
  });

  it("la lecture d'une règle inconnue rend « rien » au lieu de lever", async () => {
    const { valeurDe, getRegle, tracer } = await import("./regles_intermittent.js");
    expect(valeurDe("regle_inexistante")).toBeNull();
    expect(getRegle("regle_inexistante")).toBeNull();
    expect(tracer("regle_inexistante")).toBe("");
  });
});
