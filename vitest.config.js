// ─────────────────────────────────────────────────────────────────────────────
//  Configuration des tests du SITE (Vitest).
//  Fichier séparé de vite.config.js exprès : la configuration de construction
//  embarque Sentry et l'identifiant de build, dont les tests n'ont pas besoin
//  (et qui ralentiraient chaque exécution).
//
//  Lancer : npm test          (une fois, pour la vérification avant push)
//           npm run test:watch (en continu pendant qu'on code)
// ─────────────────────────────────────────────────────────────────────────────
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    // Sortie courte : ce qui compte, c'est la ligne « passed » et les échecs.
    reporters: ["default"],
  },
});
