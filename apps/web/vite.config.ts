import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Porty z prostredia, aby viac worktree (súbežné sessions) mohlo mať vlastný
// dev server bez kolízie: PORT = herný server, NAEX_WEB_PORT = Vite.
const server = `localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.NAEX_WEB_PORT ?? 5173),
    strictPort: true,
    // Vývojový server presmeruje WebSocket, API a médiá na herný server,
    // takže klient a server sú v prehliadači na tom istom pôvode.
    proxy: {
      "/ws": { target: `ws://${server}`, ws: true },
      "/api": { target: `http://${server}` },
      "/media": { target: `http://${server}` },
      "/hudba": { target: `http://${server}` },
      "/melichar": { target: `http://${server}` },
      "/playtesty": { target: `http://${server}` },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
