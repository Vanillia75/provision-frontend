// Vérificateur de code — filet de sécurité AVANT chaque push.
//
// Pourquoi ce fichier existe : `vite build` compile sans jamais vérifier qu'une
// variable existe vraiment. Trois écrans blancs sont partis en production pour
// cette seule raison (« c is not defined » le 20/07, « fmtDate is not defined »
// et « blocsPilotage is not defined » le 26/07) : une variable appelée dans un
// morceau d'affichage alors qu'elle était déclarée dans un AUTRE morceau.
//
// On n'active donc QUE les règles qui attrapent un plantage réel à l'écran.
// Aucune règle de style, aucun avis sur la façon d'écrire : zéro bruit, et
// chaque alerte est un vrai bug. Le build reste inchangé (Vercel ne lance pas
// ce fichier) : lancer `npm run check` à la main avant de pousser.
import globals from "globals";

export default [
  {
    files: ["src/**/*.{js,jsx}", "*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        __BUILD_ID__: "readonly", // injecté au build par vite.config.js
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Le code contient des commentaires « eslint-disable react-hooks/... »
    // hérités : on déclare la règle à vide pour qu'ils ne fassent pas échouer
    // la vérification, sans installer le module correspondant.
    plugins: { "react-hooks": { rules: { "exhaustive-deps": { create: () => ({}) } } } },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "react-hooks/exhaustive-deps": "off",

      // ── Le bug qui a fait les trois écrans blancs ──
      "no-undef": "error",

      // NOTE : « no-use-before-define » a été essayé puis retiré. Il signalait
      // 51 fois du code parfaitement sain (une fonction qui lit une variable
      // déclarée plus bas est inoffensive : elle n'est appelée qu'après, au
      // clic). Il ne sait pas distinguer ce cas du seul cas dangereux (une
      // const d'affichage évaluée tout de suite, cf. le crash PR1 du 01/07).
      // Une vérification qui crie pour rien ne serait plus lue : on garde
      // uniquement des règles à zéro fausse alerte.

      // ── Autres plantages certains ──
      "no-const-assign": "error",       // réécrire une valeur figée
      "no-dupe-keys": "error",          // deux fois la même clé : la 1re est perdue
      "no-dupe-args": "error",
      "no-duplicate-case": "error",
      "no-obj-calls": "error",
      "no-unsafe-negation": "error",
      "no-cond-assign": "error",        // « = » écrit à la place de « === »
      "no-self-assign": "error",
      "no-unreachable": "error",        // code placé après un return : jamais exécuté
      "valid-typeof": "error",
    },
  },
];
