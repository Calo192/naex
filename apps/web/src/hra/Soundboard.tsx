// Soundboard majstra Melichara (Michal 2026-10-22, dizajn soundboard-20261022-0934,
// variant B): hráč si v partii sám púšťa hlášky, počuje ich aj súper. Tlačidlo
// je v hlavičke webu pri mene súpera, panel je nemodálny „krčmový pult“.
// Od 2026-10-23 (Michal) je pult z pečiatok skupín: skupiny sú dáta (priečinok
// pri importe + skupina.json: názov, ikona, farba, kláves), nová skupina sa
// objaví sama. Kláves aj klik pustí náhodnú hlášku zo skupiny, nie poslednú.
// Kým hrá vlastná hláška a 2 s po nej, ďalšiu nepustí (stráži to aj server);
// súperova ho neblokuje. Názov hlášky sa pri prehrávaní neukazuje.

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { api } from "../lib/api.ts";
import { MELICHAR_PREDVOLENY, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { hlasitostZvuku } from "./Hudba.tsx";
import { nacitajMelichara, urlHlasky, type HlaskaMelichara, type Melichar, type SkupinaMelichara } from "./Melichar.tsx";
import type { HlaskaVPartii } from "./useHra.ts";
import "./soundboard.css";

/** Pauza po vlastnej hláške — rovnakú stráži server (MELICHAR_PAUZA_MS). */
const TICHO_MS = 2_000;
/** Keď zoznam dĺžku nemá (starý server), ráta sa s touto. */
const TRVANIE_NEZNAME_MS = 5_000;

/** Farby skupín len z tokenov schemy.css — skupina.json nesmie vniesť vlastnú farbu. */
const FARBY = new Set(["akcent", "akcent-tmavy", "akcent-svetly", "cervena", "cervena-svetla", "cervena-text", "zelena", "zelena-svetla", "info", "info-silna", "ja", "tlmeny", "text"]);
const farbaSkupiny = (farba: string): string => `var(--${FARBY.has(farba) ? farba : "akcent"})`;

interface Pecat {
  readonly skupina: SkupinaMelichara;
  readonly hlasky: readonly HlaskaMelichara[];
}

/** Skupiny v poradí zo servera (podľa klávesu), každá so svojimi hláškami; prázdne nie. */
function pecate({ hlasky, skupiny }: Melichar): Pecat[] {
  return skupiny.map((skupina) => ({ skupina, hlasky: hlasky.filter((h) => h.skupina === skupina.id) })).filter((p) => p.hlasky.length > 0);
}

const pocetHlasok = (n: number): string => (n === 1 ? "1 hláška" : n >= 2 && n <= 4 ? `${n} hlášky` : `${n} hlášok`);

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

/** Fúziky majstra Melichara (medailón v hlavičke panela aj tlačidlo v hlavičke webu). */
const FUZ =
  "M12 11c-1.5-2.3-4.3-2.7-6-.8-.8.9-2 1-2.9.3.4 2.5 2.6 4 4.9 3.4 1.7-.4 3-1.5 4-2.9Zm0 0c1.5-2.3 4.3-2.7 6-.8.8.9 2 1 2.9.3-.4 2.5-2.6 4-4.9 3.4-1.7-.4-3-1.5-4-2.9Z";

function Fuzy({ hovori }: { readonly hovori: boolean }) {
  return (
    <svg className={`fuz${hovori ? " hovori" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <path className="fuz-l" d={FUZ.split("Zm0 0")[0] + "Z"} fill="currentColor" />
      <path className="fuz-p" d={"M12 11" + (FUZ.split("Zm0 0")[1] ?? "")} fill="currentColor" />
    </svg>
  );
}

/** Ikony skupín (skupina.json „ikona“); neznámy názov sa ukáže ako text — napr. emoji. */
const IKONY: Readonly<Record<string, readonly string[]>> = {
  pivo: ["M5 9h10v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z", "M15 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2", "M5 9c0-2 1.4-3 2.8-3 .7-1.4 2.2-2.2 3.8-1.8 1 .3 1.8 1 2.2 1.9 1.4 0 2.2 1 2.2 2.9", "M8.5 12v6M11.5 12v6"],
  kladivo: ["M4.5 8.5 9 4l3.5 3.5L8 12Z", "m10.3 9.7 9.2 9.3", "m6.5 6.5-2-2"],
  minca: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M14.6 9.2c-.4-1-1.4-1.6-2.6-1.6-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.3 0-2.3-.6-2.7-1.6", "M12 6v1.6M12 16.4V18"],
  blesk: ["M13.5 2.5 5 13.5h6.5l-1 8 8.5-11h-6.5Z"],
  otaznik: ["M4 4.5h16v11.5h-9l-4.5 4v-4H4Z", "M9.8 8.6a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.4", "M12 14.6v.1"],
  vykricnik: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M12 7.5v6", "M12 16.4v.1"],
  bublina: ["M4 4.5h16v11.5h-9l-4.5 4v-4H4Z", "m7.5 11 2-2.5 2 2.5 2-2.5 2 2.5"],
};

function IkonaSkupiny({ ikona }: { readonly ikona: string }) {
  const cesty = IKONY[ikona];
  if (ikona === "fuz") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={FUZ} fill="currentColor" />
      </svg>
    );
  }
  if (cesty === undefined) return <span className="sb-ikona-text" aria-hidden="true">{ikona}</span>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {cesty.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

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

  const [pult, setPult] = useState<Pecat[] | null>(null);
  useEffect(() => {
    let zive = true;
    void nacitajMelichara().then((m) => {
      if (zive) setPult(pecate(m));
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
  /** Pečiatka, ktorou hráč naposledy buchol (kľúč animácie odtlačku). */
  const [dopad, setDopad] = useState<{ readonly skupina: string; readonly n: number } | null>(null);

  const stav: Stav = moja === null || teraz >= moja.koniec + TICHO_MS ? "pripravene" : teraz < moja.koniec ? "moja" : "odpocet";
  const superHra = teraz < superDo;
  const zostava = moja === null ? 0 : Math.max(0, moja.koniec + TICHO_MS - teraz);
  const hovori = stav === "moja" || superHra;
  const skupinaMojej = stav === "moja" ? pult?.find((p) => p.hlasky.some((h) => h.id === moja?.id))?.skupina.id : undefined;

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
    void nacitajMelichara().then(({ hlasky }) => {
      const h = hlasky.find((x) => x.id === udalost.id);
      if (h === undefined) return;
      const audio = new Audio(urlHlasky(h));
      audio.volume = hlasitostZvuku(hlasitostRef.current);
      audio.play().catch(() => undefined);
    });
  }, [udalost, miesto]);

  // Náhodná hláška zo skupiny — nie tá istá dvakrát po sebe, ak je z čoho vyberať.
  const poslednaVSkupine = useRef<Map<string, string>>(new Map());
  const pustiSkupinu = (p: Pecat): void => {
    if (stav !== "pripravene") {
      setTrasie((x) => x + 1);
      return;
    }
    const predtym = poslednaVSkupine.current.get(p.skupina.id);
    const moznosti = p.hlasky.length > 1 ? p.hlasky.filter((h) => h.id !== predtym) : p.hlasky;
    const h = moznosti[Math.floor(Math.random() * moznosti.length)];
    if (h === undefined) return;
    poslednaVSkupine.current.set(p.skupina.id, h.id);
    // Zamkne sa hneď po kliku — odpoveď servera čas len spresní.
    const t = Date.now();
    setMoja({ id: h.id, koniec: t + (h.trvanieMs ?? TRVANIE_NEZNAME_MS) });
    setTeraz(t);
    setDopad((d) => ({ skupina: p.skupina.id, n: (d?.n ?? 0) + 1 }));
    pusti(h.id);
  };
  const pustiKlavesRef = useRef((_: string): boolean => false);
  pustiKlavesRef.current = (klaves: string): boolean => {
    const p = pult?.find((x) => x.skupina.klaves === klaves);
    if (p === undefined) return false;
    pustiSkupinu(p);
    return true;
  };

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

  // M otvorí/zavrie, kláves skupiny (1–9 zo skupina.json) pustí náhodnú hlášku
  // aj pri zavretom paneli, Esc zavrie — nikdy pri písaní do poľa; klik mimo panel ho zavrie.
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
      if (/^[1-9]$/.test(e.key) && pustiKlavesRef.current(e.key)) {
        e.preventDefault();
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
  // Po otvorení fokus na prvú pečiatku, aby šli šípky hneď.
  useEffect(() => {
    if (otvorene) panel.current?.querySelector<HTMLButtonElement>(".sb-pecat")?.focus();
  }, [otvorene]);

  const sipky = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    const tlacidla = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".sb-pecat") ?? [])];
    const i = tlacidla.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    // Stĺpcov je toľko, koľko pečiatok má prvý riadok mriežky.
    const prvy = tlacidla[0]?.offsetTop;
    const stlpcov = Math.max(1, tlacidla.filter((b) => b.offsetTop === prvy).length);
    const POSUN: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: stlpcov, ArrowUp: -stlpcov };
    const posun = POSUN[e.key];
    if (posun === undefined) return;
    e.preventDefault();
    tlacidla[Math.min(tlacidla.length - 1, Math.max(0, i + posun))]?.focus();
  };

  const klavesy = (pult ?? []).flatMap((p) => (p.skupina.klaves === null ? [] : [p.skupina.klaves]));
  const sek = (zostava / 1000).toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const textStavu =
    stav === "moja"
      ? "Melichar hovorí za teba…"
      : stav === "odpocet"
        ? "Chvíľu ticho…"
        : superHra
          ? `${menoSupera} púšťa Melichara — môžeš odpovedať.`
          : "Buchni pečiatkou — Melichar vyberie hlášku zo skupiny.";
  const titulok = stav === "moja" ? "Melichar hovorí za teba" : stav === "odpocet" ? `Chvíľu ticho — o ${sek} s môžeš znova` : "Pult majstra Melichara (M)";
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
          {stav === "odpocet" ? <span className="prstenec" style={{ "--p": String(zostava / TICHO_MS) } as CSSProperties} /> : <Fuzy hovori={hovori} />}
          {superHra && <span className="sb-bodka" />}
        </span>
        <span className="sb-nazov">Melichar</span>
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
        <div className="sb-panel" id={idPanela} ref={panel} role="group" aria-label="Pult majstra Melichara" onKeyDown={sipky}>
          <div className="sb-hlava">
            <span className={`sb-medailon${hovori ? " hovori" : ""}`} aria-hidden="true">
              <Fuzy hovori={hovori} />
            </span>
            <div>
              <h2>Pult majstra Melichara</h2>
              <p>buchni pečiatkou — počuje ťa aj súper</p>
            </div>
            <button type="button" className="sb-zavriet" aria-label="Zavrieť pult (Esc)" onClick={() => zavri(true)}>
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
            {pult === null && <p className="sb-prazdne">Hlášky sa načítavajú…</p>}
            {pult !== null && pult.length === 0 && <p className="sb-prazdne">Majster Melichar dnes nemá čo povedať — hlášky na serveri nie sú.</p>}
            {pult !== null && pult.length > 0 && (
              <div className="sb-pult">
                {pult.map((p, i) => {
                  const { skupina } = p;
                  const hraje = skupinaMojej === skupina.id;
                  return (
                    <button
                      key={skupina.id}
                      type="button"
                      className={`sb-pecat${hraje ? " hraje" : ""}`}
                      style={{ "--farba": farbaSkupiny(skupina.farba), "--naklon": `${i % 2 === 0 ? -1.5 : 1.2}deg` } as CSSProperties}
                      aria-disabled={stav !== "pripravene" || undefined}
                      aria-keyshortcuts={skupina.klaves ?? undefined}
                      aria-label={`${skupina.nazov}: náhodná hláška${skupina.klaves !== null ? ` (kláves ${skupina.klaves})` : ""}`}
                      onClick={() => pustiSkupinu(p)}
                    >
                      {/* Odtlačok pri buchnutí — nový kľúč animáciu spustí znova, tlačidlo ostane (fokus). */}
                      {skupina.id === dopad?.skupina && <span key={dopad.n} className="sb-pecat-odtlacok" aria-hidden="true" />}
                      <span className="sb-pecat-hore">
                        <span className="sb-pecat-ik">{hraje ? <Vlny /> : <IkonaSkupiny ikona={skupina.ikona} />}</span>
                        {skupina.klaves !== null && <kbd>{skupina.klaves}</kbd>}
                      </span>
                      <span className="sb-pecat-nazov">{skupina.nazov}</span>
                      {skupina.citat !== "" && <span className="sb-pecat-citat">„{skupina.citat}“</span>}
                      <span className="sb-pecat-pocet">{pocetHlasok(p.hlasky.length)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="sb-pata">
            <label>
              Hlasitosť u teba{" "}
              <input type="range" min="0" max="100" value={hlasitost} onChange={(e) => setHlasitost(Number(e.target.value))} />
            </label>
            <output>{hlasitost} %</output>
            <span className="skratky">
              <kbd>M</kbd> otvorí
              {klavesy.length > 0 && (
                <>
                  {" · "}
                  <kbd>{klavesy[0]}</kbd>
                  {klavesy.length > 1 && (
                    <>
                      –<kbd>{klavesy[klavesy.length - 1]}</kbd>
                    </>
                  )}{" "}
                  pečiatka
                </>
              )}
              {" · "}
              <kbd>Esc</kbd> zavrie
            </span>
          </div>
        </div>
      )}
    </span>
  );
}
