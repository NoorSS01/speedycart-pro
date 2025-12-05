import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Base path for Hostinger - app is served from /dist/ under document root
  base: "/dist/",
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
