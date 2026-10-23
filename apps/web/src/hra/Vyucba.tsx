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
  const navrchu = document.elementFromPoint(x, y);
  return navrchu === null || el.contains(navrchu) || navrchu.contains(el) || navrchu.closest("[data-vyucba-bublina], .lupa") !== null;
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
      for (const el of [...najdene.keys()]) if ([...najdene.keys()].some((x) => x !== el && el.contains(x))) najdene.delete(el);
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

/** Stmavenie stola okrem zvýraznených prvkov — kliky prechádzajú (pointer-events: none). */
function Stmavenie({ obdlzniky }: { readonly obdlzniky: readonly Obdlznik[] }) {
  if (obdlzniky.length === 0) return null;
  const okraj = 6;
  return (
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
        <rect key={i} className="vyucba-obrys" x={o.x - okraj} y={o.y - okraj} width={o.w + 2 * okraj} height={o.h + 2 * okraj} rx={10} />
      ))}
    </svg>
  );
}

// ---- pokyn a chyba z očakávaného ťahu ------------------------------------------
// Playtest výučby 20261023-161148 (#1, #3): prvá veta bubliny je pokyn, čo kliknúť;
// pri odmietnutom ťahu bublina vymenuje, čo chýba. Oboje sa skladá z príkazu, ktorý
// krok čaká — text Melichara ostáva vysvetlením.

export interface MenaVyucby {
  readonly karta: (uid: number) => string;
  readonly starsi: (elderId: string) => string;
}

interface Polozka {
  readonly uid: number;
  readonly ciel: string;
  readonly zaverecna: boolean;
}

const pole = (c: Command): Readonly<Record<string, unknown>> => c as unknown as Readonly<Record<string, unknown>>;

/** Karty, ktoré ťah kladie (place a Záverečná), v poradí. */
function polozky(c: Command | null): Polozka[] {
  if (c === null) return [];
  const kroky = c.type === "tah" ? (c.kroky as readonly Command[]) : [c];
  return kroky.flatMap((k) => {
    const o = pole(k);
    return (k.type === "place" || k.type === "zaverecna") && typeof o.uid === "number"
      ? [{ uid: o.uid, ciel: String(o.target ?? ""), zaverecna: k.type === "zaverecna" }]
      : [];
  });
}

function textCiela(p: Polozka): string {
  if (p.zaverecna) return p.ciel === "vlastna" ? "ako Záverečnú na svoju stranu" : "ako Záverečnú na Štamgastovu stranu";
  switch (p.ciel) {
    case "vlastna":
      return "na svoju stranu";
    case "superova":
      return "na Štamgastovu stranu";
    case "dedicstvo":
      return "do Dedičstva (na dlaždicu Karty)";
    case "priznanie":
      return "priznať (na dlaždicu Karty)";
    default:
      return "";
  }
}

const zoznam = (x: readonly string[]): string => (x.length <= 1 ? (x[0] ?? "") : `${x.slice(0, -1).join(", ")} a ${x[x.length - 1] ?? ""}`);

/** Krátky pokyn, čo urobiť, aby krok prešiel — null, keď sa z príkazu nedá povedať. */
export function pokynZOcakavania(c: Command | null, m: MenaVyucby): string | null {
  if (c === null) return null;
  const o = pole(c);
  const meno = (u: unknown): string => (typeof u === "number" ? m.karta(u) : "kartu");
  const mena = (v: unknown): string[] => (Array.isArray(v) ? v.map(meno) : []);
  switch (c.type) {
    case "chooseLocation":
      return `Klikni na lokalitu ${meno(o.uid)} a potvrď.`;
    case "stavbaSenku":
      return `Na Smetisko daj ${zoznam(mena(o.odhod))}, potom potvrdiť.`;
    case "draftBer":
      return `Zo šenku vezmi ${zoznam(mena(o.uids))} a daj hotovo.`;
    case "draftStop":
      return "Klikni „už neťahám“ (P).";
    case "tah":
    case "place":
    case "zaverecna": {
      const p = polozky(c);
      if (p.length === 0) return null;
      const casti = p.map((x) => `${m.karta(x.uid)} ${textCiela(x)}`);
      const zav = p.some((x) => x.zaverecna) ? "Zapni pečiatku „záverečná“ a " : "";
      if (c.type !== "tah") return `Polož ${casti[0] ?? ""}.`;
      return p.length > 1
        ? `${zav}${zav === "" ? "P" : "p"}olož ${zoznam(casti)} — všetky naraz, až potom potvrdiť.`
        : `${zav}${zav === "" ? "P" : "p"}olož ${casti[0] ?? ""} a potvrď.`;
    }
    case "naex":
      return `Klikni na ${meno(o.uid)} a daj NA EX! (N).`;
    case "skipNaex":
      return "Klikni „končím“ (K).";
    case "pass":
      return "Pasuj (P).";
    case "smoke":
      return "Klikni na pečiatku „fajčiť“.";
    case "bezReakcie":
      return "Klikni „bez odpovede“.";
    case "prebytok":
    case "pohorsenie":
      return `Klikni na staršieho ${m.starsi(String(o.elderId))}.`;
    case "patronat":
      return `Klikni na ${m.starsi(String(o.elderId))}, vyber ${meno(o.uid)} a daj „vziať do ruky“.`;
    case "bezPatronatu":
      return "Klikni „neberiem“.";
    case "pohreb":
      return `Klikni „Pohreb“, potom na ${meno(o.kartaUid)}${typeof o.senokUid === "number" ? `, zo šenku vezmi ${meno(o.senokUid)}` : ""} a potvrď.`;
    case "skipPohreb":
      return "Klikni „preskočiť“.";
    default:
      return null;
  }
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
  const xs = [12, window.innerWidth - 12 - w];
  return [dole, hore, stred].flatMap((y, i) => xs.map((x, j) => ({ kluc: `${i}${j}`, x, y, w, h })));
}

function skoreMiesta(o: Obdlznik, zvyraznene: readonly Obdlznik[]): number {
  const sucet = (r: readonly Obdlznik[], vaha: number): number => r.reduce((s, b) => s + prekrytie(o, b) * vaha, 0);
  return sucet(zvyraznene, 50) + sucet(rectyPrvkov(".linia .partia-rad .kl"), 2) + sucet(rectyPrvkov(".doska"), 1) + sucet(rectyPrvkov(".ruka-rad .kl"), 1);
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
  menoKarty,
  menoStarsieho,
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
  readonly menoKarty: (uid: number) => string;
  readonly menoStarsieho: (elderId: string) => string;
}) {
  const krok = stav.krok;
  const mena: MenaVyucby = { karta: menoKarty, starsi: menoStarsieho };
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
    return () => document.body.classList.remove("vyucba-bezi");
  }, []);

  const pokyn = krok?.kto === "hrac" ? pokynZOcakavania(krok.ocakava, mena) : null;
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
          : [...new Set([...krok.zvyraznit, ...kluceZOcakavania(krok.ocakava), POTVRDIT])];
  // Po kroku, ktorý hra spravila za hráča (auto), svieti ešte chvíľu to, čo urobila (Navrhár).
  const [dosvit, setDosvit] = useState<readonly string[]>([]);
  useEffect(() => {
    const m = predtymAuto.current;
    predtymAuto.current = krok?.kto === "auto" ? krok.zvyraznit : null;
    if (m === null || m.length === 0) return;
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
    if (el === null) return;
    const miesta = miestaBubliny(el.offsetWidth, el.offsetHeight);
    let i = rucne ?? 0;
    if (rucne === null) {
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

  // Enter = „ďalej“ v kroku bez ťahu, aj keď fokus ostal na karte či tlačidle po kliku myšou
  // (playtest: Enter po kliku nereagoval). Polia na písanie nechá tak.
  const jeInfo = krok?.kto === "info";
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

  const presun = (): void => setRucne((zvolene + 1) % 6);
  const percento = krok === null ? 100 : Math.round(((krok.index + 1) / krok.spolu) * 100);

  return (
    <>
      <Stmavenie obdlzniky={zvyraznene} />
      <aside
        ref={bublinaRef}
        className={`vyucba-bublina ${krok?.kto ?? "hotovo"}`}
        style={poloha === null ? { visibility: "hidden" } : { left: poloha.x, top: poloha.y }}
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
          <button type="button" className="vyucba-presun" onClick={presun} title="Presunúť bublinu inam (ostane tam)">
            ⇆ <span>presunúť</span>
          </button>
        </header>
        <div className="vyucba-text" role="status" aria-live="polite">
          {chyba !== null && krok !== null && <p className="vyucba-chyba">{chyba}</p>}
          {pokyn !== null && chyba === null && <p className="vyucba-pokyn">{pokyn}</p>}
          {predtym !== null && <p className="vyucba-predtym">{predtym.melichar}</p>}
          {krok !== null ? (
            krok.melichar.trim() !== "" && <p>{krok.melichar}</p>
          ) : (
            <p>Výučbu máš za sebou! Teraz vieš všetko, čo treba. Zahraj si naostro — Štamgast a jeho kumpáni ťa čakajú.</p>
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
              {krok.kto === "info" && (
                <button className="tlacidlo-hlavne vyucba-dalej" onClick={dalej} data-vyucba-dalej="">
                  ďalej <kbd>Enter</kbd>
                </button>
              )}
              {krok.kto === "hrac" && <span className="vyucba-stav">Tvoj ťah</span>}
              {krok.kto === "bot" && <span className="vyucba-stav vyucba-caka">{menoBota} ťahá…</span>}
              {krok.kto === "auto" && <span className="vyucba-stav vyucba-caka">Hra ťahá za teba…</span>}
              <button type="button" className="tlacidlo-jemne vyucba-prerusit" onClick={prerusit} title="Postup sa uloží — pokračuješ na stránke Hrať.">
                prerušiť výučbu
              </button>
            </>
          )}
        </footer>
      </aside>
    </>
  );
}
