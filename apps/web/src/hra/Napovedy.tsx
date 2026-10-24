// Nápovedy majstra Melichara v partii (Michal 2026-10-24, roadmapa #85 a #14).
// Krátka výučba učí jedno kolo; keď sa hráč v partii prvýkrát ocitne v situácii,
// ktorej ešte nečelil, Melichar ju povie bublinou. Platí v každej partii (bot aj
// ľudia), každá nápoveda raz za účet, v profile sa dajú vypnúť a ukázať znova.
//
// Situáciu rozpoznáva jadro (napovedy.ts) z pohľadu hráča — z toho istého, čo
// klient kreslí, takže nápoveda nič neprezradí. Bublina nestmavuje stôl a hru
// neblokuje: zavrie ju klik na ňu alebo Esc. Kým beží Počítadlo bitky, pečiatka
// momentu či ťah súpera, nápoveda počká.
// Ukážka na snímky a UI inšpekciu: /hra?ukazka-napovedy=<id> (neuloží sa ako videná).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import katalogJson from "@naex/core/data/vyucba/napovedy.json";
import type { ClientState, Event, GameData, KatalogNapoved, Napoveda } from "@naex/core";
import { dalsiaNapoveda, napovedy } from "@naex/core";
import { api } from "../lib/api.ts";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { prvkyKluca } from "./Vyucba.tsx";
import "./vyucba.css";

const katalog = katalogJson as unknown as KatalogNapoved;

/** Bez účtu (alebo keď server neodpovedá) sa videné pamätajú v prehliadači. */
const KLUC_VIDENE = "naex.napovedy.videne";
const KLUC_VYPNUTE = "naex.napovedy.vypnute";
/** Pečiatka momentu s hláškou Melichara je na stole ~3 s (Momenty.tsx) — nápoveda počká. */
const MOMENT_MS = 3_500;
/** Ako dlho musí byť pokoj (žiadny ťah súpera, Počítadlo ani moment), kým sa bublina ukáže. */
const POKOJ_MS = 600;

function videneVPrehliadaci(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KLUC_VIDENE) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ulozVPrehliadaci(id: string): void {
  const v = videneVPrehliadaci();
  if (!v.includes(id)) localStorage.setItem(KLUC_VIDENE, JSON.stringify([...v, id]));
}

/** Zapnuté nápovedy a videné id — pri účte na serveri, bez účtu v prehliadači. */
export function useNapovedyUctu(): {
  readonly zapnute: boolean;
  readonly videne: ReadonlySet<string> | null;
  readonly oznac: (id: string) => void;
  readonly vypni: () => void;
} {
  const { ja, nastav } = useUcet();
  const prihlaseny = ja !== null;
  const [videne, setVidene] = useState<ReadonlySet<string> | null>(null);
  const [vypnuteBezUctu, setVypnuteBezUctu] = useState(() => localStorage.getItem(KLUC_VYPNUTE) === "1");
  useEffect(() => {
    if (!prihlaseny) {
      setVidene(new Set(videneVPrehliadaci()));
      return;
    }
    let zive = true;
    api
      .get<{ videne: string[] }>("/napovedy")
      .then((r) => zive && setVidene(new Set(r.videne)))
      .catch(() => zive && setVidene(new Set(videneVPrehliadaci())));
    return () => {
      zive = false;
    };
  }, [prihlaseny]);
  const oznac = useCallback(
    (id: string) => {
      setVidene((v) => new Set([...(v ?? []), id]));
      if (prihlaseny) void api.post("/napovedy/videna", { id }).catch(() => ulozVPrehliadaci(id));
      else ulozVPrehliadaci(id);
    },
    [prihlaseny],
  );
  const vypni = useCallback(() => {
    if (!prihlaseny) {
      localStorage.setItem(KLUC_VYPNUTE, "1");
      setVypnuteBezUctu(true);
      return;
    }
    void api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { napovedy: false })
      .then((r) => nastav(r.pouzivatel))
      .catch(() => undefined);
  }, [prihlaseny, nastav]);
  return { zapnute: prihlaseny ? ja.napovedy !== false : !vypnuteBezUctu, videne, oznac, vypni };
}

/** Ukážka z adresy (?ukazka-napovedy=id): text z pohľadu, ak situácia platí, inak prvý variant. */
function ukazkaZAdresy(data: GameData, view: ClientState): Napoveda | null {
  const id = new URLSearchParams(location.search).get("ukazka-napovedy");
  const def = katalog.napovedy.find((n) => n.id === id);
  if (def === undefined) return null;
  const zive = napovedy(data, katalog, view).find((n) => n.id === def.id);
  if (zive !== undefined) return zive;
  const text = typeof def.melichar === "string" ? def.melichar : (Object.values(def.melichar)[0] ?? "");
  return { id: def.id, poradie: def.poradie, text, zvyraznit: def.zvyraznit.filter((k) => !k.includes("{")) };
}

interface Miesto {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

const prienik = (a: DOMRect, l: number, t: number, w: number, h: number): number =>
  Math.max(0, Math.min(a.right, l + w) - Math.max(a.left, l)) * Math.max(0, Math.min(a.bottom, t + h) - Math.max(a.top, t));

/** Užšia bublina by mala viac riadkov ako slov v riadku. */
const NAJUZSIA = 220;
/**
 * Čo bublina nezakryje nikdy: tlačidlá, ruku, pokyn, nadpisy panelov, miesta Smetiska a karty,
 * z ktorých hráč vyberá (šenok, stavba, voľba cieľa). Karty v línii smie zakryť, keď inde
 * miesto nie je. Klikateľná karta má role=button — ťažká je len tam, kde sa z nej vyberá.
 */
const TAZKE =
  "button, input, [role='button']:not(.kl), .ruka, .linia-stav, .stavba-zona-miesto, .stavba-zona-nazov, .draft-hlava > *, .draft-panel .kl, .draft-karty .kl";
const PREKAZKY = `.hra :is(${TAZKE}, .kl)`;

interface Prekazka {
  readonly r: DOMRect;
  readonly tazka: boolean;
}

function prekazky(bublina: HTMLElement): Prekazka[] {
  return [...document.querySelectorAll<HTMLElement>(PREKAZKY)]
    .filter((el) => !bublina.contains(el) && el.getClientRects().length > 0)
    .map((el) => ({ r: el.getBoundingClientRect(), tazka: el.matches(TAZKE) }));
}

/** Prekrytie: najprv ťažké (nesmie byť), potom ľahké (čím menej, tým lepšie). */
interface Prekrytie {
  readonly tazke: number;
  readonly lahke: number;
}

function prekrytie(p: readonly Prekazka[], left: number, top: number, w: number, h: number): Prekrytie {
  let tazke = 0;
  let lahke = 0;
  for (const x of p) {
    const a = prienik(x.r, left, top, w, h);
    if (x.tazka) tazke += a;
    else lahke += a;
  }
  return { tazke, lahke };
}

const lepsie = (a: Prekrytie, b: Prekrytie): boolean => a.tazke < b.tazke || (a.tazke === b.tazke && a.lahke < b.lahke);

/**
 * Kam bublinu položiť: do rohu stola, kde zakryje najmenej (ťažké prekážky pred ľahkými).
 * Plná bublina sa smie zúžiť; zbalená (len Melichar a „nápoveda“) má pevnú šírku. Trieda
 * zbalenej sa na meranie prepne a hneď vráti — medzi tým sa nekreslí.
 */
function miestoBubliny(bublina: HTMLElement, zbalena: boolean): { readonly miesto: Miesto; readonly prekrytie: Prekrytie } {
  // Inline šírku nastavuje React (style) — po meraní sa vráti, inak by ju pri rovnakej hodnote nezapísal znova.
  const predtym = bublina.style.width;
  const predtymZbalena = bublina.classList.contains("zbalena");
  bublina.classList.toggle("zbalena", zbalena);
  bublina.style.width = "";
  const plna = bublina.offsetWidth;
  const vrat = (): void => {
    bublina.style.width = predtym;
    bublina.classList.toggle("zbalena", predtymZbalena);
  };
  const stol = document.querySelector(".hra .linia-obal")?.getBoundingClientRect();
  if (stol === undefined) {
    const top = Math.max(8, window.innerHeight - bublina.offsetHeight - 160);
    vrat();
    return { miesto: { left: 16, top, width: plna }, prekrytie: { tazke: 0, lahke: 0 } };
  }
  const okraj = 12;
  const p = prekazky(bublina);
  let najlepsie: { miesto: Miesto; prekrytie: Prekrytie } | null = null;
  for (const roh of ["vlavo-hore", "vpravo-hore", "vlavo-dole", "vpravo-dole"] as const) {
    for (let w = plna; w >= Math.min(plna, NAJUZSIA); w -= 20) {
      bublina.style.width = `${w}px`;
      const h = bublina.offsetHeight;
      // Hore je pilulka s pokynom (na hrane stola) — bublina začne pod ňou.
      const top = Math.round(Math.max(8, roh.endsWith("hore") ? stol.top + 34 : Math.min(stol.bottom, window.innerHeight) - h - okraj));
      const left = Math.round(Math.max(8, roh.startsWith("vlavo") ? stol.left + okraj : stol.right - w - okraj));
      const pr = prekrytie(p, left, top, w, h);
      if (najlepsie === null || lepsie(pr, najlepsie.prekrytie)) najlepsie = { miesto: { left, top, width: w }, prekrytie: pr };
      if (pr.tazke === 0 && pr.lahke === 0) break;
    }
    if (najlepsie !== null && najlepsie.prekrytie.tazke === 0 && najlepsie.prekrytie.lahke === 0) break;
  }
  vrat();
  return najlepsie ?? { miesto: { left: 16, top: 120, width: plna }, prekrytie: { tazke: 0, lahke: 0 } };
}

/** Prekrytie bubliny na mieste, kde práve je. */
function prekrytieTeraz(bublina: HTMLElement): Prekrytie {
  const r = bublina.getBoundingClientRect();
  return prekrytie(prekazky(bublina), r.left, r.top, r.width, r.height);
}

/** Jemný rámik na prvkoch, o ktorých nápoveda hovorí — bez stmavenia stola. */
function useRamik(kluce: readonly string[] | null): void {
  const sig = kluce?.join("|") ?? "";
  useEffect(() => {
    if (sig === "") return;
    const zoznam = sig.split("|");
    const oznac = (): void => {
      const najdene = new Set(zoznam.flatMap((k) => prvkyKluca(k)));
      for (const el of document.querySelectorAll<HTMLElement>("[data-napoveda-zvyraznene]")) if (!najdene.has(el)) el.removeAttribute("data-napoveda-zvyraznene");
      for (const el of najdene) el.setAttribute("data-napoveda-zvyraznene", "");
    };
    oznac();
    const t = setInterval(oznac, 500);
    return () => {
      clearInterval(t);
      for (const el of document.querySelectorAll<HTMLElement>("[data-napoveda-zvyraznene]")) el.removeAttribute("data-napoveda-zvyraznene");
    };
  }, [sig]);
}

export function NapovedaMelichara({
  data,
  view,
  udalosti,
  pocitadloBezi,
}: {
  readonly data: GameData;
  readonly view: ClientState;
  readonly udalosti: { readonly id: number; readonly events: readonly Event[] };
  readonly pocitadloBezi: boolean;
}) {
  const { zapnute, videne, oznac, vypni } = useNapovedyUctu();
  const [cakajuca, setCakajuca] = useState<Napoveda | null>(null);
  const [ukazana, setUkazana] = useState<Napoveda | null>(() => ukazkaZAdresy(data, view));
  const ukazka = useRef(ukazana !== null);

  // Pečiatka momentu s hláškou Melichara — nápoveda počká, nech nehovorí cez neho.
  const [moment, setMoment] = useState(false);
  useEffect(() => {
    if (!udalosti.events.some((e) => e.type === "moment")) return;
    setMoment(true);
    const t = setTimeout(() => setMoment(false), MOMENT_MS);
    return () => clearTimeout(t);
  }, [udalosti]);

  // Situácia sa zachytí hneď (bot ťahá rýchlo — voľba cieľa trvá chvíľu), ukáže sa, keď je pokoj.
  useEffect(() => {
    if (!zapnute || videne === null || cakajuca !== null || ukazana !== null) return;
    const n = dalsiaNapoveda(data, katalog, view, videne);
    if (n !== null) setCakajuca(n);
  }, [data, view, zapnute, videne, cakajuca, ukazana]);

  const superNaTahu = view.naTahu !== null && view.naTahu !== view.ja;
  const caka = pocitadloBezi || moment || superNaTahu;
  useEffect(() => {
    if (cakajuca === null || ukazana !== null || caka) return;
    // Chvíľa pokoja: bublina nevyskočí uprostred rýchlych ťahov a pri vstupe do výučby
    // (krok výučby príde správou hneď po stave) sa komponent odpojí skôr, než ju ukáže.
    const t = setTimeout(() => {
      setCakajuca(null);
      setUkazana(cakajuca);
      // Videná je už ukázaná — „raz“ platí, aj keď ju hráč nezavrie (odíde, obnoví stránku).
      oznac(cakajuca.id);
    }, POKOJ_MS);
    return () => clearTimeout(t);
  }, [cakajuca, ukazana, caka, oznac]);

  useEffect(() => {
    if (!zapnute && !ukazka.current) {
      setCakajuca(null);
      setUkazana(null);
    }
  }, [zapnute]);
  useEffect(() => {
    if (view.koniec !== null) setUkazana(null);
  }, [view.koniec]);

  const zavri = useCallback(() => setUkazana(null), []);

  const bublina = useRef<HTMLElement>(null);
  const [miesto, setMiesto] = useState<Miesto | null>(null);
  // Zbalená: plná bublina by zakryla kartu, z ktorej hráč vyberá (šenok) či tlačidlo — ostane
  // len Melichar s „nápoveda“; klik ju rozbalí. Keď sa neskôr plná vojde, rozbalí sa sama.
  const [zbalena, setZbalena] = useState(false);
  const rucne = useRef(false);
  const [rozbalenie, setRozbalenie] = useState(0);
  // Nová nápoveda začína nerozbalená klikom — reset v layout efekte nižšie, pred umiestnením.
  const predoslaNapoveda = useRef<Napoveda | null>(null);
  const rozbal = useCallback(() => {
    rucne.current = true;
    setRozbalenie((n) => n + 1);
    setZbalena(false);
  }, []);

  // Esc zavrie najprv bublinu (capture) — návrh ťahu na stole ostane. Skrytá čakajúca nie.
  const viditelna = ukazana !== null && miesto !== null;
  useEffect(() => {
    if (!viditelna) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      zavri();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, [viditelna, zavri]);

  useRamik(viditelna && !zbalena ? (ukazana?.zvyraznit ?? null) : null);

  // Iná fáza = iný stôl (voľba cieľa → stavba šenku → línia): miesto sa vyberie znova.
  const usek = `${view.faza}|${view.draftStav?.krok ?? ""}|${view.bitkaStav?.krok ?? ""}`;
  useLayoutEffect(() => {
    if (ukazana === null || bublina.current === null) {
      setMiesto(null);
      return;
    }
    if (predoslaNapoveda.current !== ukazana) {
      predoslaNapoveda.current = ukazana;
      rucne.current = false;
    }
    const el = bublina.current;
    const umiestni = (): void => {
      const plna = miestoBubliny(el, false);
      // Rozbalená klikom ostane plná — hráč si ju vyžiadal; inak plná len bez ťažkého prekrytia.
      if (plna.prekrytie.tazke === 0 || rucne.current) {
        setZbalena(false);
        setMiesto(plna.miesto);
        return;
      }
      const mala = miestoBubliny(el, true);
      setZbalena(true);
      // Ani zbalená sa nevojde — počká (neukáže sa), kým sa stôl neuvoľní.
      setMiesto(mala.prekrytie.tazke === 0 ? mala.miesto : null);
    };
    umiestni();
    // Karty stola sa po prekreslení ešte dorovnajú (zarovnanie línie) — druhé meranie o chvíľu.
    const t = setTimeout(umiestni, 300);
    // Stôl sa mení aj bez novej fázy (karty šenku dobehnú, objaví sa tlačidlo): keď bublina
    // niečo zakrýva, alebo je zbalená či skrytá a plná by sa už vošla, premiestni sa — inak stojí.
    const kontrola = setInterval(() => {
      if (rucne.current) return;
      const teraz = prekrytieTeraz(el);
      if (!el.classList.contains("zbalena") && el.style.visibility !== "hidden" && teraz.tazke === 0 && teraz.lahke === 0) return;
      umiestni();
    }, 1000);
    window.addEventListener("resize", umiestni);
    return () => {
      clearTimeout(t);
      clearInterval(kontrola);
      window.removeEventListener("resize", umiestni);
    };
    // Miesto sa vyberie pri otvorení, v novej fáze, po rozbalení klikom, pri zmene okna a keď niečo zakrýva.
  }, [ukazana, usek, rozbalenie]);

  if (ukazana === null) return null;
  return (
    <aside
      ref={bublina}
      className={zbalena ? "napoveda-bublina zbalena" : "napoveda-bublina"}
      data-napoveda={ukazana.id}
      aria-live="polite"
      aria-label="Nápoveda majstra Melichara"
      style={miesto === null ? { visibility: "hidden" } : { left: miesto.left, top: miesto.top, width: miesto.width }}
      onClick={zbalena ? rozbal : zavri}
      title={zbalena ? "Melichar má nápovedu — klikni a ukáže sa." : "Klikni alebo stlač Esc a nápoveda zmizne."}
    >
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={40} height={40} />
      {/* Obe podoby sú v DOM vždy (CSS podľa triedy zbalena) — miestoBubliny meria plnú aj zbalenú. */}
      <button type="button" className="tlacidlo-male napoveda-rozbal" onClick={rozbal} tabIndex={zbalena ? 0 : -1}>
        nápoveda
      </button>
      <div className="napoveda-telo">
        <p className="napoveda-text">{ukazana.text}</p>
        <div className="napoveda-pata">
          <button type="button" className="tlacidlo-male tlacidlo-hlavne" onClick={zavri}>
            rozumiem
          </button>
          <button
            type="button"
            className="tlacidlo-jemne napoveda-vypnut"
            onClick={(e) => {
              e.stopPropagation();
              vypni();
              zavri();
            }}
            title="Nápovedy zapneš znova v profile."
          >
            vypnúť nápovedy
          </button>
        </div>
      </div>
    </aside>
  );
}
