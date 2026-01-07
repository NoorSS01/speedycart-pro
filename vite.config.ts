import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => ({
  // Base path configuration:
  // - Development (npm run dev): Use "/" for local dev server
  // - Production (npm run build): Use "/dist/" for Hostinger deployment
  // This fixes the 404 error on local development while keeping Hostinger working
  base: command === 'serve' ? '/' : '/dist/',
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // NOTE: VitePWA removed because it was overwriting our manifest.json link
    // We use our own manifest.json in public/ folder and register service worker manually
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  publicDir: "public",
}));

