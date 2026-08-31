import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
        // Alias types for CV builder imports
        'types': path.resolve(__dirname, './src/app/types'),
      },
    },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    proxy: {
      '/api/lmstudio': {
        target: 'http://localhost:1234',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lmstudio/, ''),
      },
      '/api/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
      },
    },
  },

  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        "webllm-sw": path.resolve(__dirname, "src/app/services/provider/webllm-sw.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "webllm-sw") return "[name].js";
          return "assets/[name]-[hash].js";
        },
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router"],
          "dexie-vendor": ["dexie"],
        },
      },
    },
  },
})
