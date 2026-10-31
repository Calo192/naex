// Playtest výučby „Prvá hra“ (Michal 2026-10-23, roadmapa #85): nováčik ju
// prechádza ako človek — v skutočnom prehliadači, zo snímok obrazovky, myšou
// a klávesnicou — nie cez konzolového klienta hrac.ts. Každý nováčik má vlastný
// headless Chrome so svojím rozlíšením; príkazy sa k nemu pripájajú cez
// DevTools protokol a po každej akcii odfotia obrazovku.
//
//   V = node --experimental-strip-types --no-warnings tools/playtest/vyucba.ts
//   $V zaloz [1–3] [--vypinac]         server (od :8800, dočasná DB), účty nováčikov, prehliadače
//   $V <R> <n> pozri                   snímka obrazovky + čo je na nej (bublina, zvýraznené, prvky)
//   $V <R> <n> klik <číslo|x,y> [--pravy] [--dvakrat]
//   $V <R> <n> nad <číslo|x,y>         myš nad prvok (lupa karty), bez kliku
//   $V <R> <n> tahaj <odkiaľ> <kam>    potiahnutie myšou (číslo prvku alebo x,y)
//   $V <R> <n> klaves <kláves>         napr. P, K, N, Escape, Enter, Tab, ArrowLeft
//   $V <R> <n> pis <text>              napíše text do pola s fokusom
//   $V <R> <n> skrol <dy>              koliesko myši (+ dole, − hore)
//   $V <R> <n> pockaj <sekundy>        počká (ťah Štamgasta) a odfotí
//   $V <R> <n> otvor <cesta>           otvorí stránku webu (napr. /hra)
//   $V <R> suhrn                       po krokoch výučby: akcie, chyby, čas (pre spisovateľa)
//   $V <R> ukonci                      zastaví prehliadače a server
//
// R = playtest/vyucba-<id>. Pri akciách platí --cakaj <ms> (koľko počkať pred
// snímkou, predvolene 900). Server beží s NAEX_VYUCBA=1, takže výučbu dostane
// aj obyčajný návštevník; --vypinac to vypne (overenie, že sa hráčom neukáže).
//
// Čo nováčik vidí: snímku a výpis toho, čo je na obrazovke (text bubliny
// Melichara, zvýraznené prvky, číslované klikateľné prvky v okne). Krok
// výučby a hlášky servera sa berú zo záznamu WebSocketu (strážca beží pri
// každom prehliadači) — nováčikovi sa ukáže len poradie kroku a text chyby,
// nikdy príkaz, ktorý scenár čaká. Záznam je v <R>/hrac<n>/zaznam/ (nováčik
// ho nečíta).
//
// Prvky výučby v DOM (dohoda s UX/UI): [data-vyucba-bublina] = bublina
// Melichara (s data-vyucba-krok = id kroku), [data-vyucba-zvyraznene] =
// zvýraznený prvok (hodnota = kľúč zo scenára, napr. „ruka:hasic“), [data-vyucba-zmena] =
// čo sa po ťahu Štamgasta či hry za hráča práve zmenilo.

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { nastavDocasneEnv, upratStare } from "../docasne.ts";
import { cestaWebu, chrome, nahodnyPort, pockaj, pripojCdp, volnyPort, zabi, zmazProfil } from "./prehliadac.ts";

interface Novacik {
  readonly kluc: string;
  readonly meno: string;
  readonly pohlavie: "muz" | "zena";
  readonly kto: string;
  readonly ako: string;
  readonly zameranie: string;
  readonly rozlisenie: string;
}
interface HracRelacie {
  readonly n: number;
  readonly postava: Novacik;
  readonly login: string;
  readonly heslo: string;
  readonly sirka: number;
  readonly vyska: number;
  readonly cdpPort: number;
  readonly chromePid: number;
  readonly strazcaPid: number;
}
interface Relacia {
  readonly id: string;
  readonly port: number;
  readonly serverPid: number;
  readonly vypinac: boolean;
  readonly zalozena: string;
  readonly hraci: HracRelacie[];
}
/** Posledný známy stav výučby zo záznamu WebSocketu (zapisuje strážca). */
interface StavVyucby {
  index: number | null;
  spolu: number | null;
  id: string | null;
  hotovo: boolean;
  chyby: { t: number; text: string }[];
  konzola: { t: number; text: string }[];
}
interface Prvok {
  readonly c: number;
  readonly druh: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly zvyraznene: string | null;
  readonly nedostupne: boolean;
}

const args = process.argv.slice(2);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const S_HODNOTOU = new Set(["--cakaj"]);
const volne = args.filter((a, i) => !a.startsWith("--") && !S_HODNOTOU.has(args[i - 1] ?? ""));

// ---- relácia ------------------------------------------------------------------

const nacitajRelaciu = (r: string): Relacia => {
  const subor = join(r, "vyucba.json");
  if (!existsSync(subor)) throw new Error(`${subor} neexistuje — relácia vzniká príkazom „zaloz“.`);
  return JSON.parse(readFileSync(subor, "utf8")) as Relacia;
};
const hracRelacie = (rel: Relacia, n: number): HracRelacie => {
  const h = rel.hraci.find((x) => x.n === n);
  if (h === undefined) throw new Error(`Relácia nemá nováčika ${n} (má ${rel.hraci.map((x) => x.n).join(", ")}).`);
  return h;
};
const priecinokHraca = (r: string, n: number): string => join(r, `hrac${n}`);
const suborStavu = (r: string, n: number): string => join(priecinokHraca(r, n), "zaznam", "vyucba.json");
const nacitajStav = (r: string, n: number): StavVyucby => {
  try {
    return JSON.parse(readFileSync(suborStavu(r, n), "utf8")) as StavVyucby;
  } catch {
    return { index: null, spolu: null, id: null, hotovo: false, chyby: [], konzola: [] };
  }
};

async function zaloz(): Promise<void> {
  const pocet = Number(volne[1] ?? "3");
  const { novacikovia } = JSON.parse(readFileSync("tools/playtest/novacikovia.json", "utf8")) as { novacikovia: readonly Novacik[] };
  if (!Number.isInteger(pocet) || pocet < 1 || pocet > novacikovia.length) throw new Error(`Počet nováčikov musí byť 1 až ${novacikovia.length}.`);
  if (!existsSync("apps/web/dist/index.html")) throw new Error("Chýba zbuildovaný klient (apps/web/dist) — spusti najprv: npm run build --workspace=@naex/web");
  const vypinac = args.includes("--vypinac");
  const id = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const r = join("playtest", `vyucba-${id}`);
  mkdirSync(join(r, "server-data"), { recursive: true });
  nastavDocasneEnv();
  upratStare();

  // Od 8800 — nižšie porty majú dev servery súbežných sessions (docs/SESSIONS.md).
  const port = await volnyPort(8800);
  const log = openSync(join(r, "server.log"), "a");
  const server = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "packages/server/src/index.ts"], {
    env: { ...process.env, PORT: String(port), NAEX_DATA: resolve(r, "server-data"), NAEX_ADMIN_HESLO: "", NAEX_VYUCBA: vypinac ? "" : "1" },
    detached: true,
    stdio: ["ignore", log, log],
    windowsHide: true,
  });
  server.unref();
  const pidy: number[] = server.pid === undefined ? [] : [server.pid];
  const zlyhanie = (err: unknown): never => {
    console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
    for (const p of pidy) zabi(p);
    for (let n = 1; n <= pocet; n++) zmazProfil(priecinokHraca(r, n));
    process.exit(1);
  };
  process.on("uncaughtException", zlyhanie);
  process.on("unhandledRejection", zlyhanie);
  const zaklad = `http://localhost:${port}`;
  // Server pri prvom štarte plní databázu (karty, obrázky) — chvíľu to trvá.
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${zaklad}/api/ja`)).ok) break;
    } catch {
      // ešte nebeží
    }
    if (i > 120) throw new Error(`Server sa nespustil — pozri ${join(r, "server.log")}`);
    await pockaj(500);
  }

  // Poradie postáv náhodne; náhoda je tu v poriadku — nástroj, nie jadro hry.
  const poradie = [...novacikovia].sort(() => Math.random() - 0.5).slice(0, pocet);
  const hraci: HracRelacie[] = [];
  for (const [i, postava] of poradie.entries()) {
    const n = i + 1;
    const dir = priecinokHraca(r, n);
    for (const d of ["snimky", "zaznam", "chrome/tmp"]) mkdirSync(join(dir, d), { recursive: true });
    const [sirka = 1600, vyska = 1000] = postava.rozlisenie.split("x").map(Number);
    const cdpPort = await nahodnyPort();
    const ch = spawn(
      chrome(),
      ["--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${resolve(dir, "chrome")}`, `--window-size=${sirka},${vyska}`, "--mute-audio", "--no-first-run", "--no-default-browser-check", "about:blank"],
      // Chromove dočasné súbory (scoped_dir*) do profilu, nie do %TEMP% — zmiznú s ním.
      { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, TEMP: resolve(dir, "chrome", "tmp"), TMP: resolve(dir, "chrome", "tmp") } },
    );
    ch.unref();
    if (ch.pid !== undefined) pidy.push(ch.pid);
    const login = `novacik${n}`;
    const heslo = randomBytes(9).toString("base64url");
    // Strážca drží spojenie s prehliadačom celý čas: zapisuje správy WebSocketu
    // (krok výučby, chyby servera) a drží rozlíšenie okna.
    const strazca = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "tools/playtest/vyucba.ts", "_strazca", r, String(n), String(cdpPort), String(sirka), String(vyska)], {
      detached: true,
      stdio: ["ignore", openSync(join(dir, "zaznam", "strazca.log"), "a"), openSync(join(dir, "zaznam", "strazca.log"), "a")],
      windowsHide: true,
    });
    strazca.unref();
    if (strazca.pid !== undefined) pidy.push(strazca.pid);
    await pockaj(1500);

    // Registrácia priamo v prehliadači — cookie relácie ostane v ňom ako u človeka.
    const cdp = await pripojCdp(cdpPort);
    await cdp.posli("Page.enable");
    await cdp.posli("Page.navigate", { url: `${zaklad}/` });
    await pockaj(1500);
    const stav = await cdp.js<number>(
      `fetch('/api/registracia',{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify(${JSON.stringify({ login, heslo, meno: postava.meno.slice(0, 24) })})}).then(r=>r.status)`,
    );
    if (stav !== 200 && stav !== 201) throw new Error(`Registrácia ${login}: HTTP ${stav}`);
    await cdp.js(`fetch('/api/profil',{method:'PATCH',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify({pohlavie:${JSON.stringify(postava.pohlavie)}})}).then(r=>r.status)`).catch(() => 0);
    await cdp.posli("Page.navigate", { url: `${zaklad}/` });
    cdp.zavri();
    hraci.push({ n, postava, login, heslo, sirka, vyska, cdpPort, chromePid: ch.pid ?? 0, strazcaPid: strazca.pid ?? 0 });
  }

  const rel: Relacia = { id, port, serverPid: server.pid ?? 0, vypinac: !vypinac, zalozena: new Date().toISOString(), hraci };
  writeFileSync(join(r, "vyucba.json"), `${JSON.stringify(rel, null, 2)}\n`);
  const rr = r.split("\\").join("/");
  console.log(`Playtest výučby založený: ${rr}`);
  console.log(`Server: ${zaklad} (pid ${rel.serverPid}), výučba pre návštevníkov: ${vypinac ? "VYPNUTÁ (--vypinac)" : "zapnutá (NAEX_VYUCBA=1)"}`);
  for (const h of hraci) console.log(`Nováčik ${h.n}: ${h.postava.meno} — ${h.sirka}×${h.vyska} (prehliadač na otvorenej titulnej stránke)`);
  console.log(`Zastaví: tools/playtest/vyucba.ts ${rr} ukonci`);
  process.exit(0);
}

/** Beží na pozadí pri každom prehliadači, kým prehliadač žije. */
async function strazca(): Promise<void> {
  const [, r = "", nArg = "1", portArg = "0", sirkaArg = "1600", vyskaArg = "1000"] = volne;
  const n = Number(nArg);
  const cdp = await pripojCdp(Number(portArg));
  const zaznam = join(priecinokHraca(r, n), "zaznam");
  const stav: StavVyucby = { index: null, spolu: null, id: null, hotovo: false, chyby: [], konzola: [] };
  const uloz = (): void => writeFileSync(suborStavu(r, n), JSON.stringify(stav));
  uloz();
  cdp.naUdalost((method, p) => {
    const t = Date.now();
    if (method === "Network.webSocketFrameReceived" || method === "Network.webSocketFrameSent") {
      const payload = (p.response as { payloadData?: string } | undefined)?.payloadData ?? "";
      let m: { type?: string; krok?: { index: number; spolu: number; id: string } | null; hotovo?: boolean; text?: string };
      try {
        m = JSON.parse(payload) as typeof m;
      } catch {
        return;
      }
      const smer = method === "Network.webSocketFrameSent" ? "von" : "dnu";
      // Stav partie, sada kariet a história sú veľké a pre výučbu nepotrebné — len typ.
      const velka = m.type === "state" || m.type === "privitanie" || m.type === "historia";
      appendFileSync(join(zaznam, "ws.jsonl"), `${JSON.stringify(velka ? { t, smer, type: m.type } : { t, smer, ...m })}\n`);
      if (smer === "dnu" && m.type === "vyucba") {
        stav.hotovo = m.hotovo === true;
        if (m.krok !== null && m.krok !== undefined) Object.assign(stav, { index: m.krok.index, spolu: m.krok.spolu, id: m.krok.id });
        else if (stav.hotovo && stav.spolu !== null) stav.index = stav.spolu;
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
  // Rozlíšenie drží toto spojenie — kým žije strážca, platí pre všetky príkazy.
  await cdp.posli("Emulation.setDeviceMetricsOverride", { width: Number(sirkaArg), height: Number(vyskaArg), deviceScaleFactor: 1, mobile: false });
  console.log(`Strážca nováčika ${n} beží.`);
  await cdp.koniec;
}

// ---- akcie nováčika --------------------------------------------------------------

/** Čo je na obrazovke — beží v stránke. Len prvky v okne, ako ich vidí človek. */
const OBRAZOVKA = String.raw`(() => {
  const W = innerWidth, H = innerHeight;
  const viditelny = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
  };
  const text = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const druh = (el) => {
    const t = el.tagName.toLowerCase();
    if (t === 'a') return 'odkaz';
    if (t === 'button' || el.getAttribute('role') === 'button') return 'tlačidlo';
    if (t === 'input' || t === 'textarea' || t === 'select') return 'pole';
    if (t === 'summary') return 'rozbaliť';
    if (el.querySelector('img') || /karta|card/i.test(el.className)) return 'karta/obrázok';
    return 'prvok';
  };
  // Klikateľné: ovládacie prvky a čokoľvek s kurzorom ruky, čo nie je vnútri už zaradeného.
  const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[tabindex]:not([tabindex="-1"])';
  const kandidati = [...document.querySelectorAll('body *')].filter((el) => el.matches(SEL) || (getComputedStyle(el).cursor === 'pointer' && !(el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')));
  const vybrane = [];
  for (const el of kandidati) {
    if (!viditelny(el) || vybrane.some((v) => v.contains(el))) continue;
    // Zakrytý prvok (pod vrstvou, bublinou) človek neklikne — rozhoduje bod v strede.
    const r = el.getBoundingClientRect();
    const cx = Math.min(Math.max(r.left + r.width / 2, 1), W - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), H - 1);
    const navrchu = document.elementFromPoint(cx, cy);
    if (navrchu && !el.contains(navrchu) && !navrchu.contains(el)) continue;
    vybrane.push(el);
  }
  const zvyraznenie = (el) => { const z = el.closest('[data-vyucba-zvyraznene]') || el.querySelector('[data-vyucba-zvyraznene]'); return z ? z.getAttribute('data-vyucba-zvyraznene') || 'áno' : null; };
  const prvky = vybrane.slice(0, 80).map((el, i) => {
    const r = el.getBoundingClientRect();
    return { c: i + 1, druh: druh(el), text: text(el), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), zvyraznene: zvyraznenie(el), nedostupne: el.disabled === true || el.getAttribute('aria-disabled') === 'true' };
  });
  const bublina = document.querySelector('[data-vyucba-bublina]');
  const zvyraznene = [...document.querySelectorAll('[data-vyucba-zvyraznene]')].filter(viditelny).map((el) => {
    const r = el.getBoundingClientRect();
    return { kluc: el.getAttribute('data-vyucba-zvyraznene') || '', text: text(el), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  // Čo sa po ťahu Štamgasta či hry zmenilo — svieti prerušovane, nie je to pokyn.
  const zmenene = [...document.querySelectorAll('[data-vyucba-zmena]')].filter(viditelny).map((el) => {
    const r = el.getBoundingClientRect();
    return { kluc: el.getAttribute('data-vyucba-zmena') || '', text: text(el), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  });
  // Toasty a hlášky: role=alert / status (aria-live).
  const hlasky = [...document.querySelectorAll('[role=alert],[role=status],[aria-live]')].filter(viditelny).map(text).filter((t) => t.length > 0);
  return {
    url: location.pathname,
    titulok: document.title,
    bublina: bublina && viditelny(bublina) ? { text: (bublina.innerText || '').trim(), krok: bublina.getAttribute('data-vyucba-krok') } : null,
    zvyraznene, zmenene, hlasky, prvky,
    skrol: Math.round(scrollY), vyskaStranky: document.documentElement.scrollHeight,
  };
})()`;
interface Obrazovka {
  url: string;
  titulok: string;
  bublina: { text: string; krok: string | null } | null;
  zvyraznene: { kluc: string; text: string; x: number; y: number }[];
  zmenene: { kluc: string; text: string; x: number; y: number }[];
  hlasky: string[];
  prvky: Prvok[];
  skrol: number;
  vyskaStranky: number;
}

async function akcia(): Promise<void> {
  const r = volne[0] ?? "";
  const n = Number(volne[1]);
  const prikaz = volne[2] ?? "pozri";
  const rel = nacitajRelaciu(r);
  const h = hracRelacie(rel, n);
  const dir = priecinokHraca(r, n);
  const suborPrvkov = join(dir, "zaznam", "prvky.json");
  const bod = (a: string | undefined): { x: number; y: number } => {
    if (a === undefined) throw new Error(`Príkaz ${prikaz} potrebuje cieľ: číslo prvku z posledného výpisu alebo x,y.`);
    const xy = /^(\d+),(\d+)$/.exec(a);
    if (xy !== null) return { x: Number(xy[1]), y: Number(xy[2]) };
    const prvky = existsSync(suborPrvkov) ? (JSON.parse(readFileSync(suborPrvkov, "utf8")) as Prvok[]) : [];
    const p = prvky.find((x) => x.c === Number(a));
    if (p === undefined) throw new Error(`Prvok ${a} v poslednom výpise nie je — najprv „pozri“.`);
    return { x: p.x, y: p.y };
  };
  const stavPred = nacitajStav(r, n);
  const cdp = await pripojCdp(h.cdpPort);
  const mys = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) => cdp.posli("Input.dispatchMouseEvent", { type, x, y, ...extra });
  const klik = async ({ x, y }: { x: number; y: number }, tlacidlo: "left" | "right", pocet: number): Promise<void> => {
    await mys("mouseMoved", x, y);
    for (let i = 1; i <= pocet; i++) {
      await mys("mousePressed", x, y, { button: tlacidlo, buttons: tlacidlo === "left" ? 1 : 2, clickCount: i });
      await mys("mouseReleased", x, y, { button: tlacidlo, buttons: 0, clickCount: i });
    }
  };
  let popis = prikaz;
  switch (prikaz) {
    case "pozri":
      break;
    case "klik": {
      const b = bod(volne[3]);
      await klik(b, args.includes("--pravy") ? "right" : "left", args.includes("--dvakrat") ? 2 : 1);
      popis = `klik ${volne[3]} (${b.x},${b.y})${args.includes("--pravy") ? " pravým" : ""}`;
      break;
    }
    case "nad": {
      const b = bod(volne[3]);
      await mys("mouseMoved", b.x, b.y);
      popis = `myš nad ${volne[3]} (${b.x},${b.y})`;
      break;
    }
    case "tahaj": {
      const a = bod(volne[3]);
      const b = bod(volne[4]);
      // Ťahanie po krokoch — klient reaguje na pointermove, nie na skok.
      await mys("mouseMoved", a.x, a.y);
      await mys("mousePressed", a.x, a.y, { button: "left", buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 15; i++) {
        await mys("mouseMoved", Math.round(a.x + ((b.x - a.x) * i) / 15), Math.round(a.y + ((b.y - a.y) * i) / 15), { button: "left", buttons: 1 });
        await pockaj(25);
      }
      await mys("mouseReleased", b.x, b.y, { button: "left", buttons: 0, clickCount: 1 });
      popis = `ťahanie ${volne[3]} → ${volne[4]}`;
      break;
    }
    case "klaves": {
      const k = volne[3];
      if (k === undefined) throw new Error("klaves <kláves>, napr. P, Escape, Enter.");
      const pismeno = k.length === 1;
      const kod = pismeno ? (/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`) : k;
      const vk: Record<string, number> = { Escape: 27, Enter: 13, Tab: 9, Space: 32, Backspace: 8, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
      const kluc = k === "Space" ? " " : pismeno ? k.toLowerCase() : k;
      const zaklad = { key: kluc, code: k === "Space" ? "Space" : kod, windowsVirtualKeyCode: pismeno ? k.toUpperCase().charCodeAt(0) : (vk[k] ?? 0) };
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
    case "skrol": {
      const dy = Number(volne[3] ?? "400");
      await mys("mouseWheel", Math.round(h.sirka / 2), Math.round(h.vyska / 2), { deltaX: 0, deltaY: dy });
      popis = `skrol ${dy}`;
      break;
    }
    case "pockaj": {
      await pockaj(Math.min(Number(volne[3] ?? "3"), 30) * 1000);
      popis = `čakanie ${volne[3] ?? "3"} s`;
      break;
    }
    case "otvor": {
      const cesta = cestaWebu(volne[3]);
      await cdp.posli("Page.navigate", { url: `http://localhost:${rel.port}${cesta}` });
      await pockaj(1200);
      popis = `otvorenie ${cesta}`;
      break;
    }
    default:
      throw new Error(`Neznámy príkaz „${prikaz}“ — pozri hlavičku tools/playtest/vyucba.ts.`);
  }
  if (prikaz !== "pockaj") await pockaj(Number(volba("--cakaj") ?? "900"));

  const obr = await cdp.js<Obrazovka>(OBRAZOVKA);
  const poradie = readdirSync(join(dir, "snimky")).filter((f) => f.endsWith(".png")).length + 1;
  const snimka = join(dir, "snimky", `${String(poradie).padStart(3, "0")}-${prikaz}.png`);
  const png = await cdp.posli("Page.captureScreenshot", { format: "png" });
  writeFileSync(snimka, Buffer.from(String(png.data), "base64"));
  cdp.zavri();
  writeFileSync(suborPrvkov, JSON.stringify(obr.prvky));

  // Strážca zapisuje asynchrónne — chyba servera po akcii príde o pár ms neskôr.
  await pockaj(150);
  const stav = nacitajStav(r, n);
  const noveChyby = stav.chyby.slice(stavPred.chyby.length);
  const novaKonzola = stav.konzola.slice(stavPred.konzola.length);
  appendFileSync(
    join(dir, "zaznam", "akcie.jsonl"),
    `${JSON.stringify({ t: Date.now(), akcia: popis, krokPred: stavPred.index, krokPo: stav.index, krokId: stavPred.id, chyby: noveChyby.map((c) => c.text), konzola: novaKonzola.map((c) => c.text), snimka: snimka.split("\\").join("/"), url: obr.url })}\n`,
  );

  const out: string[] = [`Snímka: ${snimka.split("\\").join("/")}  ← pozri ju (Read), to je tvoja obrazovka ${h.sirka}×${h.vyska}`];
  out.push(`Stránka: ${obr.url}${obr.vyskaStranky > h.vyska + 4 ? ` (rolovanie ${obr.skrol} z ${obr.vyskaStranky - h.vyska} px)` : ""}`);
  if (stav.index !== null && stav.spolu !== null) out.push(`Výučba: ${stav.hotovo ? "dokončená" : `krok ${stav.index + 1} z ${stav.spolu}`}`);
  if (obr.bublina !== null) out.push(`Bublina Melichara: „${obr.bublina.text}“`);
  if (obr.zvyraznene.length > 0) out.push(`Zvýraznené: ${obr.zvyraznene.map((z) => `${z.text || z.kluc} @ ${z.x},${z.y}`).join(" · ")}`);
  if (obr.zmenene.length > 0) out.push(`Práve sa zmenilo (svieti prerušovane): ${obr.zmenene.map((z) => `${z.text || z.kluc} @ ${z.x},${z.y}`).join(" · ")}`);
  for (const t of obr.hlasky) out.push(`Hláška na obrazovke: „${t}“`);
  for (const c of noveChyby) out.push(`Hláška servera: „${c.text}“`);
  for (const c of novaKonzola) out.push(`(chyba v konzole prehliadača: ${c.text})`);
  out.push(`Prvky na klik (${popis === "pozri" ? "" : `po akcii „${popis}“; `}číslo → klik <číslo>):`);
  for (const p of obr.prvky) out.push(`  ${p.c}. [${p.druh}] ${p.text || "(bez textu)"} @ ${p.x},${p.y}${p.zvyraznene !== null ? " ★zvýraznené" : ""}${p.nedostupne ? " (nedostupné)" : ""}`);
  console.log(out.join("\n"));
  process.exit(0);
}

// ---- súhrn a koniec ---------------------------------------------------------------

function suhrn(): void {
  const r = volne[0] ?? "";
  const rel = nacitajRelaciu(r);
  const vystup: Record<string, unknown>[] = [];
  for (const h of rel.hraci) {
    const subor = join(priecinokHraca(r, h.n), "zaznam", "akcie.jsonl");
    const akcie = existsSync(subor)
      ? readFileSync(subor, "utf8").split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as { t: number; akcia: string; krokPred: number | null; krokPo: number | null; krokId: string | null; chyby: string[] })
      : [];
    // Krok = obdobie, keď výučba stála na tom istom indexe; zaseknutie = veľa akcií alebo chýb v ňom.
    const kroky = new Map<number, { id: string | null; akcie: number; chyby: number; od: number; do: number }>();
    for (const a of akcie) {
      if (a.krokPred === null) continue;
      const k = kroky.get(a.krokPred) ?? { id: a.krokId, akcie: 0, chyby: 0, od: a.t, do: a.t };
      k.akcie += a.akcia.startsWith("čakanie") || a.akcia === "pozri" ? 0 : 1;
      k.chyby += a.chyby.length;
      k.do = a.t;
      kroky.set(a.krokPred, k);
    }
    const stav = nacitajStav(r, h.n);
    const riadky = [...kroky.entries()].sort(([a], [b]) => a - b).map(([index, k]) => ({ index, id: k.id, akcie: k.akcie, chyby: k.chyby, sekundy: Math.round((k.do - k.od) / 1000) }));
    vystup.push({ n: h.n, meno: h.postava.meno, rozlisenie: `${h.sirka}x${h.vyska}`, dokoncena: stav.hotovo, poslednyKrok: stav.index, spolu: stav.spolu, akcii: akcie.length, chybServera: stav.chyby.length, chybKonzoly: stav.konzola.length, kroky: riadky });
    console.log(`\nNováčik ${h.n} ${h.postava.meno} (${h.sirka}×${h.vyska}): ${stav.hotovo ? "dokončil" : `skončil na kroku ${(stav.index ?? -1) + 1} z ${stav.spolu ?? "?"}`}, ${akcie.length} akcií, ${stav.chyby.length} hlášok servera, ${stav.konzola.length} chýb konzoly`);
    for (const k of riadky.filter((x) => x.akcie > 2 || x.chyby > 0)) console.log(`  krok ${k.index + 1} ${k.id ?? ""}: ${k.akcie} akcií, ${k.chyby} chýb, ${k.sekundy} s`);
  }
  writeFileSync(join(r, "suhrn.json"), `${JSON.stringify(vystup, null, 2)}\n`);
  console.log(`\nZapísané: ${join(r, "suhrn.json").split("\\").join("/")}`);
}

function ukonci(): void {
  const r = volne[0] ?? "";
  const rel = nacitajRelaciu(r);
  for (const h of rel.hraci) {
    zabi(h.strazcaPid);
    zabi(h.chromePid);
  }
  zabi(rel.serverPid);
  for (const h of rel.hraci) zmazProfil(priecinokHraca(r, h.n));
  console.log(`Playtest výučby ${rel.id}: prehliadače a server (pid ${rel.serverPid}) zastavené, profily prehliadačov zmazané. Dáta ostávajú v ${r}.`);
}

if (volne[0] === "zaloz") await zaloz();
else if (volne[0] === "_strazca") await strazca();
else if (volne[1] === "suhrn") suhrn();
else if (volne[1] === "ukonci") ukonci();
else if (volne[0] !== undefined && /^\d+$/.test(volne[1] ?? "")) await akcia();
else {
  console.error("Použitie: vyucba.ts zaloz [1–3] | <R> <n> pozri|klik|nad|tahaj|klaves|pis|skrol|pockaj|otvor … | <R> suhrn | <R> ukonci");
  process.exit(1);
}
