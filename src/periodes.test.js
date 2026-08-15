// ─────────────────────────────────────────────────────────────────────────────
//  Les périodes du récapitulatif de revenus.
//
//  Une borne fausse ici, c'est un document remis à un propriétaire ou à une
//  banque avec un total qui ne correspond à rien. On fige donc « aujourd'hui »
//  dans chaque test : ces calculs ne doivent jamais dépendre du jour où on les
//  lance, ni du fuseau horaire.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from "vitest";

import { bornesPeriode, choixDisponibles, saisonDe } from "./periodes";

// Le 15 août 2026, la journée où la fonctionnalité a été demandée.
const AUJOURDHUI = new Date(2026, 7, 15, 14, 30);

const jour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("les douze derniers mois", () => {
  it("couvrent des mois ENTIERS, du 1er au dernier jour", () => {
    // Un récap qui commencerait le 15 donnerait un premier mois amputé, et le
    // total paraîtrait faux à qui le relit.
    const p = bornesPeriode({ type: "12mois" }, AUJOURDHUI);
    expect(jour(p.debut)).toBe("2025-09-01");
    expect(jour(p.fin)).toBe("2026-08-31");
  });

  it("s'appliquent par défaut, même sans choix", () => {
    expect(jour(bornesPeriode(undefined, AUJOURDHUI).debut)).toBe("2025-09-01");
    expect(jour(bornesPeriode({}, AUJOURDHUI).debut)).toBe("2025-09-01");
    expect(jour(bornesPeriode({ type: "n'importe quoi" }, AUJOURDHUI).debut)).toBe("2025-09-01");
  });

  it("portent un libellé lisible", () => {
    expect(bornesPeriode({ type: "12mois" }, AUJOURDHUI).label).toBe("septembre 2025 – août 2026");
  });
});

describe("les trois derniers mois", () => {
  it("couvrent juin, juillet et août", () => {
    const p = bornesPeriode({ type: "3mois" }, AUJOURDHUI);
    expect(jour(p.debut)).toBe("2026-06-01");
    expect(jour(p.fin)).toBe("2026-08-31");
  });
});

describe("une année civile", () => {
  it("va du 1er janvier au 31 décembre", () => {
    const p = bornesPeriode({ type: "annee", annee: 2025 }, AUJOURDHUI);
    expect(jour(p.debut)).toBe("2025-01-01");
    expect(jour(p.fin)).toBe("2025-12-31");
    expect(p.label).toBe("année 2025");
  });

  it("gère l'année en cours sans la tronquer à aujourd'hui", () => {
    // On veut bien « année 2026 » entière : les contrats déjà prévus en
    // décembre doivent y figurer.
    const p = bornesPeriode({ type: "annee", annee: 2026 }, AUJOURDHUI);
    expect(jour(p.fin)).toBe("2026-12-31");
  });
});

describe("une saison du spectacle", () => {
  it("va de septembre à août", () => {
    const p = bornesPeriode({ type: "saison", saison: 2025 }, AUJOURDHUI);
    expect(jour(p.debut)).toBe("2025-09-01");
    expect(jour(p.fin)).toBe("2026-08-31");
    expect(p.label).toBe("saison 2025-2026");
  });

  it("range une date de septembre dans la saison qui COMMENCE", () => {
    expect(saisonDe(new Date(2026, 8, 3))).toBe(2026);   // 3 septembre 2026
  });

  it("range une date d'août dans la saison qui SE TERMINE", () => {
    expect(saisonDe(new Date(2026, 7, 31))).toBe(2025);  // 31 août 2026
  });

  it("bascule bien au 1er septembre, pas au 31 août", () => {
    expect(saisonDe(new Date(2026, 7, 31))).toBe(2025);
    expect(saisonDe(new Date(2026, 8, 1))).toBe(2026);
  });
});

describe("un mois précis", () => {
  it("va du 1er au dernier jour du mois", () => {
    const p = bornesPeriode({ type: "mois", annee: 2026, mois: 1 }, AUJOURDHUI);
    expect(jour(p.debut)).toBe("2026-02-01");
    expect(jour(p.fin)).toBe("2026-02-28");
    expect(p.label).toBe("février 2026");
  });

  it("gère février d'une année bissextile", () => {
    expect(jour(bornesPeriode({ type: "mois", annee: 2028, mois: 1 }, AUJOURDHUI).fin)).toBe("2028-02-29");
  });
});

describe("la fin d'une période inclut la journée entière", () => {
  it("un contrat du dernier jour à 20 h reste dans la période", () => {
    const p = bornesPeriode({ type: "annee", annee: 2025 }, AUJOURDHUI);
    expect(new Date(2025, 11, 31, 20, 0) <= p.fin).toBe(true);
  });
});

describe("les choix proposés à l'écran", () => {
  const activites = [
    { date: "2026-07-15" }, { date: "2026-03-02" },
    { date: "2025-11-20" }, { date: "2025-06-10" },
  ];

  it("proposent toujours les deux fenêtres glissantes", () => {
    const c = choixDisponibles(activites, AUJOURDHUI);
    expect(c[0].cle).toBe("12mois");
    expect(c[1].cle).toBe("3mois");
  });

  it("ne proposent que les années où la personne a vraiment travaillé", () => {
    const annees = choixDisponibles(activites, AUJOURDHUI).filter(x => x.type === "annee").map(x => x.annee);
    expect(annees).toEqual([2026, 2025]);   // pas 2024, pas 2023
  });

  it("ne proposent que les saisons réellement travaillées", () => {
    const saisons = choixDisponibles(activites, AUJOURDHUI).filter(x => x.type === "saison").map(x => x.saison);
    // juillet 2026 et mars 2026 -> saison 2025 ; novembre 2025 -> saison 2025 ;
    // juin 2025 -> saison 2024.
    expect(saisons).toEqual([2025, 2024]);
  });

  it("un dossier vide ne propose rien d'autre que les fenêtres glissantes", () => {
    const c = choixDisponibles([], AUJOURDHUI);
    expect(c.map(x => x.cle)).toEqual(["12mois", "3mois"]);
  });

  it("une date illisible est ignorée sans faire planter", () => {
    const c = choixDisponibles([{ date: "pas une date" }, { date: null }, {}], AUJOURDHUI);
    expect(c.map(x => x.cle)).toEqual(["12mois", "3mois"]);
    expect(() => choixDisponibles(null, AUJOURDHUI)).not.toThrow();
  });
});
