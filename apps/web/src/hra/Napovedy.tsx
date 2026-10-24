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
/** Prekryté tlačidlo, nadpis či miesto na kartu váži toľkokrát viac ako prekrytá karta na stole. */
const VAHA_TLACIDLA = 20;
/** Čo bublina nesmie zakryť (váha VAHA_TLACIDLA) a čo smie, len keď inde miesto nie je (karty — aj klikateľné, role=button). */
const TAZKE = "button, input, [role='button']:not(.kl), .ruka, .linia-stav, .stavba-zona-miesto, .stavba-zona-nazov, .draft-hlava > *";
const PREKAZKY = `.hra :is(${TAZKE}, .kl)`;

interface Prekazka {
  readonly r: DOMRect;
  readonly vaha: number;
}

function prekazky(bublina: HTMLElement): Prekazka[] {
  return [...document.querySelectorAll<HTMLElement>(PREKAZKY)]
    .filter((el) => !bublina.contains(el) && el.getClientRects().length > 0)
    .map((el) => ({ r: el.getBoundingClientRect(), vaha: el.matches(TAZKE) ? VAHA_TLACIDLA : 1 }));
}

const prekrytie = (p: readonly Prekazka[], left: number, top: number, w: number, h: number): number =>
  p.reduce((a, x) => a + x.vaha * prienik(x.r, left, top, w, h), 0);

/**
 * Kam bublinu položiť: do rohu stola, kde neprekryje tlačidlá, nadpisy ani karty (ruka je
 * pod stolom, tú nezakryje nikdy). Bublina sa smie zúžiť, aby sa vošla vedľa kariet; keď
 * nevojde nikde, vyberie roh s najmenším váženým prekrytím. Pri rovnosti vyhrá skorší roh.
 */
function miestoBubliny(bublina: HTMLElement): { readonly miesto: Miesto; readonly skore: number } {
  // Inline šírku nastavuje React (style) — po meraní sa vráti, inak by ju pri rovnakej hodnote nezapísal znova.
  const predtym = bublina.style.width;
  bublina.style.width = "";
  const plna = bublina.offsetWidth;
  const stol = document.querySelector(".hra .linia-obal")?.getBoundingClientRect();
  if (stol === undefined) {
    const top = Math.max(8, window.innerHeight - bublina.offsetHeight - 160);
    bublina.style.width = predtym;
    return { miesto: { left: 16, top, width: plna }, skore: 0 };
  }
  const okraj = 12;
  const p = prekazky(bublina);
  let najlepsie: Miesto | null = null;
  let najmenej = Number.POSITIVE_INFINITY;
  for (const roh of ["vlavo-hore", "vpravo-hore", "vlavo-dole", "vpravo-dole"] as const) {
    for (let w = plna; w >= Math.min(plna, NAJUZSIA); w -= 20) {
      bublina.style.width = `${w}px`;
      const h = bublina.offsetHeight;
      // Hore je pilulka s pokynom (na hrane stola) — bublina začne pod ňou.
      const top = Math.round(Math.max(8, roh.endsWith("hore") ? stol.top + 34 : Math.min(stol.bottom, window.innerHeight) - h - okraj));
      const left = Math.round(Math.max(8, roh.startsWith("vlavo") ? stol.left + okraj : stol.right - w - okraj));
      const plocha = prekrytie(p, left, top, w, h);
      if (plocha < najmenej) {
        najmenej = plocha;
        najlepsie = { left, top, width: w };
      }
      if (plocha === 0) break;
    }
    if (najmenej === 0) break;
  }
  bublina.style.width = predtym;
  return { miesto: najlepsie ?? { left: 16, top: 120, width: plna }, skore: najmenej };
}

/** Vážené prekrytie bubliny na mieste, kde práve je. */
function skoreTeraz(bublina: HTMLElement): number {
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
  // Esc zavrie najprv bublinu (capture) — návrh ťahu na stole ostane.
  useEffect(() => {
    if (ukazana === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      zavri();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, [ukazana, zavri]);

  useRamik(ukazana?.zvyraznit ?? null);

  const bublina = useRef<HTMLElement>(null);
  const [miesto, setMiesto] = useState<Miesto | null>(null);
  // Iná fáza = iný stôl (voľba cieľa → stavba šenku → línia): miesto sa vyberie znova.
  const usek = `${view.faza}|${view.draftStav?.krok ?? ""}|${view.bitkaStav?.krok ?? ""}`;
  useLayoutEffect(() => {
    if (ukazana === null || bublina.current === null) {
      setMiesto(null);
      return;
    }
    const el = bublina.current;
    const zmeraj = (): void => setMiesto(miestoBubliny(el).miesto);
    zmeraj();
    // Karty stola sa po prekreslení ešte dorovnajú (zarovnanie línie) — druhé meranie o chvíľu.
    const t = setTimeout(zmeraj, 300);
    // Stôl sa mení aj bez novej fázy (karty šenku dobehnú, objaví sa tlačidlo): keď bublina
    // niečo zakrýva a inde by zakryla citeľne menej, presunie sa — inak stojí.
    const kontrola = setInterval(() => {
      const teraz = skoreTeraz(el);
      if (teraz === 0) return;
      const nove = miestoBubliny(el);
      if (nove.skore < teraz / 2) setMiesto(nove.miesto);
    }, 1000);
    window.addEventListener("resize", zmeraj);
    return () => {
      clearTimeout(t);
      clearInterval(kontrola);
      window.removeEventListener("resize", zmeraj);
    };
    // Miesto sa vyberie pri otvorení, v novej fáze, pri zmene okna a keď niečo zakrýva.
  }, [ukazana, usek]);

  if (ukazana === null) return null;
  return (
    <aside
      ref={bublina}
      className="napoveda-bublina"
      data-napoveda={ukazana.id}
      aria-live="polite"
      aria-label="Nápoveda majstra Melichara"
      style={miesto === null ? { visibility: "hidden" } : { left: miesto.left, top: miesto.top, width: miesto.width }}
      onClick={zavri}
      title="Klikni alebo stlač Esc a nápoveda zmizne."
    >
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={40} height={40} />
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
