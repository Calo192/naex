// Doplnenie náhľadov obrázkov na webe bez ručného kliku (Michal 2026-10-22).
// Server obrázky zmenšiť nevie (bez knižnice) — robí to prehliadač admina
// tlačidlom „Doplniť náhľady“ v Tvorba → Prehľad. Tento nástroj spustí
// headless Chrome cez DevTools protokol, prihlási ho reláciou agenta (cookie,
// nie heslo cez stránku), klikne na tlačidlo a počká na výsledok.
// Volá ho admin.ts nahlady [--zivy] — po nasadení na živý web.

import { existsSync } from "node:fs";
import { createServer } from "node:net";
import WebSocket from "ws";
import { spustiChrome } from "../docasne.ts";

const pockaj = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

function najdiChrome(): string {
  const kandidati = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter((x): x is string => x !== undefined);
  const chrome = kandidati.find((c) => existsSync(c));
  if (chrome === undefined) throw new Error("Nenašiel som Chrome ani Edge — nastav CHROME=<cesta>.");
  return chrome;
}

function volnyPort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => ok(typeof a === "object" && a !== null ? a.port : 9334));
    });
  });
}

/** Výsledok doplnenia: koľko čakalo, koľko je hotových, text sekcie z Prehľadu. */
export interface VysledokNahladov {
  readonly cakalo: number;
  readonly text: string;
}

/**
 * Otvorí Tvorba → Prehľad na `url` ako prihlásený subadmin (`cookie` = „meno=hodnota“),
 * spustí „Doplniť náhľady“ a počká, kým skončí (najviac `limitMs`).
 */
export async function doplnNahladyCezChrome(url: string, cookie: string, limitMs = 15 * 60_000): Promise<VysledokNahladov> {
  const [meno, ...hodnota] = cookie.split("=");
  if (meno === undefined || hodnota.length === 0) throw new Error("Chýba cookie relácie agenta.");
  const cdpPort = await volnyPort();
  const prehliadac = spustiChrome(najdiChrome(), ["--headless=new", `--remote-debugging-port=${cdpPort}`, "--window-size=1600,1000", "about:blank"], "naex-nahlady-");
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
    const cakajuce = new Map<number, (v: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
    ws.on("message", (d) => {
      const m = JSON.parse(String(d)) as { id?: number; result?: Record<string, unknown>; error?: { message: string } };
      if (m.id !== undefined) cakajuce.get(m.id)?.(m);
    });
    const posli = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((ok, chyba) => {
        id += 1;
        cakajuce.set(id, (m) => (m.error !== undefined ? chyba(new Error(`${method}: ${m.error.message}`)) : ok(m.result ?? {})));
        ws.send(JSON.stringify({ id, method, params }));
      });
    const js = async <T>(expression: string): Promise<T> => {
      const r = await posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      const vynimka = r.exceptionDetails as { exception?: { description?: string } } | undefined;
      if (vynimka !== undefined) throw new Error(vynimka.exception?.description ?? "chyba v stránke");
      return (r.result as { value: T }).value;
    };

    await posli("Network.enable");
    await posli("Network.setCookie", { name: meno, value: hodnota.join("="), url });
    await posli("Page.navigate", { url: `${url}/admin` });
    for (let i = 0; i < 60; i++) {
      await pockaj(500);
      const nacitane = await js<boolean>(`location.href.startsWith(${JSON.stringify(url)}) && document.readyState === 'complete'`);
      if (nacitane) break;
    }

    // Sekcia sa ukáže až po načítaní zoznamu bez náhľadu; bez veľkých obrázkov nie je.
    const cakalo = await js<number>(
      `fetch('/api/admin/media-bez-nahladu').then((r) => { if (!r.ok) throw new Error('media-bez-nahladu: ' + r.status); return r.json(); }).then((r) => r.media.length)`,
    );
    if (cakalo === 0) return { cakalo, text: "Všetky veľké obrázky už náhľad majú." };
    const sekcia = `[...document.querySelectorAll('main section')].find((s) => s.querySelector('h2')?.textContent === 'Náhľady obrázkov')`;
    let klik = "";
    for (let i = 0; i < 60 && klik !== "ok"; i++) {
      await pockaj(500);
      klik = await js<string>(`(() => { const s = ${sekcia}; const b = s?.querySelector('button'); if (!b || b.disabled) return 'caka'; b.click(); return 'ok'; })()`);
    }
    if (klik !== "ok") throw new Error("Tlačidlo „Doplniť náhľady“ sa v Tvorba → Prehľad neukázalo.");
    const koniec = Date.now() + limitMs;
    let text = "";
    let posledny = "";
    while (Date.now() < koniec) {
      await pockaj(2000);
      text = await js<string>(`(${sekcia})?.innerText.replace(/\\n+/g, ' ') ?? ''`);
      const priebeh = /Robím náhľady… (\d+\/\d+)/.exec(text)?.[1];
      if (priebeh === undefined) break;
      if (priebeh !== posledny) console.error(`(náhľady ${priebeh})`);
      posledny = priebeh;
    }
    ws.close();
    return { cakalo, text };
  } finally {
    prehliadac.zastav();
  }
}
