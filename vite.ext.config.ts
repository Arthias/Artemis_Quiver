import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import archiver from "archiver";
import { cpSync, createWriteStream, mkdirSync, readdirSync, readFileSync } from "fs";

const OUT_DIR = "Artemis_Quiver_extension";
const manifestVersion = JSON.parse(
  readFileSync(path.resolve(__dirname, "src/extension/manifest.json"), "utf-8")
).version as string;
const ZIP_PATH = path.resolve(__dirname, "release", `${OUT_DIR}-v${manifestVersion}.zip`);

function extensionAssets() {
  return {
    name: "extension-assets",
    closeBundle() {
      const out = path.resolve(__dirname, OUT_DIR);
      mkdirSync(out, { recursive: true });

      // Copy manifest to dist root
      cpSync(
        path.resolve(__dirname, "src/extension/manifest.json"),
        path.join(out, "manifest.json"),
        { force: true }
      );

      // Copy popup.html to dist root (Vite preserves nested dir structure)
      const srcPopup = path.resolve(out, "src/extension/popup.html");
      const dstPopup = path.resolve(out, "popup.html");
      try { cpSync(srcPopup, dstPopup, { force: true }); } catch { /* popup may be at root already */ }

      // Copy sidepanel.html to dist root (same reason as popup.html above)
      const srcSidepanel = path.resolve(out, "src/extension/sidepanel.html");
      const dstSidepanel = path.resolve(out, "sidepanel.html");
      try { cpSync(srcSidepanel, dstSidepanel, { force: true }); } catch { /* sidepanel may be at root already */ }

      // Copy i18n locale files for extension use
      const localesDir = path.resolve(__dirname, "src/app/i18n/locales");
      const outLocales = path.join(out, "locales");
      mkdirSync(outLocales, { recursive: true });
      try {
        for (const file of readdirSync(localesDir)) {
          if (file.endsWith(".json")) {
            cpSync(path.join(localesDir, file), path.join(outLocales, file), { force: true });
          }
        }
      } catch { /* locales dir may not exist */ }

      // Package the built extension into a zip for distribution
      mkdirSync(path.dirname(ZIP_PATH), { recursive: true });
      const output = createWriteStream(ZIP_PATH);
      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("warning", (err) => { if (err.code !== "ENOENT") console.warn(err); });
      archive.on("error", (err) => { throw err; });
      archive.pipe(output);
      archive.directory(out, false);
      archive.finalize().then(() => {
        console.log(`Packaged ${ZIP_PATH}`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), extensionAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      types: path.resolve(__dirname, "./src/app/types"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  build: {
    chunkSizeWarningLimit: 1000,
    modulePreload: false,
    outDir: OUT_DIR,
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "src/extension/background.ts"),
        overlay: path.resolve(__dirname, "src/extension/overlay.ts"),
        "nano-inject": path.resolve(__dirname, "src/extension/nano-inject.ts"),
        popup: path.resolve(__dirname, "src/extension/popup.html"),
        sidepanel: path.resolve(__dirname, "src/extension/sidepanel.html"),
        "webllm-sw": path.resolve(__dirname, "src/app/services/provider/webllm-sw.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("node_modules") && !id.includes("fake-indexeddb")) {
            return "vendor";
          }
        },
      },
    },
  },
});
