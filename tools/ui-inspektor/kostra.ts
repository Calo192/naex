// Kostra stránok mimo hry (Michal 2026-10-26: „Ľavý okraj každej stránky skáče“) —
// headless Chrome prejde stránky pri 1920, 1440 a 1366 px a zmeria ľavú hranu loga
// a obsahu. Obsah musí začínať na hrane loga a tá sa medzi stránkami nesmie pohnúť
// ani o pixel; inak skončí s chybou. Úzke stránky smú byť užšie len sprava.
//
//   node --experimental-strip-types --no-warnings tools/ui-inspektor/kostra.ts [cesta …] [--url http://localhost:5176] [--rozlisenia 1920x1080,1440x800,1366x650]
//
// Hrana obsahu = najľavejší viditeľný prvok v <main> (nadpis, panel, karta…), nie
// samotný <main> — vnútorné centrovanie stránky (Rebríček, mriežka kariet) by sa inak schovalo.
// Herný stôl (partia, prehrávač) ide na celú šírku a nemeria sa.

import { existsSync } from "node:fs";
import { createServer } from "node:net";
import WebSocket from "ws";
import { spustiChrome } from "../docasne.ts";
import { prihlasAgenta } from "../playtest/web.ts";

/** Stránky mimo hry (apps/web/src/App.tsx a admin/); /hrac/:id sa doplní podľa účtu. */
const STRANKY = [
  "/", "/hra", "/pravidla", "/karty", "/karty/dielna", "/novinky", "/rebricek", "/spatna-vazba", "/vyvoj", "/vyvoj/roadmapa",
  "/profil", "/hrac/:ja", "/playtest", "/playtest/reporty", "/hraci", "/achievementy/ukazka",
  "/admin", "/admin/karty", "/admin/akcie", "/admin/bodovacie", "/admin/kategorie", "/admin/klucove-slova", "/admin/nastavenia",
  "/admin/obsah", "/admin/sady", "/admin/media", "/admin/import-export", "/admin/tlac", "/admin/zverejnit",
];

const args = process.argv.slice(2);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const sHodnotou = new Set(["--rozlisenia", "--url"]);
// Git Bash (MSYS) prepíše „/pravidla" na „C:/Program Files/Git/pravidla" — vrátime pôvodnú cestu.
const cestaZArg = (a: string): string => {
  const msys = /^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)$/.exec(a);
  const c = msys?.[1] !== undefined ? msys[1].replace(/\\/g, "/") : a;
  return c.startsWith("/") ? c : `/${c}`;
};
const cesty = args.filter((a, i) => !a.startsWith("--") && !sHodnotou.has(args[i - 1] ?? "")).map(cestaZArg);
const rozlisenia = (volba("--rozlisenia") ?? "1920x1080,1440x800,1366x650").split(",").map((r) => {
  const [w, h] = r.split("x").map(Number);
  if (w === undefined || h === undefined || !(w > 0) || !(h > 0)) throw new Error(`Zlé rozlíšenie: ${r}`);
  return { w, h };
});
const zaklad = (volba("--url") ?? process.env.NAEX_WEB_URL ?? "http://localhost:8787").replace(/\/+$/, "");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(zaklad)) throw new Error("Meranie kostry beží len na lokálnom serveri.");
const ucet = await prihlasAgenta(zaklad, "UI inšpektor", "subadmin");

const chrome = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
  .filter((x): x is string => x !== undefined)
  .find((c) => existsSync(c));
if (chrome === undefined) throw new Error("Nenašiel som Chrome ani Edge — nastav CHROME=<cesta>.");
const volnyPort = (): Promise<number> =>
  new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => ok(typeof a === "object" && a !== null ? a.port : 9335));
    });
  });
const pockaj = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

// Beží v prehliadači. Prvky mimo toku (fixed, sticky lišty na mobile, sr-only) hranu neurčujú.
const MERANIE = String.raw`(() => {
  const logo = document.querySelector('.hlavicka .logo');
  const main = document.querySelector('main.obsah');
  if (!logo || !main) return { chyba: 'chýba logo alebo main' };
  let min = Infinity, prvok = '';
  for (const el of main.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.position === 'fixed') continue;
    if (el.closest('[hidden], details:not([open]) > :not(summary), dialog:not([open])')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right <= 0) continue;
    if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') continue;
    if (r.left < min) {
      min = r.left;
      prvok = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    }
  }
  const nadpis = main.querySelector('h1, h2');
  return {
    logo: logo.getBoundingClientRect().left,
    obsah: min === Infinity ? null : min,
    prvok,
    nadpis: nadpis ? nadpis.getBoundingClientRect().left : null,
    stol: document.querySelector('main.obsah > .hra') !== null,
    presah: document.documentElement.scrollWidth > innerWidth + 1,
  };
})()`;

interface Meranie {
  readonly logo?: number;
  readonly obsah?: number | null;
  readonly prvok?: string;
  readonly nadpis?: number | null;
  readonly stol?: boolean;
  readonly presah?: boolean;
  readonly chyba?: string;
}

const cdpPort = await volnyPort();
const prehliadac = spustiChrome(chrome, ["--headless=new", `--remote-debugging-port=${cdpPort}`, "--hide-scrollbars", "about:blank"], "naex-kostra-");
let chyby = 0;
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
  const js = async <T,>(expression: string): Promise<T> => {
    const r = await posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    return (r.result as { value: T }).value;
  };

  await posli("Page.navigate", { url: `${zaklad}/` });
  await pockaj(1500);
  const jaId = await js<number | null>(
    `fetch('/api/prihlasenie',{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify(${JSON.stringify({ login: ucet.login, heslo: ucet.heslo })})})` +
      `.then(()=>fetch('/api/ja')).then(r=>r.json()).then(j=>j.pouzivatel?.id ?? null).catch(()=>null)`,
  );
  const zoznam = (cesty.length > 0 ? cesty : STRANKY).flatMap((c) => (c === "/hrac/:ja" ? (jaId === null ? [] : [`/hrac/${jaId}`]) : [c]));

  for (const { w, h } of rozlisenia) {
    await posli("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    console.log(`\n${w} × ${h}`);
    let hrana: number | null = null;
    for (const cesta of zoznam) {
      await posli("Page.navigate", { url: `${zaklad}${cesta}` });
      await pockaj(1800);
      const m = await js<Meranie>(MERANIE);
      if (m.chyba !== undefined || m.logo === undefined) {
        console.log(`  ✗ ${cesta}: ${m.chyba ?? "nedá sa zmerať"}`);
        chyby++;
        continue;
      }
      if (m.stol === true) {
        console.log(`  · ${cesta}: herný stôl — nemeria sa`);
        continue;
      }
      hrana ??= m.logo;
      const obsah = m.obsah ?? m.logo;
      const ok = Math.abs(m.logo - hrana) < 0.5 && Math.abs(obsah - m.logo) < 0.5 && m.presah !== true;
      if (!ok) chyby++;
      const nadpis = m.nadpis === null || m.nadpis === undefined ? "" : ` · nadpis ${m.nadpis.toFixed(1)}`;
      console.log(`  ${ok ? "✓" : "✗"} ${cesta}: logo ${m.logo.toFixed(1)} · obsah ${obsah.toFixed(1)} (${m.prvok ?? ""})${nadpis}${m.presah === true ? " · VODOROVNÝ PRESAH" : ""}`);
    }
  }
  ws.close();
} finally {
  prehliadac.zastav();
}
console.log(chyby === 0 ? "\nKostra drží: ľavá hrana obsahu = logo na všetkých stránkach." : `\n${chyby} stránok mimo kostry.`);
process.exit(chyby === 0 ? 0 : 1);
