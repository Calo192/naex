import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Vývojový server presmeruje WebSocket, API a médiá na herný server,
    // takže klient a server sú v prehliadači na tom istom pôvode.
    proxy: {
      "/ws": { target: "ws://localhost:8787", ws: true },
      "/api": { target: "http://localhost:8787" },
      "/media": { target: "http://localhost:8787" },
      "/hudba": { target: "http://localhost:8787" },
      "/melichar": { target: "http://localhost:8787" },
      "/playtesty": { target: "http://localhost:8787" },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
