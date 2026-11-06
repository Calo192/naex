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
//   NAEX_INSTANCIA       vypalena (predvolene, oficiálna hra) | zrejuca (pokusná, s oprávnením hrat_zrejucu;
//                        Michal 2026-11-02, zrejuca.ts) — Zrejúca potrebuje aj:
//   NAEX_VYPALENA        adresa, na ktorej Zrejúca volá Vypálenú (v Dockeri http://naex:8787);
//                        heslo admina Vypálenej je to isté NAEX_ADMIN_LOGIN / NAEX_ADMIN_HESLO
//   NAEX_VYPALENA_ADRESA len vo vývoji: adresa Vypálenej pre prehliadač (http://localhost:8789);
//                        za Caddy chýba — obe inštancie sú na jednej adrese
//   NAEX_ZREJUCA_ADRESA  Vypálená: kam prepínač „Zrejúca“ pošle prehliadač — za Caddy "/", vo vývoji
//                        http://localhost:<port Zrejúcej>; bez nej sa Zrejúca neponúka
//   NAEX_ZREJUCA_URL     Vypálená: kde sa pýta Zrejúcej na verziu (v Dockeri http://naex-zrejuca:8787) —
//                        Zrejúca bez zmien sa hráčom neponúka; bez nej sa to neoveruje
//   NAEX_REZIMY_ZREJUCEJ 2 na 2 a Päta, Lakeť, Otočka (zrejuca.ts) idú podľa NAEX_INSTANCIA: Zrejúca áno,
//                        Vypálená nie, a tak aj predvolený `npm run dev`. 1 = zapnúť ich vývojárovi aj bez
//                        druhého servera (Zrejúca potrebuje NAEX_VYPALENA); pri NODE_ENV=production sa ignoruje

import { fileURLToPath } from "node:url";
import { createGameServer } from "./server.ts";
import { scenarZProstredia } from "./scenar.ts";
import { odosielacZProstredia } from "./email.ts";
import { Vypalena, instanciaZProstredia } from "./zrejuca.ts";

const PORT = Number(process.env.PORT ?? 8787);
const admin = { login: process.env.NAEX_ADMIN_LOGIN ?? "Admin", heslo: process.env.NAEX_ADMIN_HESLO || null };

const instancia = instanciaZProstredia(process.env);
const urlVypalenej = process.env.NAEX_VYPALENA;
if (instancia === "zrejuca" && (urlVypalenej === undefined || urlVypalenej === "")) {
  console.error("NAEX_INSTANCIA=zrejuca potrebuje NAEX_VYPALENA (adresu Vypálenej) — účty a tvorca sú tam.");
  process.exit(1);
}
const zrejuca =
  instancia === "zrejuca" && urlVypalenej !== undefined
    ? { vypalena: new Vypalena(urlVypalenej, process.env.NAEX_VYPALENA_ADRESA || null, admin) }
    : undefined;
const zrejucaAdresa = process.env.NAEX_ZREJUCA_ADRESA || undefined;
if (zrejuca !== undefined) console.log(`Zrejúca — pokusná inštancia; účty a tvorca: ${urlVypalenej}`);

// Scenár mení rozdanie — na živom webe nikdy (scenarZProstredia).
const { scenar, ignorovany } = scenarZProstredia(process.env);
if (ignorovany !== null) console.warn(`NAEX_SCENAR=${ignorovany} sa ignoruje (neznámy scenár alebo produkcia).`);
if (scenar !== undefined) console.log(`Vývojový scenár partií proti botovi: ${scenar}`);

createGameServer({
  port: PORT,
  dataDir: process.env.NAEX_DATA ?? fileURLToPath(new URL("../../../data", import.meta.url)),
  admin,
  bezpecneCookie: process.env.NAEX_SECURE_COOKIE === "1",
  ...(process.env.NAEX_VYUCBA === "1" ? { vyucbaZapnuta: true } : {}),
  ...(process.env.NAEX_ACHIEVEMENTY === "1" ? { achievementyZapnute: true } : {}),
  ...(process.env.NAEX_PLAYTESTY ? { playtestyDir: process.env.NAEX_PLAYTESTY } : {}),
  ...(scenar !== undefined ? { scenar } : {}),
  posliEmail: odosielacZProstredia(process.env.NAEX_EMAIL_REZIM),
  ...(process.env.NAEX_ADRESA ? { adresa: process.env.NAEX_ADRESA } : {}),
  ...(zrejuca !== undefined ? { zrejuca } : {}),
  rezimyZrejucej: zrejuca !== undefined || (process.env.NODE_ENV !== "production" && process.env.NAEX_REZIMY_ZREJUCEJ === "1"),
  ...(zrejuca === undefined && zrejucaAdresa !== undefined ? { zrejucaAdresa } : {}),
  ...(zrejuca === undefined && process.env.NAEX_ZREJUCA_URL ? { zrejucaUrl: process.env.NAEX_ZREJUCA_URL } : {}),
})
  .then((server) => {
    console.log(`NA EX server počúva na http://localhost:${server.port}`);
  })
  .catch((err: unknown) => {
    console.error("Server sa nepodarilo spustiť:", err);
    process.exit(1);
  });
