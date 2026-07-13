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

// ─── Démarrage GARANTI de la caisse (demande PC 13/07) ───
// Un seul démarrage pour toute l'app (single-flight) : tous les appels attendent
// la même promesse — fini les doubles configure() qui se figent. Chrono de 8 s :
// un pont natif muet devient une ERREUR VISIBLE au lieu d'une attente infinie.
// `etatCaisse` raconte l'histoire ("ok" ou la cause) pour l'afficher à l'écran.
let _initArgs = null;      // { apiKey, appUserID } mémorisés au premier init
let _demarrage = null;     // promesse unique de démarrage en cours ou abouti
export let etatCaisse = "pas encore démarrée";

// Journal de diagnostic (affiché discrètement sous le fallback si la boutique est muette).
const _journal = [];
function _note(msg) { _journal.push(msg); if (_journal.length > 12) _journal.shift(); }
export function journalCaisse() { return [..._journal]; }

function plateforme() {
  try { return window.Capacitor?.getPlatform?.() || "web"; } catch { return "web"; }
}

const chrono = (p, nom, ms = 8000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(nom + " : pas de réponse en " + ms / 1000 + " s")), ms))]);

/** user_id du backend, lu dans le JWT (champ sub) sans vérification (identification locale). */
export function lireUserIdDuToken(token) {
  try {
    // base64url → base64 : remap des caractères ET padding (atob est strict).
    let b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(Array.from(atob(b64), c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    return JSON.parse(json).sub || null;
  } catch { return null; }
}

async function purchases() {
  const mod = await chrono(import("@revenuecat/purchases-capacitor"), "chargement du module caisse");
  // ⚠️ JAMAIS renvoyer le proxy Purchases nu depuis une fonction async : `await`
  // verrait son `.then` (piege du proxy Capacitor : methode native inexistante,
  // callbacks ignores) et la promesse resterait PENDUE A VIE. On l'emballe.
  return { Purchases: mod.Purchases };
}

function demarrerCaisse() {
  // Single-flight : si un démarrage est en cours ou abouti, on s'y accroche.
  if (_demarrage) return _demarrage;
  _demarrage = (async () => {
    const { Purchases } = await purchases();
    try { await Purchases.setLogLevel({ level: "DEBUG" }); } catch {}
    etatCaisse = "configuration…";
    await chrono(Purchases.configure(_initArgs), "configure caisse");
    etatCaisse = "ok";
    _note("configure OK (" + plateforme() + (_initArgs.appUserID ? ", identité liée" : ", anonyme") + ")");
    try {
      const r = await chrono(Purchases.canMakePayments(), "canMakePayments", 6000);
      _note("canMakePayments=" + r.canMakePayments);
    } catch (e) { _note("canMakePayments err: " + (e?.message || e)); }
    return { Purchases };  // meme piege au retour : toujours emballe
  })().catch(e => {
    etatCaisse = "échec : " + String(e?.message || e);
    _demarrage = null; // un prochain appel retentera
    throw e;
  });
  return _demarrage;
}

/** Garantit que la caisse est prête (démarre au besoin). Rejette avec une cause lisible. */
async function caissePrete() {
  if (plateforme() !== "ios" && plateforme() !== "android") throw new Error("caisse indisponible sur le web");
  if (!_initArgs) _initArgs = { apiKey: plateforme() === "android" ? CLE_ANDROID : CLE_IOS };
  return demarrerCaisse();
}

/** Configure la caisse et rattache l'achat au compte TOTOR. À appeler après l'auth. */
export async function initCaisse(token) {
  const p = plateforme();
  if (p !== "ios" && p !== "android") return false;
  const userId = lireUserIdDuToken(token);
  try {
    _initArgs = { apiKey: p === "ios" ? CLE_IOS : CLE_ANDROID, ...(userId ? { appUserID: userId } : {}) };
    const { Purchases } = await demarrerCaisse();
    // Si la caisse avait démarré sans identité (secours), on rattache le compte.
    if (userId) { try { await chrono(Purchases.logIn({ appUserID: userId }), "logIn caisse", 8000); } catch { /* déjà loggé ou identique */ } }
    return true;
  } catch (e) {
    console.warn("Caisse in-app indisponible:", e?.message || e);
    return false;
  }
}

/** Les 2 produits avec leurs PRIX LOCALISÉS lus chez Apple/Google (source de vérité). */
export async function chargerProduitsVeille() {
  const { Purchases } = await caissePrete();
  const { products } = await chrono(Purchases.getProducts({ productIdentifiers: PRODUITS_VEILLE }), "lecture des produits");
  _note("getProducts -> " + (products ? products.length : "null") + " produit(s)" +
    (products && products.length ? " [" + products.map(x => x.identifier).join(", ") + "]" : ""));
  const parId = {};
  // Android nomme ses produits "abonnement:forfait" (ex. veille_mensuel:mensuel) :
  // on indexe par la partie AVANT les deux-points pour rester commun iOS/Android.
  for (const prod of products || []) parId[String(prod.identifier).split(":")[0]] = prod;
  return {
    mensuel: parId["veille_mensuel"] || null,
    annuel: parId["veille_annuel"] || null,
  };
}

/** Lance l'achat natif (Face ID / Google Pay). Renvoie true si l'achat aboutit. */
export async function acheterVeille(produit) {
  const { Purchases } = await caissePrete();
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
  const { Purchases } = await caissePrete();
  await Purchases.restorePurchases();
  return true;
}
