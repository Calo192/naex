// Vstupný bod servera — konfigurácia z prostredia, logika v server.ts.
//
//   PORT                 port (predvolene 8787)
//   NAEX_DATA            adresár s databázou a nahranými súbormi (./data)
//   NAEX_ADMINS          prihlasovacie mená administrátorov, oddelené čiarkou
//   NAEX_SECURE_COOKIE   1 = cookie len cez HTTPS (nastav za reverse proxy)

import { createGameServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 8787);

createGameServer({
  port: PORT,
  dataDir: process.env.NAEX_DATA ?? "data",
  admini: (process.env.NAEX_ADMINS ?? "").split(","),
  bezpecneCookie: process.env.NAEX_SECURE_COOKIE === "1",
})
  .then((server) => {
    console.log(`NA EX server počúva na http://localhost:${server.port}`);
  })
  .catch((err: unknown) => {
    console.error("Server sa nepodarilo spustiť:", err);
    process.exit(1);
  });
