import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" is load-bearing. Home Assistant ingress serves this app from a
// prefixed path, so absolute asset URLs would 404. Relative ones survive it.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  plugins: [react()],
});
