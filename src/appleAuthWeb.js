// ─────────────────────────────────────────────────────────────────────────────
//  « Se connecter avec Apple » sur le web (SDK JavaScript d'Apple).
//  Jumeau web de src/appleAuth.js côté app iOS : MÊME convention de nonce, pour
//  que les deux tapent la même route /auth/apple sans que le backend distingue.
//
//  La règle du nonce, à ne jamais inverser :
//    - on tire un nonce BRUT au hasard ;
//    - on donne sa SHA-256 à Apple (il la recopie dans le jeton) ;
//    - on envoie le nonce BRUT au backend, qui rehashe et compare.
//  Envoyer le haché au backend = 401 systématique.
// ─────────────────────────────────────────────────────────────────────────────

// Identifiant du SITE chez Apple (Services ID), différent du bundle id de l'app
// iPhone (fr.montotor.ios). Le backend accepte les deux via APPLE_AUDIENCES.
const APPLE_SERVICES_ID = "fr.montotor.web";
const APPLE_REDIRECT_URI = "https://www.montotor.fr";
const APPLE_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/fr_FR/appleid.auth.js";

/** Erreur « la personne a fermé la fenêtre Apple » : ce n'est pas un échec. */
export class AppleAnnule extends Error {}

function nonceAleatoire() {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => o.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(texte) {
  const empreinte = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
  return Array.from(new Uint8Array(empreinte), o => o.toString(16).padStart(2, "0")).join("");
}

let sdkCharge = null;
function chargerSdk() {
  if (window.AppleID) return Promise.resolve();
  if (sdkCharge) return sdkCharge; // déjà en cours : on ne charge pas deux fois
  sdkCharge = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = APPLE_SDK_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { sdkCharge = null; reject(new Error("SDK Apple injoignable")); };
    document.head.appendChild(s);
  });
  return sdkCharge;
}

/**
 * Ouvre la fenêtre Apple et rend { identity_token, nonce } prêt à poster sur
 * /auth/apple. Lève AppleAnnule si la personne ferme la fenêtre.
 */
export async function connexionApple() {
  await chargerSdk();

  const nonce = nonceAleatoire();
  window.AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: "email",
    redirectURI: APPLE_REDIRECT_URI,
    // Apple recopie TEL QUEL ce qu'on lui donne ici dans le jeton : on lui donne
    // donc la SHA-256, et c'est le nonce brut qu'on enverra au backend.
    nonce: await sha256Hex(nonce),
    usePopup: true, // sans ça, Apple quitte le site et revient par redirection
  });

  let reponse;
  try {
    reponse = await window.AppleID.auth.signIn();
  } catch (e) {
    // Apple renvoie { error: "popup_closed_by_user" } quand on ferme la fenêtre.
    const code = e && (e.error || (e.detail && e.detail.error));
    if (code === "popup_closed_by_user" || code === "user_cancelled_authorize") {
      throw new AppleAnnule();
    }
    throw new Error("La connexion Apple a échoué. Réessaie ou utilise ton email.");
  }

  const identityToken = reponse && reponse.authorization && reponse.authorization.id_token;
  if (!identityToken) throw new Error("Apple n'a pas renvoyé de jeton. Réessaie.");

  return { identity_token: identityToken, nonce };
}

/** Bouton officiel Apple : noir, coins arrondis, logo intégré (règles d'Apple). */
export const STYLE_BOUTON_APPLE = {
  width: "100%",
  maxWidth: 360,
  minHeight: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "#000000",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  padding: "0 16px",
};
