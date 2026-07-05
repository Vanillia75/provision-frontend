// ─────────────────────────────────────────────────────────────────────────────
//  Feature flags — OFF par défaut. Un flag ne s'active JAMAIS tout seul.
//
//  Deux déclencheurs, tous deux volontaires :
//    1) BUILD  : variable d'env Vite `VITE_FEATURE_*` = "true" (définie au build).
//                Le build de prod actuel ne la définit pas → flag OFF pour tous.
//    2) LOCAL  : une clé localStorage posée À LA MAIN dans la console du navigateur.
//                Sert à prévisualiser en prod sans redéployer. Un testeur lambda ne
//                connaît pas la clé et ne peut donc pas tomber sur l'écran, même en
//                tapant une URL (les écrans internes sont pilotés par l'état `interNav`,
//                pas par l'URL).
// ─────────────────────────────────────────────────────────────────────────────

function localOverride(key) {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

// « Trouver des heures » — écran caché derrière ce flag tant que la V1 mockée
// n'est pas validée. Activation perso : localStorage.setItem('ff_trouver_heures','1').
export const FEATURE_TROUVER_HEURES =
  import.meta.env.VITE_FEATURE_TROUVER_HEURES === "true" ||
  localOverride("ff_trouver_heures");
