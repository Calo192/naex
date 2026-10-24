// Výučba „Prvá hra“ (Michal 2026-10-23): partia proti Štamgastovi po krokoch
// scenára. Server posiela krok (text majstra Melichara, čo zvýrazniť, kto je
// na rade) a pustí len ťah, ktorý krok čaká — klient len ukazuje bublinu,
// stmaví stôl okrem zvýraznených prvkov a pri krokoch bez ťahu pošle „ďalej“.
//
// Zvýraznenie: kľúč zo scenára („bar:poldeci“, „ruka:hasic“, „tlacidlo:pas“)
// nájde prvok s data-vyucba="kľúč", alebo v zóne data-vyucba="bar" / "ruka"
// prvok s data-vyucba-prvok / data-vyucba-karta = časť za dvojbodkou.
// Nájdený prvok dostane data-vyucba-zvyraznene="kľúč" (číta ho playtest výučby).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Command } from "@naex/core";
import { api } from "../lib/api.ts";
import type { KrokVyucby, PopisKrokuVyucby, StavVyucby } from "./useHra.ts";
import "./vyucba.css";

/** Stav výučby účtu (GET /api/vyucba). */
export interface VyucbaUctu {
  readonly krok: number;
  readonly spolu: number;
  readonly stav: "hotova" | "preskocena" | null;
  /** Či ukázať vstup do výučby (kým nie je zverejnená, len správcom). */
  readonly dostupna: boolean;
  /** Ponúknuť ju pri prvom kliku na Hrať (návštevník, ktorý ju ešte nezačal). */
  readonly ponuknut: boolean;
}

export function useVyucbaUctu(prihlaseny: boolean): { readonly vyucba: VyucbaUctu | null; readonly obnov: () => void } {
  const [vyucba, setVyucba] = useState<VyucbaUctu | null>(null);
  const obnov = useCallback(() => {
    if (!prihlaseny) return;
    api
      .get<VyucbaUctu>("/vyucba")
      .then(setVyucba)
      .catch(() => setVyucba(null));
  }, [prihlaseny]);
  useEffect(obnov, [obnov]);
  return { vyucba, obnov };
}

/** Rozpracovaná výučba: niečo už prešiel, ale ešte nie je hotová. */
export const rozpracovana = (v: VyucbaUctu): boolean => v.stav !== "hotova" && v.krok > 0 && v.krok < v.spolu;

/** Vstup do výučby v lobby (/hra): „Prvá hra — nauč sa hrať“ alebo „Pokračovať vo výučbe“. */
export function VyucbaVLobby({ vyucba, zacni }: { readonly vyucba: VyucbaUctu; readonly zacni: (odznova: boolean) => void }) {
  const pokracuj = rozpracovana(vyucba);
  return (
    <section className="panel vyucba-vstup">
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={64} height={64} />
      <div>
        <h2>Prvá hra — nauč sa hrať</h2>
        <p className="tlmene">
          {pokracuj
            ? `Majster Melichar ťa čaká pri stole — si v kroku ${vyucba.krok + 1} z ${vyucba.spolu}.`
            : vyucba.stav === "hotova"
              ? "Výučbu máš za sebou. Ak si chceš pravidlá zopakovať, zahraj si ju znova."
              : "Majster Melichar ťa krok za krokom prevedie partiou proti Štamgastovi: vybrať cieľ, postaviť šenok, vykladať, NA EX! a bitka. Do štatistík sa neráta."}
        </p>
      </div>
      <div className="riadok-tlacidiel">
        {pokracuj ? (
          <>
            <button className="tlacidlo-hlavne" onClick={() => zacni(false)} data-vyucba-vstup="pokracovat">
              Pokračovať vo výučbe
            </button>
            <button onClick={() => zacni(true)}>Začať odznova</button>
          </>
        ) : (
          <button className="tlacidlo-hlavne" onClick={() => zacni(vyucba.stav !== null)} data-vyucba-vstup="zacat">
            {vyucba.stav === "hotova" ? "Zahrať výučbu znova" : "Prvá hra — nauč sa hrať"}
          </button>
        )}
      </div>
    </section>
  );
}

/** Ponuka pri prvom kliku na Hrať: novému hráčovi výučbu, dá sa preskočiť. */
export function PonukaVyucby({ zacni, preskoc }: { readonly zacni: () => void; readonly preskoc: () => void }) {
  const hlavne = useRef<HTMLButtonElement>(null);
  useEffect(() => hlavne.current?.focus(), []);
  return (
    <div className="vyucba-ponuka-zaves" role="dialog" aria-modal="true" aria-labelledby="vyucba-ponuka-nadpis">
      <div className="vyucba-ponuka panel">
        <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={96} height={96} />
        <h2 id="vyucba-ponuka-nadpis">Prvýkrát pri stole?</h2>
        <p>
          Som majster Melichar. Za pár minút ťa naučím hrať NA EX! — zahráš si so Štamgastom a ja ti poviem, čo a prečo. Kedykoľvek
          môžeš prestať a pokračovať neskôr.
        </p>
        <div className="riadok-tlacidiel">
          <button ref={hlavne} className="tlacidlo-hlavne" onClick={zacni} data-vyucba-vstup="ponuka">
            Nauč ma hrať
          </button>
          <button onClick={preskoc}>Preskočiť, poznám pravidlá</button>
        </div>
        <p className="tlmene vyucba-ponuka-pozn">Výučbu nájdeš kedykoľvek hore na tejto stránke.</p>
      </div>
    </div>
  );
}

// ---- výučba pri stole ----------------------------------------------------------

interface Obdlznik {
  readonly kluc: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Potvrdenie ťahu (potvrdiť, hotovo v šenku) — v kroku hráča svieti vždy, keď je
 * na stole, inak by hráč po výbere karty nevidel, čím ťah dokončí.
 */
const POTVRDIT = "potvrdit";

/** Prvky stola ku kľúču zo scenára — priamo, alebo cez zónu (ruka, linia, bar…). */
function prvkyKluca(kluc: string): HTMLElement[] {
  // Potvrdenie ťahu: tlačidlá so skratkou K (potvrdiť, hotovo) a tie, ktoré si to označia (vziať do ruky).
  if (kluc === POTVRDIT) {
    return [...document.querySelectorAll<HTMLElement>('.hra button.tlacidlo-hlavne:is([data-skratka="k"], [data-vyucba="potvrdit"]):not(:disabled)')];
  }
  // Karta z očakávaného ťahu (uid:N) — mimo zväčšenej kópie v lupe.
  if (kluc.startsWith("uid:")) {
    return [...document.querySelectorAll<HTMLElement>(`[data-vyucba-uid="${Number(kluc.slice(4))}"]`)].filter((el) => el.closest(".lupa") === null);
  }
  // Pri stavbe šenku len karty, ktoré ešte ležia v balíčku — na Smetisku už sú, kde majú byť.
  if (kluc.startsWith("smetisko:")) return [...document.querySelectorAll<HTMLElement>(`.stavba-balicek [data-vyucba-uid="${Number(kluc.slice(9))}"]`)];
  const css = (x: string): string => x.replace(/["\\]/g, "");
  if (kluc.startsWith("akcia:")) return [...document.querySelectorAll<HTMLElement>(`:is(.ruka-rad, .linia) .kl-slot[data-akcia="${css(kluc.slice(6))}"]`)];
  const priame = [...document.querySelectorAll<HTMLElement>(`[data-vyucba="${css(kluc)}"]`)];
  if (priame.length > 0 || !kluc.includes(":")) return priame;
  const [zona, id] = [kluc.slice(0, kluc.indexOf(":")), kluc.slice(kluc.indexOf(":") + 1)];
  return [
    ...document.querySelectorAll<HTMLElement>(
      `[data-vyucba="${css(zona)}"] [data-vyucba-karta="${css(id)}"], [data-vyucba="${css(zona)}"] [data-vyucba-prvok="${css(id)}"]`,
    ),
  ];
}

/**
 * Čo zvýrazniť z príkazu, ktorý krok čaká: karty (pri stavbe šenku len tie na Smetisko —
 * tie hráč presúva) a staršieho. Text Melichara ich nemusí vymenovať všetky.
 */
function kluceZOcakavania(c: Command | null): string[] {
  if (c === null) return [];
  const o = c as unknown as Readonly<Record<string, unknown>>;
  const out: string[] = [];
  for (const pole of ["uid", "rukaUid", "senokUid", "kartaUid", "cirhozaUid"]) if (typeof o[pole] === "number") out.push(`uid:${o[pole] as number}`);
  const zoznam = o[c.type === "stavbaSenku" ? "odhod" : "uids"];
  if (Array.isArray(zoznam)) for (const u of zoznam) if (typeof u === "number") out.push(c.type === "stavbaSenku" ? `smetisko:${u}` : `uid:${u}`);
  if (typeof o.elderId === "string") out.push(`starsi:${o.elderId}`);
  if (c.type === "tah") for (const k of c.kroky) out.push(...kluceZOcakavania(k as Command));
  return out;
}

function viditelny(el: HTMLElement): boolean {
  if (el.closest("[hidden], [inert]") !== null) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 2 || r.height <= 2 || r.bottom <= 0 || r.top >= window.innerHeight) return false;
  // Prvok pod vrstvou (šenok, Karty, Log) nesvieti cez ňu; bublina a lupa sa nerátajú.
  const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
  const y = Math.min(Math.max(r.top + Math.min(r.height / 2, 40), 0), window.innerHeight - 1);
  const navrchu = document.elementsFromPoint(x, y).find((e) => e.closest(".vyucba-stmavenie, [data-vyucba-bublina], .lupa") === null) ?? null;
  return navrchu === null || el.contains(navrchu) || navrchu.contains(el);
}

/** Zvýraznené prvky kroku: označí ich data-vyucba-zvyraznene a vráti ich obdĺžniky. */
function useZvyraznenie(kluce: readonly string[]): readonly Obdlznik[] {
  const [obdlzniky, setObdlzniky] = useState<readonly Obdlznik[]>([]);
  const klucKlucov = kluce.join("|");
  useEffect(() => {
    const zoznam = klucKlucov === "" ? [] : klucKlucov.split("|");
    let posledne = "";
    // Stôl sa mení (lupa, ťah, vrstvy) — prvky sa hľadajú znova každú chvíľu, nie len pri zmene kroku.
    const zmeraj = (): void => {
      const najdene = new Map<HTMLElement, string>();
      // Karty z očakávaného ťahu: „ruka:pijan“ pri dvoch Pijanoch zvýrazní len toho, ktorého ťah čaká.
      const ocakavane = new Set(zoznam.filter((k) => k.startsWith("uid:")).map((k) => k.slice(4)));
      for (const k of zoznam) {
        // Karta inej inštancie (druhý Pijan v ruke, keď prvý už leží na stole ako návrh) nesvieti.
        const prvky = prvkyKluca(k).filter(
          (el) => viditelny(el) && (ocakavane.size === 0 || !el.hasAttribute("data-vyucba-uid") || ocakavane.has(el.getAttribute("data-vyucba-uid") ?? "")),
        );
        for (const el of prvky) najdene.set(el, k);
      }
      for (const el of document.querySelectorAll<HTMLElement>("[data-vyucba-zvyraznene]")) {
        if (!najdene.has(el)) el.removeAttribute("data-vyucba-zvyraznene");
      }
      // Zóna, ktorá obsahuje presnejšie zvýraznené prvky (panel stavby a jeho karty), ostane v tieni.
      for (const el of [...najdene.keys()]) if (el.hasAttribute("data-vyucba") && [...najdene.keys()].some((x) => x !== el && el.contains(x))) najdene.delete(el);
      const out: Obdlznik[] = [];
      for (const [el, k] of najdene) {
        if (el.getAttribute("data-vyucba-zvyraznene") !== k) el.setAttribute("data-vyucba-zvyraznene", k);
        const r = el.getBoundingClientRect();
        out.push({ kluc: k, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
      }
      const sig = JSON.stringify(out);
      if (sig !== posledne) {
        posledne = sig;
        setObdlzniky(out);
      }
    };
    zmeraj();
    const t = setInterval(zmeraj, 200);
    window.addEventListener("resize", zmeraj);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", zmeraj);
      for (const el of document.querySelectorAll<HTMLElement>("[data-vyucba-zvyraznene]")) el.removeAttribute("data-vyucba-zvyraznene");
    };
  }, [klucKlucov]);
  return obdlzniky;
}

/**
 * Stmavenie stola okrem zvýraznených prvkov. Kliky prechádzajú, len v kroku bez ťahu
 * (blokovat) chytí stmavená plocha klik mimo zvýraznených dier (playtest: klik na okraj
 * otvoril Karty). Diery sú v ceste s evenodd, takže zvýraznený prvok sa dá kliknúť.
 */
function Stmavenie({ obdlzniky, blokovat }: { readonly obdlzniky: readonly Obdlznik[]; readonly blokovat: boolean }) {
  if (obdlzniky.length === 0 && !blokovat) return null;
  const okraj = 6;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const diery = obdlzniky.map((o) => {
    const x = o.x - okraj;
    const y = o.y - okraj;
    return `M${x},${y}h${o.w + 2 * okraj}v${o.h + 2 * okraj}h${-(o.w + 2 * okraj)}Z`;
  });
  return (
    <svg className="vyucba-stmavenie" aria-hidden="true" width="100%" height="100%">
      {blokovat && <path className="vyucba-blok" d={`M0,0H${W}V${H}H0Z${diery.join("")}`} fillRule="evenodd" />}
      <defs>
        <mask id="vyucba-maska">
          <rect width="100%" height="100%" fill="white" />
          {obdlzniky.map((o, i) => (
            <rect key={i} x={o.x - okraj} y={o.y - okraj} width={o.w + 2 * okraj} height={o.h + 2 * okraj} rx={10} fill="black" />
          ))}
        </mask>
      </defs>
      {obdlzniky.length > 0 && <rect className="vyucba-tien" width="100%" height="100%" mask="url(#vyucba-maska)" />}
      {obdlzniky.map((o, i) => (
        <rect key={i} className="vyucba-obrys" x={o.x - okraj} y={o.y - okraj} width={o.w + 2 * okraj} height={o.h + 2 * okraj} rx={10} />
      ))}
    </svg>
  );
}

// ---- umiestnenie bubliny ---------------------------------------------------------

/** Plocha prekrytia dvoch obdĺžnikov. */
const prekrytie = (a: Obdlznik, b: Obdlznik): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const rectyPrvkov = (sel: string): Obdlznik[] =>
  [...document.querySelectorAll<HTMLElement>(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    return { kluc: sel, x: r.left, y: r.top, w: r.width, h: r.height };
  });

/**
 * Miesta pre bublinu: rohy okna (pod osou kola a nad spodkom) a stred okraja stola,
 * vľavo aj vpravo. Vyberie sa to, ktoré najmenej zakrýva zvýraznené prvky (veľmi),
 * karty v línii a bary hráčov (playtest výučby: bublina zakryla Body a Farára).
 */
function miestaBubliny(w: number, h: number): Obdlznik[] {
  const hore = (document.querySelector(".hra-hlava")?.getBoundingClientRect().bottom ?? 110) + 8;
  const dole = Math.max(hore, window.innerHeight - h - 12);
  const plst = document.querySelector(".stol-plst")?.getBoundingClientRect();
  const stred = plst === undefined ? (hore + dole) / 2 : Math.min(dole, Math.max(hore, plst.top + (plst.height - h) / 2));
  // Hore na stole: vedľa nadpisov krajov býva prázdno (karty sú v strede).
  const hornyStol = plst === undefined ? hore : Math.min(dole, Math.max(hore, plst.top + 6));
  const xs = [12, window.innerWidth - 12 - w];
  // Nad pečiatkami na hrane stola: spodok bubliny tesne nad nimi (inak siahla na „pasovať“).
  const hrana = [...document.querySelectorAll<HTMLElement>(".stol-hrana .pecat, .stol-hrana button")].map((el) => el.getBoundingClientRect().top).filter((t) => t > 0);
  // Nie nad hornú hranu stola — tam je pás kola a pokyn (UI inšpekcia).
  const nadHranou = hrana.length === 0 ? hornyStol : Math.max(hornyStol, Math.min(...hrana) - h - 8);
  // Miesto hneď pod osou kola nie — zakrylo bar súpera, pás kola aj pokyn (UI inšpekcia).
  return [hornyStol, nadHranou, stred, dole].flatMap((y, i) => xs.map((x, j) => ({ kluc: `${i}${j}`, x, y, w, h })));
}

function skoreMiesta(o: Obdlznik, zvyraznene: readonly Obdlznik[]): number {
  const sucet = (r: readonly Obdlznik[], vaha: number): number => r.reduce((s, b) => s + prekrytie(o, b) * vaha, 0);
  return (
    sucet(zvyraznene, 50) +
    // Hláška, prečo sa karta nepoložila, musí byť celá vidno.
    sucet(rectyPrvkov(".pokyn-tahania"), 50) +
    sucet(rectyPrvkov(".vrstva-fazy .stavba-zona, .vrstva-fazy .stavba-balicek, .vrstva-fazy .draft-karty, .vrstva-starsich:not([hidden]) .ls-sc"), 30) +
    sucet(rectyPrvkov(".linia .partia-rad .kl"), 4) +
    sucet(rectyPrvkov(".stol-hrana .pecat, .stol-hrana button"), 20) +
    sucet(rectyPrvkov(".linia-stav"), 4) +
    sucet(rectyPrvkov(".pas-kola-obal"), 4) +
    // Miesto na konci strany je cieľ ťahu — rovnako dôležité ako zvýraznené prvky.
    sucet(rectyPrvkov(".miesto-volby"), 50) +
    sucet(rectyPrvkov(".doska"), 4) +
    sucet(rectyPrvkov(".ruka-rad .kl"), 1)
  );
}

export function VyucbaStol({
  stav,
  dalej,
  chyba,
  zrusChybu,
  prerusit,
  hratProtiPocitacu,
  menoBota,
  chybaVyucby,
  odpovedz,
  rada,
  pocitadloBezi,
}: {
  readonly stav: StavVyucby;
  readonly dalej: () => void;
  readonly chyba: string | null;
  readonly zrusChybu: () => void;
  /** Odíde od stola; postup ostáva uložený. */
  readonly prerusit: () => void;
  readonly hratProtiPocitacu: () => void;
  readonly menoBota: string;
  /** Čo zlému ťahu chýbalo a čo bolo navyše (server, vyucbaChyba) — karty sa zvýraznia. */
  readonly chybaVyucby: { readonly chybajuce: readonly PopisKrokuVyucby[]; readonly navyse: readonly PopisKrokuVyucby[] } | null;
  /** Odpoveď na kontrolnú otázku (index možnosti) — server si zapíše prvú. */
  readonly odpovedz: (index: number) => void;
  /** Rada Melichara po zlom ťahu v rozhodnutí (partia sa nezmenila). */
  readonly rada: string | null;
  /** Beží Počítadlo bitky — bublina čaká, inak by ju prekrylo a Enter by preskočil krok (UI inšpekcia). */
  readonly pocitadloBezi: boolean;
}) {
  const krok = stav.krok;
  // Komentár k ťahu Štamgasta ostane v bubline nad ďalším krokom — len jeden (playtest: kopa odsekov).
  const [predtym, setPredtym] = useState<KrokVyucby | null>(null);
  const minuly = useRef<KrokVyucby | null>(null);
  const predtymAuto = useRef<readonly string[] | null>(null);
  useEffect(() => {
    const m = minuly.current;
    if (krok !== null && m !== null && m.id === krok.id) return;
    setPredtym(m !== null && (m.kto === "bot" || m.kto === "auto") && m.melichar.trim() !== "" ? m : null);
    minuly.current = krok;
    zrusChybu();
    // Len pri zmene kroku — zrusChybu je stabilný (useCallback v useHra).
  }, [krok?.id]);

  // Pri novom kroku sa stôl vráti z pohľadu starších a zavrú sa vrstvy, ktoré krok
  // nepotrebuje (playtest: po kroku Body ostali starší otvorení, Lokality zakryli bar).
  useEffect(() => {
    if (krok === null) return;
    const kluceKroku = krok.zvyraznit;
    const typ = krok.ocakava?.type ?? "";
    const t = setTimeout(() => {
      const starsich =
        kluceKroku.some((k) => k === "bar:body" || k === "linia-starsich" || k.startsWith("starsi:")) || ["prebytok", "pohorsenie", "patronat", "bezPatronatu"].includes(typ);
      if (!starsich) document.querySelector<HTMLElement>('[data-vyucba-prvok="body"][aria-pressed="true"]')?.click();
      const vrstvu = kluceKroku.some((k) => k.startsWith("hlavicka:")) || typ === "pohreb" || typ === "patronat";
      if (!vrstvu) document.querySelector<HTMLElement>(".vrstva:not(.skryta) .vrstva-zavriet")?.click();
    }, 350);
    return () => clearTimeout(t);
  }, [krok?.id]);

  // U5: pri zmene kroku zavrie visiacu lupu karty či staršieho (Lupa sa zatvára Escapom) —
  // len keď je otvorená, inak by Escape zrušil rozpracovaný výber.
  useEffect(() => {
    if (krok === null || document.querySelector(".lupa:not(.doznieva)") === null) return;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }, [krok?.id]);

  // Hrozba na stole je v odhade bitky — keď ju krok ukazuje a odhad je zbalený, rozbalí sa raz.
  useEffect(() => {
    if (krok === null || !krok.zvyraznit.includes("hrozba")) return;
    const t = setTimeout(() => {
      if (document.querySelector('[data-vyucba="hrozba"]') === null) document.querySelector<HTMLElement>('.suhrn-bitky[aria-expanded="false"]')?.click();
    }, 300);
    return () => clearTimeout(t);
    // Len pri zmene kroku — hráč ho potom smie zbaliť.
  }, [krok?.id]);

  // Pruhy udalostí a priazne na stole počas výučby nie — komentuje Melichar (playtest: ležali cez karty).
  useEffect(() => {
    document.body.classList.add("vyucba-bezi");
    return () => document.body.classList.remove("vyucba-bezi", "vyucba-odhad");
  }, []);
  // Odhad bitky, stávka a vydesení sa ukážu od kroku, ktorý o nich hovorí (alebo o bitke), a potom ostanú.
  useEffect(() => {
    if (krok === null) return;
    const text = krok.melichar.toLowerCase();
    if (krok.zvyraznit.some((k) => k === "hrozba" || k === "bitka-ucet") || /odhad|vydes|hrozb|bitk/.test(text)) document.body.classList.add("vyucba-odhad");
  }, [krok?.id]);

  // Vetu „Takto nie — ešte chýba: …“ skladá server; po odmietnutí svietia len karty,
  // ktoré chýbajú alebo sú navyše (a potvrdenie), inak všetko, čo krok čaká.
  const zleKarty =
    chyba === null || chybaVyucby === null
      ? []
      : [...chybaVyucby.chybajuce, ...chybaVyucby.navyse].flatMap((x) => (x.uid === null ? [] : [`uid:${x.uid}`]));
  const kluce =
    krok === null
      ? []
      : krok.kto !== "hrac"
        ? krok.zvyraznit
        : zleKarty.length > 0
          ? [...zleKarty, POTVRDIT]
          : krok.volba !== null
            ? [...new Set([...krok.zvyraznit, ...krok.volba.kandidati, POTVRDIT])]
            : [...new Set([...krok.zvyraznit, ...kluceZOcakavania(krok.ocakava), POTVRDIT])];
  // Po kroku, ktorý hra spravila za hráča (auto), svieti ešte chvíľu to, čo urobila (Navrhár).
  const [dosvit, setDosvit] = useState<readonly string[]>([]);
  useEffect(() => {
    const m = predtymAuto.current;
    predtymAuto.current = krok?.kto === "auto" ? krok.zvyraznit : null;
    if (m === null || m.length === 0) {
      setDosvit([]);
      return;
    }
    setDosvit(m);
    const t = setTimeout(() => setDosvit([]), 1500);
    return () => clearTimeout(t);
  }, [krok?.id]);
  const zvyraznene = useZvyraznenie(dosvit.length > 0 ? [...new Set([...dosvit, ...kluce])] : kluce);

  // Bublina si vyberie miesto, ktoré najmenej zakrýva zvýraznené prvky, líniu a bary;
  // keď ju hráč presunie (⇆), ostane tam do konca výučby.
  const bublinaRef = useRef<HTMLElement>(null);
  const [rucne, setRucne] = useState<number | null>(null);
  const [poloha, setPoloha] = useState<Obdlznik | null>(null);
  const [zvolene, setZvolene] = useState(0);
  useLayoutEffect(() => {
    const el = bublinaRef.current;
    // Počas ťahania karty sa úzke „+“ mení na plné miesto, ktoré skóre nepozná —
    // bublina by naň skočila a karta by dopadla na ňu (playtest výučby 2026-10-23).
    if (el === null || document.body.classList.contains("tahanie-aktivne")) return;
    const miesta = miestaBubliny(el.offsetWidth, el.offsetHeight);
    let i = rucne ?? zvolene;
    const sama = krok?.kto === "auto" || krok?.kto === "bot";
    if (rucne === null && !(sama && poloha !== null)) {
      let naj = Number.POSITIVE_INFINITY;
      miesta.forEach((o, j) => {
        // Pri rovnakom skóre ostáva bublina, kde je (neskáče sem a tam).
        const sk = skoreMiesta(o, zvyraznene) - (j === zvolene ? 1 : 0);
        if (sk < naj) {
          naj = sk;
          i = j;
        }
      });
    }
    const p = miesta[i % miesta.length];
    if (p === undefined) return;
    if (i !== zvolene) setZvolene(i);
    if (poloha === null || Math.abs(poloha.x - p.x) > 1 || Math.abs(poloha.y - p.y) > 1) setPoloha(p);
  });
  useEffect(() => {
    const zmena = (): void => setPoloha(null);
    window.addEventListener("resize", zmena);
    return () => window.removeEventListener("resize", zmena);
  }, []);

  // Chyba zmizne pri ďalšom kliku na stole — hráč výber opravuje.
  useEffect(() => {
    if (chyba === null) return;
    const zrus = (e: PointerEvent): void => {
      if ((e.target as HTMLElement | null)?.closest("[data-vyucba-bublina]") === null) zrusChybu();
    };
    window.addEventListener("pointerdown", zrus);
    return () => window.removeEventListener("pointerdown", zrus);
  }, [chyba, zrusChybu]);

  // Kontrolná otázka: vybraná možnosť (overuje klient); po správnej sa dá ísť ďalej.
  const [odpoved, setOdpoved] = useState<number | null>(null);
  useEffect(() => setOdpoved(null), [krok?.id]);
  const moznosti = krok?.kto === "otazka" ? (krok.moznosti ?? []) : [];
  const vybrana = odpoved === null ? undefined : moznosti[odpoved];
  const vyber = useCallback(
    (i: number) => {
      if (moznosti[i] === undefined || vybrana?.spravna === true) return;
      setOdpoved(i);
      odpovedz(i);
    },
    [moznosti, vybrana, odpovedz],
  );
  useEffect(() => {
    if (moznosti.length === 0) return;
    const klaves = (e: KeyboardEvent): void => {
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= moznosti.length) return;
      e.preventDefault();
      vyber(i);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [moznosti, vyber]);

  // Enter = „ďalej“ v kroku bez ťahu, aj keď fokus ostal na karte či tlačidle po kliku myšou
  // (playtest: Enter po kliku nereagoval). Polia na písanie nechá tak.
  const jeInfo = !pocitadloBezi && (krok?.kto === "info" || (krok?.kto === "otazka" && vybrana?.spravna === true));
  useEffect(() => {
    if (!jeInfo) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Enter" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]") != null) return;
      e.preventDefault();
      dalej();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [jeInfo, dalej]);

  // Po novom kroku bez ťahu fokus na „ďalej“ — Enter aj čítačka vedia, kde sú.
  const dalejRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (jeInfo && poloha !== null) dalejRef.current?.focus({ preventScroll: true });
  }, [krok?.id, jeInfo, poloha === null]);

  const presun = (): void => setRucne((zvolene + 1) % 8);
  const percento = krok === null ? 100 : Math.round(((krok.index + 1) / krok.spolu) * 100);

  return (
    <>
      <Stmavenie obdlzniky={zvyraznene} blokovat={krok?.kto === "info" || krok?.kto === "otazka"} />
      <aside
        ref={bublinaRef}
        className={`vyucba-bublina ${krok?.kto ?? "hotovo"}`}
        style={poloha === null || pocitadloBezi ? { visibility: "hidden" } : { left: poloha.x, top: poloha.y }}
        data-vyucba-bublina=""
        data-vyucba-krok={krok?.id ?? "hotovo"}
        aria-label="Majster Melichar"
      >
        <header className="vyucba-hlava">
          <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={44} height={44} />
          <div className="vyucba-kto">
            <strong>Majster Melichar</strong>
            {/* Percentá, nie „krok n / 70“ — ťahy Štamgasta sa spájajú a číslo by preskakovalo (playtest). */}
            <span className="vyucba-postup" aria-label={`Výučba: ${percento} %`}>
              <span className="vyucba-postup-pruh">
                <span style={{ width: `${percento}%` }} />
              </span>
              {percento} %
            </span>
          </div>
        </header>
        <div className="vyucba-text" role="status" aria-live="polite" hidden={krok !== null && krok.melichar.trim() === "" && predtym === null && chyba === null && rada === null}>
          {chyba !== null && krok !== null && <p className="vyucba-chyba">{chyba}</p>}
          {rada !== null && krok !== null && <p className="vyucba-rada">{rada}</p>}
          {predtym !== null && <p className="vyucba-predtym">{predtym.melichar}</p>}
          {krok !== null ? (
            krok.melichar.trim() !== "" && <p>{krok.melichar}</p>
          ) : (
            <p>Výučbu máš za sebou! Teraz vieš všetko, čo treba. Zahraj si naostro — Štamgast a jeho kumpáni ťa čakajú.</p>
          )}
          {moznosti.length > 0 && (
            <div className="vyucba-moznosti" role="group" aria-label="Možnosti odpovede">
              {moznosti.map((m, i) => {
                const stav = odpoved === i ? (m.spravna ? " spravna" : " zla") : "";
                return (
                  <button
                    key={i}
                    type="button"
                    className={`vyucba-moznost${stav}`}
                    onClick={() => vyber(i)}
                    disabled={vybrana?.spravna === true && odpoved !== i}
                    aria-pressed={odpoved === i}
                  >
                    <kbd>{i + 1}</kbd> {m.text}
                  </button>
                );
              })}
            </div>
          )}
          {vybrana !== undefined && (
            <p className={vybrana.spravna ? "vyucba-vysvetlenie spravna" : "vyucba-vysvetlenie zla"}>
              <strong>{vybrana.spravna ? "Správne. " : "Nie celkom. "}</strong>
              {vybrana.vysvetlenie}
              {!vybrana.spravna && " Skús inú možnosť."}
            </p>
          )}
        </div>
        <footer className="vyucba-pata">
          {krok === null ? (
            <>
              <button className="tlacidlo-hlavne" onClick={hratProtiPocitacu}>
                Hrať proti počítaču
              </button>
              <button onClick={prerusit}>Do lobby</button>
            </>
          ) : (
            <>
              {jeInfo && (
                <button ref={dalejRef} className="tlacidlo-hlavne vyucba-dalej" onClick={dalej} data-vyucba-dalej="">
                  ďalej <kbd>Enter</kbd>
                </button>
              )}
              {krok.kto === "hrac" && <span className="vyucba-stav">Tvoj ťah</span>}
              {krok.kto === "bot" && <span className="vyucba-stav vyucba-caka">{menoBota} ťahá…</span>}
              {krok.kto === "auto" && <span className="vyucba-stav vyucba-caka">Hra ťahá za teba…</span>}
              <button type="button" className="vyucba-presun" onClick={presun} title="Bublina zakrýva, čo potrebuješ? Presuň ju inam — ostane tam.">
                ⇆ <span>presunúť</span>
              </button>
              <button type="button" className="tlacidlo-jemne vyucba-prerusit" onClick={prerusit} title="Prerušiť výučbu — postup sa uloží, pokračuješ na stránke Hrať.">
                prerušiť<span className="vyucba-dlhy-popis"> výučbu</span>
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
