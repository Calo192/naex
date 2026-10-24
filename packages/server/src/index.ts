// Vstupný bod servera — konfigurácia z prostredia, logika v server.ts.
//
//   PORT                 port (predvolene 8787)
//   NAEX_DATA            adresár s databázou a nahranými súbormi (predvolene <repo>/data)
//   NAEX_ADMIN_HESLO     heslo jediného admina; účet sa pri štarte založí/aktualizuje
//   NAEX_ADMIN_LOGIN     jeho prihlasovacie meno (predvolene Admin)
//   NAEX_PLAYTESTY       priečinok s reportmi playtestov (predvolene <repo>/docs/playtesty)
//   NAEX_SECURE_COOKIE   1 = cookie len cez HTTPS (nastav za reverse proxy)
//   NAEX_VYUCBA          1 = výučba „Prvá hra“ aj pre hráčov pri vypnutom vypínači (dočasný server
//                        playtestu výučby: nováčik má byť obyčajný návštevník, nie správca)
//   NAEX_ACHIEVEMENTY    1 = achievementy počítať aj pri „zapnute“: false v katalógu (vývoj a UI inšpekcia)

import { fileURLToPath } from "node:url";
import { createGameServer } from "./server.ts";

const PORT = Number(process.env.PORT ?? 8787);

createGameServer({
  port: PORT,
  dataDir: process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url)),
  admin: { login: process.env.NAEX_ADMIN_LOGIN ?? "Admin", heslo: process.env.NAEX_ADMIN_HESLO || null },
  bezpecneCookie: process.env.NAEX_SECURE_COOKIE === "1",
  ...(process.env.NAEX_VYUCBA === "1" ? { vyucbaZapnuta: true } : {}),
  ...(process.env.NAEX_ACHIEVEMENTY === "1" ? { achievementyZapnute: true } : {}),
  ...(process.env.NAEX_PLAYTESTY ? { playtestyDir: process.env.NAEX_PLAYTESTY } : {}),
})
  .then((server) => {
    console.log(`NA EX server počúva na http://localhost:${server.port}`);
  })
  .catch((err: unknown) => {
    console.error("Server sa nepodarilo spustiť:", err);
    process.exit(1);
  });
