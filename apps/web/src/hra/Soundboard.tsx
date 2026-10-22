// Soundboard majstra Melichara (Michal 2026-10-22, dizajn soundboard-20261022-0934,
// variant B): hráč si v partii sám púšťa hlášky, počuje ich aj súper. Tlačidlo
// je v hlavičke webu pri mene súpera, panel je nemodálny „krčmový cenník“.
// Kým hrá vlastná hláška a 2 s po nej, ďalšiu nepustí (stráži to aj server);
// súperova ho neblokuje. Názov hlášky sa pri prehrávaní neukazuje.

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { api } from "../lib/api.ts";
import { MELICHAR_PREDVOLENY, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { hlasitostZvuku } from "./Hudba.tsx";
import { nacitajHlasky, urlHlasky, type HlaskaMelichara } from "./Melichar.tsx";
import type { HlaskaVPartii } from "./useHra.ts";
import "./soundboard.css";

/** Pauza po vlastnej hláške — rovnakú stráži server (MELICHAR_PAUZA_MS). */
const TICHO_MS = 2_000;
/** Keď zoznam dĺžku nemá (starý server), ráta sa s touto. */
const TRVANIE_NEZNAME_MS = 5_000;

interface Skupina {
  readonly id: string;
  readonly nazov: string;
  readonly citat: string;
  readonly situacia: string;
  /** nazov = názov v zoznam.json, text = ako ho hráč vidí (s diakritikou). */
  readonly hlasky: readonly { readonly nazov: string; readonly text: string }[];
}

// Skupiny podľa významu (Michal 2026-10-22 ich schválil v mockupe).
const SKUPINY: readonly Skupina[] = [
  {
    id: "udiv",
    nazov: "Údiv",
    citat: "„Čo to je?!“",
    situacia: "keď súper zahrá niečo nečakané",
    hlasky: [
      { nazov: "No toto je marha", text: "No toto je marha" },
      { nazov: "No teda toto som nevideu", text: "No teda, toto som nevideu" },
      { nazov: "Boha", text: "Boha" },
    ],
  },
  {
    id: "nasupera",
    nazov: "Na súpera",
    citat: "„Ty jeden…“",
    situacia: "keď ťa súper naštve",
    hlasky: [
      { nazov: "Ty svina", text: "Ty svina" },
      { nazov: "Bzdocha", text: "Bzdocha" },
      { nazov: "Jebem ja Tvojho boha", text: "Jebem ja tvojho boha" },
      { nazov: "Ale na kurvy to ma", text: "Ale na kurvy to má" },
      { nazov: "To nebude mat rozum hinta ciganska banda nikdy", text: "To nebude mať rozum, hinta cigánska banda, nikdy" },
    ],
  },
  {
    id: "smola",
    nazov: "Smola",
    citat: "„Zas to isté“",
    situacia: "keď ti to nejde",
    hlasky: [
      { nazov: "Ach boha", text: "Ach, boha" },
      { nazov: "To zas bude vyzerat", text: "To zas bude vyzerať" },
      { nazov: "Cil isla ked najviac jebe", text: "Čil išla, keď najviac jebe" },
      { nazov: "Uz mam v pici nervy zas", text: "Už mám v piči nervy zas" },
    ],
  },
  {
    id: "pohoda",
    nazov: "Pohoda",
    citat: "„Toto je život“",
    situacia: "keď ti to vyšlo",
    hlasky: [
      { nazov: "Toto je ZIVOT", text: "Toto je ŽIVOT" },
      { nazov: "Keksy a kokotiny", text: "Keksy a kokotiny" },
    ],
  },
];

/**
 * Kláves 1–4 pustí náhodnú hlášku z kategórie (Michal 2026-10-22; predtým mala
 * každá hláška svoj kláves). Náhodu vyberá klient, server dostane konkrétne id.
 */
const KLAVESY_SKUPIN = ["1", "2", "3", "4"];

interface Riadok {
  readonly hlaska: HlaskaMelichara;
  readonly text: string;
  readonly trvanieMs: number;
}

/** Hlášky zo servera v skupinách; nové hlášky, ktoré skupinu nemajú, idú do „Ďalšie“ (bez klávesu). */
function zoskup(hlasky: readonly HlaskaMelichara[]): { readonly skupina: Skupina; readonly klaves: string | null; readonly riadky: Riadok[] }[] {
  const podlaNazvu = new Map(hlasky.map((h) => [h.nazov, h]));
  const pouzite = new Set<string>();
  const out: { readonly skupina: Skupina; readonly klaves: string | null; readonly riadky: Riadok[] }[] = SKUPINY.map((skupina, i) => ({
    skupina,
    klaves: KLAVESY_SKUPIN[i] ?? null,
    riadky: skupina.hlasky.flatMap((x) => {
      const h = podlaNazvu.get(x.nazov);
      if (h === undefined) return [];
      pouzite.add(h.id);
      return [{ hlaska: h, text: x.text, trvanieMs: h.trvanieMs ?? TRVANIE_NEZNAME_MS }];
    }),
  }));
  const ostatne = hlasky.filter((h) => !pouzite.has(h.id));
  if (ostatne.length > 0) {
    out.push({
      skupina: { id: "dalsie", nazov: "Ďalšie", citat: "", situacia: "", hlasky: [] },
      klaves: null,
      riadky: ostatne.map((h) => ({ hlaska: h, text: h.nazov, trvanieMs: h.trvanieMs ?? TRVANIE_NEZNAME_MS })),
    });
  }
  return out.filter((s) => s.riadky.length > 0);
}

function Vlny() {
  return (
    <span className="vlny" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

const FUZ =
  "M12 11.2c-1.2-1.7-3.3-2-4.6-.6-.6.7-1.5.8-2.2.2.3 1.9 2 3 3.7 2.6 1.3-.3 2.3-1.1 3.1-2.2Zm0 0c1.2-1.7 3.3-2 4.6-.6.6.7 1.5.8 2.2.2-.3 1.9-2 3-3.7 2.6-1.3-.3-2.3-1.1-3.1-2.2Z";

function IkonaTicho() {
  return (
    <svg className="sb-ticho" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 6h2.5L8 3v10L4.5 10H2Z" fill="currentColor" />
      <path d="m10.5 6 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export interface SoundboardProps {
  /** Moje miesto v partii. */
  readonly ja: 0 | 1;
  readonly menoSupera: string;
  /** Posledná pustená hláška (od servera, moja aj súperova). */
  readonly udalost: HlaskaVPartii | null;
  readonly pusti: (id: string) => void;
}

type Stav = "pripravene" | "moja" | "odpocet";

export function Soundboard({ ja: miesto, menoSupera, udalost, pusti }: SoundboardProps) {
  const { ja, nastav } = useUcet();
  const ulozena = ja?.melichar ?? MELICHAR_PREDVOLENY;
  const [hlasitost, setHlasitost] = useState(ulozena);
  useEffect(() => setHlasitost(ulozena), [ulozena]);
  const stlmene = hlasitost === 0;
  const hlasitostRef = useRef(hlasitost);
  hlasitostRef.current = hlasitost;

  const [skupiny, setSkupiny] = useState<ReturnType<typeof zoskup>>([]);
  useEffect(() => {
    let zive = true;
    void nacitajHlasky().then((h) => {
      if (zive) setSkupiny(zoskup(h));
    });
    return () => {
      zive = false;
    };
  }, []);

  const [otvorene, setOtvorene] = useState(false);
  // Časy, nie stav — odpočet sa ráta z nich pri každom prekreslení.
  const [moja, setMoja] = useState<{ readonly id: string; readonly koniec: number } | null>(null);
  const [superDo, setSuperDo] = useState(0);
  const [teraz, setTeraz] = useState(() => Date.now());
  const [trasie, setTrasie] = useState(0);

  const stav: Stav = moja === null || teraz >= moja.koniec + TICHO_MS ? "pripravene" : teraz < moja.koniec ? "moja" : "odpocet";
  const superHra = teraz < superDo;
  const zostava = moja === null ? 0 : Math.max(0, moja.koniec + TICHO_MS - teraz);

  // Hodiny bežia, len kým niečo hrá alebo sa odpočítava.
  const aktivne = stav !== "pripravene" || superHra;
  useEffect(() => {
    if (!aktivne) return;
    let raf = 0;
    const krok = (): void => {
      setTeraz(Date.now());
      raf = requestAnimationFrame(krok);
    };
    raf = requestAnimationFrame(krok);
    return () => cancelAnimationFrame(raf);
  }, [aktivne]);

  // Hláška od servera: zahrá sa obom (moja aj súperova môžu hrať naraz).
  const posledna = useRef(0);
  useEffect(() => {
    if (udalost === null || udalost.n === posledna.current) return;
    posledna.current = udalost.n;
    const t = Date.now();
    if (udalost.seat === miesto) setMoja({ id: udalost.id, koniec: t + udalost.trvanieMs });
    else setSuperDo(t + udalost.trvanieMs);
    setTeraz(t);
    if (hlasitostRef.current === 0) return;
    void nacitajHlasky().then((hlasky) => {
      const h = hlasky.find((x) => x.id === udalost.id);
      if (h === undefined) return;
      const audio = new Audio(urlHlasky(h));
      audio.volume = hlasitostZvuku(hlasitostRef.current);
      audio.play().catch(() => undefined);
    });
  }, [udalost, miesto]);

  const zatras = (): void => setTrasie((x) => x + 1);
  const pustiRiadok = (r: Riadok): void => {
    if (stav !== "pripravene") {
      zatras();
      return;
    }
    // Zamkne sa hneď po kliku — odpoveď servera čas len spresní.
    const t = Date.now();
    setMoja({ id: r.hlaska.id, koniec: t + r.trvanieMs });
    setTeraz(t);
    pusti(r.hlaska.id);
  };
  // Náhodná hláška z kategórie — nie tá istá dvakrát po sebe, ak je z čoho vyberať.
  const poslednaVSkupine = useRef<Map<string, string>>(new Map());
  const pustiNahodnu = (klaves: string): void => {
    const s = skupiny.find((x) => x.klaves === klaves);
    if (s === undefined) return;
    const posledna = poslednaVSkupine.current.get(s.skupina.id);
    const moznosti = s.riadky.length > 1 ? s.riadky.filter((x) => x.hlaska.id !== posledna) : s.riadky;
    const r = moznosti[Math.floor(Math.random() * moznosti.length)];
    if (r === undefined) return;
    if (stav === "pripravene") poslednaVSkupine.current.set(s.skupina.id, r.hlaska.id);
    pustiRiadok(r);
  };
  const pustiNahodnuRef = useRef(pustiNahodnu);
  pustiNahodnuRef.current = pustiNahodnu;

  // Hlasitosť sa ukladá do profilu (to isté nastavenie ako v Profile), s malým oneskorením.
  useEffect(() => {
    if (hlasitost === ulozena) return;
    const t = setTimeout(() => {
      void api
        .patch<{ pouzivatel: Pouzivatel }>("/profil", { melichar: hlasitost })
        .then((r) => nastav(r.pouzivatel))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [hlasitost, ulozena, nastav]);

  const obal = useRef<HTMLSpanElement>(null);
  const spust = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const zavri = useCallback((fokusNaTlacidlo: boolean): void => {
    setOtvorene(false);
    if (fokusNaTlacidlo) spust.current?.focus();
  }, []);

  // M otvorí/zavrie, 1–4 pustí náhodnú hlášku z kategórie (aj pri zavretom paneli),
  // Esc zavrie — nikdy pri písaní do poľa; klik mimo panel ho zavrie.
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setOtvorene((o) => !o);
        return;
      }
      if (KLAVESY_SKUPIN.includes(e.key)) {
        e.preventDefault();
        pustiNahodnuRef.current(e.key);
        return;
      }
      if (e.key === "Escape" && otvorene) zavri(true);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [otvorene, zavri]);
  useEffect(() => {
    if (!otvorene) return;
    const mimo = (e: PointerEvent): void => {
      if (obal.current !== null && e.target instanceof Node && !obal.current.contains(e.target)) setOtvorene(false);
    };
    document.addEventListener("pointerdown", mimo);
    return () => document.removeEventListener("pointerdown", mimo);
  }, [otvorene]);
  // Po otvorení fokus na prvú hlášku, aby šli skratky a šípky hneď.
  useEffect(() => {
    if (otvorene) panel.current?.querySelector<HTMLButtonElement>(".sb-hlaska")?.focus();
  }, [otvorene]);

  const klavesVPaneli = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    const POSUN: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 };
    const posun = POSUN[e.key];
    if (posun === undefined) return;
    const tlacidla = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".sb-hlaska") ?? [])];
    const i = tlacidla.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    tlacidla[Math.min(tlacidla.length - 1, Math.max(0, i + posun))]?.focus();
  };

  const sek = (zostava / 1000).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const textStavu =
    stav === "moja"
      ? "Melichar hovorí za teba…"
      : stav === "odpocet"
        ? "Chvíľu ticho…"
        : superHra
          ? `${menoSupera} púšťa Melichara — môžeš odpovedať.`
          : "Vyber hlášku — kliknutím alebo klávesom.";
  const titulok = stav === "moja" ? "Melichar hovorí za teba" : stav === "odpocet" ? `Chvíľu ticho — o ${sek} s môžeš znova` : "Hlášky majstra Melichara (M)";
  const idPanela = useId();

  return (
    <span className="sb" ref={obal} data-ja={stav} data-super={superHra ? "1" : "0"} data-stlmene={stlmene ? "1" : "0"}>
      <button
        type="button"
        ref={spust}
        className="sb-spust"
        aria-expanded={otvorene}
        aria-controls={idPanela}
        aria-keyshortcuts="M"
        title={titulok}
        onClick={() => setOtvorene((o) => !o)}
      >
        <span className="sb-ik" aria-hidden="true">
          {stav === "moja" ? (
            <Vlny />
          ) : stav === "odpocet" ? (
            <span className="prstenec" style={{ "--p": String(zostava / TICHO_MS) } as CSSProperties} />
          ) : (
            <svg className="fuz" viewBox="0 0 24 24" fill="none">
              <path
                d="M3.5 5.5h17a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17.5h-3A1.5 1.5 0 0 1 2 16V7a1.5 1.5 0 0 1 1.5-1.5Z"
                stroke="var(--akcent)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d={FUZ} fill="var(--akcent)" />
            </svg>
          )}
          {superHra && <span className="sb-bodka" />}
        </span>
        Melichar
        {stlmene && <IkonaTicho />}
      </button>

      {/* Kto hovorí, nie čo — názov hlášky sa pri prehrávaní neukazuje. */}
      <span className="sb-super" role="status">
        {superHra && (
          <>
            <Vlny />
            <span>
              <span className="meno">{menoSupera}</span> púšťa Melichara{stlmene ? " (stlmené)" : ""}
            </span>
          </>
        )}
      </span>

      {otvorene && (
        <div className="sb-panel" id={idPanela} ref={panel} role="group" aria-label="Hlášky majstra Melichara" onKeyDown={klavesVPaneli}>
          <div className="sb-hlava">
            <span className="sb-medailon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12 11c-1.5-2.3-4.3-2.7-6-.8-.8.9-2 1-2.9.3.4 2.5 2.6 4 4.9 3.4 1.7-.4 3-1.5 4-2.9Zm0 0c1.5-2.3 4.3-2.7 6-.8.8.9 2 1 2.9.3-.4 2.5-2.6 4-4.9 3.4-1.7-.4-3-1.5-4-2.9Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <div>
              <h2>Majster Melichar</h2>
              <p>počuje ťa aj súper</p>
            </div>
            <button type="button" className="sb-zavriet" aria-label="Zavrieť hlášky (Esc)" onClick={() => zavri(true)}>
              ✕
            </button>
          </div>
          <div className={`sb-stav ${trasie % 2 === 1 ? "trasie" : trasie > 0 ? "trasie2" : ""}`}>
            {stav === "moja" && <Vlny />}
            {stav === "pripravene" && superHra && <Vlny />}
            <span>{textStavu}</span>
            {stav === "odpocet" && <span className="sb-cas">{sek} s</span>}
            <i className="sb-pas" style={{ width: stav === "odpocet" ? `${(zostava / TICHO_MS) * 100}%` : 0 }} />
          </div>
          {stlmene && (
            <div className="sb-stlmene">
              <span>U teba je Melichar stlmený — súper hlášky počuje, ty nie.</span>
              <button type="button" onClick={() => setHlasitost(MELICHAR_PREDVOLENY)}>
                Zapnúť zvuk
              </button>
            </div>
          )}
          <div className="sb-telo">
            {skupiny.length === 0 && <p className="sb-prazdne">Hlášky sa načítavajú…</p>}
            {skupiny.map(({ skupina, klaves, riadky: r }) => (
              <fieldset key={skupina.id} className="sb-skupina">
                <legend>
                  {klaves !== null && (
                    <kbd className="sb-klaves-skupiny" title={`Kláves ${klaves}: náhodná hláška z tejto skupiny`}>
                      {klaves}
                    </kbd>
                  )}
                  {skupina.nazov} {skupina.citat !== "" && <span className="citat">{skupina.citat}</span>}
                  {skupina.situacia !== "" && <span className="sb-situacia">{skupina.situacia}</span>}
                </legend>
                {r.map((x) => {
                  const hraje = stav === "moja" && moja?.id === x.hlaska.id;
                  return (
                    <button
                      key={x.hlaska.id}
                      type="button"
                      className={["sb-hlaska", x.text.length > 30 ? "dlha" : "", hraje ? "hraje" : ""].join(" ")}
                      aria-disabled={stav !== "pripravene" || undefined}
                      onClick={() => pustiRiadok(x)}
                    >
                      <span className="hr-ik">
                        {hraje ? (
                          <Vlny />
                        ) : (
                          <svg viewBox="0 0 9 10" aria-hidden="true">
                            <path d="M0 0.5v9l8.5-4.5z" fill="currentColor" />
                          </svg>
                        )}
                      </span>
                      <span className="hr-text">{x.text}</span>
                      <span className="hr-bodky" aria-hidden="true" />
                    </button>
                  );
                })}
              </fieldset>
            ))}
          </div>
          <div className="sb-pata">
            <label>
              Hlasitosť u teba{" "}
              <input type="range" min="0" max="100" value={hlasitost} onChange={(e) => setHlasitost(Number(e.target.value))} />
            </label>
            <output>{hlasitost} %</output>
            <span className="skratky">
              <kbd>M</kbd> otvorí · <kbd>1</kbd>–<kbd>4</kbd> náhodná · <kbd>Esc</kbd> zavrie
            </span>
          </div>
        </div>
      )}
    </span>
  );
}
