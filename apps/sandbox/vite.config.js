import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "/apps": path.resolve(import.meta.dirname, "../../apps"),
    },
  },
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: [".."],
    },
  },
});
