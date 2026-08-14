// ─────────────────────────────────────────────────────────────────────────────
//  Garder la MEILLEURE des deux lectures quand un document arrive en plusieurs
//  photos. Le cas signalé par Mac : une FCTU de 3 pages envoyée en 3 photos.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from "vitest";

import { doitPrendreLaLectureGroupee, regrouperParMois, trous } from "./scan";

const complete = { employeur: "TELEVISION FRANCAISE 1", metier: "technicien", nombre: 10.5 };
const sansEnTete = { employeur: null, metier: null, nombre: 10.5 };

describe("compter les champs manquants", () => {
  it("une attestation complète ne compte aucun trou", () => {
    expect(trous([complete])).toBe(0);
  });

  it("l'employeur et le métier manquants comptent deux trous", () => {
    expect(trous([sansEnTete])).toBe(2);
  });

  it("une liste vide ne fait pas planter", () => {
    expect(trous([])).toBe(0);
    expect(trous(null)).toBe(0);
  });
});

describe("choisir entre lecture page par page et lecture groupée", () => {
  it("AUCUNE page lisible seule : on prend la lecture groupée", () => {
    // ⚠️ LE DÉFAUT DU 14/08/2026. C'est le pire cas, et c'est exactement là que
    // la lecture groupée sert : les 3 photos échouent isolément, le document
    // entier se lit très bien. L'ancienne règle jetait ce résultat, et la
    // personne lisait « je n'ai pas réussi à lire ce document ».
    expect(doitPrendreLaLectureGroupee([complete], [])).toBe(true);
  });

  it("la page 2 seule perdait l'employeur : le groupé le retrouve, on le prend", () => {
    expect(doitPrendreLaLectureGroupee([complete], [sansEnTete])).toBe(true);
  });

  it("le groupé ne fait pas mieux : on garde la lecture page par page", () => {
    expect(doitPrendreLaLectureGroupee([sansEnTete], [complete])).toBe(false);
  });

  it("à égalité parfaite, on ne change rien", () => {
    expect(doitPrendreLaLectureGroupee([complete], [complete])).toBe(false);
  });

  it("le groupé perd des attestations : on ne le prend pas", () => {
    expect(doitPrendreLaLectureGroupee([complete], [complete, complete])).toBe(false);
  });

  it("le groupé n'a rien trouvé : on ne remplace jamais par du vide", () => {
    expect(doitPrendreLaLectureGroupee([], [complete])).toBe(false);
    expect(doitPrendreLaLectureGroupee([], [])).toBe(false);
    expect(doitPrendreLaLectureGroupee(null, null)).toBe(false);
  });
});

describe("regrouper les périodes d'un relevé par mois", () => {
  it("un mois entier par période : rien ne change", () => {
    const r = regrouperParMois([
      { debut: "2026-05-01", fin: "2026-05-31", aj_dues: 15, net_du: 915.0, jours_travail: 14 },
      { debut: "2026-06-01", fin: "2026-06-30", aj_dues: 22, net_du: 1361.36, jours_travail: 6 },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ annee: 2026, mois: 5, aj_dues: 15, net_du: 915.0 });
    expect(r[1]).toMatchObject({ annee: 2026, mois: 6, aj_dues: 22, net_du: 1361.36 });
  });

  it("droits ouverts en cours de mois : les deux moitiés s'additionnent", () => {
    // ⚠️ LE DÉFAUT. Avant, ces deux périodes devenaient deux lignes du même
    // mois, et la seconde écrasait la première à l'enregistrement : Totor ne
    // voyait que 446,36 € versés au lieu de 1 361,36 € et annonçait un écart
    // de 900 € qui n'existait pas.
    const r = regrouperParMois([
      { debut: "2026-06-01", fin: "2026-06-14", aj_dues: 15, net_du: 915.0, jours_travail: 4 },
      { debut: "2026-06-15", fin: "2026-06-30", aj_dues: 7, net_du: 446.36, jours_travail: 2 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ annee: 2026, mois: 6, aj_dues: 22, jours_travail: 6 });
    expect(r[0].net_du).toBe(1361.36);   // et pas 1361.3600000000001
  });

  it("une période sans date exploitable est ignorée, pas rangée n'importe où", () => {
    const r = regrouperParMois([
      { debut: null, fin: null, net_du: 500 },
      { debut: "2026-05-01", fin: "2026-05-31", net_du: 915.0 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].mois).toBe(5);
  });

  it("une liste vide ne fait pas planter", () => {
    expect(regrouperParMois([])).toEqual([]);
    expect(regrouperParMois(null)).toEqual([]);
  });

  it("un champ absent des deux moitiés reste absent, il ne devient pas zéro", () => {
    const r = regrouperParMois([
      { fin: "2026-06-14", net_du: 100 },
      { fin: "2026-06-30", net_du: 200 },
    ]);
    expect(r[0].net_du).toBe(300);
    expect(r[0].jours_franchise_cp).toBe(null);
  });
});
