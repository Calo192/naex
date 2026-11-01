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
//   NAEX_SCENAR          vývojový scenár partií proti botovi (scenar.ts): zajatie | zajatie-vyhra —
//                        starší na stupni 3 pre tok zajatia; pri NODE_ENV=production sa ignoruje
//   NAEX_EMAIL_REZIM     ako posielať e-maily (obnova hesla); zatiaľ len log = vypísať do logu (predvolene)
//   NAEX_ADRESA          verejná adresa webu do odkazov v e-mailoch (https://naex.sk); bez nej len cesta

import { fileURLToPath } from "node:url";
import { createGameServer } from "./server.ts";
import { scenarZProstredia } from "./scenar.ts";
import { odosielacZProstredia } from "./email.ts";

const PORT = Number(process.env.PORT ?? 8787);

// Scenár mení rozdanie — na živom webe nikdy (scenarZProstredia).
const { scenar, ignorovany } = scenarZProstredia(process.env);
if (ignorovany !== null) console.warn(`NAEX_SCENAR=${ignorovany} sa ignoruje (neznámy scenár alebo produkcia).`);
if (scenar !== undefined) console.log(`Vývojový scenár partií proti botovi: ${scenar}`);

createGameServer({
  port: PORT,
  dataDir: process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url)),
  admin: { login: process.env.NAEX_ADMIN_LOGIN ?? "Admin", heslo: process.env.NAEX_ADMIN_HESLO || null },
  bezpecneCookie: process.env.NAEX_SECURE_COOKIE === "1",
  ...(process.env.NAEX_VYUCBA === "1" ? { vyucbaZapnuta: true } : {}),
  ...(process.env.NAEX_ACHIEVEMENTY === "1" ? { achievementyZapnute: true } : {}),
  ...(process.env.NAEX_PLAYTESTY ? { playtestyDir: process.env.NAEX_PLAYTESTY } : {}),
  ...(scenar !== undefined ? { scenar } : {}),
  posliEmail: odosielacZProstredia(process.env.NAEX_EMAIL_REZIM),
  ...(process.env.NAEX_ADRESA ? { adresa: process.env.NAEX_ADRESA } : {}),
})
  .then((server) => {
    console.log(`NA EX server počúva na http://localhost:${server.port}`);
  })
  .catch((err: unknown) => {
    console.error("Server sa nepodarilo spustiť:", err);
    process.exit(1);
  });
