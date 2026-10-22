// Menej klikov (roadmapa #9 B, Michal 2026-10-22): logika mimo stola, aby sa
// dala napojiť do akéhokoľvek rozloženia — HernaPlocha len kreslí tlačidlá.

import { useEffect, useRef, useState } from "react";
import type { ClientState, Command } from "@naex/core";
import { autoKoniecPitky } from "@naex/core";

/** Ako dlho sa dá pas ešte vrátiť, kým odíde na server. */
export const PAS_VRATIT_MS = 4000;
/** Krátka pauza pred automatickým „končím“, aby hráč videl, čo sa deje. */
const AUTO_KONCIM_MS = 600;

/**
 * „V tejto bitke už NA EX nedám“: do konca kola klient za hráča ukončí jeho
 * časť každej Pitky. Odpoveď na súperovo NA EX a Krčmu nechá na hráčovi.
 */
export function useBezNaexVBitke(
  view: ClientState,
  posli: (c: Command) => void,
): { readonly zapnute: boolean; readonly zapni: () => void; readonly vypni: () => void } {
  const [kolo, setKolo] = useState<number | null>(null);
  const poslane = useRef<string | null>(null);
  const prikaz = autoKoniecPitky(view, kolo);
  const kluc = prikaz === null ? null : `${view.kolo}:${view.pitkaCislo}`;
  useEffect(() => {
    if (prikaz === null || kluc === null || poslane.current === kluc) return;
    const t = setTimeout(() => {
      poslane.current = kluc;
      posli(prikaz);
    }, AUTO_KONCIM_MS);
    return () => clearTimeout(t);
  }, [kluc]);
  return {
    zapnute: kolo !== null && kolo === view.kolo,
    zapni: () => setKolo(view.kolo),
    vypni: () => setKolo(null),
  };
}

/**
 * Príkaz, ktorý sa dá pár sekúnd vrátiť (pas bez potvrdzovacieho okna). Nový
 * ťah (`kluc`) čakajúci príkaz zruší.
 */
export function useOdlozenyPrikaz(
  posli: (c: Command) => void,
  kluc: string,
  ms = PAS_VRATIT_MS,
): { readonly caka: Command | null; readonly zostavaS: number; readonly spusti: (c: Command) => void; readonly vrat: () => void } {
  const [caka, setCaka] = useState<{ readonly cmd: Command; readonly kedy: number } | null>(null);
  const [teraz, setTeraz] = useState(() => Date.now());
  useEffect(() => setCaka(null), [kluc]);
  useEffect(() => {
    if (caka === null) return;
    const t = setTimeout(() => {
      setCaka(null);
      posli(caka.cmd);
    }, Math.max(0, caka.kedy - Date.now()));
    const tik = setInterval(() => setTeraz(Date.now()), 250);
    return () => {
      clearTimeout(t);
      clearInterval(tik);
    };
  }, [caka]);
  return {
    caka: caka?.cmd ?? null,
    zostavaS: caka === null ? 0 : Math.max(0, Math.ceil((caka.kedy - teraz) / 1000)),
    spusti: (c) => {
      setTeraz(Date.now());
      setCaka({ cmd: c, kedy: Date.now() + ms });
    },
    vrat: () => setCaka(null),
  };
}
