import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// When deploying to https://<user>.github.io/hmail/ the build needs base: '/hmail/'.
// When deploying to a custom domain (mail.hyphae.intelechia.com) base stays '/'.
// VITE_BASE_PATH overrides at build time; default is '/' so `npm run dev` works
// without thinking about it.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
