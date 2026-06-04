import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";

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
      cpSync(
        path.resolve(__dirname, "src/extension/manifest.json"),
        path.join(out, "manifest.json"),
        { force: true }
      );
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
    outDir: "dist-ext",
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        background: path.resolve(__dirname, "src/extension/background.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
