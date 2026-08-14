// ─────────────────────────────────────────────────────────────────────────────
//  Garder la MEILLEURE des deux lectures quand un document arrive en plusieurs
//  photos. Le cas signalé par Mac : une FCTU de 3 pages envoyée en 3 photos.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from "vitest";

import { doitPrendreLaLectureGroupee, trous } from "./scan";

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
