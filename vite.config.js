import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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

export default defineConfig({
  plugins: [react(), hectorVersionPlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
});
