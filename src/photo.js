// ─────────────────────────────────────────────────────────────────────────────
//  Préparer une photo AVANT de l'envoyer au scan.
//
//  Ajouté le 14/08/2026, après la découverte des bugs de scan côté iPhone.
//  Le serveur sait maintenant redresser et réduire une photo lui-même (c'est la
//  vraie défense, celle qui protège aussi les applications déjà installées).
//  Ici on s'occupe de ce que le serveur ne peut PAS faire : ce qui se passe
//  AVANT l'envoi.
//
//  Deux raisons, toutes deux vécues sur téléphone :
//    · une photo d'iPhone récent peut dépasser la limite de 10 Mo du serveur.
//      La personne recevait « fichier trop volumineux, réduis la photo », ce qui
//      n'a aucun sens quand on ne sait pas comment réduire une photo sur un
//      téléphone. C'est une impasse, pas un message d'erreur.
//    · en 4G, envoyer 8 Mo prend un temps interminable, pour une image que le
//      lecteur ramènera de toute façon à une définition bien plus petite.
//
//  Règle de prudence : cette fonction ne doit JAMAIS empêcher un envoi. Au
//  moindre problème, on renvoie le fichier d'origine et on laisse le serveur
//  faire son travail.
// ─────────────────────────────────────────────────────────────────────────────

// Le grand côté visé. Le lecteur ramène de toute façon les images autour de
// 1568 px : on garde de la marge pour les petits caractères des attestations.
export const COTE_MAX = 2200;

// En dessous de ça, réduire ne rapporte rien et risque d'abîmer pour rien.
export const POIDS_PLANCHER = 1_200_000; // 1,2 Mo

const EXTENSIONS_IMAGE = /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)$/i;

/** Vrai si ce fichier est une photo (et pas un PDF).
 *  ⚠️ Sur iPhone, un fichier HEIC arrive parfois avec un type vide : on regarde
 *  aussi le nom, sinon la photo passe à travers sans être préparée. */
export function estImage(file) {
  if (!file) return false;
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf") return false;
  if (type.startsWith("image/")) return true;
  return EXTENSIONS_IMAGE.test(file.name || "");
}

/** Les dimensions après réduction, en gardant les proportions.
 *  On n'agrandit jamais : fabriquer du faux détail n'aide pas à lire. */
export function dimensionsCibles(largeur, hauteur, max = COTE_MAX) {
  const cote = Math.max(largeur, hauteur);
  if (!cote || cote <= max) return { largeur, hauteur };
  const ratio = max / cote;
  return {
    largeur: Math.max(1, Math.round(largeur * ratio)),
    hauteur: Math.max(1, Math.round(hauteur * ratio)),
  };
}

/** Vrai s'il vaut la peine de préparer ce fichier avant l'envoi. */
export function meriteReduction(file) {
  if (!estImage(file)) return false;
  // Un HEIC est toujours converti, même léger : le convertir ici évite au
  // serveur de le faire et garantit un format que tout le monde comprend.
  const heic = /heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
  return heic || (file.size || 0) > POIDS_PLANCHER;
}

/** Charge le fichier en image, en respectant l'orientation d'origine. */
async function chargerImage(file) {
  if (typeof createImageBitmap === "function") {
    // « from-image » applique la consigne de rotation des métadonnées : c'est
    // ce qui redresse une photo prise en portrait avec un téléphone.
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image illisible"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Renvoie un fichier prêt à envoyer : redressé, réduit, en JPEG.
 * Renvoie le fichier D'ORIGINE si ce n'est pas une image, si la préparation
 * échoue, ou si le résultat n'est pas plus léger.
 */
export async function preparerPhoto(file) {
  try {
    if (!meriteReduction(file)) return file;

    const source = await chargerImage(file);
    const l = source.width, h = source.height;
    if (!l || !h) return file;
    const cible = dimensionsCibles(l, h);

    const canvas = document.createElement("canvas");
    canvas.width = cible.largeur;
    canvas.height = cible.hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, cible.largeur, cible.hauteur);
    if (typeof source.close === "function") source.close();

    const blob = await new Promise((resolve) => {
      if (typeof canvas.toBlob !== "function") return resolve(null);
      canvas.toBlob(resolve, "image/jpeg", 0.85);
    });
    if (!blob || !blob.size) return file;

    // Si on n'a rien gagné, on garde l'original : moins de transformation,
    // moins de risque d'abîmer le document.
    const converti = /heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");
    if (!converti && blob.size >= (file.size || 0)) return file;

    const nom = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nom, { type: "image/jpeg", lastModified: file.lastModified || Date.now() });
  } catch {
    return file;   // jamais d'envoi bloqué à cause de cette préparation
  }
}

/** La même chose sur une liste, en gardant l'ordre des pages. */
export async function preparerPhotos(fichiers) {
  const sortie = [];
  for (const f of fichiers) sortie.push(await preparerPhoto(f));
  return sortie;
}
