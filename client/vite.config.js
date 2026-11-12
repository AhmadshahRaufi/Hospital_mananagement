import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5000",
      // Uploaded logo / lab report header-footer images are served by the
      // API server from disk (see server/src/index.js) — proxy them too so
      // <img src="/uploads/..."> resolves while running the Vite dev server.
      "/uploads": "http://127.0.0.1:5000",
    },
  },
});
