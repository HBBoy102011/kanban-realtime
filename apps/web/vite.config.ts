import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(here, "../../packages/shared/src"),
      "@": path.resolve(here, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:8787" },
      "/socket.io": { target: "http://localhost:8787", ws: true },
    },
  },
  build: {
    outDir: path.resolve(here, "../../dist/web"),
    emptyOutDir: true,
  },
});
