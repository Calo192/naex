// Hlášky majstra Melichara (Michal 2026-10-21): v partii proti počítaču po
// hráčovom NA EX! či vyložení karty občas utrúsi hlášku. Hlasitosť a frekvenciu
// si hráč nastaví v profile (hlasitosť 0 = Melichar mlčí). Hudba hrá ďalej
// rovnako nahlas a názov hlášky sa neukazuje (Michal 2026-10-22).

import { useCallback, useEffect, useRef } from "react";
import type { Command } from "@naex/core";
import { api } from "../lib/api.ts";
import { MELICHAR_FREKVENCIA_DO, MELICHAR_FREKVENCIA_PREDVOLENA, MELICHAR_PREDVOLENY, useUcet } from "../lib/ucet.tsx";
import { hlasitostZvuku, zamiesaj, type Skladba } from "./Hudba.tsx";

/** Hláška má rovnaký tvar ako skladba — nazov je jej text; trvanieMs pre soundboard. */
export type HlaskaMelichara = Skladba & { readonly trvanieMs?: number };

/** Po hláške aspoň chvíľu ticho, nech jedna nenadväzuje na druhú. */
const TICHO_MS = 4_000;
/** Melichar reaguje s oneskorením, nie v tej istej chvíli ako klik. */
const ONESKORENIE_MS = 350;

/** Vyloženie karty na stôl — do línie (aj odpoveď na NA EX) či do Dedičstva, nie priznanie. */
const jeVylozenie = (c: Command): boolean => c.type === "place" && c.target !== "priznanie";

/**
 * Šanca, že sa Melichar ozve po príkaze: len po NA EX! (dvojnásobná) a po
 * vyložení karty, nikdy viac než MELICHAR_FREKVENCIA_DO (Michal 2026-10-22).
 */
export function sancaHlasky(cmd: Command, frekvencia: number): number {
  const kroky = cmd.type === "tah" ? cmd.kroky : [cmd];
  const nasobok = kroky.some((k) => k.type === "naex") ? 2 : kroky.some(jeVylozenie) ? 1 : 0;
  return Math.min(MELICHAR_FREKVENCIA_DO, frekvencia * nasobok) / 100;
}

let zoznam: Promise<readonly HlaskaMelichara[]> | null = null;

/** Zoznam hlášok — načíta sa raz za návštevu; po chybe sa skúsi znova nabudúce. */
export function nacitajHlasky(): Promise<readonly HlaskaMelichara[]> {
  zoznam ??= api
    .get<{ hlasky: HlaskaMelichara[] }>("/melichar")
    .then((r) => r.hlasky)
    .catch(() => {
      zoznam = null;
      return [];
    });
  return zoznam;
}

export const urlHlasky = (h: HlaskaMelichara): string => `/melichar/${h.subor}`;

interface Hlas {
  readonly audio: HTMLAudioElement;
  rad: HlaskaMelichara[];
  posledna: string | null;
  hovori: boolean;
  tichoDo: number;
  caka: ReturnType<typeof setTimeout> | undefined;
  skoncil(): void;
}

/** aktivny = rozohraná partia proti počítaču. ozvi(cmd) volaj pri každom hráčovom príkaze. */
export function useMelichar(aktivny: boolean): { readonly ozvi: (cmd: Command) => void } {
  const ja = useUcet().ja;
  const hlasitost = ja?.melichar ?? MELICHAR_PREDVOLENY;
  const frekvencia = ja?.melicharFrekvencia ?? MELICHAR_FREKVENCIA_PREDVOLENA;
  const zapnuty = aktivny && hlasitost > 0;
  const hlas = useRef<Hlas | null>(null);
  const nastavenie = useRef({ hlasitost, frekvencia });
  nastavenie.current = { hlasitost, frekvencia };

  useEffect(() => {
    if (hlas.current !== null) hlas.current.audio.volume = hlasitostZvuku(hlasitost);
  }, [hlasitost]);

  useEffect(() => {
    if (!zapnuty) return;
    void nacitajHlasky();
    const h: Hlas = {
      audio: new Audio(),
      rad: [],
      posledna: null,
      hovori: false,
      tichoDo: 0,
      caka: undefined,
      skoncil: () => {
        if (!h.hovori) return;
        h.hovori = false;
        h.tichoDo = Date.now() + TICHO_MS;
      },
    };
    h.audio.addEventListener("ended", h.skoncil);
    h.audio.addEventListener("error", h.skoncil);
    hlas.current = h;

    return () => {
      clearTimeout(h.caka);
      h.audio.removeEventListener("ended", h.skoncil);
      h.audio.removeEventListener("error", h.skoncil);
      h.audio.pause();
      h.audio.removeAttribute("src");
      h.audio.load();
      hlas.current = null;
    };
  }, [zapnuty]);

  const ozvi = useCallback((cmd: Command): void => {
    const h = hlas.current;
    if (h === null || h.hovori || Date.now() < h.tichoDo) return;
    if (Math.random() >= sancaHlasky(cmd, nastavenie.current.frekvencia)) return;
    // Obsadené hneď — ďalší ťah počas oneskorenia už novú hlášku nespustí.
    h.hovori = true;
    h.caka = setTimeout(() => {
      void nacitajHlasky().then((hlasky) => {
        if (hlas.current !== h) return;
        if (h.rad.length === 0) h.rad = zamiesaj(hlasky, h.posledna);
        const hlaska = h.rad.shift();
        if (hlaska === undefined) {
          h.hovori = false;
          return;
        }
        h.posledna = hlaska.id;
        h.audio.src = urlHlasky(hlaska);
        h.audio.volume = hlasitostZvuku(nastavenie.current.hlasitost);
        h.audio.play().catch(h.skoncil);
      });
    }, ONESKORENIE_MS);
  }, []);

  return { ozvi };
}
