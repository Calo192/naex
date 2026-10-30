// Prejde výučbu „Prvá hra“ v skutočnom klientovi (headless Chrome) — kontrola pre
// programátora po zmene scenára či UI výučby: každý krok sa vykreslí, kľúče
// zvýraznenia zo scenára musia na stole niečo rozsvietiť, tiché kroky (bot, auto
// bez textu) musia prejsť bez kliku a konce častí ukážu ponuku ďalšej časti.
//
//   node --experimental-strip-types --no-warnings tools/vyucba/v-prehliadaci.ts --url http://localhost:5173 \
//        --login Admin --heslo <heslo> [--sirka 1440] [--vyska 800] [--do-casti 3] [--foto id,id] [--vystup priečinok]
//
// Bez --login si založí nový účet návštevníka (časti s textami na schválenie neuvidí).
// Info kroky a kvízy kliká v bubline (kvíz skúša možnosti po poradí — aj zlá odpoveď
// a jej hláška), ťah hráča pošle cez WebSocket stránky príkaz, ktorý krok čaká (myšou
// ho hrá playtest výučby, tools/playtest/vyucba.ts). Na začiatku každej časti raz
// pošle zlý ťah — overí radu a hlášku pri chybe. Snímky: koniec každej časti,
// začiatok ďalšej, lobby s „Pokračovať vo výučbe“; výpis do <vystup>/priebeh.json.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import WebSocket from "ws";
import { spustiChrome } from "../docasne.ts";

const args = process.argv.slice(2);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const zaklad = volba("--url") ?? "http://localhost:5173";
const sirka = Number(volba("--sirka") ?? "1440");
const vyska = Number(volba("--vyska") ?? "800");
const vystup = volba("--vystup") ?? join("playtest", "vyucba-prehliadac");
const castDo = Number(volba("--do-casti") ?? "3");
/** Kroky, ktoré odfotiť navyše (id oddelené čiarkou). */
const fotoKrokov = new Set((volba("--foto") ?? "").split(",").filter((x) => x !== ""));
mkdirSync(vystup, { recursive: true });

const chrome = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
  .filter((x): x is string => x !== undefined)
  .find((c) => existsSync(c));
if (chrome === undefined) throw new Error("Nenašiel som Chrome ani Edge — nastav CHROME=<cesta>.");

const volnyPort = (): Promise<number> =>
  new Promise((ok) => {
    const s = createServer();
    s.listen(0, () => {
      const a = s.address();
      s.close(() => ok(typeof a === "object" && a !== null ? a.port : 9334));
    });
  });
const pockaj = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

/** Zachytí WebSocket stránky: posledný krok výučby, chyby a hlášky pri chybe. */
const SPION = `(() => {
  const W = window.WebSocket;
  window.__naex = { ws: null, vyucba: null, chyby: [], hlasky: [], rady: [] };
  window.WebSocket = class extends W {
    constructor(...a) {
      super(...a);
      window.__naex.ws = this;
      this.addEventListener("message", (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "vyucba") window.__naex.vyucba = m;
          if (m.type === "error") window.__naex.chyby.push(m.text);
          if (m.type === "vyucbaRada") window.__naex.rady.push(m.text);
          if ((m.type === "vyucbaChyba" || m.type === "vyucbaRada" || m.type === "vyucbaHlaska") && m.hlaska) window.__naex.hlasky.push(m.type + ":" + m.hlaska);
        } catch {}
      });
    }
  };
})();`;

/** Ako prvkyKluca vo Vyucba.tsx: prvky kľúča a či svietia. */
const STAV_KLUCOV = `(kluce) => kluce.map((k) => {
  let els = [];
  if (k === "spoje-lokality") els = [...document.querySelectorAll(".linia .linia-skupina.lokalita .kl-slot.kl-aktivna")];
  else {
    els = [...document.querySelectorAll('[data-vyucba="' + k + '"]')];
    if (els.length === 0 && k === "bitka-ucet") els = [...document.querySelectorAll(".jbar-odhad")];
    if (els.length === 0 && k.includes(":")) {
      const z = k.slice(0, k.indexOf(":")), id = k.slice(k.indexOf(":") + 1);
      els = [...document.querySelectorAll('[data-vyucba="' + z + '"] [data-vyucba-karta="' + id + '"], [data-vyucba="' + z + '"] [data-vyucba-prvok="' + id + '"]')];
    }
  }
  const lit = els.some((e) => e.hasAttribute("data-vyucba-zvyraznene") || e.querySelector("[data-vyucba-zvyraznene]") !== null || e.closest("[data-vyucba-zvyraznene]") !== null);
  return [k, els.length, lit];
})`;

interface Krok {
  readonly index: number;
  readonly id: string;
  readonly kto: "hrac" | "bot" | "info" | "auto" | "otazka";
  readonly vykonany: boolean;
  readonly melichar: string;
  readonly zvyraznit: readonly string[];
  readonly ocakava: unknown;
  readonly naneisto: boolean;
  readonly cast: { readonly cast: number; readonly poradie: number; readonly krokov: number };
}
interface SpravaVyucby {
  readonly krok: Krok | null;
  readonly hotovo: boolean;
  readonly koniecCasti: number | null;
  readonly dalsiaCast: { cast: number } | null;
  readonly pripravujeme: { cast: number } | null;
}

const cdpPort = await volnyPort();
const prehliadac = spustiChrome(chrome, ["--headless=new", `--remote-debugging-port=${cdpPort}`, `--window-size=${sirka},${vyska}`, "--hide-scrollbars", "--autoplay-policy=no-user-gesture-required", "about:blank"], "naex-vyucba-");
const priebeh: Record<string, unknown>[] = [];
const snimky: string[] = [];
const chybyStranky: string[] = [];
try {
  let ciel: { type: string; webSocketDebuggerUrl: string } | undefined;
  for (let i = 0; i < 40 && ciel === undefined; i++) {
    await pockaj(250);
    try {
      ciel = ((await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[]).find((t) => t.type === "page");
    } catch {
      // Chrome ešte štartuje
    }
  }
  if (ciel === undefined) throw new Error("Chrome sa nespustil.");
  const cdp = new WebSocket(ciel.webSocketDebuggerUrl);
  await new Promise((ok) => cdp.on("open", ok));
  let id = 0;
  const cakajuce = new Map<number, (v: Record<string, unknown>) => void>();
  cdp.on("message", (d) => {
    const m = JSON.parse(String(d)) as { id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown> };
    if (m.id !== undefined) cakajuce.get(m.id)?.(m.result ?? {});
    if (m.method === "Runtime.exceptionThrown") chybyStranky.push(JSON.stringify((m.params?.exceptionDetails as { exception?: { description?: string } })?.exception?.description ?? m.params));
    if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") chybyStranky.push(JSON.stringify(m.params.args).slice(0, 400));
  });
  const posli = (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> =>
    new Promise((ok) => {
      id += 1;
      cakajuce.set(id, ok);
      cdp.send(JSON.stringify({ id, method, params }));
    });
  const js = async <T>(expression: string): Promise<T> =>
    ((await posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result as { value?: T } | undefined)?.value as T;
  const foto = async (nazov: string): Promise<void> => {
    await pockaj(700);
    const r = await posli("Page.captureScreenshot", { format: "png" });
    const subor = join(vystup, `${nazov}-${sirka}x${vyska}.png`);
    writeFileSync(subor, Buffer.from(String(r.data), "base64"));
    snimky.push(subor);
  };
  const sprava = (): Promise<SpravaVyucby | null> => js<SpravaVyucby | null>("window.__naex?.vyucba ?? null");
  const posliWs = (msg: unknown): Promise<unknown> => js(`window.__naex.ws.send(${JSON.stringify(JSON.stringify(msg))})`);
  const klik = (selektor: string): Promise<boolean> => js<boolean>(`(() => { const b = document.querySelector(${JSON.stringify(selektor)}); if (!b || b.disabled) return false; b.click(); return true; })()`);
  /**
   * Medziobrazovky a Počítadlá (bitka, Pitka) zatvára hráč klikom — inak výučba čaká. Vráti, či niečo zavrel.
   * Lokalita súpera (.medziobrazovka.lokalita-supera) má „Rozumiem“ až po 3 s — dovtedy nie je čo kliknúť
   * a ďalšie kolo slučky ho chytí; vo výučbe ju Melichar zatiaľ neukazuje, lokalitu vyberá vždy hráč.
   */
  const zavriVrstvy = (): Promise<boolean> =>
    js<boolean>(`(() => {
      const b = document.querySelector(".medziobrazovka button, .rk-dalej");
      if (b) { b.click(); return true; }
      const p = document.querySelector(".pocitadlo-bitky:not(.hotova)");
      if (p) { p.click(); return true; }
      return false;
    })()`);
  let zavrete = 0;
  /** Čaká, kým sa krok zmení (alebo časť skončí); vráti novú správu, null pri vypršaní. */
  const cakajNaZmenu = async (pred: SpravaVyucby | null, ms = 8_000): Promise<SpravaVyucby | null> => {
    const koniec = Date.now() + ms;
    while (Date.now() < koniec) {
      await pockaj(150);
      if (await zavriVrstvy()) zavrete++;
      const s = await sprava();
      if (s !== null && (s.krok?.index !== pred?.krok?.index || s.krok?.vykonany !== pred?.krok?.vykonany || s.hotovo !== pred?.hotovo)) return s;
    }
    return null;
  };

  await posli("Runtime.enable");
  await posli("Page.enable");
  await posli("Page.addScriptToEvaluateOnNewDocument", { source: SPION });
  await posli("Emulation.setDeviceMetricsOverride", { width: sirka, height: vyska, deviceScaleFactor: 1, mobile: false });
  await posli("Page.navigate", { url: `${zaklad}/` });
  await pockaj(1500);
  const login = volba("--login");
  const prihlasenie =
    login === undefined
      ? { cesta: "/api/registracia", telo: { login: `vyucba${Date.now() % 1_000_000}`, heslo: "tajneheslo", meno: "Skúška výučby" } }
      : { cesta: "/api/prihlasenie", telo: { login, heslo: volba("--heslo") ?? "" } };
  const stav = await js<number>(
    `fetch(${JSON.stringify(prihlasenie.cesta)},{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:${JSON.stringify(JSON.stringify(prihlasenie.telo))}}).then(r=>r.status)`,
  );
  if (stav !== 200 && stav !== 201) throw new Error(`Prihlásenie zlyhalo (${stav}).`);
  await js("fetch('/api/vyucba/znova',{method:'POST',headers:{'x-naex':'1'}}).then(r=>r.status)");
  await posli("Page.navigate", { url: `${zaklad}/hra` });
  await pockaj(3000);
  if (!(await klik('[data-vyucba-vstup="zacat"]'))) throw new Error("V lobby nie je tlačidlo „Začať výučbu“.");

  let s = await cakajNaZmenu(null, 10_000);
  let zlyTahVCasti = 0;
  for (let n = 0; n < 1_000 && s !== null; n++) {
    if (s.hotovo || s.krok === null) {
      const cast = s.koniecCasti ?? 0;
      priebeh.push({ koniecCasti: cast, dalsia: s.dalsiaCast, pripravujeme: s.pripravujeme });
      // Dlhší text listuje „ďalej“; ponuka ďalšej časti je až na poslednej strane.
      for (let k = 0; k < 15 && !(await js<boolean>("!!document.querySelector('[data-vyucba-koniec]')")); k++) {
        await klik("[data-vyucba-dalej]");
        await pockaj(300);
      }
      await foto(`koniec-casti-${cast}`);
      if (s.dalsiaCast === null && s.pripravujeme === null) break;
      // Po 2. časti (a po poslednej žiadanej) cez lobby: „Pokračovať vo výučbe“ spustí ďalšiu časť od začiatku.
      if (cast === 2 || cast >= castDo || s.dalsiaCast === null) {
        await klik("[data-vyucba-koniec] ~ button");
        await pockaj(2500);
        await foto(`lobby-pokracovat-${cast + 1}`);
        if (cast >= castDo || s.dalsiaCast === null) break;
        if (!(await klik('[data-vyucba-vstup="pokracovat"]'))) throw new Error("V lobby nie je „Pokračovať vo výučbe“.");
        await js("window.__naex.vyucba = null");
        s = await cakajNaZmenu(null, 15_000);
      } else {
        if (!(await klik("[data-vyucba-dalsia-cast]"))) throw new Error("Na konci časti nie je „Pokračovať ďalšou časťou“.");
        s = await cakajNaZmenu(s, 10_000);
      }
      if (s?.krok !== null && s?.krok !== undefined) await foto(`zaciatok-casti-${s.krok.cast.cast}`);
      continue;
    }
    const krok = s.krok;
    // Zvýraznenie sa dopočíta každých 200 ms — počkať, potom porovnať s kľúčmi kroku.
    const kontrola = krok.kto === "hrac" || krok.kto === "info" || krok.kto === "otazka" || krok.vykonany;
    await pockaj(kontrola ? 600 : 100);
    for (let v = 0; v < 6 && (await zavriVrstvy()); v++) {
      zavrete++;
      await pockaj(400);
    }
    const zaznam: Record<string, unknown> = { i: krok.index, id: krok.id, kto: krok.kto, cast: krok.cast.cast };
    if (kontrola) {
      // Kľúč sedí, keď jeho prvok svieti, alebo leží v svietiacom či ho obsahuje (zóna s presnejším
      // zvýraznením ostáva v tieni); neznámy = klient preň nemá na stole žiadny prvok.
      const kluce = krok.zvyraznit.filter((k) => !k.startsWith("uid:"));
      const stav = await js<[string, number, boolean][]>(`(${STAV_KLUCOV})(${JSON.stringify(kluce)})`);
      const nezname = stav.filter(([, n]) => n === 0).map(([k]) => k);
      const nesvieti = stav.filter(([, n, lit]) => n > 0 && !lit).map(([k]) => k);
      if (nezname.length > 0) zaznam.nezname = nezname;
      if (nesvieti.length > 0) zaznam.nesvieti = nesvieti;
    }
    priebeh.push(zaznam);
    if (kontrola && fotoKrokov.has(krok.id)) await foto(`krok-${krok.id}`);

    if (krok.kto === "hrac") {
      if (zlyTahVCasti !== krok.cast.cast) {
        zlyTahVCasti = krok.cast.cast;
        const hlasok = await js<number>("window.__naex.hlasky.length");
        await posliWs({ type: "cmd", cmd: { type: "pass" } });
        await pockaj(800);
        const nove = await js<string[]>(`window.__naex.hlasky.slice(${hlasok})`);
        zaznam.zlyTah = nove;
        await foto(`zly-tah-cast-${krok.cast.cast}`);
      }
      await posliWs({ type: "cmd", cmd: krok.ocakava });
    } else if (krok.kto === "otazka") {
      // Možnosti po poradí: zlá → späť na otázku, kým nepríde správna; potom ďalej.
      const pocet = await js<number>("document.querySelectorAll('.vyucba-moznost').length");
      for (let m = 0; m < pocet; m++) {
        await js(`document.querySelectorAll('.vyucba-moznost')[${m}]?.click()`);
        await pockaj(400);
        if (await js<boolean>("!!document.querySelector('.kviz-odpoved.spravna')")) break;
        await klik("[data-vyucba-spat]");
        await pockaj(250);
      }
      for (let k = 0; k < 20 && (await sprava())?.krok?.index === krok.index; k++) {
        await klik("[data-vyucba-dalej]");
        await pockaj(350);
      }
    } else if (krok.kto === "info" || krok.vykonany) {
      for (let k = 0; k < 20 && (await sprava())?.krok?.index === krok.index && (await sprava())?.krok?.vykonany === krok.vykonany; k++) {
        await klik("[data-vyucba-dalej]");
        await pockaj(350);
      }
    } else if (krok.melichar.trim() === "") {
      // Tichý ťah bota či hry za hráča: musí prejsť sám, bez kliku.
      zaznam.ticho = true;
    }
    const dalsi = await cakajNaZmenu(s, 10_000);
    if (dalsi === null) {
      zaznam.zaseknute = true;
      await foto(`zaseknute-${krok.id}`);
      break;
    }
    s = dalsi;
  }
  const chybyServera = await js<string[]>("window.__naex.chyby");
  const hlasky = await js<string[]>("window.__naex.hlasky");
  writeFileSync(join(vystup, "priebeh.json"), JSON.stringify({ priebeh, snimky, chybyStranky, chybyServera, hlasky }, null, 2));
  const nesvieti = priebeh.filter((p) => p.nesvieti !== undefined || p.nezname !== undefined);
  const zaseknute = priebeh.filter((p) => p.zaseknute === true);
  console.log(`Krokov ${priebeh.filter((p) => p.i !== undefined).length}, tichých ${priebeh.filter((p) => p.ticho === true).length}, zaseknutých ${zaseknute.length}, s nesvietiacim kľúčom ${nesvieti.length}.`);
  for (const p of nesvieti) console.log(`  ${String(p.id)}: ${p.nezname === undefined ? "" : `NEZNÁME ${JSON.stringify(p.nezname)} `}${p.nesvieti === undefined ? "" : `nesvieti ${JSON.stringify(p.nesvieti)}`}`);
  for (const p of zaseknute) console.log(`  ZASEKNUTÉ ${String(p.id)}`);
  console.log(`Konce častí: ${JSON.stringify(priebeh.filter((p) => p.koniecCasti !== undefined))}`);
  console.log(`Zavreté vrstvy: ${zavrete}. Hlášky pri chybe: ${hlasky.length}, chyby servera ${chybyServera.length}, chyby stránky ${chybyStranky.length}.`);
  for (const c of chybyStranky.slice(0, 10)) console.log(`  STRÁNKA ${c}`);
  console.log(`Snímky: ${snimky.join(", ")}`);
} finally {
  prehliadac.zastav();
}
