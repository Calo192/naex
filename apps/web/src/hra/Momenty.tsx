// Pečiatka momentu (Michal 2026-10-23, nápad 5): keď sa v partii naozaj niečo
// stane, nad stolom dopadne pečiatka („ZVRAT!“, „VÝPRASK“…) a Melichar sa
// ozve. Momenty vyberá jadro na serveri (momenty.ts) — klient ich len ukáže.
// Pečiatka nič neblokuje (pointer-events: none) a o pár sekúnd zmizne.
// Ukážka na snímky a UI inšpekciu: /hra?ukazka-momentu=zvrat (len vzhľad, na minútu).

import { useEffect, useRef, useState } from "react";
import type { Event, Moment, PlayerId, SkupinaHlasky, TypMomentu } from "@naex/core";
import { MOMENTY, skupinaMomentu } from "@naex/core";
import "./hra.css";

/** Ako dlho pečiatka ostane na stole. */
const NA_STOLE_MS = 3_200;
/**
 * Moment z bitky čaká na koniec Počítadla bitky (pocitadloBezi). Toľko mu dáme,
 * kým sa Počítadlo rozbehne; keď sa nespustí vôbec (preskočené, bez animácií),
 * pečiatka padne hneď po ňom.
 */
const ROZBEH_POCITADLA_MS = 150;
/** Ukážka z adresy ostane dlhšie, nech ju stihne odfotiť nástroj. */
const UKAZKA_MS = 60_000;

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
  readonly hovor: (skupina: SkupinaHlasky) => void;
  /** Beží Počítadlo bitky — pečiatka z bitky počká, nech nepadne pod neho. */
  readonly pocitadloBezi?: boolean;
}

type Aktivny = { readonly id: number; readonly moment: Moment };

export function Momenty({ udalosti, ja, mena, hovor, pocitadloBezi = false }: MomentyProps) {
  const [aktivny, setAktivny] = useState<Aktivny | null>(() => {
    const u = ukazkaZAdresy();
    return u === null ? null : { id: -1, moment: u };
  });
  // Časovače neruší nová správa zo servera (bot ťahá rýchlo) — len odchod zo stola.
  const casovace = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [poBitke, setPoBitke] = useState<Aktivny | null>(null);
  const hovorRef = useRef(hovor);
  hovorRef.current = hovor;
  const jaRef = useRef(ja);
  jaRef.current = ja;

  const ukaz = useRef((a: Aktivny): void => {
    setAktivny(a);
    hovorRef.current(skupinaMomentu(a.moment, jaRef.current));
    casovace.current.push(setTimeout(() => setAktivny((x) => (x?.id === a.id ? null : x)), NA_STOLE_MS));
  }).current;

  useEffect(() => {
    const moment = udalosti.events.flatMap((e) => (e.type === "moment" ? [e.moment] : [])).at(-1);
    if (moment === undefined) return;
    if (udalosti.events.some((e) => e.type === "bitkaVysledok")) setPoBitke({ id: udalosti.id, moment });
    else ukaz({ id: udalosti.id, moment });
  }, [udalosti, ukaz]);

  useEffect(() => {
    if (poBitke === null || pocitadloBezi) return;
    const t = setTimeout(() => {
      setPoBitke(null);
      ukaz(poBitke);
    }, ROZBEH_POCITADLA_MS);
    return () => clearTimeout(t);
  }, [poBitke, pocitadloBezi, ukaz]);

  useEffect(() => {
    if (aktivny?.id === -1) casovace.current.push(setTimeout(() => setAktivny((a) => (a?.id === -1 ? null : a)), UKAZKA_MS));
    return () => casovace.current.forEach(clearTimeout);
    // Len pri prvom vykreslení — ukážka z adresy.
  }, []);

  if (aktivny === null) return null;
  const { moment } = aktivny;
  const popis = moment.popis.replace(/[Hh]ráč ([12])/g, (_, n: string) => mena[Number(n) - 1] ?? `Hráč ${n}`);
  return (
    <div className="moment-vrstva" aria-live="polite" role="status">
      <div key={aktivny.id} className={`moment-pecat moment-${moment.stupen}${aktivny.id === -1 ? " moment-ukazka" : ""}`} title={popis}>
        <span className="moment-nazov">{moment.nazov}</span>
        <span className="moment-popis">{popis}</span>
      </div>
    </div>
  );
}
