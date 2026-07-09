import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import fs from "fs";
import path from "path";

// Identifiant unique de ce build (timestamp). Sert à détecter qu'une nouvelle
// version a été déployée : il est embarqué dans l'app (__BUILD_ID__) ET écrit
// dans dist/version.json. L'app compare les deux pour proposer la mise à jour.
const BUILD_ID = Date.now().toString();

function hectorVersionPlugin() {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "hector-version",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
      root = cfg.root;
    },
    closeBundle() {
      try {
        const dir = path.isAbsolute(outDir) ? outDir : path.join(root, outDir);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "version.json"), JSON.stringify({ id: BUILD_ID }));
      } catch (e) {
        console.warn("[hector-version] écriture de version.json échouée :", e);
      }
    },
  };
}

export default defineConfig(() => {
  // Upload des sourcemaps à Sentry UNIQUEMENT si le token est fourni (variable d'env).
  // Sans token (dev local, ou prod tant que les variables Vercel ne sont pas posées),
  // le comportement reste IDENTIQUE à avant : pas de sourcemap, pas d'upload, aucun risque.
  const uploadSentry = !!process.env.SENTRY_AUTH_TOKEN;
  return {
    plugins: [
      react(),
      hectorVersionPlugin(),
      ...(uploadSentry
        ? [sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: BUILD_ID },
            // Les .map sont uploadées PUIS supprimées du build : jamais servies au public.
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.js.map"] },
          })]
        : []),
    ],
    // "hidden" = sourcemaps générées (pour l'upload) mais SANS commentaire
    // //# sourceMappingURL dans les bundles servis → non exposées publiquement.
    build: {
      sourcemap: uploadSentry ? "hidden" : false,
      // Multi-pages : chaque landing a son propre HTML (titre/description/texte
      // propres, lisibles par Google avant React). Les 3 chargent la MÊME app,
      // qui affiche la bonne page selon l'URL.
      rollupOptions: {
        input: {
          main: path.resolve(process.cwd(), "index.html"),
          intermittent: path.resolve(process.cwd(), "intermittent.html"),
          "auto-entrepreneur": path.resolve(process.cwd(), "auto-entrepreneur.html"),
        },
      },
    },
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
  };
});
