// Snímky obrazovky partie tak, ako ju vidí hráč v prehliadači,
// alebo ľubovoľnej stránky webu (pre UI a UX dizajnéra).
// Headless Chrome cez DevTools protokol: prihlási sa za hráča, otvorí /hra
// a odfotí vrch stránky (stôl) a spodok (starší, ruka). Voliteľne prejde
// myšou na bod (mouseover) a odfotí aj to.
//
//   node --experimental-strip-types --no-warnings tools/playtest/snimka.ts <relacia> <1|2> [nazov] [--sirka 1600] [--vyska 1000] [--hover x,y] [--cesta pravidla] [--klik selektor]
//   node --experimental-strip-types --no-warnings tools/playtest/snimka.ts web [nazov] --cesta spatna-vazba [--ako "Dizajnér"] [--tvorba] [--plna] [--mobil] [--vystup priečinok] [--url http://…]
//
// --cesta odfotí inú stránku webu (pravidla, karty, profil…; lomka na začiatku nie je
// potrebná — Git Bash ju aj tak prepisuje) namiesto partie.
// --klik klikne na prvok (CSS selektor, napr. ".tlacidlo-naex") a odfotí výsledok;
// --klik sa dá zopakovať — kliky idú postupne, po každom snímka.
// --schema noc odfotí web vo farebnej schéme (id z apps/web/src/lib/schemy.ts).
// --miestnost KÓD uloží v režime „web“ kód miestnosti do prehliadača (návrat do partie po načítaní).
//
// Režim „web“ nepotrebuje partiu: prihlási sa na web (predvolene vývojový server
// :8787, inak --url / NAEX_WEB_URL) AI účtom „<--ako> (AI)“ — hráč, s --tvorba
// subadmin (sekcia Tvorba). Snímky ukladá do --vystup (predvolene playtest/dizajn/snimky).
// --plna odfotí celú výšku stránky jednou snímkou, --mobil emuluje telefón 390 × 844.
//
// Chrome: CHROME=<cesta>, inak štandardná inštalácia Chrome/Edge na Windows.
// Pozn.: prehliadač na pár sekúnd prevezme hráčovo spojenie so serverom;
// konzolový klient playtestera sa pripojí znova sám.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import WebSocket from "ws";
import { spustiChrome } from "../docasne.ts";
import { prihlasAgenta, webUrl } from "./web.ts";

const args = process.argv.slice(2);
/** Prepínače bez hodnoty — argument za nimi je voľný (relácia, názov). */
const BEZ_HODNOTY = new Set(["--tvorba", "--plna", "--mobil"]);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const ma = (k: string): boolean => args.includes(k);
const volne = args.filter((a, i) => {
  const pred = args[i - 1];
  return !a.startsWith("--") && !(pred !== undefined && pred.startsWith("--") && !BEZ_HODNOTY.has(pred));
});
const [relacia, hracArg, nazovArg] = volne;
const web = relacia === "web";
if (relacia === undefined || (!web && hracArg !== "1" && hracArg !== "2")) {
  console.error("Použitie: snimka.ts <relacia> <1|2> [nazov] [--sirka N] [--vyska N] [--hover x,y] [--cesta stranka] [--klik selektor] [--schema id]");
  console.error("          snimka.ts web [nazov] --cesta stranka [--ako meno] [--tvorba] [--plna] [--mobil] [--vystup priečinok]");
  process.exit(1);
}
const mobil = ma("--mobil");
const plna = ma("--plna");
const sirka = Number(volba("--sirka") ?? (mobil ? "390" : "1600"));
const vyska = Number(volba("--vyska") ?? (mobil ? "844" : "1000"));
const hover = volba("--hover")?.split(",").map(Number);
// Git Bash (MSYS) na Windows prepíše argument „/pravidla" na „C:/Program Files/Git/pravidla" —
// vrátime pôvodnú cestu; bez lomky na začiatku ju doplníme.
let cesta = volba("--cesta") ?? (web ? "/" : "/hra");
const msys = /^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)$/.exec(cesta);
if (msys?.[1] !== undefined) cesta = msys[1].replace(/\\/g, "/");
if (!cesta.startsWith("/")) cesta = `/${cesta}`;
/** CSS selektory prvkov, na ktoré sa postupne klikne (--klik sa dá zopakovať); po každom snímka. */
const kliky = args.flatMap((a, i) => (args[i - 1] === "--klik" ? [a] : []));
/** Farebná schéma webu (apps/web/src/lib/schemy.ts), napr. „noc"; inak tá z účtu. */
const schema = volba("--schema");
const nazov = ((web ? hracArg : nazovArg) ?? "stav").replace(/[^a-z0-9_-]/gi, "_");

/** Kam a ako sa prihlásiť: hráč partie playtestu, alebo AI účet na webe. */
interface Prihlasenie {
  readonly zaklad: string;
  readonly login: string;
  readonly heslo: string;
  readonly miestnost: string | null;
  readonly vystup: string;
  readonly predpona: string;
}

async function prihlasenie(): Promise<Prihlasenie> {
  if (web) {
    const url = webUrl(args);
    const ucet = await prihlasAgenta(url, volba("--ako") ?? "Dizajnér", ma("--tvorba") ? "subadmin" : "hrac");
    return { zaklad: url, login: ucet.login, heslo: ucet.heslo, miestnost: volba("--miestnost") ?? null, vystup: volba("--vystup") ?? join("playtest", "dizajn", "snimky"), predpona: "" };
  }
  const hra = JSON.parse(readFileSync(join(relacia ?? "", "hra.json"), "utf8")) as {
    port: number;
    kod: string;
    hraci: { login: string; heslo: string }[];
  };
  const ucet = hra.hraci[Number(hracArg) - 1];
  if (ucet === undefined) throw new Error("Neznámy hráč.");
  return {
    zaklad: `http://localhost:${hra.port}`,
    login: ucet.login,
    heslo: ucet.heslo,
    miestnost: hra.kod,
    vystup: volba("--vystup") ?? join(relacia ?? "", "snimky"),
    predpona: `hrac${hracArg ?? ""}-`,
  };
}
const ucet = await prihlasenie();
mkdirSync(ucet.vystup, { recursive: true });

const kandidati = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter((x): x is string => x !== undefined);
const chrome = kandidati.find((c) => existsSync(c));
if (chrome === undefined) throw new Error("Nenašiel som Chrome ani Edge — nastav CHROME=<cesta>.");

function volnyPort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => ok(typeof a === "object" && a !== null ? a.port : 9333));
    });
  });
}

const cdpPort = await volnyPort();
const prehliadac = spustiChrome(chrome, [`--headless=new`, `--remote-debugging-port=${cdpPort}`, `--window-size=${sirka},${vyska}`, "--hide-scrollbars", "about:blank"], "naex-snimka-");
const pockaj = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

try {
  let ciel: { type: string; webSocketDebuggerUrl: string } | undefined;
  for (let i = 0; i < 40 && ciel === undefined; i++) {
    await pockaj(250);
    try {
      const zoznam = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      ciel = zoznam.find((t) => t.type === "page");
    } catch {
      // Chrome ešte štartuje
    }
  }
  if (ciel === undefined) throw new Error("Chrome sa nespustil.");
  const ws = new WebSocket(ciel.webSocketDebuggerUrl);
  await new Promise((ok) => ws.on("open", ok));
  let id = 0;
  const cakajuce = new Map<number, (v: Record<string, unknown>) => void>();
  ws.on("message", (d) => {
    const m = JSON.parse(String(d)) as { id?: number; result?: Record<string, unknown> };
    if (m.id !== undefined) cakajuce.get(m.id)?.(m.result ?? {});
  });
  const posli = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((ok) => {
      id += 1;
      cakajuce.set(id, ok);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = (expression: string) => posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });

  await posli("Emulation.setDeviceMetricsOverride", { width: sirka, height: vyska, deviceScaleFactor: 1, mobile: mobil });
  if (mobil) await posli("Emulation.setTouchEmulationEnabled", { enabled: true });
  const { zaklad } = ucet;
  await posli("Page.navigate", { url: `${zaklad}/` });
  await pockaj(1500);
  const miestnost =
    (ucet.miestnost === null ? "" : `localStorage.setItem('naex.miestnost',${JSON.stringify(ucet.miestnost)});`) +
    (schema === undefined ? "" : `localStorage.setItem('naex-schema',${JSON.stringify(schema)});`);
  await js(
    `fetch('/api/prihlasenie',{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify(${JSON.stringify({ login: ucet.login, heslo: ucet.heslo })})}).then(r=>r.status).then(s=>{${miestnost}return s})`,
  );
  await posli("Page.navigate", { url: `${zaklad}${cesta}` });
  await pockaj(3500);

  const cas = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const subory: string[] = [];
  const foto = async (cast: string): Promise<void> => {
    const r = await posli("Page.captureScreenshot", { format: "png" });
    const subor = join(ucet.vystup, `${cas}-${ucet.predpona}${nazov}-${cast}.png`);
    writeFileSync(subor, Buffer.from(String(r.data), "base64"));
    subory.push(subor);
  };
  if (plna) {
    // Celá stránka: výrez sa natiahne na výšku obsahu (najviac 12 000 px), potom sa vráti.
    const r = await js("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)");
    const vyskaObsahu = Math.min(12000, Number((r.result as { value?: number } | undefined)?.value ?? vyska));
    await posli("Emulation.setDeviceMetricsOverride", { width: sirka, height: Math.max(vyska, vyskaObsahu), deviceScaleFactor: 1, mobile: mobil });
    await pockaj(900);
    await foto("cela");
    await posli("Emulation.setDeviceMetricsOverride", { width: sirka, height: vyska, deviceScaleFactor: 1, mobile: mobil });
    await pockaj(500);
  } else {
    await foto("hore");
  }
  for (const [i, klik] of kliky.entries()) {
    const r = await js(`(() => { const el = document.querySelector(${JSON.stringify(klik)}); if (!el) return "nenájdený"; el.click(); return "ok"; })()`);
    const vysledok = (r.result as { value?: string } | undefined)?.value;
    if (vysledok !== "ok") console.error(`--klik: prvok ${klik} sa nenašiel`);
    await pockaj(900);
    await foto(kliky.length === 1 ? "klik" : `klik${i + 1}`);
  }
  if (hover !== undefined && hover.length === 2) {
    await posli("Input.dispatchMouseEvent", { type: "mouseMoved", x: hover[0], y: hover[1] });
    await pockaj(700);
    await foto("hover");
    await posli("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  }
  if (!plna) {
    await js("window.scrollTo(0, document.documentElement.scrollHeight)");
    await pockaj(700);
    await foto("dole");
  }
  ws.close();
  console.log(subory.join("\n"));
} finally {
  prehliadac.zastav();
}
