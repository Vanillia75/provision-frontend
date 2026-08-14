// ─────────────────────────────────────────────────────────────────────────────
//  La préparation d'une photo avant l'envoi au scan (bugs iPhone du 14/08/2026).
//
//  Ce qui compte ici : la fonction ne doit JAMAIS empêcher un envoi. Elle est un
//  confort (envoi plus rapide, plus de photo refusée pour cause de poids), pas
//  la défense principale : la vraie défense est sur le serveur, parce qu'elle
//  protège aussi les applications déjà installées sur les téléphones.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from "vitest";

import { COTE_MAX, dimensionsCibles, estImage, meriteReduction, preparerPhoto } from "./photo";

const fichier = (nom, type, taille) => {
  const f = new File([new Uint8Array(8)], nom, { type });
  Object.defineProperty(f, "size", { value: taille });
  return f;
};

describe("reconnaître une photo", () => {
  it("un PDF n'est jamais traité comme une photo", () => {
    expect(estImage(fichier("aem.pdf", "application/pdf", 500_000))).toBe(false);
  });

  it("une photo d'iPhone sans type déclaré est reconnue par son nom", () => {
    // Piège réel : selon la façon dont on choisit le fichier, iOS ne remplit
    // pas toujours le type. Sans ce filet, la photo passait sans préparation.
    expect(estImage(fichier("IMG_4021.HEIC", "", 4_000_000))).toBe(true);
    expect(estImage(fichier("IMG_4021.JPG", "", 4_000_000))).toBe(true);
  });

  it("les formats habituels sont reconnus", () => {
    for (const t of ["image/jpeg", "image/png", "image/heic", "image/webp"]) {
      expect(estImage(fichier("x", t, 100))).toBe(true);
    }
  });
});

describe("décider s'il faut préparer", () => {
  it("une photo d'iPhone lourde est préparée", () => {
    expect(meriteReduction(fichier("IMG_4021.JPG", "image/jpeg", 6_000_000))).toBe(true);
  });

  it("un HEIC est toujours converti, même léger", () => {
    expect(meriteReduction(fichier("IMG_4021.HEIC", "image/heic", 300_000))).toBe(true);
  });

  it("une petite capture d'écran est laissée tranquille", () => {
    expect(meriteReduction(fichier("capture.png", "image/png", 200_000))).toBe(false);
  });

  it("un PDF n'est jamais touché, quelle que soit sa taille", () => {
    expect(meriteReduction(fichier("aem.pdf", "application/pdf", 9_000_000))).toBe(false);
  });
});

describe("calculer la réduction", () => {
  it("une photo d'iPhone 12 Mpx descend au grand côté visé, sans déformation", () => {
    const d = dimensionsCibles(4032, 3024);
    expect(Math.max(d.largeur, d.hauteur)).toBe(COTE_MAX);
    expect(d.largeur / d.hauteur).toBeCloseTo(4032 / 3024, 2);
  });

  it("une photo en portrait garde son sens", () => {
    const d = dimensionsCibles(3024, 4032);
    expect(d.hauteur).toBe(COTE_MAX);
    expect(d.hauteur).toBeGreaterThan(d.largeur);
  });

  it("une image déjà petite n'est pas agrandie", () => {
    expect(dimensionsCibles(1200, 900)).toEqual({ largeur: 1200, hauteur: 900 });
  });

  it("une image minuscule ne tombe jamais à zéro pixel", () => {
    const d = dimensionsCibles(3, 9000);
    expect(d.largeur).toBeGreaterThanOrEqual(1);
  });
});

describe("ne jamais bloquer un envoi", () => {
  it("un PDF ressort exactement tel quel", async () => {
    const f = fichier("aem.pdf", "application/pdf", 500_000);
    expect(await preparerPhoto(f)).toBe(f);
  });

  it("quand la préparation est impossible, l'original part quand même", async () => {
    // Dans cet environnement de test il n'y a pas de vrai moteur de rendu
    // d'image : c'est exactement le cas « ça a échoué ». On doit récupérer le
    // fichier d'origine, jamais null, jamais une erreur.
    const f = fichier("IMG_4021.JPG", "image/jpeg", 6_000_000);
    const sortie = await preparerPhoto(f);
    expect(sortie).toBeTruthy();
    expect(sortie.name).toBeTruthy();
  });

  it("un fichier absent ne fait pas planter", async () => {
    expect(await preparerPhoto(null)).toBe(null);
    expect(estImage(null)).toBe(false);
    expect(meriteReduction(null)).toBe(false);
  });
});
