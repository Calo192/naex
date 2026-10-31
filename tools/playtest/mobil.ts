// Playtest UI/UX mobilného stola (Michal 2026-10-31): AI playtester hrá partiu
// proti botovi v prehliadači ako človek s telefónom na šírku — zo snímok, ťukmi
// prsta — a hodnotí len vzhľad a ovládanie (zalomenie textov, prekryvy, malé
// ciele), nie herné mechaniky. Mobilná verzia stola (rozloženie Pult,
// mobil-sirka.css) je len pre správcov, preto má každý playtester vlastný
// agentský účet „<meno> (AI)“ povýšený na subadmina (heslo admina z .env).
// Návod pre agenta: tools/playtest/mobil-playtest.md.
//
//   M = node --experimental-strip-types --no-warnings tools/playtest/mobil.ts
//   $M zaloz [1–3] [--url http://localhost:8790] [--web http://localhost:5176] [--displej 762x340|800x330|844x350|915x380|780x300]
//            [--kola 1] [--liga kratka|stredna|dlha] [--hraci "Palec,Ukazovák"]
//   $M <R> <n> partia                  založí partiu proti botovi (liga relácie) a otvorí stôl
//   $M <R> <n> pozri                   snímka + ťukateľné prvky + upozornenia z DOM
//   $M <R> <n> tuk <číslo|x,y> […]    ťuk prstom; viac cieľov = ťuky rýchlo po sebe (potvrdenie „naozaj?“)
//   $M <R> <n> podrz <číslo|x,y> [--ms 700]   dlhý dotyk (lupa karty); snímka aj počas držania
//   $M <R> <n> potiahni <odkiaľ> <kam> ťahanie prstom (číslo prvku alebo x,y)
//   $M <R> <n> otoc                    telefón na výšku / späť na šírku
//   $M <R> <n> detail <číslo|x,y,w,h>  ostrý výrez (hustota telefónu 3×) — drobné písmo, orezaný text
//   $M <R> <n> pis <text> | klaves <kláves> | pockaj <s> | otvor <cesta>
//   $M <R> stav                        po playteste: kolá, akcie, upozornenia, chyby
//   $M <R> ukonci                      zastaví prehliadače (server beží ďalej, nie je náš)
//
// R = playtest/mobil/<id>. Pri akciách platí --cakaj <ms> (pred snímkou, predvolene 900).
// Server nespúšťa — beží vývojový server pracoviska (npm run dev); --url je jeho API
// (PORT), --web adresa, ktorú otvorí prehliadač (vite NAEX_WEB_PORT, predvolene --url).
// Účty sú v spoločnom súbore hesiel (ucty.ts) pod databázou data/ pracoviska — nástroj
// púšťaj z koreňa toho pracoviska, kde beží server. Len lokálny server.
//
// Snímka je v CSS px okna telefónu (762×340), takže súradnice zo snímky platia pre tuk;
// ostré detaily v skutočnej hustote dá „detail“. Emulácia: viewport s mobile=true,
// devicePixelRatio 3, dotyk (pointer: coarse — zariadenie.ts spozná telefón), user-agent
// Chrome na Androide. Natočenie drží strážca (proces pri prehliadači), príkaz otoc mu ho
// pošle súborom zaznam/orientacia.json.

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { nastavDocasneEnv, upratStare } from "../docasne.ts";
import {
  DPR,
  type Displej,
  LIGY,
  type Liga,
  MALE_PISMO,
  MALY_CIEL,
  MENA_TESTEROV,
  PRAZDNY_STAV,
  type Prvok,
  type StavMobilu,
  UA_TELEFONU,
  bodCiela,
  citajDisplej,
  citajLigu,
  odohraneKola,
  oknoDispleja,
  popisPartie,
  riadokPrvku,
  vyrez,
  zapisView,
} from "./mobil-stav.ts";
import { type Cdp, cestaWebu, chrome, nahodnyPort, pockaj, pripojCdp, zabi, zmazProfil } from "./prehliadac.ts";
import { loginAgenta, menoAgenta, prihlasAgenta, webDostupny, webUrl } from "./web.ts";

interface HracRelacie {
  readonly n: number;
  readonly meno: string;
  readonly login: string;
  readonly cdpPort: number;
  readonly chromePid: number;
  readonly strazcaPid: number;
}
interface Relacia {
  readonly id: string;
  readonly url: string;
  readonly web: string;
  readonly displej: Displej;
  readonly kola: number;
  readonly liga: Liga;
  readonly zalozena: string;
  readonly hraci: HracRelacie[];
}
interface Upozornenie {
  readonly druh: "text" | "mimo" | "prekryv" | "pismo";
  readonly zavaznost: "vysoká" | "stredná" | "nízka";
  readonly text: string;
}
interface Obrazovka {
  url: string;
  hlasky: string[];
  prvky: Prvok[];
  upozornenia: Upozornenie[];
  skrol: number;
  vyskaStranky: number;
  sirkaStranky: number;
}

const args = process.argv.slice(2);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const S_HODNOTOU = new Set(["--cakaj", "--url", "--web", "--displej", "--kola", "--liga", "--hraci", "--ms"]);
const volne = args.filter((a, i) => !a.startsWith("--") && !S_HODNOTOU.has(args[i - 1] ?? ""));
const lomky = (p: string): string => p.split("\\").join("/");

// ---- relácia ------------------------------------------------------------------

const nacitajRelaciu = (r: string): Relacia => {
  const subor = join(r, "mobil.json");
  if (!existsSync(subor)) throw new Error(`${subor} neexistuje — relácia vzniká príkazom „zaloz“.`);
  return JSON.parse(readFileSync(subor, "utf8")) as Relacia;
};
const hracRelacie = (rel: Relacia, n: number): HracRelacie => {
  const h = rel.hraci.find((x) => x.n === n);
  if (h === undefined) throw new Error(`Relácia nemá playtestera ${n} (má ${rel.hraci.map((x) => x.n).join(", ")}).`);
  return h;
};
const priecinokHraca = (r: string, n: number): string => join(r, `hrac${n}`);
const suborStavu = (r: string, n: number): string => join(priecinokHraca(r, n), "zaznam", "stav.json");
const suborOrientacie = (r: string, n: number): string => join(priecinokHraca(r, n), "zaznam", "orientacia.json");
function nacitajStav(r: string, n: number): StavMobilu {
  try {
    return JSON.parse(readFileSync(suborStavu(r, n), "utf8")) as StavMobilu;
  } catch {
    return { ...PRAZDNY_STAV, chyby: [], konzola: [] };
  }
}
async function cakajNaStav(r: string, n: number, podmienka: (s: StavMobilu) => boolean, ms: number): Promise<StavMobilu | null> {
  for (let t = 0; t < ms; t += 100) {
    const s = nacitajStav(r, n);
    if (podmienka(s)) return s;
    await pockaj(100);
  }
  return null;
}

async function zaloz(): Promise<void> {
  if (args.includes("--zivy")) throw new Error("Playtest mobilu beží len na lokálnom serveri (vývojový server pracoviska).");
  const url = webUrl(args);
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) throw new Error(`${url} nie je lokálny server — playtest mobilu beží len lokálne.`);
  const web = (volba("--web") ?? url).replace(/\/+$/, "");
  const displej = citajDisplej(volba("--displej"));
  const kola = Number(volba("--kola") ?? "1");
  if (!Number.isInteger(kola) || kola < 1) throw new Error("--kola musí byť kladné celé číslo (1 = jedno kolo).");
  const liga = citajLigu(volba("--liga"));
  const mena = (volba("--hraci")?.split(",").map((m) => m.trim()).filter((m) => m !== "") ?? [...MENA_TESTEROV]).slice(0, 3);
  const pocet = Number(volne[1] ?? "1");
  if (!Number.isInteger(pocet) || pocet < 1 || pocet > mena.length) throw new Error(`Počet playtesterov musí byť 1 až ${mena.length}.`);
  for (const m of mena) if (/-\d+$/.test(loginAgenta(m))) throw new Error(`Meno „${m}“ dá login ${loginAgenta(m)} s číslom na konci — server ho odmietne.`);
  if (!(await webDostupny(url))) throw new Error(`Server ${url} nebeží — spusti v pracovisku: PORT=<p> NAEX_WEB_PORT=<w> npm run dev`);
  if (!(await webDostupny(web))) throw new Error(`Web ${web} neodpovedá — skontroluj --web (vite: NAEX_WEB_PORT).`);

  const id = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const r = join("playtest", "mobil", id);
  mkdirSync(r, { recursive: true });
  nastavDocasneEnv();
  upratStare();

  const pidy: number[] = [];
  const zlyhanie = (err: unknown): never => {
    console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
    for (const p of pidy) zabi(p);
    for (let n = 1; n <= pocet; n++) zmazProfil(priecinokHraca(r, n));
    process.exit(1);
  };
  process.on("uncaughtException", zlyhanie);
  process.on("unhandledRejection", zlyhanie);

  const hraci: HracRelacie[] = [];
  for (let n = 1; n <= pocet; n++) {
    const meno = mena[n - 1] ?? "";
    // Účet sa zaregistruje a povýši heslom admina z .env (web.ts) — heslo ostane v spoločnom súbore.
    const ucet = await prihlasAgenta(url, meno, "subadmin");
    const ja = (await (await fetch(`${url}/api/ja`, { headers: { cookie: ucet.cookie, "x-naex": "1" } })).json()) as { pouzivatel: { rola: string } | null };
    const rola = ja.pouzivatel?.rola ?? "?";
    if (rola !== "subadmin" && rola !== "admin") throw new Error(`Účet ${ucet.login} je ${rola}, mobilný stôl vidí len subadmin/admin — daj NAEX_ADMIN_HESLO do .env pracoviska.`);

    const dir = priecinokHraca(r, n);
    for (const d of ["snimky", "zaznam", "chrome/tmp"]) mkdirSync(join(dir, d), { recursive: true });
    const cdpPort = await nahodnyPort();
    const ch = spawn(
      chrome(),
      ["--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${resolve(dir, "chrome")}`, `--window-size=${displej.sirka},${displej.vyska}`, "--mute-audio", "--no-first-run", "--no-default-browser-check", "about:blank"],
      // Chromove dočasné súbory (scoped_dir*) do profilu, nie do %TEMP% — zmiznú s ním.
      { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, TEMP: resolve(dir, "chrome", "tmp"), TMP: resolve(dir, "chrome", "tmp") } },
    );
    ch.unref();
    if (ch.pid !== undefined) pidy.push(ch.pid);
    const log = openSync(join(dir, "zaznam", "strazca.log"), "a");
    const strazca = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "tools/playtest/mobil.ts", "_strazca", r, String(n), String(cdpPort), String(displej.sirka), String(displej.vyska)], {
      detached: true,
      stdio: ["ignore", log, log],
      windowsHide: true,
    });
    strazca.unref();
    if (strazca.pid !== undefined) pidy.push(strazca.pid);
    // Telefón (dotyk, user-agent) musí platiť skôr, než sa načíta prvá stránka.
    if ((await cakajNaStav(r, n, (s) => s.pripraveny, 20_000)) === null) throw new Error(`Strážca prehliadača ${n} sa nespustil — pozri ${join(dir, "zaznam", "strazca.log")}`);

    // Prihlásenie priamo v prehliadači — cookie relácie ostane v ňom ako u človeka.
    const cdp = await pripojCdp(cdpPort);
    await cdp.posli("Page.enable");
    await cdp.posli("Page.navigate", { url: `${web}/` });
    await pockaj(1500);
    const stav = await cdp.js<number>(
      `fetch('/api/prihlasenie',{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify(${JSON.stringify({ login: ucet.login, heslo: ucet.heslo })})}).then(r=>r.status)`,
    );
    if (stav !== 200) throw new Error(`Prihlásenie ${ucet.login} v prehliadači: HTTP ${stav}`);
    // Ponuka výučby by sa vložila pred partiu proti botovi — playtest mobilu ju nepotrebuje.
    await cdp.js(`fetch('/api/vyucba/preskocit',{method:'POST',headers:{'x-naex':'1'}}).then(r=>r.status)`).catch(() => 0);
    await cdp.posli("Page.navigate", { url: `${web}/hra` });
    await pockaj(1200);
    const telefon = await cdp.js<boolean>(`matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 500px)').matches`);
    cdp.zavri();
    if (!telefon) throw new Error("Prehliadač sa netvári ako telefón na šírku (pointer: coarse) — emulácia zlyhala.");
    hraci.push({ n, meno: menoAgenta(meno), login: ucet.login, cdpPort, chromePid: ch.pid ?? 0, strazcaPid: strazca.pid ?? 0 });
  }

  const rel: Relacia = { id, url, web, displej, kola, liga, zalozena: new Date().toISOString(), hraci };
  writeFileSync(join(r, "mobil.json"), `${JSON.stringify(rel, null, 2)}\n`);
  const rr = lomky(r);
  console.log(`Playtest mobilu založený: ${rr}`);
  console.log(`Web: ${web} (API ${url}), telefón ${displej.sirka}×${displej.vyska} na šírku, DPR ${DPR}, dotyk; liga ${liga}, koniec po ${kola} ${kola === 1 ? "kole" : "kolách"}`);
  for (const h of hraci) console.log(`Playtester ${h.n}: ${h.meno} (${h.login}, subadmin) — lobby /hra; partiu založí: mobil.ts ${rr} ${h.n} partia`);
  console.log(`Zastaví: tools/playtest/mobil.ts ${rr} ukonci`);
  process.exit(0);
}

/** Beží na pozadí pri každom prehliadači: drží emuláciu telefónu a zapisuje stav partie. */
async function strazca(): Promise<void> {
  const [, r = "", nArg = "1", portArg = "0", sirkaArg = "762", vyskaArg = "340"] = volne;
  const n = Number(nArg);
  const displej: Displej = { sirka: Number(sirkaArg), vyska: Number(vyskaArg) };
  const cdp = await pripojCdp(Number(portArg));
  const zaznam = join(priecinokHraca(r, n), "zaznam");
  const stav: StavMobilu = { ...PRAZDNY_STAV, chyby: [], konzola: [] };
  const uloz = (): void => {
    // Cez dočasný súbor — príkaz nesmie čítať napoly zapísaný stav.
    const docasny = `${suborStavu(r, n)}.tmp`;
    writeFileSync(docasny, JSON.stringify(stav));
    try {
      renameSync(docasny, suborStavu(r, n));
    } catch {
      writeFileSync(suborStavu(r, n), JSON.stringify(stav));
    }
  };
  uloz();
  cdp.naUdalost((method, p) => {
    const t = Date.now();
    if (method === "Network.webSocketFrameReceived" || method === "Network.webSocketFrameSent") {
      const payload = (p.response as { payloadData?: string } | undefined)?.payloadData ?? "";
      let m: { type?: string; view?: unknown; text?: string };
      try {
        m = JSON.parse(payload) as typeof m;
      } catch {
        return;
      }
      const smer = method === "Network.webSocketFrameSent" ? "von" : "dnu";
      const velka = m.type === "state" || m.type === "privitanie" || m.type === "historia";
      appendFileSync(join(zaznam, "ws.jsonl"), `${JSON.stringify(velka ? { t, smer, type: m.type } : { t, smer, ...m })}\n`);
      if (smer === "dnu" && m.type === "state") {
        zapisView(stav, m.view);
        stav.poslednyStav = t;
        uloz();
      } else if (smer === "dnu" && m.type === "error") {
        stav.chyby.push({ t, text: String(m.text ?? "") });
        uloz();
      }
    } else if (method === "Runtime.exceptionThrown") {
      const e = p.exceptionDetails as { text?: string; exception?: { description?: string } };
      stav.konzola.push({ t, text: (e.exception?.description ?? e.text ?? "výnimka").split("\n")[0] ?? "" });
      uloz();
    } else if (method === "Runtime.consoleAPICalled" && p.type === "error") {
      const a = (p.args as { value?: unknown; description?: string }[] | undefined) ?? [];
      stav.konzola.push({ t, text: a.map((x) => String(x.value ?? x.description ?? "")).join(" ").slice(0, 300) });
      uloz();
    }
  });
  await cdp.posli("Network.enable");
  await cdp.posli("Runtime.enable");
  const natoc = async (naVysku: boolean): Promise<void> => {
    const o = oknoDispleja(displej, naVysku);
    await cdp.posli("Emulation.setDeviceMetricsOverride", {
      width: o.sirka,
      height: o.vyska,
      deviceScaleFactor: DPR,
      mobile: true,
      screenOrientation: naVysku ? { type: "portraitPrimary", angle: 0 } : { type: "landscapePrimary", angle: 90 },
    });
    stav.naVysku = naVysku;
    uloz();
  };
  // Emulácia platí, kým žije toto spojenie — preto ju drží strážca, nie príkaz.
  await cdp.posli("Emulation.setUserAgentOverride", { userAgent: UA_TELEFONU, platform: "Linux armv8l" });
  await cdp.posli("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // Telefón má posuvníky len prekryvné a počas posúvania — trvalý pruh desktopu by klamal o šírke.
  await cdp.posli("Emulation.setScrollbarsHidden", { hidden: true });
  // Stôl na telefóne je povinne na celej obrazovke. Skutočná celá obrazovka v headless Chrome
  // zmení okno na vlastný rozmer (746 × 245) a emulácia telefónu by sa rozsypala — telefón tu
  // celú obrazovku len predstiera: requestFullscreen nastaví fullscreenElement a pošle udalosť.
  await cdp.posli("Page.enable");
  await cdp.posli("Page.addScriptToEvaluateOnNewDocument", { source: CELA_OBRAZOVKA });
  await cdp.posli("Runtime.evaluate", { expression: CELA_OBRAZOVKA });
  await natoc(false);
  stav.pripraveny = true;
  uloz();
  let meniSa = false;
  setInterval(() => {
    if (meniSa) return;
    let chcem = stav.naVysku;
    try {
      chcem = (JSON.parse(readFileSync(suborOrientacie(r, n), "utf8")) as { naVysku?: boolean }).naVysku === true;
    } catch {
      return;
    }
    if (chcem === stav.naVysku) return;
    meniSa = true;
    void natoc(chcem).finally(() => {
      meniSa = false;
    });
  }, 150);
  console.log(`Strážca playtestera ${n} beží (${displej.sirka}×${displej.vyska}, DPR ${DPR}).`);
  await cdp.koniec;
  process.exit(0);
}

/** Predstieraná celá obrazovka (viď strážcu): rozmer okna sa nemení, stránka vidí fullscreen. */
const CELA_OBRAZOVKA = String.raw`(() => {
  if (window.__naexCela) return;
  window.__naexCela = true;
  let el = null;
  Object.defineProperty(Document.prototype, "fullscreenElement", { configurable: true, get: () => el });
  Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => true });
  const zmena = () => document.dispatchEvent(new Event("fullscreenchange"));
  Element.prototype.requestFullscreen = function () { el = this; setTimeout(zmena, 0); return Promise.resolve(); };
  Document.prototype.exitFullscreen = function () { el = null; setTimeout(zmena, 0); return Promise.resolve(); };
})()`;

// ---- čo je na obrazovke --------------------------------------------------------

/**
 * Beží v stránke: ťukateľné prvky v okne (aj čiastočne zakryté — ťuk ide na odkrytý bod)
 * a upozornenia z DOM. Logika orezaného textu je z tools/ui-inspektor/inspekcia.ts.
 */
const OBRAZOVKA = String.raw`(() => {
  const W = innerWidth, H = innerHeight, MALE_PISMO = ${MALE_PISMO};
  const viditelny = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
  };
  const text = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const kratko = (s) => (s.length > 40 ? s.slice(0, 39) + '…' : s);
  const popis = (el) => {
    let p = el.tagName.toLowerCase();
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) p += '.' + cls.join('.');
    return p;
  };
  const kde = (r) => Math.round(r.left + r.width / 2) + ',' + Math.round(r.top + r.height / 2);
  const druh = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === 'a') return 'odkaz';
    if (t === 'button' || el.getAttribute('role') === 'button') return 'tlačidlo';
    if (t === 'input' || t === 'textarea' || t === 'select') return 'pole';
    if (t === 'summary') return 'rozbaliť';
    if (el.querySelector('img') || /karta|card/i.test(el.className)) return 'karta/obrázok';
    return 'prvok';
  };
  const naBode = (el, x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const t = document.elementFromPoint(x, y);
    return t !== null && (el.contains(t) || t.contains(el));
  };
  // Odkrytý bod prvku: stred, inak mriežka 5×5 — karta vo vejári je zakrytá v strede.
  const odkryty = (el) => {
    const r = el.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), W - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), H - 1);
    if (naBode(el, cx, cy)) return { x: cx, y: cy, stred: true };
    for (const fy of [0.5, 0.3, 0.7, 0.15, 0.85]) for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (naBode(el, x, y)) return { x, y, stred: false };
    }
    return null;
  };
  const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=radio],[tabindex]:not([tabindex="-1"])';
  const kandidati = [...document.querySelectorAll('body *')].filter((el) => el.matches(SEL) || (getComputedStyle(el).cursor === 'pointer' && !(el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')));
  const vybrane = [];
  for (const el of kandidati) {
    if (!viditelny(el) || vybrane.some((v) => v.el.contains(el))) continue;
    const b = odkryty(el);
    if (b === null) continue;
    vybrane.push({ el, b });
  }
  const zoznam = vybrane.slice(0, 80);
  const prvky = zoznam.map(({ el, b }, i) => {
    const r = el.getBoundingClientRect();
    return { c: i + 1, druh: druh(el), text: text(el), x: Math.round(b.x), y: Math.round(b.y), w: Math.round(r.width), h: Math.round(r.height), nedostupne: el.disabled === true || el.getAttribute('aria-disabled') === 'true' };
  });

  const up = [];
  const pridaj = (druh, zavaznost, t) => up.push({ druh, zavaznost, text: t });
  const maText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const skryva = (s) => /hidden|clip/.test(s.overflowX + ' ' + s.overflowY);
  const posuvny = (s) => /auto|scroll/.test(s.overflowX + ' ' + s.overflowY);
  const obsahRect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); return rg.getBoundingClientRect(); };
  const vycnieva = (r, p) => Math.max(p.left - r.left, r.right - p.right, p.top - r.top, r.bottom - p.bottom);
  const natoceny = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(e).transform);
      if (m) { const [, b, c] = m[1].split(',').map(Number); if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) return true; }
    }
    return false;
  };
  const plavajuci = (el) => { for (let e = el; e; e = e.parentElement) if (/fixed|sticky/.test(getComputedStyle(e).position)) return true; return false; };
  const maBox = (s) => parseFloat(s.borderLeftWidth) > 0 || parseFloat(s.borderTopWidth) > 0 || !/^(rgba\(0, 0, 0, 0\)|transparent)$/.test(s.backgroundColor) || s.backgroundImage !== 'none';
  const vsetky = [...document.body.querySelectorAll('*')].filter(viditelny);
  // Text pod modálnou vrstvou (výzva otočiť telefón, dialóg) hráč nevidí — meria sa len to navrchu.
  const textove = vsetky.filter(maText).filter((el) => odkryty(el) !== null);

  // 1. Text, ktorý sa nezmestí: orezaný boxom, vytŕča z predka, alebo leží cez okraj svojho boxu.
  const hotove = new Set();
  for (const el of textove) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && (skryva(s) || s.textOverflow === 'ellipsis')) {
      const trojbodka = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none');
      pridaj('text', trojbodka ? 'nízka' : 'vysoká', (trojbodka ? 'skrátený trojbodkou' : 'orezaný') + ' „' + kratko(text(el)) + '“ ' + popis(el) + ': obsah ' + el.scrollWidth + '×' + el.scrollHeight + ' px v boxe ' + el.clientWidth + '×' + el.clientHeight + ' px @ ' + kde(r));
      hotove.add(el);
      continue;
    }
    if (natoceny(el)) continue;
    const tr = obsahRect(el);
    let box = null;
    for (let p = el, i = 0; p && p !== document.body && i < 6; p = p.parentElement, i++) {
      const ps = getComputedStyle(p);
      if (p !== el && posuvny(ps)) break;
      if (p !== el && skryva(ps)) {
        const presah = vycnieva(tr, p.getBoundingClientRect());
        if (presah > 2 && presah < tr.width + tr.height) { pridaj('text', 'vysoká', 'vytŕča o ' + Math.round(presah) + ' px z ' + popis(p) + ' (orezaný) „' + kratko(text(el)) + '“ @ ' + kde(tr)); hotove.add(el); }
        break;
      }
      if (box === null && maBox(ps) && ps.display !== 'inline') box = p;
    }
    if (hotove.has(el) || box === null) continue;
    const presah = vycnieva(tr, box.getBoundingClientRect());
    if (presah > 2 && presah < tr.width + tr.height) pridaj('text', 'stredná', 'leží cez okraj ' + popis(box) + ' o ' + Math.round(presah) + ' px „' + kratko(text(el)) + '“ @ ' + kde(tr));
  }

  // 2. Mimo displeja: stránka širšia než telefón, prvky cez okraj, ovládanie celé mimo.
  const sirka = document.documentElement.scrollWidth, vyska = document.documentElement.scrollHeight;
  if (sirka > W + 1) pridaj('mimo', 'vysoká', 'stránka je široká ' + sirka + ' px pri displeji ' + W + ' px (vodorovné posúvanie)');
  const skrolujeZvisle = vyska > H + 1;
  const orezanyPredkom = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p); if (skryva(ps) || posuvny(ps)) return true; } return false; };
  const mimo = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (!(maText(el) || el.matches(SEL) || el.tagName === 'IMG')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) continue;
    const zvisle = !skrolujeZvisle || plavajuci(el);
    const strany = [];
    if (r.left < -1) strany.push('vľavo o ' + Math.round(-r.left));
    if (r.right > W + 1) strany.push('vpravo o ' + Math.round(r.right - W));
    if (zvisle && r.top < -1) strany.push('hore o ' + Math.round(-r.top));
    if (zvisle && r.bottom > H + 1) strany.push('dole o ' + Math.round(r.bottom - H));
    if (strany.length === 0 || mimo.some((m) => m.contains(el)) || orezanyPredkom(el)) continue;
    mimo.push(el);
    const cele = r.right < 0 || r.left > W || (zvisle && (r.bottom < 0 || r.top > H));
    pridaj('mimo', el.matches(SEL) ? 'vysoká' : 'stredná', popis(el) + ' „' + kratko(text(el)) + '“ ' + (cele ? 'je celý mimo displeja' : 'siaha za okraj ' + strany.join(', ') + ' px') + ' (' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ')');
  }

  // 3. Ťukateľné prvky cez seba: prst trafí iný, než chcel.
  for (let i = 0; i < zoznam.length; i++) for (let j = i + 1; j < zoznam.length; j++) {
    const a = zoznam[i].el.getBoundingClientRect(), b = zoznam[j].el.getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 3 && h > 3) pridaj('prekryv', 'stredná', 'prvky ' + (i + 1) + ' a ' + (j + 1) + ' sa prekrývajú (' + Math.round(w) + '×' + Math.round(h) + ' px)');
  }

  // 4. Drobné písmo (aj zmenšené cez transform: scale).
  const male = new Map();
  for (const el of textove) {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const mierka = !natoceny(el) && el.offsetWidth > 0 && s.display !== 'inline' ? r.width / el.offsetWidth : 1;
    const px = parseFloat(s.fontSize) * mierka;
    if (!(px < MALE_PISMO)) continue;
    const t = kratko(text(el));
    if (!male.has(t)) male.set(t, { px, kde: kde(r), sel: popis(el) });
  }
  for (const [t, m] of male) pridaj('pismo', m.px < 9 ? 'stredná' : 'nízka', 'písmo ' + m.px.toFixed(1) + ' px „' + t + '“ ' + m.sel + ' @ ' + m.kde);

  const hlasky = [...document.querySelectorAll('[role=alert],[role=alertdialog],[role=status],[aria-live]')].filter((el) => viditelny(el) && odkryty(el) !== null).map(text).filter((t) => t.length > 0);
  return { url: location.pathname, hlasky, prvky, upozornenia: up, skrol: Math.round(scrollY), vyskaStranky: vyska, sirkaStranky: sirka };
})()`;

const NAZVY_UPOZORNENI: Readonly<Record<Upozornenie["druh"], string>> = {
  text: "text sa nezmestí",
  mimo: "mimo displeja",
  prekryv: "ťukateľné prvky cez seba",
  pismo: `písmo < ${MALE_PISMO} px`,
};

function vypisUpozornenia(obr: Obrazovka): string[] {
  const out: string[] = [];
  const male = obr.prvky.filter((p) => p.w < MALY_CIEL || p.h < MALY_CIEL);
  if (obr.upozornenia.length === 0 && male.length === 0) return out;
  out.push("Upozornenia z DOM (automatické — over na snímke, nie každé je chyba):");
  if (male.length > 0) out.push(`  [cieľ < ${MALY_CIEL} px] ${male.length} z ${obr.prvky.length} prvkov: ${male.map((p) => `${p.c} (${p.w}×${p.h})`).join(", ")}`);
  for (const druh of ["text", "mimo", "prekryv", "pismo"] as const) {
    const u = obr.upozornenia.filter((x) => x.druh === druh);
    for (const x of u.slice(0, 6)) out.push(`  [${NAZVY_UPOZORNENI[druh]}, ${x.zavaznost}] ${x.text}`);
    if (u.length > 6) out.push(`  [${NAZVY_UPOZORNENI[druh]}] … a ďalších ${u.length - 6}`);
  }
  return out;
}

// ---- akcie playtestera ------------------------------------------------------------

/**
 * Snímka okna v CSS px telefónu alebo ostrý výrez v hustote telefónu. Pri clip rozhoduje
 * len clip.scale — deviceScaleFactor emulácie sa neuplatní, preto výrez dostane DPR sám.
 */
async function odfot(cdp: Cdp, subor: string, vyrezCss?: { x: number; y: number; w: number; h: number }): Promise<void> {
  const m = await cdp.posli("Page.getLayoutMetrics");
  const v = m.cssVisualViewport as { pageX: number; pageY: number; clientWidth: number; clientHeight: number };
  const clip =
    vyrezCss === undefined
      ? { x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight, scale: 1 }
      : { x: v.pageX + vyrezCss.x, y: v.pageY + vyrezCss.y, width: vyrezCss.w, height: vyrezCss.h, scale: DPR };
  const png = await cdp.posli("Page.captureScreenshot", { format: "png", clip });
  writeFileSync(subor, Buffer.from(String(png.data), "base64"));
}

async function akcia(): Promise<void> {
  const r = volne[0] ?? "";
  const n = Number(volne[1]);
  const prikaz = volne[2] ?? "pozri";
  const rel = nacitajRelaciu(r);
  const h = hracRelacie(rel, n);
  const dir = priecinokHraca(r, n);
  const suborPrvkov = join(dir, "zaznam", "prvky.json");
  const prvky = existsSync(suborPrvkov) ? (JSON.parse(readFileSync(suborPrvkov, "utf8")) as Prvok[]) : [];
  const stavPred = nacitajStav(r, n);
  const okno = oknoDispleja(rel.displej, stavPred.naVysku);
  const dalsiaSnimka = (nazov: string): string => {
    const poradie = readdirSync(join(dir, "snimky")).filter((f) => f.endsWith(".png")).length + 1;
    return join(dir, "snimky", `${String(poradie).padStart(3, "0")}-${nazov}.png`);
  };
  const cdp = await pripojCdp(h.cdpPort);
  const dotyk = (type: "touchStart" | "touchMove" | "touchEnd", bod?: { x: number; y: number }) =>
    cdp.posli("Input.dispatchTouchEvent", { type, touchPoints: bod === undefined ? [] : [{ x: bod.x, y: bod.y, id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  const extra: string[] = [];
  let popis = prikaz;
  switch (prikaz) {
    case "pozri":
      break;
    case "tuk": {
      // Viac cieľov = ťuky rýchlo po sebe (ako človek): druhé ťuknutie na potvrdenie
      // „naozaj?“ musí prísť skôr, než sa tlačidlo po 4 s vráti — samostatný príkaz to nestihne.
      const ciele = volne.slice(3);
      const body = (ciele.length === 0 ? [undefined] : ciele).map((c) => bodCiela(c, prvky, prikaz));
      for (const [i, b] of body.entries()) {
        if (i > 0) await pockaj(400);
        await dotyk("touchStart", b);
        await pockaj(70);
        await dotyk("touchEnd");
      }
      popis = `ťuk ${ciele.map((c, i) => `${c} (${body[i]?.x},${body[i]?.y})`).join(", ")}`;
      break;
    }
    case "podrz": {
      const b = bodCiela(volne[3], prvky, prikaz);
      const ms = Math.max(Number(volba("--ms") ?? "700"), 100);
      await dotyk("touchStart", b);
      await pockaj(ms);
      // Čo hráč vidí, kým drží prst (lupa) — po pustení sa môže zavrieť.
      const pocas = dalsiaSnimka("podrz-drzim");
      await odfot(cdp, pocas);
      extra.push(`Snímka počas držania: ${lomky(pocas)}`);
      await dotyk("touchEnd");
      popis = `podržanie ${volne[3]} (${b.x},${b.y}) ${ms} ms`;
      break;
    }
    case "potiahni": {
      const a = bodCiela(volne[3], prvky, prikaz);
      const b = bodCiela(volne[4], prvky, prikaz);
      await dotyk("touchStart", a);
      for (let i = 1; i <= 15; i++) {
        await dotyk("touchMove", { x: Math.round(a.x + ((b.x - a.x) * i) / 15), y: Math.round(a.y + ((b.y - a.y) * i) / 15) });
        await pockaj(25);
      }
      await dotyk("touchEnd");
      popis = `potiahnutie ${volne[3]} → ${volne[4]}`;
      break;
    }
    case "otoc": {
      const naVysku = !stavPred.naVysku;
      writeFileSync(suborOrientacie(r, n), JSON.stringify({ naVysku }));
      if ((await cakajNaStav(r, n, (s) => s.naVysku === naVysku, 5000)) === null) throw new Error("Strážca telefón neotočil — beží ešte relácia?");
      popis = naVysku ? "otočenie na výšku" : "otočenie späť na šírku";
      break;
    }
    case "detail": {
      const v = vyrez(volne[3], prvky, okno);
      const subor = dalsiaSnimka("detail");
      await odfot(cdp, subor, v);
      cdp.zavri();
      console.log(`Ostrý výrez ${v.w}×${v.h} CSS px z bodu ${v.x},${v.y} (hustota ${DPR}×): ${lomky(subor)}  ← pozri ho (Read)`);
      process.exit(0);
      break;
    }
    case "klaves": {
      const k = volne[3];
      if (k === undefined) throw new Error("klaves <kláves>, napr. Enter, Escape, Backspace.");
      const pismeno = k.length === 1;
      const vk: Record<string, number> = { Escape: 27, Enter: 13, Tab: 9, Space: 32, Backspace: 8 };
      const kluc = k === "Space" ? " " : pismeno ? k.toLowerCase() : k;
      const zaklad = { key: kluc, code: k === "Space" ? "Space" : pismeno ? (/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`) : k, windowsVirtualKeyCode: pismeno ? k.toUpperCase().charCodeAt(0) : (vk[k] ?? 0) };
      await cdp.posli("Input.dispatchKeyEvent", { type: "keyDown", ...zaklad, ...(pismeno || k === "Space" ? { text: kluc } : {}) });
      await cdp.posli("Input.dispatchKeyEvent", { type: "keyUp", ...zaklad });
      popis = `kláves ${k}`;
      break;
    }
    case "pis": {
      const text = volne.slice(3).join(" ");
      await cdp.posli("Input.insertText", { text });
      popis = `písanie „${text}“`;
      break;
    }
    case "pockaj": {
      await pockaj(Math.min(Number(volne[3] ?? "3"), 30) * 1000);
      popis = `čakanie ${volne[3] ?? "3"} s`;
      break;
    }
    case "otvor": {
      const cesta = cestaWebu(volne[3]);
      await cdp.posli("Page.navigate", { url: `${rel.web}${cesta}` });
      await pockaj(1200);
      popis = `otvorenie ${cesta}`;
      break;
    }
    case "partia": {
      const od = Date.now();
      await cdp.posli("Page.navigate", { url: `${rel.web}/hra` });
      await pockaj(1800);
      // Cez tlačidlá lobby ako človek; ligu vyberie podľa relácie (kratka = Tretia liga).
      const chyba = await cdp.js<string>(`(async () => {
        const volba = [...document.querySelectorAll('.dlzka-volba')][${LIGY.indexOf(rel.liga)}];
        if (volba && !volba.disabled) { volba.click(); await new Promise((ok) => setTimeout(ok, 250)); }
        const b = document.querySelector('[data-hrat-bot]');
        if (!b) return 'Na /hra nie je tlačidlo „Hrať proti počítaču“ — beží už partia? Pozri snímku (pozri).';
        if (b.disabled) return 'Tlačidlo „Hrať proti počítaču“ je nedostupné' + (b.title ? ': ' + b.title : '');
        b.click();
        return '';
      })()`);
      if (chyba !== "") throw new Error(chyba);
      if ((await cakajNaStav(r, n, (s) => (s.poslednyStav ?? 0) > od, 15_000)) === null) throw new Error("Partia sa nezačala do 15 s — pozri snímku (pozri) a hlášky.");
      popis = `partia proti botovi (${rel.liga})`;
      break;
    }
    default:
      throw new Error(`Neznámy príkaz „${prikaz}“ — pozri hlavičku tools/playtest/mobil.ts.`);
  }
  if (prikaz !== "pockaj") await pockaj(Number(volba("--cakaj") ?? "900"));

  const obr = await cdp.js<Obrazovka>(OBRAZOVKA);
  const snimka = dalsiaSnimka(prikaz);
  await odfot(cdp, snimka);
  cdp.zavri();
  writeFileSync(suborPrvkov, JSON.stringify(obr.prvky));

  // Strážca zapisuje asynchrónne — chyba servera po akcii príde o pár ms neskôr.
  await pockaj(150);
  const stav = nacitajStav(r, n);
  const oknoPo = oknoDispleja(rel.displej, stav.naVysku);
  const noveChyby = stav.chyby.slice(stavPred.chyby.length);
  const novaKonzola = stav.konzola.slice(stavPred.konzola.length);
  appendFileSync(
    join(dir, "zaznam", "akcie.jsonl"),
    `${JSON.stringify({ t: Date.now(), akcia: popis, url: obr.url, naVysku: stav.naVysku, kolo: stav.kolo, faza: stav.faza, chyby: noveChyby.map((c) => c.text), konzola: novaKonzola.map((c) => c.text), upozornenia: obr.upozornenia.length, maleCiele: obr.prvky.filter((p) => p.w < MALY_CIEL || p.h < MALY_CIEL).length, snimka: lomky(snimka) })}\n`,
  );

  const out: string[] = [`Snímka: ${lomky(snimka)}  ← pozri ju (Read); telefón ${stav.naVysku ? "NA VÝŠKU" : "na šírku"} ${oknoPo.sirka}×${oknoPo.vyska} CSS px = súradnice pre tuk`];
  out.push(...extra);
  out.push(`Stránka: ${obr.url}${obr.vyskaStranky > oknoPo.vyska + 4 ? ` (stránka je vysoká ${obr.vyskaStranky} px — posun prstom: potiahni)` : ""}`);
  out.push(...popisPartie(stav, rel.kola));
  for (const t of obr.hlasky) out.push(`Hláška na obrazovke: „${t}“`);
  for (const c of noveChyby) out.push(`Hláška servera: „${c.text}“`);
  for (const c of novaKonzola) out.push(`(chyba v konzole prehliadača: ${c.text})`);
  out.push(`Ťukateľné prvky (${popis === "pozri" ? "" : `po akcii „${popis}“; `}tuk <číslo>; rozmer v CSS px):`);
  for (const p of obr.prvky) out.push(riadokPrvku(p));
  out.push(...vypisUpozornenia(obr));
  console.log(out.join("\n"));
  process.exit(0);
}

// ---- súhrn a koniec ---------------------------------------------------------------

function suhrn(): void {
  const r = volne[0] ?? "";
  const rel = nacitajRelaciu(r);
  for (const h of rel.hraci) {
    const dir = priecinokHraca(r, h.n);
    const subor = join(dir, "zaznam", "akcie.jsonl");
    const akcie = existsSync(subor)
      ? readFileSync(subor, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as { akcia: string; chyby: string[]; upozornenia: number; naVysku: boolean })
      : [];
    const stav = nacitajStav(r, h.n);
    const naleze = join(dir, "naleze.md");
    console.log(
      `Playtester ${h.n} ${h.meno}: odohrané kolá ${odohraneKola(stav)} z ${rel.kola}, akcií ${akcie.length} (${akcie.filter((a) => a.naVysku).length} na výšku), ` +
        `upozornení DOM ${akcie.reduce((s, a) => s + a.upozornenia, 0)}, hlášok servera ${stav.chyby.length}, chýb konzoly ${stav.konzola.length}; ` +
        `nálezy: ${existsSync(naleze) ? lomky(naleze) : "naleze.md ešte chýba"}`,
    );
  }
}

function ukonci(): void {
  const r = volne[0] ?? "";
  const rel = nacitajRelaciu(r);
  for (const h of rel.hraci) {
    zabi(h.strazcaPid);
    zabi(h.chromePid);
  }
  for (const h of rel.hraci) zmazProfil(priecinokHraca(r, h.n));
  console.log(`Playtest mobilu ${rel.id}: prehliadače zastavené, profily zmazané (server ${rel.url} beží ďalej). Snímky a nálezy ostávajú v ${lomky(r)}.`);
}

try {
  if (volne[0] === "zaloz") await zaloz();
  else if (volne[0] === "_strazca") await strazca();
  else if (volne[1] === "stav") suhrn();
  else if (volne[1] === "ukonci") ukonci();
  else if (volne[0] !== undefined && /^\d+$/.test(volne[1] ?? "")) await akcia();
  else {
    console.error("Použitie: mobil.ts zaloz [1–3] [--url …] [--web …] | <R> <n> partia|pozri|tuk|podrz|potiahni|otoc|detail|pis|klaves|pockaj|otvor … | <R> stav | <R> ukonci");
    process.exit(1);
  }
} catch (err) {
  console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
