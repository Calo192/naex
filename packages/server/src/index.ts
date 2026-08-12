// Vstupný bod servera — konfigurácia z prostredia, logika v server.ts.

import { createGameServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 8787);

createGameServer({ port: PORT })
  .then((server) => {
    console.log(`NA EX server počúva na http://localhost:${server.port}`);
  })
  .catch((err: unknown) => {
    console.error("Server sa nepodarilo spustiť:", err);
    process.exit(1);
  });
