// ─────────────────────────────────────────────────────────────────────────────
//  appleAuth.js — « Se connecter avec Apple » (iOS natif uniquement).
//
//  Le nonce, en deux mots : un code à usage unique qui empêche qu'un jeton
//  intercepté soit rejoué par quelqu'un d'autre.
//
//  ⚠️ Les deux formes du nonce, à ne surtout pas confondre :
//     • à APPLE  → on envoie la SHA-256 du nonce (Apple la recopie dans le jeton)
//     • à NOTRE BACKEND → on envoie le nonce BRUT (le serveur le rehashe et compare)
//  Envoyer le haché au backend échouerait à tous les coups (401).
//
//  Le backend attend : { identity_token, nonce }  →  { token, email }
// ─────────────────────────────────────────────────────────────────────────────

const enHex = (octets) => Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");

/** Nonce aléatoire (le BRUT, celui qui part chez nous). */
function nonceAleatoire(taille = 32) {
  const octets = new Uint8Array(taille);
  crypto.getRandomValues(octets);
  return enHex(octets);
}

/** SHA-256 en hexa (le HACHÉ, celui qui part chez Apple). */
async function sha256Hex(texte) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return enHex(new Uint8Array(buf));
}

/** Le bouton Apple n'a de sens que dans l'appli iOS (pas sur le web, pas sur Android). */
export function appleDisponible() {
  try { return window.Capacitor?.getPlatform?.() === "ios"; } catch { return false; }
}

/**
 * Ouvre la feuille de connexion Apple (Face ID).
 * @returns {Promise<{identity_token: string, nonce: string} | null>} null si la personne annule.
 */
export async function connexionApple() {
  const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
  const nonce = nonceAleatoire();             // brut  → notre backend
  const nonceHache = await sha256Hex(nonce);  // haché → Apple
  try {
    const res = await SignInWithApple.authorize({ scopes: "email name", nonce: nonceHache });
    const identity_token = res?.response?.identityToken;
    if (!identity_token) throw new Error("Apple n'a pas renvoyé de jeton d'identité.");
    return { identity_token, nonce };
  } catch (e) {
    // Annulation par la personne : ce n'est pas une erreur, on ne montre rien.
    const msg = String(e?.message || e || "");
    if (/cancel/i.test(msg) || e?.code === "1001" || /1001/.test(msg)) return null;
    throw e;
  }
}
