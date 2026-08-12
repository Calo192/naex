import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Vývojový server presmeruje WebSocket na herný server,
    // takže klient a server sú v prehliadači na tom istom pôvode.
    proxy: { "/ws": { target: "ws://localhost:8787", ws: true } },
  },
  build: { outDir: "dist", sourcemap: true },
});
