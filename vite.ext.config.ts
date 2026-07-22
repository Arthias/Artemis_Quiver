import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync, readdirSync } from "fs";

function figmaAssetResolver() {
  return {
    name: "figma-asset-resolver",
    resolveId(id: string) {
      if (id.startsWith("figma:asset/")) {
        const filename = id.replace("figma:asset/", "");
        return path.resolve(__dirname, "src/assets", filename);
      }
    },
  };
}

function extensionAssets() {
  return {
    name: "extension-assets",
    closeBundle() {
      const out = path.resolve(__dirname, "dist-ext");
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
    },
  };
}

export default defineConfig({
  plugins: [figmaAssetResolver(), react(), tailwindcss(), extensionAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      types: path.resolve(__dirname, "./src/app/types"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
  build: {
    chunkSizeWarningLimit: 1000,
    outDir: "dist-ext",
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "src/extension/background.ts"),
        overlay: path.resolve(__dirname, "src/extension/overlay.ts"),
        "nano-inject": path.resolve(__dirname, "src/extension/nano-inject.ts"),
        popup: path.resolve(__dirname, "src/extension/popup.html"),
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
