import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies the API and the audio files to the Express backend (Module 2),
// so the browser sees a single origin and no CORS setup is needed during development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/media": "http://localhost:4000",
    },
  },
});
