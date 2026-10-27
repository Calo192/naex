// Pečiatka momentu (Michal 2026-10-23, nápad 5): keď sa v partii naozaj niečo
// stane, nad stolom dopadne pečiatka („ZVRAT!“, „VÝPRASK“…) a Melichar sa
// ozve. Momenty vyberá jadro na serveri (momenty.ts) — klient ich len ukáže.
// Pečiatka nič neblokuje (pointer-events: none).
//
// Michal 2026-10-27: pečiatky boli prekryté súhrnom bitky. Pečiatka teraz padne
// NAD súhrn (bitky aj Pitky), keď je dopočítaný — veľká, natočená, s otrasom, ako
// gumová pečiatka. Po chvíli na prečítanie sa zmenší do rohu súhrnu a ostane tam,
// kým ho hráč nezavrie. Bez súhrnu po chvíli zmizne. Viac pečiatok naraz ide pod seba.
// Ukážka na snímky a UI inšpekciu: /hra?ukazka-momentu=zvrat (len vzhľad, na minútu).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Event, Moment, NaladaMomentu, PlayerId, TypMomentu } from "@naex/core";
import { MOMENTY, naladaMomentu } from "@naex/core";
import "./hra.css";

/** Ako dlho je pečiatka veľká — dopad (0,45 s) a asi 2 s na prečítanie. */
const VELKA_MS = 2_500;
/** Bez súhrnu pod sebou pečiatka po veľkej fáze odíde. */
const ODCHOD_MS = 500;
/**
 * Toľko dáme stolu, kým rozbehne Počítadlo bitky či rekapituláciu Pitky — potom
 * pečiatka čaká, kým je súhrn dopočítaný (trieda .hotova), alebo padne hneď.
 */
const ROZBEH_MS = 150;
const KONTROLA_MS = 150;
/** Ukážka z adresy ostane dlhšie, nech ju stihne odfotiť nástroj. */
const UKAZKA_MS = 60_000;
/** Súhrn bitky či Pitky (PocitadloBitky, RekapitulaciaPitkyVrstva). */
const SUHRN = ".pocitadlo-bitky";
const PANEL_SUHRNU = ".pocitadlo-bitky .pocitadlo-panel";

/** Ukážkový moment z adresy (?ukazka-momentu=typ), inak null. */
function ukazkaZAdresy(): Moment | null {
  const typ = new URLSearchParams(location.search).get("ukazka-momentu") as TypMomentu | null;
  if (typ === null || !(typ in MOMENTY)) return null;
  return { typ, ...MOMENTY[typ], hrac: 0, popis: "Ukážka pečiatky — takto sa ukáže moment, ktorý v partii práve nastal." };
}

export interface MomentyProps {
  readonly udalosti: { readonly id: number; readonly events: readonly Event[] };
  readonly ja: PlayerId;
  /** Mená hráčov podľa miesta — do popisu („Hráč N“ → meno). */
  readonly mena: readonly string[];
  readonly hovor: (nalada: NaladaMomentu) => void;
  /** Je otvorený súhrn bitky či Pitky (alebo sa naň čaká) — pečiatka padne naň a ostane v jeho rohu. */
  readonly pocitadloBezi?: boolean;
}

type Faza = "velka" | "roh" | "odchod";
interface Aktivne {
  readonly id: number;
  readonly momenty: readonly Moment[];
  readonly faza: Faza;
  /** Roh panela súhrnu, kam sa pečiatka zmenší (px). */
  readonly roh: { readonly x: number; readonly y: number } | null;
}

export function Momenty({ udalosti, ja, mena, hovor, pocitadloBezi = false }: MomentyProps) {
  const [aktivne, setAktivne] = useState<Aktivne | null>(() => {
    const u = ukazkaZAdresy();
    return u === null ? null : { id: -1, momenty: [u], faza: "velka", roh: null };
  });
  const [cakajuce, setCakajuce] = useState<{ readonly id: number; readonly momenty: readonly Moment[] } | null>(null);
  const hovorRef = useRef(hovor);
  hovorRef.current = hovor;
  const jaRef = useRef(ja);
  jaRef.current = ja;
  const beziRef = useRef(pocitadloBezi);
  beziRef.current = pocitadloBezi;

  useEffect(() => {
    const momenty = udalosti.events.flatMap((e) => (e.type === "moment" ? [e.moment] : []));
    if (momenty.length > 0) setCakajuce({ id: udalosti.id, momenty });
  }, [udalosti]);

  // Čakanie na súhrn: kým beží Počítadlo (súhrn ešte nie je dopočítaný), pečiatka nepadne.
  useEffect(() => {
    if (cakajuce === null) return;
    let t: ReturnType<typeof setTimeout>;
    const skus = (): void => {
      const dopocitany = document.querySelector(`${SUHRN}.hotova`) !== null;
      if (beziRef.current && !dopocitany) {
        t = setTimeout(skus, KONTROLA_MS);
        return;
      }
      setCakajuce(null);
      setAktivne({ id: cakajuce.id, momenty: cakajuce.momenty, faza: "velka", roh: null });
      const posledny = cakajuce.momenty.at(-1);
      if (posledny !== undefined) hovorRef.current(naladaMomentu(posledny, jaRef.current));
      // Otras súhrnu pod pečiatkou — buchne do neho.
      const suhrn = document.querySelector(SUHRN);
      if (suhrn !== null && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        suhrn.classList.remove("moment-otras");
        void (suhrn as HTMLElement).offsetWidth;
        suhrn.classList.add("moment-otras");
      }
    };
    t = setTimeout(skus, ROZBEH_MS);
    return () => clearTimeout(t);
  }, [cakajuce]);

  // Po veľkej fáze: do rohu súhrnu, ak je otvorený; inak preč.
  useEffect(() => {
    if (aktivne === null || aktivne.faza !== "velka" || aktivne.id === -1) return;
    const t = setTimeout(() => {
      const panel = document.querySelector(PANEL_SUHRNU)?.getBoundingClientRect();
      setAktivne((a) =>
        a?.id !== aktivne.id ? a : panel === undefined ? { ...a, faza: "odchod" } : { ...a, faza: "roh", roh: { x: panel.right - 6, y: panel.top + 6 } },
      );
    }, VELKA_MS);
    return () => clearTimeout(t);
  }, [aktivne]);

  // V rohu ostane, kým je súhrn otvorený; po jeho zavretí (Ďalej) odíde.
  useEffect(() => {
    if (aktivne === null) return;
    if (aktivne.faza === "roh" && !pocitadloBezi) setAktivne({ ...aktivne, faza: "odchod" });
    if (aktivne.faza !== "odchod") return;
    const t = setTimeout(() => setAktivne((a) => (a?.id === aktivne.id ? null : a)), ODCHOD_MS);
    return () => clearTimeout(t);
  }, [aktivne, pocitadloBezi]);

  useEffect(() => {
    if (aktivne?.id !== -1) return;
    const t = setTimeout(() => setAktivne((a) => (a?.id === -1 ? null : a)), UKAZKA_MS);
    return () => clearTimeout(t);
    // Len pri prvom vykreslení — ukážka z adresy.
  }, []);

  if (aktivne === null) return null;
  const popisy = aktivne.momenty.map((m) => m.popis.replace(/[Hh]ráč ([12])/g, (_, n: string) => mena[Number(n) - 1] ?? `Hráč ${n}`));
  const poloha: CSSProperties = aktivne.roh === null ? {} : { left: aktivne.roh.x, top: aktivne.roh.y };
  return (
    <div className="moment-vrstva" aria-live="polite" role="status">
      <div className={`moment-stoh moment-${aktivne.faza}`} style={poloha}>
        {aktivne.momenty.map((moment, i) => (
          <div
            key={`${aktivne.id}-${i}`}
            className={`moment-pecat moment-${moment.stupen}${aktivne.id === -1 ? " moment-ukazka" : ""}`}
            style={{ "--poradie": i } as CSSProperties}
            title={popisy[i]}
          >
            <span className="moment-nazov">{moment.nazov}</span>
            <span className="moment-popis">{popisy[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
