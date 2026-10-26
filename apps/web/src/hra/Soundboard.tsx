// Soundboard majstra Melichara (Michal 2026-10-22, dizajn soundboard-20261022-0934,
// variant B): hráč si v partii sám púšťa hlášky, počuje ich aj súper. Tlačidlo
// je v hlavičke webu pri mene súpera.
// Od 2026-10-23 (Michal) je pult z pečiatok skupín: skupiny sú dáta (priečinok
// pri importe + skupina.json: názov, ikona, farba, kláves), nová skupina sa
// objaví sama. Kláves aj klik pustí náhodnú hlášku zo skupiny, nie poslednú.
// Kým hrá vlastná hláška a 2 s po nej, ďalšiu nepustí (stráži to aj server);
// súperova ho neblokuje. Názov hlášky sa pri prehrávaní neukazuje.
// Od 2026-10-25 (Michal) nepláva pod hlavičkou: otvorený pult nahradí obsah
// jednotného baru nad stolom (ako Body prepnú bar hráča na podmienky), v jeho výške;
// po zatvorení sa bar vráti. Melichar vo výučbe či v nápovede má prednosť (pult.ts).
// Od 2026-10-26 (Michal, #23) v hlavičke počas partie nie je tlačidlo: pult otvorí
// položka „Hlášky Melichara“ v menu Partia alebo kláves M. V hlavičke ostane len
// krátky stav, kým hláška hrá alebo beží pauza.

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api.ts";
import { MELICHAR_PREDVOLENY, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { hlasitostZvuku } from "./Hudba.tsx";
import { nacitajMelichara, urlHlasky, type HlaskaMelichara, type Melichar, type SkupinaMelichara } from "./Melichar.tsx";
import { useMelicharHovoriVBare, useMiestoVBare } from "./MelicharBar.tsx";
import { TICHO_MS, prepniPult, pultVBare, stavPauzy, zostavaPauzy } from "./pult.ts";
import { ID_TLACIDLA_PARTIE } from "./stitokPartie.ts";
import type { HlaskaVPartii } from "./useHra.ts";
import "./soundboard.css";

/** Udalosť, ktorou menu Partia otvorí a zavrie pult (Soundboard žije v hlavičke celú partiu). */
const PREPNI_PULT = "naex:pult-melichara";

/** Položka menu Partia: otvorí alebo zavrie pult Melichara. */
export function prepniPultMelichara(): void {
  window.dispatchEvent(new Event(PREPNI_PULT));
}

/** Kliky do menu Partia pult nezatvoria — položka ho prepína sama. */
export const MIMO_PULTU = "data-pult-melichara";

/** Ako dlho ostane v hlavičke „Melichar práve hovorí“ po pokuse otvoriť pult. */
const POCKA_MS = 2_000;

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

/** Fúziky majstra Melichara (medailón pultu aj tlačidlo v hlavičke webu). */
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

function IkonaReproduktor() {
  return (
    <svg className="sb-reproduktor" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 6h2.5L8 3v10L4.5 10H2Z" fill="currentColor" />
      <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.3 6.3 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
  const miestoVBare = useMiestoVBare();
  const melicharHovori = useMelicharHovoriVBare(miestoVBare);
  const vBare = pultVBare(otvorene, melicharHovori) && miestoVBare !== null;
  // Časy, nie stav — odpočet sa ráta z nich pri každom prekreslení.
  const [moja, setMoja] = useState<{ readonly id: string; readonly koniec: number } | null>(null);
  const [superDo, setSuperDo] = useState(0);
  const [teraz, setTeraz] = useState(() => Date.now());
  const [trasie, setTrasie] = useState(0);
  /** Pokus otvoriť pult, kým hovorí Melichar — hlavička to chvíľu povie (kľúč animácie a koniec). */
  const [pocka, setPocka] = useState<{ readonly n: number; readonly do: number }>({ n: 0, do: 0 });
  /** Pečiatka, ktorou hráč naposledy buchol (kľúč animácie odtlačku). */
  const [dopad, setDopad] = useState<{ readonly skupina: string; readonly n: number } | null>(null);

  const stav = stavPauzy(moja, teraz);
  const superHra = teraz < superDo;
  const zostava = zostavaPauzy(moja, teraz);
  const hovori = stav === "moja" || superHra;
  const skupinaMojej = stav === "moja" ? pult?.find((p) => p.hlasky.some((h) => h.id === moja?.id))?.skupina.id : undefined;

  const pockaVidno = teraz < pocka.do;
  // Hodiny bežia, len kým niečo hrá alebo sa odpočítava.
  const aktivne = stav !== "pripravene" || superHra || pockaVidno;
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
  const panel = useRef<HTMLElement>(null);
  /** Fokus na prvú pečiatku len po otvorení hráčom — nie keď sa pult vráti po Melicharovi. */
  const fokusPoOtvoreni = useRef(false);
  const zavri = useCallback((fokusNaTlacidlo: boolean): void => {
    setOtvorene(false);
    if (fokusNaTlacidlo) document.getElementById(ID_TLACIDLA_PARTIE)?.focus();
  }, []);
  const prepniRef = useRef((): void => undefined);
  prepniRef.current = (): void => {
    const krok = prepniPult(otvorene, melicharHovori);
    if (krok === "zavri") setOtvorene(false);
    else if (krok === "pocka") {
      const t = Date.now();
      setPocka((p) => ({ n: p.n + 1, do: t + POCKA_MS }));
      setTeraz(t);
    }
    else {
      fokusPoOtvoreni.current = true;
      setOtvorene(true);
    }
  };

  // M otvorí/zavrie, kláves skupiny (1–9 zo skupina.json) pustí náhodnú hlášku
  // aj pri zavretom pulte, Esc zavrie — nikdy pri písaní do poľa; klik mimo pult ho zavrie.
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") {
        // Na mobile pult nie je (partia je tam blokovaná, menu Partia ho neponúka).
        if (window.matchMedia("(max-width: 760px)").matches) return;
        e.preventDefault();
        prepniRef.current();
        return;
      }
      if (/^[1-9]$/.test(e.key) && pustiKlavesRef.current(e.key)) {
        e.preventDefault();
        return;
      }
      // Pult schovaný za Melicharom Esc nezavrie — Esc patrí tomu, čo je vidno.
      if (e.key === "Escape" && vBare) zavri(true);
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [vBare, zavri]);
  useEffect(() => {
    const prepni = (): void => prepniRef.current();
    window.addEventListener(PREPNI_PULT, prepni);
    return () => window.removeEventListener(PREPNI_PULT, prepni);
  }, []);
  useEffect(() => {
    if (!otvorene) return;
    // Klik do bublín Melichara („ďalej“, „rozumiem“) pult nezavrie — vráti sa po nich.
    const mimo = (e: PointerEvent): void => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (obal.current?.contains(t) === true || miestoVBare?.contains(t) === true) return;
      if (t instanceof Element && t.closest(`[${MIMO_PULTU}]`) !== null) return;
      setOtvorene(false);
    };
    document.addEventListener("pointerdown", mimo);
    return () => document.removeEventListener("pointerdown", mimo);
  }, [otvorene, miestoVBare]);
  useEffect(() => {
    if (!vBare || !fokusPoOtvoreni.current) return;
    fokusPoOtvoreni.current = false;
    panel.current?.querySelector<HTMLButtonElement>(".sb-pecat")?.focus();
  }, [vBare]);

  const sipky = (e: ReactKeyboardEvent<HTMLElement>): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
    const tlacidla = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".sb-pecat") ?? [])];
    const i = tlacidla.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const POSUN: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 };
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
          ? `${menoSupera} púšťa Melichara — môžeš odpovedať`
          : stlmene
            ? "U teba stlmený — súper ťa počuje"
            : "Buchni pečiatkou — počuje ťa aj súper";
  // Stav v hlavičke len kým sa niečo deje — tlačidlo pultu je v menu Partia.
  const stavVHlavicke =
    vBare
      ? null
      : stav === "moja"
        ? "Melichar hovorí za teba"
        : stav === "odpocet"
          ? `Chvíľu ticho — ${sek} s`
          : pockaVidno
            ? "Majster Melichar práve hovorí — pult otvoríš, keď dohovorí"
            : null;
  const skratky = `M otvorí a zavrie${klavesy.length > 0 ? ` · ${klavesy[0]}${klavesy.length > 1 ? `–${klavesy[klavesy.length - 1]}` : ""} pečiatka` : ""} · Esc zavrie`;
  const idPanela = useId();
  const data = { "data-ja": stav, "data-super": superHra ? "1" : "0", "data-stlmene": stlmene ? "1" : "0" };

  return (
    <span className="sb" ref={obal} {...data} data-v-bare={vBare ? "1" : "0"}>
      {stavVHlavicke !== null && (
        <span key={`spust-${pocka.n}`} className={`sb-spust sb-indikator${pockaVidno && stav === "pripravene" ? " pocka" : ""}`} title={stavVHlavicke}>
          <span className="sb-ik" aria-hidden="true">
            {stav === "odpocet" ? <span className="prstenec" style={{ "--p": String(zostava / TICHO_MS) } as CSSProperties} /> : <Fuzy hovori={hovori} />}
          </span>
          <span className="sb-nazov">{stav === "odpocet" ? `${sek} s` : "Melichar"}</span>
          {stlmene && <IkonaTicho />}
        </span>
      )}

      {/* Kto hovorí, nie čo — názov hlášky sa pri prehrávaní neukazuje. Pri otvorenom pulte to povie pult. */}
      <span className="sb-super" role="status">
        {superHra && !vBare && (
          <>
            <Vlny />
            <span>
              <span className="meno">{menoSupera}</span> púšťa Melichara{stlmene ? " (stlmené)" : ""}
            </span>
          </>
        )}
      </span>

      {/* Bar nad stolom: data-mel-rezim="cely" mu povie, že jeho riadky má schovať (JednotnyBar). */}
      {vBare &&
        createPortal(
          <section className="sb-bar" id={idPanela} ref={panel} data-mel-rezim="cely" aria-label="Pult majstra Melichara" onKeyDown={sipky} {...data}>
            <span className={`sb-medailon${hovori ? " hovori" : ""}`} aria-hidden="true">
              <Fuzy hovori={hovori} />
            </span>
            <div className={`sb-info ${trasie % 2 === 1 ? "trasie" : trasie > 0 ? "trasie2" : ""}`}>
              <span className="sb-kto">Pult Melichara</span>
              <span className="sb-stav" role="status" title={textStavu}>
                {(stav === "moja" || (stav === "pripravene" && superHra)) && <Vlny />}
                <span className="sb-stav-text">{textStavu}</span>
                {stav === "odpocet" && <span className="sb-cas">{sek} s</span>}
              </span>
              <i className="sb-pas" style={{ width: stav === "odpocet" ? `${(zostava / TICHO_MS) * 100}%` : 0 }} />
            </div>
            {pult === null && <p className="sb-prazdne">Hlášky sa načítavajú…</p>}
            {pult !== null && pult.length === 0 && <p className="sb-prazdne">Majster Melichar dnes nemá čo povedať — hlášky na serveri nie sú.</p>}
            {pult !== null && pult.length > 0 && (
              <div className="sb-pult" role="group" aria-label="Pečiatky skupín hlášok">
                {pult.map((p, i) => {
                  const { skupina } = p;
                  const hraje = skupinaMojej === skupina.id;
                  return (
                    <button
                      key={skupina.id}
                      type="button"
                      className={`sb-pecat${hraje ? " hraje" : ""}`}
                      style={{ "--farba": farbaSkupiny(skupina.farba), "--naklon": `${i % 2 === 0 ? -1.2 : 1}deg` } as CSSProperties}
                      aria-disabled={stav !== "pripravene" || undefined}
                      aria-keyshortcuts={skupina.klaves ?? undefined}
                      aria-label={`${skupina.nazov}: náhodná hláška${skupina.klaves !== null ? ` (kláves ${skupina.klaves})` : ""}`}
                      title={`${skupina.nazov}${skupina.citat !== "" ? ` — „${skupina.citat}“` : ""} · ${pocetHlasok(p.hlasky.length)}`}
                      onClick={() => pustiSkupinu(p)}
                    >
                      {/* Odtlačok pri buchnutí — nový kľúč animáciu spustí znova, tlačidlo ostane (fokus). */}
                      {skupina.id === dopad?.skupina && <span key={dopad.n} className="sb-pecat-odtlacok" aria-hidden="true" />}
                      <span className="sb-pecat-ik">{hraje ? <Vlny /> : <IkonaSkupiny ikona={skupina.ikona} />}</span>
                      {/* Citát a počet hlášok sú v titulku — v bare na ne nie je miesto. */}
                      <span className="sb-pecat-nazov">{skupina.nazov}</span>
                      {skupina.klaves !== null && <kbd>{skupina.klaves}</kbd>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="sb-ovladanie">
              <label title="Hlasitosť Melichara u teba — súper ho počuje podľa svojej">
                <IkonaReproduktor />
                <input type="range" min="0" max="100" value={hlasitost} aria-label="Hlasitosť Melichara u teba" onChange={(e) => setHlasitost(Number(e.target.value))} />
              </label>
              {stlmene ? (
                <button type="button" className="sb-zapnut" onClick={() => setHlasitost(MELICHAR_PREDVOLENY)}>
                  Zapnúť zvuk
                </button>
              ) : (
                <output>{hlasitost} %</output>
              )}
              <button type="button" className="sb-zavriet" aria-label="Zavrieť pult (Esc)" title={skratky} onClick={() => zavri(true)}>
                ✕
              </button>
            </div>
          </section>,
          miestoVBare,
        )}
    </span>
  );
}
