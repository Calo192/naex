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
import type { KrokVyucby, StavVyucby } from "./useHra.ts";
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
        <p className="tlmene vyucba-ponuka-pozn">Výučbu nájdeš aj neskôr na stránke Hrať.</p>
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
  // Hlavné tlačidlo na stole je vždy potvrdenie ťahu (potvrdiť, hotovo, vziať do ruky…).
  if (kluc === POTVRDIT) return [...document.querySelectorAll<HTMLElement>(".hra button.tlacidlo-hlavne:not(:disabled)")];
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

type Roh = "vlavo-dole" | "vpravo-dole" | "vlavo-hore" | "vpravo-hore";
const ROHY: readonly Roh[] = ["vlavo-dole", "vpravo-dole", "vlavo-hore", "vpravo-hore"];

/**
 * Roh okna pre bublinu: dole nad rohom ruky (tam je len počítadlo balíčka a avatar
 * v bare), hore pod osou kola.
 */
function obdlznikRohu(roh: Roh, w: number, h: number): Obdlznik {
  const hore = (document.querySelector(".hra-hlava")?.getBoundingClientRect().bottom ?? 110) + 8;
  const x = roh.startsWith("vlavo") ? 12 : window.innerWidth - 12 - w;
  const y = roh.endsWith("hore") ? hore : Math.max(hore, window.innerHeight - h - 12);
  return { kluc: roh, x, y, w, h };
}

/** Plocha prekrytia dvoch obdĺžnikov. */
const prekrytie = (a: Obdlznik, b: Obdlznik): number =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/** Text chyby zo servera bez zopakovania celej hlášky Melichara (tú bublina už ukazuje). */
function kratkaChyba(text: string): string {
  return text.startsWith("Vo výučbe teraz urob toto:") ? "Takto nie — urob, čo hovorím vyššie." : text;
}

export function VyucbaStol({
  stav,
  dalej,
  chyba,
  zrusChybu,
  prerusit,
  hratProtiPocitacu,
  menoBota,
}: {
  readonly stav: StavVyucby;
  readonly dalej: () => void;
  readonly chyba: string | null;
  readonly zrusChybu: () => void;
  /** Odíde od stola; postup ostáva uložený. */
  readonly prerusit: () => void;
  readonly hratProtiPocitacu: () => void;
  readonly menoBota: string;
}) {
  const krok = stav.krok;
  // Ťahy bota idú rýchlo za sebou — ich komentáre ostávajú v bubline až do ďalšieho kroku hráča.
  const [predtym, setPredtym] = useState<readonly KrokVyucby[]>([]);
  const minuly = useRef<KrokVyucby | null>(null);
  useEffect(() => {
    const m = minuly.current;
    if (krok !== null && m !== null && m.id === krok.id) return;
    setPredtym((p) => (m !== null && m.kto === "bot" && m.melichar.trim() !== "" ? [...p, m].slice(-3) : []));
    minuly.current = krok;
    zrusChybu();
    // Len pri zmene kroku — zrusChybu je stabilný (useCallback v useHra).
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
  const obdlzniky = useZvyraznenie(
    krok === null ? [] : krok.kto === "hrac" ? [...new Set([...krok.zvyraznit, ...kluceZOcakavania(krok.ocakava), POTVRDIT])] : krok.zvyraznit,
  );

  // Bublina si vyberie roh stola, ktorý nezakrýva zvýraznené prvky; hráč ju smie presunúť.
  const bublinaRef = useRef<HTMLElement>(null);
  const [roh, setRoh] = useState<Roh>("vlavo-dole");
  const [rucne, setRucne] = useState<Roh | null>(null);
  const [poloha, setPoloha] = useState<Obdlznik | null>(null);
  useLayoutEffect(() => {
    const el = bublinaRef.current;
    if (el === null) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const poradie = rucne !== null ? [rucne, ...ROHY.filter((r) => r !== rucne)] : ROHY;
    // Roh, ktorý najmenej zakrýva zvýraznené prvky (pri rovnosti skôr ten v poradí).
    const zakryva = (r: Roh): number => obdlzniky.reduce((sum, o) => sum + prekrytie(obdlznikRohu(r, w, h), o), 0);
    const volny = poradie.reduce((naj, r) => (zakryva(r) < zakryva(naj) ? r : naj), poradie[0] ?? "vlavo-dole");
    const p = obdlznikRohu(volny, w, h);
    if (volny !== roh) setRoh(volny);
    if (poloha === null || poloha.x !== p.x || poloha.y !== p.y) setPoloha(p);
  });
  useEffect(() => {
    const zmena = (): void => setPoloha(null);
    window.addEventListener("resize", zmena);
    return () => window.removeEventListener("resize", zmena);
  }, []);

  // Enter = „ďalej“ pri krokoch bez ťahu (keď fokus nie je na inom tlačidle či poli).
  const jeInfo = krok?.kto === "info";
  useEffect(() => {
    if (!jeInfo) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Enter" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t !== null && t !== document.body && t.closest("button, a, input, textarea, select, [role=button]") !== null) return;
      e.preventDefault();
      dalej();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [jeInfo, dalej]);

  const presun = (): void => {
    const i = ROHY.indexOf(roh);
    setRucne(ROHY[(i + 1) % ROHY.length] ?? "vlavo-dole");
  };

  return (
    <>
      <Stmavenie obdlzniky={obdlzniky} />
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
            {krok !== null && (
              <span className="vyucba-postup" aria-label={`Krok ${krok.index + 1} z ${krok.spolu}`}>
                <span className="vyucba-postup-pruh">
                  <span style={{ width: `${Math.round(((krok.index + 1) / krok.spolu) * 100)}%` }} />
                </span>
                {krok.index + 1} / {krok.spolu}
              </span>
            )}
          </div>
          <button type="button" className="vyucba-presun" onClick={presun} title="Presunúť bublinu do iného rohu" aria-label="Presunúť bublinu">
            ⇆
          </button>
        </header>
        <div className="vyucba-text" role="status" aria-live="polite">
          {predtym.map((p) => (
            <p key={p.id} className="vyucba-predtym">
              {p.melichar}
            </p>
          ))}
          {krok !== null ? (
            krok.melichar.trim() !== "" && <p>{krok.melichar}</p>
          ) : (
            <p>Výučbu máš za sebou! Teraz vieš všetko, čo treba. Zahraj si naostro — Štamgast a jeho kumpáni ťa čakajú.</p>
          )}
          {chyba !== null && krok !== null && <p className="vyucba-chyba">{kratkaChyba(chyba)}</p>}
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
