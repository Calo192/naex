// Výučba „Prvá hra“ (Michal 2026-10-23): partia proti Štamgastovi po krokoch
// scenára. Server posiela krok (text majstra Melichara, čo zvýrazniť, kto je
// na rade) a pustí len ťah, ktorý krok čaká — klient len ukazuje bublinu,
// stmaví stôl okrem zvýraznených prvkov a pri krokoch bez ťahu pošle „ďalej“.
//
// Zvýraznenie: kľúč zo scenára („bar:poldeci“, „ruka:hasic“, „tlacidlo:pas“)
// nájde prvok s data-vyucba="kľúč", alebo v zóne data-vyucba="bar" / "ruka"
// prvok s data-vyucba-prvok / data-vyucba-karta = časť za dvojbodkou.
// Nájdený prvok dostane data-vyucba-zvyraznene="kľúč" (číta ho playtest výučby).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientState, Command, Event as UdalostHry } from "@naex/core";
import { api } from "../lib/api.ts";
import { menoVoVete, rodHraca, textUdalosti, type HracInfo, type KrokVyucby, type PopisKrokuVyucby, type StavVyucby } from "./useHra.ts";
import { stitokTahu, zmenyStola } from "./zmenyVyucby.ts";
import type { Sada } from "@naex/tvorba";
import { moznostiKvizu, rezimMelichara } from "./bar.ts";
import { CisloStrany, MelicharVBare, StrankovanaVeta, VetaMelichara, kusyVety, useStrany, type KusVety } from "./MelicharBar.tsx";
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
              : "Majster Melichar ťa za pár minút prevedie jedným kolom proti Štamgastovi: vybrať cieľ, kúpiť zo šenku, vykladať, NA EX! a bitka. Šenok postaví hra za teba. Do štatistík sa neráta."}
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
  /** Len zmena po ťahu bota či hry (dosvit), nie to, čo má hráč urobiť. */
  readonly zmena: boolean;
}

/** Ako dlho po ťahu bota či hry za hráča svieti, čo sa zmenilo (playtest výučby kolo 4, U2). */
const ZMENA_MS = 2_500;

/**
 * Potvrdenie ťahu (potvrdiť, hotovo v šenku) — v kroku hráča svieti vždy, keď je
 * na stole, inak by hráč po výbere karty nevidel, čím ťah dokončí.
 */
const POTVRDIT = "potvrdit";

/** Prvky stola ku kľúču zo scenára — priamo, alebo cez zónu (ruka, linia, bar…). */
export function prvkyKluca(kluc: string): HTMLElement[] {
  // Potvrdenie ťahu: tlačidlá so skratkou K (potvrdiť, hotovo) a tie, ktoré si to označia (vziať do ruky).
  if (kluc === POTVRDIT) {
    return [...document.querySelectorAll<HTMLElement>('.hra button:is(.tlacidlo-hlavne, .pecat-potvrd):is([data-skratka="k"], [data-vyucba="potvrdit"]):not(:disabled)')];
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
  // Účet bitky je na stole až v ďalšom kole — počas bitky je jej výsledok v odhade jednotného baru.
  if (kluc === "bitka-ucet" && priame.length === 0) return [...document.querySelectorAll<HTMLElement>(".jbar-odhad")];
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

/**
 * Zvýraznené prvky kroku: označí ich data-vyucba-zvyraznene a vráti ich obdĺžniky.
 * Zmeny po ťahu bota či hry dostanú data-vyucba-zmena — playtest výučby ich nesmie
 * čítať ako „klikni sem“.
 */
function useZvyraznenie(kluce: readonly string[], zmeny: readonly string[]): readonly Obdlznik[] {
  const [obdlzniky, setObdlzniky] = useState<readonly Obdlznik[]>([]);
  const klucKlucov = kluce.join("|");
  const klucZmien = zmeny.join("|");
  useEffect(() => {
    const zoznam = klucKlucov === "" ? [] : klucKlucov.split("|");
    const zmenene = klucZmien === "" ? [] : klucZmien.split("|");
    let posledne = "";
    // Stôl sa mení (lupa, ťah, vrstvy) — prvky sa hľadajú znova každú chvíľu, nie len pri zmene kroku.
    const zmeraj = (): void => {
      const zmenaEl = new Map<HTMLElement, string>();
      for (const k of zmenene) for (const el of prvkyKluca(k)) if (viditelny(el)) zmenaEl.set(el, k);
      for (const el of document.querySelectorAll<HTMLElement>("[data-vyucba-zmena]")) if (!zmenaEl.has(el)) el.removeAttribute("data-vyucba-zmena");
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
      const obdlznik = (el: HTMLElement, k: string, zmena: boolean): Obdlznik => {
        const r = el.getBoundingClientRect();
        return { kluc: k, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), zmena };
      };
      for (const [el, k] of najdene) {
        if (el.getAttribute("data-vyucba-zvyraznene") !== k) el.setAttribute("data-vyucba-zvyraznene", k);
        out.push(obdlznik(el, k, false));
      }
      // Čo krok zvýrazňuje, svieti ako pokyn; zmena len tam, kde pokyn nie je.
      for (const [el, k] of zmenaEl) {
        if (najdene.has(el) || [...najdene.keys()].some((x) => x.contains(el) || el.contains(x))) continue;
        if (el.getAttribute("data-vyucba-zmena") !== k) el.setAttribute("data-vyucba-zmena", k);
        out.push(obdlznik(el, k, true));
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
      for (const el of document.querySelectorAll<HTMLElement>("[data-vyucba-zmena]")) el.removeAttribute("data-vyucba-zmena");
    };
  }, [klucKlucov, klucZmien]);
  return obdlzniky;
}

/** Maska „všetko okrem zvýraznených prvkov“ pre zošednutie (CSS mask-image s dierami). */
function maskaBezDier(obdlzniky: readonly Obdlznik[], okraj: number): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const diery = obdlzniky.map((o) => `M${o.x - okraj} ${o.y - okraj}h${o.w + 2 * okraj}v${o.h + 2 * okraj}h${-(o.w + 2 * okraj)}z`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill-rule="evenodd" d="M0 0h${w}v${h}h${-w}z${diery}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Stmavenie stola okrem zvýraznených prvkov — kliky aj myš prechádzajú (pointer-events: none).
 * Keď Melichar dovolí len „ďalej“ (sede), stôl navyše zošedne (Michal 2026-10-25); farbu si
 * nechá len to, o čom hovorí.
 */
function Stmavenie({ obdlzniky, sede }: { readonly obdlzniky: readonly Obdlznik[]; readonly sede: boolean }) {
  if (obdlzniky.length === 0 && !sede) return null;
  const okraj = 6;
  const maska = sede ? maskaBezDier(obdlzniky, okraj) : null;
  return (
    <>
      {maska !== null && <div className="vyucba-sede" aria-hidden="true" style={{ maskImage: maska, WebkitMaskImage: maska }} />}
      <svg className="vyucba-stmavenie" aria-hidden="true" width="100%" height="100%">
        <defs>
          <mask id="vyucba-maska">
            <rect width="100%" height="100%" fill="white" />
            {obdlzniky.map((o, i) => (
              <rect key={i} x={o.x - okraj} y={o.y - okraj} width={o.w + 2 * okraj} height={o.h + 2 * okraj} rx={10} fill="black" />
            ))}
          </mask>
        </defs>
        <rect className="vyucba-tien" width="100%" height="100%" mask="url(#vyucba-maska)" />
        {obdlzniky.map((o, i) => (
          <rect key={i} className={o.zmena ? "vyucba-obrys zmena" : "vyucba-obrys"} x={o.x - okraj} y={o.y - okraj} width={o.w + 2 * okraj} height={o.h + 2 * okraj} rx={10} />
        ))}
      </svg>
    </>
  );
}

/** Krok potrebuje líniu starších — inak ju otvorenú cez Body pri novom kroku zavrieme. */
export function krokSoStarsimi(krok: KrokVyucby | null): boolean {
  if (krok === null) return false;
  return (
    krok.zvyraznit.some((k) => k === "bar:body" || k === "linia-starsich" || k === "starsi-stupnica" || k.startsWith("starsi:")) ||
    ["prebytok", "pohorsenie", "patronat", "bezPatronatu"].includes(krok.ocakava?.type ?? "")
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
  view,
  udalosti,
  hraci,
  sada,
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
  /** Beží Počítadlo bitky — „ďalej“ čaká, inak by Enter preskočil krok (UI inšpekcia). */
  readonly pocitadloBezi: boolean;
  /** Stôl a udalosti poslednej správy — čo sa zmenilo po ťahu bota či hry za hráča. */
  readonly view: ClientState;
  readonly udalosti: { readonly id: number; readonly events: readonly UdalostHry[] };
  readonly hraci: readonly [HracInfo | null, HracInfo | null];
  /** Sada kariet — piktogramy akcií v reči Melichara (aj vlastné ikony z tvorcu). */
  readonly sada: Sada | null;
}) {
  const krok = stav.krok;
  useEffect(() => {
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
      if (!krokSoStarsimi(krok)) document.querySelector<HTMLElement>('[data-vyucba-prvok="body"][aria-pressed="true"]')?.click();
      // Stupnice strachu sú na kartách starších — línia starších sa otvorí sama (playtest: krok 38 svietil Body).
      else if (kluceKroku.some((k) => k === "starsi-stupnica" || k === "linia-starsich")) {
        document.querySelector<HTMLElement>('.doska.moja [data-vyucba-prvok="body"][aria-pressed="false"]')?.click();
      }
      const vrstvu = kluceKroku.some((k) => k.startsWith("hlavicka:")) || typ === "pohreb" || typ === "patronat";
      if (!vrstvu) document.querySelector<HTMLElement>(".vrstva:not(.skryta) .vrstva-zavriet")?.click();
    }, 350);
    return () => clearTimeout(t);
  }, [krok?.id]);

  // Pri zmene kroku zavrie visiacu lupu karty či staršieho (HernaPlocha, U2).
  useEffect(() => {
    if (krok !== null) window.dispatchEvent(new Event("naex:zavri-lupu"));
  }, [krok?.id]);

  // Pruhy udalostí a priazne na stole počas výučby nie — komentuje Melichar (playtest: ležali cez karty).
  useEffect(() => {
    document.body.classList.add("vyucba-bezi");
    return () => document.body.classList.remove("vyucba-bezi", "vyucba-odhad", "vyucba-vydesenie", "vyucba-body", "vyucba-stavka");
  }, []);
  // Odhad bitky, stávka a vydesení sa ukážu od kroku, ktorý o nich hovorí (alebo o bitke), a potom ostanú.
  useEffect(() => {
    if (krok === null) return;
    const text = krok.melichar.toLowerCase();
    if (krok.zvyraznit.some((k) => k === "hrozba" || k === "bitka-ucet") || /bitka/.test(krok.id) || /odhad|hrozb/.test(text)) {
      document.body.classList.add("vyucba-odhad");
    }
    // Počet vydesených až pri starších — uvítanie spomína vydesenie len ako cieľ hry (playtest výučby kolo 4, U1).
    if (/vydes/.test(text) && krokSoStarsimi(krok)) document.body.classList.add("vyucba-vydesenie");
    // Porovnanie bodov („o 7 pred“) až keď Melichar ukáže body — pri starších po vyhratej bitke
    // ukazovalo súpera vpredu a zavádzalo (playtest výučby kolo 4, U1).
    if (krok.zvyraznit.includes("bar:body")) document.body.classList.add("vyucba-body");
    // Stávku bitky (±3: +19 / −21 b) scenár nevysvetľuje — ukáže sa, až keď o nej Melichar hovorí.
    if (/stávk/.test(text)) document.body.classList.add("vyucba-stavka");
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
        ? // Ťah bota bez kľúča by nerozsvietil nič — aspoň jeho bar (krok nesmie nič nezvýrazniť, Leader).
          krok.zvyraznit.length === 0 && krok.kto === "bot"
          ? ["bar-supera"]
          : krok.zvyraznit
        : zleKarty.length > 0
          ? [...zleKarty, POTVRDIT]
          : krok.volba !== null
            ? [...new Set([...krok.zvyraznit, ...krok.volba.kandidati, POTVRDIT])]
            : [...new Set([...krok.zvyraznit, ...kluceZOcakavania(krok.ocakava), POTVRDIT])];
  // Ťah bota či hry za hráča (playtest výučby kolo 4, U2): krok bez textu ubehol a hráč nevidel,
  // čo sa stalo. Čo sa na stole zmenilo, svieti, kým krok s textom čaká na „ďalej“, a ešte
  // ZMENA_MS po ňom; krok bez textu nechá v ďalšom kroku štítok z logu („Bot Štamgast pasuje…“).
  // Správa so stavom príde pred ďalším krokom, takže krok je v tej chvíli ešte ten, čo ťahal.
  const predView = useRef(view);
  const [zmena, setZmena] = useState<{ readonly krokId: string; readonly kluce: readonly string[]; readonly sTextom: boolean } | null>(null);
  const [stitok, setStitok] = useState<{ readonly krokId: string; readonly text: string; readonly ukazany: string | null } | null>(null);
  useEffect(() => {
    const pred = predView.current;
    predView.current = view;
    if (pred === view || krok === null || (krok.kto !== "bot" && krok.kto !== "auto")) return;
    setZmena({ krokId: krok.id, kluce: [...new Set([...(krok.kto === "auto" ? krok.zvyraznit : []), ...zmenyStola(pred, view)])], sTextom: krok.melichar.trim() !== "" });
    const mena = hraci.map((h, i) => menoVoVete(h, i));
    const rody = [rodHraca(hraci[0]), rodHraca(hraci[1])] as const;
    const riadky = udalosti.events.map((e) => textUdalosti(e, mena, rody)).filter((t): t is string => t !== null);
    const text = krok.melichar.trim() === "" ? stitokTahu(riadky, krok.kto) : null;
    // Ťah s textom štítok nepíše; štítok predošlého ťahu, ktorý práve ukazuje, nechá tak.
    setStitok((s) => (text !== null ? { krokId: krok.id, text, ukazany: null } : s !== null && s.ukazany === krok.id ? s : null));
    // Len nový stav — krok a mená sa čítajú z toho istého prekreslenia.
  }, [view]);
  useEffect(() => {
    if (zmena === null || krok?.id === zmena.krokId) return;
    // Zmenu po ťahu s textom hráč videl, kým čítal; ďalší krok s vlastným zvýraznením ju tiež
    // nepotrebuje — panely Štamgasta svietili v krokoch, ktoré o nich nehovoria (playtest výučby 20261025).
    const hned = zmena.sTextom || (krok?.zvyraznit.length ?? 0) > 0;
    const t = setTimeout(() => setZmena(null), hned ? 0 : ZMENA_MS);
    return () => clearTimeout(t);
  }, [zmena, krok?.id]);
  // Štítok patrí jednému kroku za ťahom — ďalší krok ho zahodí.
  useEffect(() => {
    setStitok((s) => (s === null || krok?.id === s.krokId ? s : s.ukazany === null ? { ...s, ukazany: krok?.id ?? "" } : s.ukazany === krok?.id ? s : null));
  }, [krok?.id]);
  const stitokText = stitok !== null && stitok.ukazany === krok?.id ? stitok.text : null;
  const zvyraznene = useZvyraznenie(kluce, zmena?.kluce ?? []);

  // Krok bez ťahu: klik mimo bubliny nič neurobí (playtest: klik na okraj otvoril Karty).
  // Prechod myšou ostáva — lupa karty či staršieho sa otvorí aj v info kroku.
  // Vykonaný ťah bota či auto krok s textom čaká na „ďalej“ ako info (U5).
  // Zvýraznený prvok v kroku bez ťahu tiež nie: klik na svietiacu Jednotu otvoril výber cieľa
  // s POTVRDIŤ a jeho X sa nedalo zavrieť (playtest výučby 20261025, krok 2). Kým ťahá Štamgast
  // či hra za hráča, nemá hráč na stole čo robiť tiež.
  const tahaIny = (krok?.kto === "bot" || krok?.kto === "auto") && krok.vykonany !== true;
  const blokuj = krok?.kto === "info" || krok?.kto === "otazka" || krok?.vykonany === true || tahaIny;
  useEffect(() => {
    if (!blokuj) return;
    const povolene = (t: EventTarget | null): boolean =>
      t instanceof Element && t.closest("[data-vyucba-bublina], .lupa, .vrstva-zavriet, .pecat-zrusit, .hlavicka") !== null;
    const zastav = (e: Event): void => {
      // Kliky z kódu (zatvorenie vrstvy, otvorenie starších pri novom kroku) prejdú.
      if (!e.isTrusted || povolene(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    for (const typ of ["pointerdown", "mousedown", "click", "contextmenu"]) window.addEventListener(typ, zastav, true);
    return () => {
      for (const typ of ["pointerdown", "mousedown", "click", "contextmenu"]) window.removeEventListener(typ, zastav, true);
    };
  }, [blokuj]);

  // Chyba zmizne pri ďalšom kliku na stole — hráč výber opravuje.
  useEffect(() => {
    if (chyba === null) return;
    const zrus = (e: PointerEvent): void => {
      if ((e.target as HTMLElement | null)?.closest("[data-vyucba-bublina]") === null) zrusChybu();
    };
    window.addEventListener("pointerdown", zrus);
    return () => window.removeEventListener("pointerdown", zrus);
  }, [chyba, zrusChybu]);

  // Kontrolná otázka v bare (Michal 2026-10-25): otázka vľavo, dve možnosti pod sebou vpravo;
  // po výbere odpoveď ako samostatné okno v tom istom bare — „späť na otázku“ ju vráti. Vybranú
  // možnosť overuje klient; po zlej sa vyberá znova, po správnej sa dá ísť ďalej.
  const [odpoved, setOdpoved] = useState<number | null>(null);
  const [pohlad, setPohlad] = useState<"otazka" | "odpoved">("otazka");
  useEffect(() => {
    setOdpoved(null);
    setPohlad("otazka");
  }, [krok?.id]);
  const moznosti = krok?.kto === "otazka" ? (krok.moznosti ?? []) : [];
  const kviz = useMemo(() => moznostiKvizu(moznosti), [moznosti]);
  useEffect(() => {
    if (kviz.varovanie !== null) console.warn(`Výučba, krok ${krok?.id ?? "?"}: ${kviz.varovanie}`);
  }, [krok?.id, kviz.varovanie]);
  const vybrana = odpoved === null ? undefined : moznosti[odpoved];
  const vOdpovedi = pohlad === "odpoved" && vybrana !== undefined;
  const vyber = useCallback(
    (i: number) => {
      if (moznosti[i] === undefined) return;
      setPohlad("odpoved");
      if (i === odpoved || vybrana?.spravna === true) return;
      setOdpoved(i);
      odpovedz(i);
    },
    [moznosti, odpoved, vybrana, odpovedz],
  );
  const spatNaOtazku = useCallback(() => setPohlad("otazka"), []);
  useEffect(() => {
    if (kviz.zobrazene.length === 0) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Backspace" && pohlad === "odpoved") {
        e.preventDefault();
        spatNaOtazku();
        return;
      }
      const m = kviz.zobrazene[Number(e.key) - 1];
      if (m === undefined || e.repeat) return;
      e.preventDefault();
      vyber(m.index);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [kviz.zobrazene, vyber, pohlad, spatNaOtazku]);

  // Text v bare po stranách — nescrolluje sa (Michal 2026-10-25); „ďalej“ najprv listuje.
  const kusy: KusVety[] = [];
  if (krok === null) {
    kusy.push(...kusyVety("hotovo", TEXT_NA_KONIEC, sada));
  } else if (vOdpovedi) {
    kusy.push({ kluc: "verdikt", obsah: <strong className="mel-verdikt">{vybrana.spravna === true ? "Správne. " : "Nie celkom. "}</strong> });
    kusy.push(...kusyVety("vysvetlenie", vybrana.vysvetlenie, sada));
    if (vybrana.spravna !== true) kusy.push({ kluc: "skus", obsah: " Skús inú možnosť." });
  } else {
    if (stitokText !== null) {
      kusy.push({
        kluc: "stitok",
        obsah: (
          <span className="vyucba-stitok" data-vyucba-stitok="">
            {stitokText}
          </span>
        ),
      });
    }
    if (chyba !== null) kusy.push({ kluc: "chyba", obsah: <span className="vyucba-chyba">{chyba}</span> });
    if (rada !== null) {
      kusy.push({
        kluc: "rada",
        obsah: (
          <span className="vyucba-rada">
            <VetaMelichara text={rada} sada={sada} />
          </span>
        ),
      });
    }
    kusy.push(...kusyVety("veta", krok.melichar, sada));
    // Ťah hry za hráča bez textu: bar nesmie zmiznúť — stôl by ostal bez slova (playtest výučby 20261025, krok 6).
    if (krok.melichar.trim() === "" && stitokText === null && krok.kto === "auto" && tahaIny) kusy.push({ kluc: "auto", obsah: "Tento ťah spraví hra za teba — chvíľu počkaj." });
  }
  const podpis = [krok?.id ?? "hotovo", pohlad, odpoved ?? "", stitokText ?? "", chyba ?? "", rada ?? "", vOdpovedi ? vybrana.vysvetlenie : (krok?.melichar ?? "")].join("|");
  const strany = useStrany(podpis);

  // Enter = „ďalej“ v kroku bez ťahu, aj keď fokus ostal na karte či tlačidle po kliku myšou
  // (playtest: Enter po kliku nereagoval). Polia na písanie nechá tak. Dlhý text najprv listuje,
  // zlá odpoveď kvízu vráti otázku.
  const jeInfo = !pocitadloBezi && (krok?.kto === "info" || krok?.vykonany === true || (krok?.kto === "otazka" && vybrana?.spravna === true));
  const zlaOdpoved = vOdpovedi && vybrana.spravna !== true;
  const enter: (() => void) | null = pocitadloBezi ? null : strany.dalsiaJe ? strany.dalsia : zlaOdpoved ? spatNaOtazku : jeInfo ? dalej : null;
  useEffect(() => {
    if (enter === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Enter" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]") != null) return;
      e.preventDefault();
      enter();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [enter]);

  // Po novom kroku bez ťahu či po odpovedi fokus na hlavné tlačidlo — Enter aj čítačka vedia, kde sú.
  const dalejRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (jeInfo || vOdpovedi) dalejRef.current?.focus({ preventScroll: true });
  }, [krok?.id, jeInfo, vOdpovedi, strany.strana]);

  const percento = krok === null ? 100 : Math.round(((krok.index + 1) / krok.spolu) * 100);
  // Melichar hovorí v bare (Michal 2026-10-25), kým má čo povedať alebo čaká na „ďalej“; ťah bez
  // textu nechá bar hráčovi. Počas Počítadla bitky text čaká (playtest výučby kolo 4, U3) — stmavený
  // pod animáciou hovoril o výsledku skôr, než ho bolo vidno.
  const maText =
    krok === null || stitokText !== null || chyba !== null || rada !== null || krok.melichar.trim() !== "" || moznosti.length > 0 || jeInfo || (krok.kto === "auto" && tahaIny);
  const hovori = maText && !pocitadloBezi;
  const spatHlavne = zlaOdpoved && !strany.dalsiaJe;

  const tlacidloDalej = (
    <button ref={spatHlavne ? undefined : dalejRef} className="tlacidlo-hlavne mel-dalej vyucba-dalej" onClick={() => enter?.()} data-vyucba-dalej="">
      ďalej <kbd>Enter</kbd>
    </button>
  );
  const predoslaStrana = strany.strana > 0 && (
    <button type="button" className="tlacidlo-jemne mel-spat" onClick={strany.predosla} title="Predošlá strana textu" aria-label="Predošlá strana textu">
      ‹
    </button>
  );

  return (
    <>
      {/* Ťah Štamgasta stôl nezošedí — hráč sleduje, čo sa na ňom zmení. */}
      <Stmavenie obdlzniky={zvyraznene} sede={hovori && blokuj && !(krok?.kto === "bot" && tahaIny)} />
      {hovori && (
        <MelicharVBare
          // Kvíz je celý v bare a v jeho výške (Michal 2026-10-25) — os kola pod ním neostáva.
          rezim={moznosti.length > 0 ? "cely" : rezimMelichara(kluce)}
          trieda={`vyucba-bublina ${krok?.kto ?? "hotovo"}${moznosti.length === 0 ? "" : vOdpovedi ? ` kviz kviz-odpoved ${zlaOdpoved ? "zla" : "spravna"}` : " kviz kviz-otazka"}`}
          atributy={{
            "data-vyucba-bublina": "",
            "data-vyucba-krok": krok?.id ?? "hotovo",
            ...(moznosti.length > 0 ? { "data-vyucba-kviz": vOdpovedi ? "odpoved" : "otazka" } : {}),
          }}
          // Percentá, nie „krok n / 70“ — ťahy Štamgasta sa spájajú a číslo by preskakovalo (playtest).
          pocitadlo={
            <>
              <span className="mel-pocitadlo" aria-label={`Výučba: ${percento} %`}>
                {percento} %
              </span>
              <CisloStrany strany={strany} />
              {/* Okno odpovede nahradilo otázku — nech hráč vie, na čo Melichar odpovedá. */}
              {vOdpovedi && (
                <span className="mel-tvoja">
                  tvoja odpoveď: <VetaMelichara text={vybrana.text} sada={sada} />
                </span>
              )}
            </>
          }
          moznosti={
            moznosti.length > 0 && !vOdpovedi ? (
              <div className="vyucba-moznosti" role="group" aria-label="Možnosti odpovede">
                {kviz.zobrazene.map(({ index, moznost: m }, k) => {
                  const stav = odpoved === index ? (m.spravna === true ? " spravna" : " zla") : "";
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`vyucba-moznost${stav}`}
                      onClick={() => vyber(index)}
                      disabled={vybrana?.spravna === true && odpoved !== index}
                      aria-pressed={odpoved === index}
                    >
                      <kbd>{k + 1}</kbd>
                      {/* Jeden kus textu — tlačidlo je flex a medzera by vznikla aj okolo piktogramu. */}
                      <span>
                        <VetaMelichara text={m.text} sada={sada} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : undefined
          }
          vpravo={
            krok === null ? (
              <>
                {predoslaStrana}
                {strany.dalsiaJe ? (
                  tlacidloDalej
                ) : (
                  <>
                    <button className="tlacidlo-hlavne" onClick={hratProtiPocitacu}>
                      Hrať prvú partiu proti počítaču
                    </button>
                    <button onClick={prerusit}>Do lobby</button>
                  </>
                )}
              </>
            ) : (
              <>
                {predoslaStrana}
                {!vOdpovedi && krok.kto === "hrac" && <span className="vyucba-stav">Tvoj ťah</span>}
                {!vOdpovedi && krok.kto === "bot" && !krok.vykonany && <span className="vyucba-stav vyucba-caka">{menoBota} ťahá…</span>}
                {!vOdpovedi && krok.kto === "auto" && !krok.vykonany && <span className="vyucba-stav vyucba-caka">Hra ťahá za teba…</span>}
                {vOdpovedi && (
                  <button
                    ref={spatHlavne ? dalejRef : undefined}
                    type="button"
                    className={spatHlavne ? "tlacidlo-hlavne mel-dalej kviz-spat" : "mel-dalej kviz-spat"}
                    onClick={spatNaOtazku}
                    data-vyucba-spat=""
                    title="Späť na otázku (aj Backspace)"
                  >
                    späť na otázku{spatHlavne && <kbd>Enter</kbd>}
                  </button>
                )}
                {(strany.dalsiaJe || (jeInfo && !spatHlavne)) && tlacidloDalej}
                <button type="button" className="tlacidlo-jemne vyucba-prerusit" onClick={prerusit} title="Prerušiť výučbu — postup sa uloží, pokračuješ na stránke Hrať.">
                  prerušiť<span className="vyucba-dlhy-popis"> výučbu</span>
                </button>
              </>
            )
          }
        >
          <div className="vyucba-text" role="status" aria-live="polite">
            <StrankovanaVeta kusy={kusy} podpis={podpis} strany={strany} />
          </div>
        </MelicharVBare>
      )}
    </>
  );
}

const TEXT_NA_KONIEC =
  "Výučbu máš za sebou! Základ vieš, zvyšok ti poviem v prvej partii: keď sa objaví niečo nové — Dlh, Absťák, Pohoršenie — ozvem sa krátkou nápovedou. Zahraj si naostro, Štamgast a jeho kumpáni ťa čakajú.";
