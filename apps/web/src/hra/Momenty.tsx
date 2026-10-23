// Pečiatka momentu (Michal 2026-10-23, nápad 5): keď sa v partii naozaj niečo
// stane, nad stolom dopadne pečiatka („ZVRAT!“, „VÝPRASK“…) a Melichar sa
// ozve. Momenty vyberá jadro na serveri (momenty.ts) — klient ich len ukáže.
// Pečiatka nič neblokuje (pointer-events: none) a o pár sekúnd zmizne.
// Ukážka na snímky a UI inšpekciu: /hra?ukazka-momentu=zvrat (len vzhľad, na minútu).

import { useEffect, useRef, useState } from "react";
import type { Event, Moment, PlayerId, TypMomentu } from "@naex/core";
import { MOMENTY } from "@naex/core";
import { skupinaMomentu, type SkupinaHlasky } from "./Melichar.tsx";
import "./hra.css";

/** Ako dlho pečiatka ostane na stole. */
const NA_STOLE_MS = 3_200;
/** Moment z bitky počká, kým dobehne výsledok bitky (Počítadlo bitky). */
const PO_BITKE_MS = 4_000;
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
}

export function Momenty({ udalosti, ja, mena, hovor }: MomentyProps) {
  const [aktivny, setAktivny] = useState<{ readonly id: number; readonly moment: Moment } | null>(() => {
    const u = ukazkaZAdresy();
    return u === null ? null : { id: -1, moment: u };
  });
  // Časovače neruší nová správa zo servera (bot ťahá rýchlo) — len odchod zo stola.
  const casovace = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hovorRef = useRef(hovor);
  hovorRef.current = hovor;

  useEffect(() => {
    const moment = udalosti.events.flatMap((e) => (e.type === "moment" ? [e.moment] : [])).at(-1);
    if (moment === undefined) return;
    const caka = udalosti.events.some((e) => e.type === "bitkaVysledok") ? PO_BITKE_MS : 0;
    casovace.current.push(
      setTimeout(() => {
        setAktivny({ id: udalosti.id, moment });
        hovorRef.current(skupinaMomentu(moment, ja));
      }, caka),
      setTimeout(() => setAktivny((a) => (a?.id === udalosti.id ? null : a)), caka + NA_STOLE_MS),
    );
  }, [udalosti, ja]);

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
