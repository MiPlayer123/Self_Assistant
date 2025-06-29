// vite.config.ts
import { defineConfig } from "vite"
import electron from "vite-plugin-electron"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // main.ts
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: process.env.NODE_ENV !== "production",
            minify: process.env.NODE_ENV === "production",
            rollupOptions: {
              external: ["electron", "node-llama-cpp"]
            }
          }
        }
      },
      {
        // preload.ts
        entry: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            sourcemap: process.env.NODE_ENV !== "production",
            minify: process.env.NODE_ENV === "production",
            rollupOptions: {
              external: ["electron"]
            }
          }
        }
      }
    ])
  ],
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  server: {
    port: 54321,
    strictPort: true,
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== "production",
    minify: process.env.NODE_ENV === "production",
    chunkSizeWarningLimit: 2000, // Increased for transformers.js
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-toast', '@radix-ui/react-tooltip'],
          transformers: ['@xenova/transformers']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers']
  },
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
})
