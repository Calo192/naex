// Spoločné ovládanie headless Chromu pre playtesty v prehliadači (výučba vyucba.ts,
// mobilný stôl mobil.ts): Chrome beží celú reláciu na pozadí, príkazy sa k nemu
// pripájajú cez DevTools protokol a po akcii sa odpoja.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import WebSocket from "ws";
import { zmazPriecinok } from "../docasne.ts";

export const pockaj = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export function volnyPort(od: number): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.once("error", () => ok(volnyPort(od + 1)));
    s.listen(od, () => s.close(() => ok(od)));
  });
}

export function nahodnyPort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => ok(typeof a === "object" && a !== null ? a.port : 9335));
    });
  });
}

export const chrome = (): string => {
  const c = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
    .filter((x): x is string => x !== undefined)
    .find((x) => existsSync(x));
  if (c === undefined) throw new Error("Nenašiel som Chrome ani Edge — nastav CHROME=<cesta>.");
  return c;
};

/**
 * Profil prehliadača nie je záznam playtestu — po zastavení sa zmaže
 * (Leader 2026-10-23: profily Chromu zaplnili disk). Chrome ho ešte chvíľu drží.
 */
export function zmazProfil(dir: string): void {
  // Ak ostane zamknutý, je v priečinku relácie (mimo %TEMP%).
  zmazPriecinok(join(dir, "chrome"), 20);
}

/** Chrome spúšťa podprocesy — zastaviť treba celý strom. */
export function zabi(pid: number): void {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(pid);
    } catch {
      // už nebeží
    }
  }
}

/** Git Bash (MSYS) prepíše „/hra“ na „C:/Program Files/Git/hra“ — vráti pôvodnú cestu webu. */
export function cestaWebu(a: string | undefined): string {
  const c = (a ?? "/").replace(/^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)$/, "$1").replace(/\\/g, "/");
  return c.startsWith("/") ? c : `/${c}`;
}

// ---- DevTools protokol ---------------------------------------------------------

export interface Cdp {
  posli(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  js<T>(expression: string): Promise<T>;
  naUdalost(f: (method: string, params: Record<string, unknown>) => void): void;
  zavri(): void;
  readonly koniec: Promise<void>;
}

export async function pripojCdp(cdpPort: number): Promise<Cdp> {
  let ciel: { type: string; webSocketDebuggerUrl: string } | undefined;
  for (let i = 0; i < 60 && ciel === undefined; i++) {
    try {
      const ciele = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[];
      ciel = ciele.find((t) => t.type === "page");
    } catch {
      // Chrome ešte štartuje
    }
    if (ciel === undefined) await pockaj(250);
  }
  if (ciel === undefined) throw new Error(`Prehliadač na porte ${cdpPort} nebeží — založ playtest znova.`);
  const ws = new WebSocket(ciel.webSocketDebuggerUrl);
  await new Promise((ok, zle) => {
    ws.once("open", ok);
    ws.once("error", zle);
  });
  let poradie = 0;
  const cakajuce = new Map<number, (v: { result?: Record<string, unknown>; error?: { message: string } }) => void>();
  const posluchaci: ((method: string, params: Record<string, unknown>) => void)[] = [];
  ws.on("message", (d) => {
    const m = JSON.parse(String(d)) as { id?: number; result?: Record<string, unknown>; error?: { message: string }; method?: string; params?: Record<string, unknown> };
    if (m.id !== undefined) cakajuce.get(m.id)?.(m);
    else if (m.method !== undefined) for (const f of posluchaci) f(m.method, m.params ?? {});
  });
  const koniec = new Promise<void>((ok) => ws.once("close", () => ok()));
  const posli = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((ok, zle) => {
      poradie += 1;
      const cislo = poradie;
      const casovac = setTimeout(() => {
        cakajuce.delete(cislo);
        zle(new Error(`${method}: bez odpovede 30 s`));
      }, 30_000);
      cakajuce.set(cislo, (v) => {
        clearTimeout(casovac);
        cakajuce.delete(cislo);
        if (v.error !== undefined) zle(new Error(`${method}: ${v.error.message}`));
        else ok(v.result ?? {});
      });
      ws.send(JSON.stringify({ id: cislo, method, params }));
    });
  const js = async <T>(expression: string): Promise<T> => {
    const r = await posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails !== undefined) throw new Error(`Skript v stránke zlyhal: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return (r.result as { value?: T } | undefined)?.value as T;
  };
  return { posli, js, naUdalost: (f) => posluchaci.push(f), zavri: () => ws.close(), koniec };
}
