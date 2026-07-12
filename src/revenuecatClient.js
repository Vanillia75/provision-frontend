// ─────────────────────────────────────────────────────────────────────────────
//  revenuecatClient.js — la caisse in-app (RevenueCat) pour iOS et Android.
//
//  Rôle : parler à StoreKit (Apple) / Play Billing (Google) via le plugin
//  Capacitor de RevenueCat. Le BACKEND reste le juge unique du premium : après
//  un achat, RevenueCat notifie notre serveur (webhook) qui active le compte ;
//  l'app se contente de recharger le profil.
//
//  Identité (non négociable) : Purchases.logIn(user_id) avec NOTRE user.id,
//  lu dans le jeton de connexion (champ "sub"). Jamais d'achat anonyme.
//
//  Tout est défensif : sur le web (pas de plugin) ou si les stores toussent,
//  chaque fonction échoue en douceur et l'écran garde un état honnête.
// ─────────────────────────────────────────────────────────────────────────────

// Clés PUBLIQUES RevenueCat (aucune valeur secrète : elles identifient l'app).
const CLE_IOS = "appl_qEocfiDKlpZJgNdIMFYiVdCDBNv";
const CLE_ANDROID = "goog_eLuNvBCxhHCCGRtvahaALVUCyml";

export const PRODUITS_VEILLE = ["veille_mensuel", "veille_annuel"];

let _configure = false;

function plateforme() {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
}

/** user_id du backend, lu dans le JWT (champ sub) sans vérification (identification locale). */
export function lireUserIdDuToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || null;
  } catch { return null; }
}

async function purchases() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

/** Configure la caisse et rattache l'achat au compte TOTOR. À appeler après l'auth. */
export async function initCaisse(token) {
  const p = plateforme();
  if (p !== "ios" && p !== "android") return false;
  const userId = lireUserIdDuToken(token);
  if (!userId) return false;
  try {
    const Purchases = await purchases();
    if (!_configure) {
      await Purchases.configure({ apiKey: p === "ios" ? CLE_IOS : CLE_ANDROID, appUserID: userId });
      _configure = true;
    } else {
      await Purchases.logIn({ appUserID: userId });
    }
    return true;
  } catch (e) {
    console.warn("Caisse in-app indisponible:", e?.message || e);
    return false;
  }
}

/** Les 2 produits avec leurs PRIX LOCALISÉS lus chez Apple/Google (source de vérité). */
export async function chargerProduitsVeille() {
  const Purchases = await purchases();
  const { products } = await Purchases.getProducts({ productIdentifiers: PRODUITS_VEILLE });
  const parId = {};
  for (const prod of products || []) parId[prod.identifier] = prod;
  return {
    mensuel: parId["veille_mensuel"] || null,
    annuel: parId["veille_annuel"] || null,
  };
}

/** Lance l'achat natif (Face ID / Google Pay). Renvoie true si l'achat aboutit. */
export async function acheterVeille(produit) {
  const Purchases = await purchases();
  try {
    await Purchases.purchaseStoreProduct({ product: produit });
    return true;
  } catch (e) {
    if (e?.userCancelled || /cancel/i.test(e?.message || "")) return false; // annulé = pas une erreur
    throw e;
  }
}

/** Restaurer mes achats (obligation Apple) : resynchronise les reçus du store. */
export async function restaurerAchats() {
  const Purchases = await purchases();
  await Purchases.restorePurchases();
  return true;
}
