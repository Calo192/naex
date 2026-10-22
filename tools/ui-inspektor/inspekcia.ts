// UI inšpekcia webu NA EX! — headless Chrome prejde stránky a priamo v nich
// zmeria UI chyby: orezaný a prekrytý text, nezarovnané ikony, prekryvy,
// vodorovný presah, malé klikacie ciele, chýbajúci fokus, nízky kontrast,
// chyby v konzole, rozbité obrázky a pomalé načítanie. Výsledok je JSON
// s nálezmi a výrezy snímok — overí ich a report napíše agent naex-ui-inspektor.
//
//   node --experimental-strip-types --no-warnings tools/ui-inspektor/inspekcia.ts [cesta …] [--rozlisenia 1600x1000,1920x1080]
//        [--url http://localhost:8793] [--relacia R --hrac 1] [--klik selektor]… [--stav nazov] [--vystup priečinok]
//
// Bez ciest prejde všetky stránky (STRANKY nižšie, aj admin); /hra s --relacia
// odfotí partiu daného hráča (relácia z tools/playtest/zaloz.ts), inak lobby.
// --klik klikne pred meraním na prvok (dá sa zopakovať), --stav pomenuje stav
// stránky v nálezoch (napr. „pitka“). Michal 2026-10-22: len lokálny server —
// na iný než localhost odmietne ísť bez --aj-zivy.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import { prihlasAgenta } from "../playtest/web.ts";

/** Všetky stránky webu (apps/web/src/App.tsx a admin/). /hrac/:id sa doplní podľa účtu. */
const STRANKY = [
  "/", "/pravidla", "/karty", "/novinky", "/hra", "/rebricek", "/spatna-vazba", "/vyvoj", "/vyvoj/roadmapa",
  "/profil", "/prihlasenie", "/registracia", "/playtest", "/playtest/reporty", "/hraci",
  "/admin", "/admin/karty", "/admin/karty/nova", "/admin/akcie", "/admin/bodovacie", "/admin/kategorie",
  "/admin/klucove-slova", "/admin/nastavenia", "/admin/obsah", "/admin/sady", "/admin/media",
  "/admin/import-export", "/admin/tlac", "/admin/zverejnit",
];

const args = process.argv.slice(2);
const volba = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i < 0 ? undefined : args[i + 1];
};
const sHodnotou = new Set(["--rozlisenia", "--url", "--relacia", "--hrac", "--klik", "--stav", "--vystup"]);
// Git Bash (MSYS) prepíše „/pravidla" na „C:/Program Files/Git/pravidla" — vrátime pôvodnú cestu.
const cestaZArg = (a: string): string => {
  const msys = /^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)$/.exec(a);
  const c = msys?.[1] !== undefined ? msys[1].replace(/\\/g, "/") : a;
  return c.startsWith("/") ? c : `/${c}`;
};
const cesty = args.filter((a, i) => !a.startsWith("--") && !sHodnotou.has(args[i - 1] ?? "")).map(cestaZArg);
const relacia = volba("--relacia");
const hrac = volba("--hrac") ?? "1";
const kliky = args.flatMap((a, i) => (args[i - 1] === "--klik" ? [a] : []));
const stav = volba("--stav") ?? (kliky.length > 0 ? "klik" : "zaklad");
const rozlisenia = (volba("--rozlisenia") ?? "1600x1000,1920x1080").split(",").map((r) => {
  const [w, h] = r.split("x").map(Number);
  if (w === undefined || h === undefined || !(w > 0) || !(h > 0)) throw new Error(`Zlé rozlíšenie: ${r}`);
  return { w, h };
});
const id = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const vystup = volba("--vystup") ?? join("playtest", "ui-inspektor", id);
mkdirSync(vystup, { recursive: true });

// Kam a za koho: hráč partie (relácia playtestu), inak AI účet so subadminom na webe.
let zaklad: string;
let prihlasenie: { login: string; heslo: string };
let miestnost: string | null = null;
if (relacia !== undefined) {
  const hra = JSON.parse(readFileSync(join(relacia, "hra.json"), "utf8")) as { port: number; kod: string; hraci: { login: string; heslo: string }[] };
  const ucet = hra.hraci[Number(hrac) - 1];
  if (ucet === undefined) throw new Error(`Relácia nemá hráča ${hrac}.`);
  zaklad = `http://localhost:${hra.port}`;
  prihlasenie = ucet;
  miestnost = hra.kod;
} else {
  zaklad = (volba("--url") ?? process.env.NAEX_WEB_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(zaklad) && !args.includes("--aj-zivy")) {
    throw new Error("Inšpekcia beží len na lokálnom serveri (Michal 2026-10-22). Živý web len s --aj-zivy.");
  }
  const ucet = await prihlasAgenta(zaklad, "UI inšpektor", "subadmin");
  prihlasenie = { login: ucet.login, heslo: ucet.heslo };
}
const zoznam = cesty.length > 0 ? cesty : relacia !== undefined ? ["/hra"] : STRANKY;

// ---- Chrome cez DevTools protokol -------------------------------------------------

const chrome = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
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
const pockaj = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const cdpPort = await volnyPort();
const profil = mkdtempSync(join(tmpdir(), "naex-inspekcia-"));
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profil}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

interface Nalez {
  typ: string;
  zavaznost: "vysoka" | "stredna" | "nizka";
  selektor: string;
  text: string;
  box: { x: number; y: number; w: number; h: number };
  detail: string;
  vyrez?: string;
  pocet?: number;
}
interface Vysledok {
  cesta: string;
  stav: string;
  rozlisenie: string;
  snimka: string;
  nacitanieMs: number;
  nalezy: Nalez[];
}

// Meranie v stránke — beží v prehliadači, preto ako text. Vracia nálezy so súradnicami
// na celej stránke (box) — z nich sa potom robia výrezy.
const MERANIE = String.raw`(async () => {
  const W = innerWidth, H = innerHeight, nalezy = [];
  const viditelny = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
    // Obsah zatvoreného <details> sa nevykreslí, hoci má rozmery.
    const zatvoreny = el.closest('details:not([open])');
    if (zatvoreny && !el.closest('summary')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const popis = (el) => {
    const casti = [];
    for (let e = el, i = 0; e && e !== document.body && i < 4; e = e.parentElement, i++) {
      let p = e.tagName.toLowerCase();
      if (e.id) p += '#' + e.id;
      const cls = [...e.classList].slice(0, 3);
      if (cls.length) p += '.' + cls.join('.');
      casti.unshift(p);
    }
    return casti.join(' > ');
  };
  const text = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 90);
  const box = (r) => ({ x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  const pridaj = (typ, zavaznost, el, detail, r) => nalezy.push({ typ, zavaznost, selektor: popis(el), text: text(el), box: box(r || el.getBoundingClientRect()), detail });
  const vsetky = [...document.body.querySelectorAll('*')].filter(viditelny);
  const maText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const skryva = (s) => /hidden|clip/.test(s.overflowX + ' ' + s.overflowY);
  const natoceny = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const t = getComputedStyle(e).transform;
      const m = /matrix\(([^)]+)\)/.exec(t);
      if (m) { const [, b, c] = m[1].split(',').map(Number); if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) return true; }
      if (/matrix3d|rotate/.test(t)) return true;
    }
    return false;
  };
  const plavajuci = (el) => {
    for (let e = el; e; e = e.parentElement) if (/fixed|sticky/.test(getComputedStyle(e).position)) return true;
    return false;
  };

  // 1. Orezaný text: obsah je väčší než box so skrytým pretečením, alebo text vytŕča z predka, ktorý ho skryje.
  for (const el of vsetky.filter(maText)) {
    const s = getComputedStyle(el);
    const sirsi = el.scrollWidth > el.clientWidth + 1, vyssi = el.scrollHeight > el.clientHeight + 1;
    if ((sirsi || vyssi) && (skryva(s) || s.textOverflow === 'ellipsis')) {
      const trojbodka = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none');
      pridaj(trojbodka ? 'skrateny-text' : 'orezany-text', trojbodka ? 'nizka' : 'vysoka', el,
        'obsah ' + el.scrollWidth + '×' + el.scrollHeight + ' px, box ' + el.clientWidth + '×' + el.clientHeight + ' px' + (trojbodka ? ', trojbodka' : ''));
      continue;
    }
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/auto|scroll/.test(ps.overflowX + ' ' + ps.overflowY)) break;
      if (!skryva(ps)) continue;
      const pr = p.getBoundingClientRect();
      const presah = Math.max(pr.left - r.left, r.right - pr.right, pr.top - r.top, r.bottom - pr.bottom);
      if (presah > 2 && presah < r.height + r.width) pridaj('orezany-text', 'vysoka', el, 'text vytŕča o ' + Math.round(presah) + ' px z ' + popis(p) + ', ktorý pretečenie skrýva');
      break;
    }
  }

  // 2. Vodorovný presah stránky a prvky mimo okna (len najvonkajší prvok).
  const sirka = document.documentElement.scrollWidth;
  if (sirka > W + 1) nalezy.push({ typ: 'vodorovny-posun', zavaznost: 'vysoka', selektor: 'html', text: '', box: { x: 0, y: 0, w: sirka, h: 40 }, detail: 'stránka je široká ' + sirka + ' px pri okne ' + W + ' px' });
  const mimo = new Set();
  for (const el of vsetky) {
    const r = el.getBoundingClientRect();
    if (r.right <= W + 1 && r.left >= -1) continue;
    let orezany = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/hidden|clip|auto|scroll/.test(ps.overflowX)) { orezany = true; break; }
    }
    if (orezany || (el.parentElement && mimo.has(el.parentElement))) { mimo.add(el); continue; }
    mimo.add(el);
    pridaj('mimo-okna', 'stredna', el, 'prvok siaha ' + (r.left < -1 ? 'za ľavý okraj (' + Math.round(r.left) + ' px)' : 'za pravý okraj o ' + Math.round(r.right - W) + ' px'));
  }

  // 3. Interaktívne prvky: prekrytie (elementFromPoint po obrazovkách) a malé ciele.
  const INTERAKTIVNE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=checkbox],[tabindex]:not([tabindex="-1"])';
  const interaktivne = [...document.querySelectorAll(INTERAKTIVNE)].filter(viditelny).filter((el) => !el.disabled);
  for (const el of interaktivne) {
    const r = el.getBoundingClientRect();
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
    // Políčko s popisom: cieľom je celý label (klik naň prepne políčko).
    const label = el.closest('label') || (el.id ? document.querySelector('label[for="' + el.id + '"]') : null);
    const lr = label ? label.getBoundingClientRect() : null;
    const velkyLabel = lr !== null && lr.width >= 24 && lr.height >= 24;
    if (!inline && !velkyLabel && (r.width < 24 || r.height < 24) && !el.closest('[aria-hidden=true]')) pridaj('maly-ciel', 'stredna', el, 'klikací cieľ ' + Math.round(r.width) + '×' + Math.round(r.height) + ' px (WCAG 2.5.8: aspoň 24×24)');
  }
  const vyskaStranky = document.documentElement.scrollHeight;
  const skontrolovane = new Set();
  // scroll-behavior: smooth by meranie posunul, kým sa stránka ešte hýbe.
  document.documentElement.style.scrollBehavior = 'auto';
  for (let y = 0; y < vyskaStranky; y += Math.max(200, Math.round(H * 0.8))) {
    scrollTo({ top: y, behavior: 'instant' });
    await new Promise((ok) => setTimeout(ok, 120));
    for (const el of interaktivne) {
      if (skontrolovane.has(el)) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cy < 0 || cy > H || cx < 0 || cx > W) continue;
      skontrolovane.add(el);
      const zakryva = (x, y) => {
        const hore = document.elementFromPoint(x, y);
        if (!hore || el.contains(hore) || hore.contains(el)) return null;
        // Label nad vlastným inputom a podobné väzby nie sú prekryv.
        if (hore.closest('label') && hore.closest('label').contains(el)) return null;
        return hore;
      };
      let hore = zakryva(cx, cy);
      // Lepiaca lišta zakryje, čo pod ňu práve doroluje — chyba je to, len ak prvok zakrýva aj v strede okna.
      if (hore && plavajuci(hore)) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        await new Promise((ok) => setTimeout(ok, 80));
        const r2 = el.getBoundingClientRect();
        hore = zakryva(r2.left + r2.width / 2, r2.top + r2.height / 2);
        scrollTo({ top: y, behavior: 'instant' });
      }
      if (!hore) continue;
      pridaj('prekryty-prvok', 'vysoka', el, 'stred prvku zakrýva ' + popis(hore) + (text(hore) ? ' („' + text(hore).slice(0, 40) + '“)' : ''), r);
      nalezy[nalezy.length - 1].box = { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    }
  }
  scrollTo({ top: 0, behavior: 'instant' });
  await new Promise((ok) => setTimeout(ok, 150));

  // 4. Prekrývajúci sa text: listové textové prvky, ktorých riadky (getClientRects — inline text
  // má obdĺžnik na každý riadok) sa pretínajú. Natočené prvky (vejár kariet) a lepiace či pevné
  // vrstvy (hlavička) sa prekrývajú zámerne, tie sa vynechajú.
  const listy = vsetky.filter(maText).filter((el) => el.children.length === 0 || [...el.children].every((c) => !maText(c)))
    .filter((el) => !natoceny(el) && !plavajuci(el)).slice(0, 1500);
  const rr = listy.map((el) => [...el.getClientRects()].filter((r) => r.width > 1 && r.height > 1));
  for (let i = 0; i < listy.length; i++) {
    for (let j = i + 1; j < listy.length; j++) {
      if (listy[i].contains(listy[j]) || listy[j].contains(listy[i])) continue;
      let zasah = null;
      for (const a of rr[i]) for (const b of rr[j]) {
        const sx = Math.min(a.right, b.right) - Math.max(a.left, b.left), sy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (sx > 2 && sy > 2 && sx * sy >= Math.min(a.width * a.height, b.width * b.height) * 0.3) zasah = { a, b };
      }
      if (!zasah) continue;
      const { a, b } = zasah;
      const r = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), width: Math.max(a.right, b.right) - Math.min(a.left, b.left), height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) };
      pridaj('prekryty-text', 'vysoka', listy[i], 'text sa prekrýva s ' + popis(listy[j]) + ' („' + text(listy[j]).slice(0, 40) + '“)', r);
    }
  }

  // 5. Nezarovnané ikony: ikona vedľa textu v jednom riadku má iný zvislý stred.
  const ikony = vsetky.filter((el) => (el.tagName === 'svg' || el.tagName === 'IMG' || /ikon|icon|piktogram/i.test(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className)) && el.getBoundingClientRect().width <= 64);
  for (const ik of ikony) {
    const ri = ik.getBoundingClientRect();
    const rodic = ik.parentElement;
    if (!rodic) continue;
    for (const n of rodic.childNodes) {
      if (n === ik) continue;
      let rt = null;
      if (n.nodeType === 3 && n.textContent.trim()) { const rg = document.createRange(); rg.selectNodeContents(n); rt = rg.getBoundingClientRect(); }
      else if (n.nodeType === 1 && maText(n) && viditelny(n) && !n.querySelector('svg,img')) rt = n.getBoundingClientRect();
      if (!rt || rt.height === 0 || rt.height > 60) continue;
      const vedla = Math.min(Math.abs(rt.left - ri.right), Math.abs(ri.left - rt.right)) < 16;
      const prekryvY = Math.min(rt.bottom, ri.bottom) - Math.max(rt.top, ri.top) > 0;
      if (!vedla || !prekryvY) continue;
      const rozdiel = (ri.top + ri.height / 2) - (rt.top + rt.height / 2);
      if (Math.abs(rozdiel) > Math.max(3, rt.height * 0.2)) {
        const r = { left: Math.min(ri.left, rt.left), top: Math.min(ri.top, rt.top), width: Math.max(ri.right, rt.right) - Math.min(ri.left, rt.left), height: Math.max(ri.bottom, rt.bottom) - Math.min(ri.top, rt.top) };
        pridaj('nezarovnana-ikona', 'stredna', ik, 'stred ikony je o ' + Math.round(rozdiel) + ' px ' + (rozdiel > 0 ? 'nižšie' : 'vyššie') + ' než stred textu vedľa', r);
        break;
      }
    }
  }

  // 6. Kontrast textu (WCAG AA): farba cez canvas, aby sedeli aj oklch a color-mix.
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx2 = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx2.clearRect(0, 0, 1, 1); cx2.fillStyle = '#000'; cx2.fillStyle = c; cx2.fillRect(0, 0, 1, 1); const d = cx2.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const jas = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const zmiesaj = (h, d) => [h[0] * h[3] + d[0] * (1 - h[3]), h[1] * h[3] + d[1] * (1 - h[3]), h[2] * h[3] + d[2] * (1 - h[3]), 1];
  for (const el of listy) {
    if (el.closest('[disabled],[aria-disabled=true]')) continue;
    const s = getComputedStyle(el);
    const vrstvy = [];
    let obrazok = false;
    for (let e = el; e; e = e.parentElement) {
      const es = getComputedStyle(e);
      if (es.backgroundImage !== 'none') { obrazok = true; break; }
      const c = rgba(es.backgroundColor);
      if (c[3] > 0) { vrstvy.push(c); if (c[3] >= 0.99) break; }
    }
    if (obrazok) continue;
    let pozadie = [255, 255, 255, 1];
    for (const v of vrstvy.reverse()) pozadie = zmiesaj(v, pozadie);
    const popredie = zmiesaj(rgba(s.color), pozadie);
    const l1 = jas(popredie), l2 = jas(pozadie);
    const pomer = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const velkost = parseFloat(s.fontSize), tucne = Number(s.fontWeight) >= 700;
    const prah = velkost >= 24 || (tucne && velkost >= 18.66) ? 3 : 4.5;
    if (pomer < prah) pridaj('nizky-kontrast', pomer < prah - 1 ? 'stredna' : 'nizka', el, 'kontrast ' + pomer.toFixed(2) + ' : 1, treba ' + prah + ' : 1 (písmo ' + Math.round(velkost) + ' px)');
  }

  // 7. Rozbité obrázky.
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) pridaj('rozbity-obrazok', 'vysoka', img, 'obrázok sa nenačítal: ' + img.getAttribute('src'));
  }
  return nalezy;
})()`;

// Fokus: Tab nastaví klávesnicový režim, potom sa porovná vzhľad prvku bez a s fokusom.
const FOKUS = String.raw`(() => {
  const vlastnosti = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'borderColor', 'backgroundColor', 'color', 'textDecorationLine'];
  const otlacok = (el) => { const s = getComputedStyle(el); return vlastnosti.map((k) => s[k]).join('|'); };
  const prvky = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"])')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled; }).slice(0, 80);
  const bez = [];
  for (const el of prvky) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const pred = otlacok(el);
    el.focus({ preventScroll: true });
    if (document.activeElement !== el) continue;
    if (otlacok(el) === pred) {
      const r = el.getBoundingClientRect();
      bez.push({ selektor: (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')),
        text: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), box: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } });
    }
  }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  return bez;
})()`;

const vysledky: Vysledok[] = [];
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
  const ws = new WebSocket(ciel.webSocketDebuggerUrl);
  await new Promise((ok) => ws.on("open", ok));
  let poradie = 0;
  const cakajuce = new Map<number, (v: Record<string, unknown>) => void>();
  /** Udalosti stránky (konzola, sieť) — zbierajú sa pre práve meranú stránku. */
  let udalosti: Nalez[] = [];
  const ziadosti = new Map<string, string>();
  ws.on("message", (d) => {
    const m = JSON.parse(String(d)) as { id?: number; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
    if (m.id !== undefined) {
      cakajuce.get(m.id)?.(m.result ?? {});
      return;
    }
    const p = m.params ?? {};
    const prazdny = { selektor: "konzola", text: "", box: { x: 0, y: 0, w: 0, h: 0 } };
    if (m.method === "Runtime.exceptionThrown") {
      const e = p.exceptionDetails as { text?: string; exception?: { description?: string } };
      udalosti.push({ ...prazdny, typ: "chyba-konzola", zavaznost: "vysoka", detail: (e.exception?.description ?? e.text ?? "výnimka").split("\n")[0] ?? "" });
    } else if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning")) {
      const a = (p.args as { value?: unknown; description?: string }[] | undefined) ?? [];
      udalosti.push({ ...prazdny, typ: p.type === "error" ? "chyba-konzola" : "varovanie-konzola", zavaznost: p.type === "error" ? "vysoka" : "nizka", detail: a.map((x) => String(x.value ?? x.description ?? "")).join(" ").slice(0, 300) });
    } else if (m.method === "Network.requestWillBeSent") {
      ziadosti.set(String(p.requestId), String((p.request as { url?: string }).url ?? ""));
    } else if (m.method === "Network.responseReceived") {
      const r = p.response as { status: number; url: string };
      if (r.status >= 400) udalosti.push({ ...prazdny, selektor: "sieť", typ: "chyba-siete", zavaznost: "vysoka", detail: `${r.status} ${r.url}` });
    } else if (m.method === "Network.loadingFailed" && p.canceled !== true) {
      udalosti.push({ ...prazdny, selektor: "sieť", typ: "chyba-siete", zavaznost: "vysoka", detail: `${String(p.errorText)} ${ziadosti.get(String(p.requestId)) ?? ""}` });
    }
  });
  const posli = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((ok) => {
      poradie += 1;
      cakajuce.set(poradie, ok);
      ws.send(JSON.stringify({ id: poradie, method, params }));
    });
  const js = async <T>(expression: string): Promise<T> => {
    const r = await posli("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    const v = r.result as { value?: T } | undefined;
    if (r.exceptionDetails !== undefined) throw new Error(`Meranie zlyhalo: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return v?.value as T;
  };
  await posli("Runtime.enable");
  await posli("Network.enable");
  await posli("Page.enable");

  // Prihlásenie: cookie relácie platí pre všetky ďalšie stránky.
  await posli("Page.navigate", { url: `${zaklad}/` });
  await pockaj(1500);
  const ls = miestnost === null ? "" : `localStorage.setItem('naex.miestnost',${JSON.stringify(miestnost)});`;
  await js(`fetch('/api/prihlasenie',{method:'POST',headers:{'content-type':'application/json','x-naex':'1'},body:JSON.stringify(${JSON.stringify(prihlasenie)})}).then(r=>{${ls}return r.status})`);

  for (const { w, h } of rozlisenia) {
    await posli("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    for (const cesta of zoznam) {
      udalosti = [];
      const start = Date.now();
      await posli("Page.navigate", { url: `${zaklad}${cesta}` });
      // Načítanie: dokument a všetky obrázky (najviac 15 s) — dlhé čakanie je samo nález.
      for (let i = 0; i < 60; i++) {
        await pockaj(250);
        const hotovo = await js<boolean>("document.readyState === 'complete' && [...document.images].every((i) => i.complete)");
        if (hotovo && Date.now() - start > 1200) break;
      }
      const nacitanieMs = Date.now() - start;
      await pockaj(600);
      for (const klik of kliky) {
        const ok = await js<string>(`(() => { const el = document.querySelector(${JSON.stringify(klik)}); if (!el) return 'nie'; el.click(); return 'ok'; })()`);
        if (ok !== "ok") console.error(`--klik: ${klik} sa na ${cesta} nenašiel`);
        await pockaj(900);
      }
      const nalezy = await js<Nalez[]>(MERANIE);
      await posli("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await posli("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      const bezFokusu = await js<{ selektor: string; text: string; box: Nalez["box"] }[]>(FOKUS);
      for (const b of bezFokusu) nalezy.push({ ...b, typ: "bez-fokusu", zavaznost: "stredna", detail: "prvok pri fokuse z klávesnice nijako nezmení vzhľad" });
      if (nacitanieMs > 4000) nalezy.push({ typ: "pomale-nacitanie", zavaznost: "stredna", selektor: "stránka", text: "", box: { x: 0, y: 0, w: 0, h: 0 }, detail: `stránka s obrázkami sa načítala za ${(nacitanieMs / 1000).toFixed(1)} s` });
      nalezy.push(...udalosti);

      // Rovnaký nález viackrát (typ + selektor + detail) = jeden s počtom.
      const zlucene: Nalez[] = [];
      for (const n of nalezy) {
        const ten = zlucene.find((z) => z.typ === n.typ && z.selektor === n.selektor && z.detail === n.detail);
        if (ten !== undefined) ten.pocet = (ten.pocet ?? 1) + 1;
        else zlucene.push(n);
      }
      const vaha = { vysoka: 0, stredna: 1, nizka: 2 } as const;
      zlucene.sort((a, b) => vaha[a.zavaznost] - vaha[b.zavaznost]);

      const meno = `${cesta.replace(/^\/$/, "domov").replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")}-${stav}-${w}x${h}`;
      const vyska = Math.min(12000, await js<number>("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)"));
      const cela = await posli("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: vyska, scale: 1 } });
      const snimka = join(vystup, `${meno}.png`);
      writeFileSync(snimka, Buffer.from(String(cela.data), "base64"));
      // Výrezy: nález orámovaný červenou, okolo 40 px kontextu; najviac 40 na stránku.
      let n = 0;
      for (const z of zlucene) {
        if (z.box.w === 0 || n >= 40) continue;
        n += 1;
        await js(`(() => { const d = document.createElement('div'); d.id = '__inspekcia'; Object.assign(d.style, { position: 'absolute', left: '${z.box.x - 2}px', top: '${z.box.y - 2}px', width: '${z.box.w + 4}px', height: '${z.box.h + 4}px', outline: '2px solid #ff2d55', zIndex: 2147483647, pointerEvents: 'none' }); document.body.appendChild(d); })()`);
        const x = Math.max(0, z.box.x - 40), y = Math.max(0, z.box.y - 40);
        const vyrez = await posli("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x, y, width: Math.min(w - x, z.box.w + 80), height: Math.min(vyska - y, Math.max(60, z.box.h + 80)), scale: 1 } });
        await js("document.getElementById('__inspekcia')?.remove()");
        z.vyrez = join(vystup, `${meno}-${String(n).padStart(2, "0")}-${z.typ}.png`);
        writeFileSync(z.vyrez, Buffer.from(String(vyrez.data), "base64"));
      }
      vysledky.push({ cesta, stav, rozlisenie: `${w}x${h}`, snimka, nacitanieMs, nalezy: zlucene });
      const sucet = (zav: string) => zlucene.filter((x) => x.zavaznost === zav).length;
      console.log(`${cesta} ${w}x${h}: ${zlucene.length} nálezov (vysoká ${sucet("vysoka")}, stredná ${sucet("stredna")}, nízka ${sucet("nizka")}), načítanie ${(nacitanieMs / 1000).toFixed(1)} s`);
    }
  }
  ws.close();
} finally {
  writeFileSync(join(vystup, "nalezy.json"), JSON.stringify({ cas: new Date().toISOString(), zaklad, stav, stranky: vysledky }, null, 1));
  console.log(`Nálezy: ${join(vystup, "nalezy.json")}`);
  proc.kill();
  await pockaj(500);
  try {
    rmSync(profil, { recursive: true, force: true });
  } catch {
    // Chrome ešte drží súbory — dočasný priečinok upratá systém
  }
}
