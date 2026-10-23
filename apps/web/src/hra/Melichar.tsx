// Hlášky majstra Melichara (Michal 2026-10-21): v partii proti počítaču sa ozve
// pri pečiatke momentu (Michal 2026-10-23, nápad 5) — už nie náhodne po NA EX.
// Moment má náladu (jadro, NALADY_MOMENTOV), skupiny hlášok k nálade určujú
// dáta (pole nalady v skupina.json pri importe). Hlasitosť si hráč nastaví
// v profile (0 = Melichar mlčí). Hudba hrá ďalej rovnako nahlas a názov
// hlášky sa neukazuje (Michal 2026-10-22).

import { useCallback, useEffect, useRef } from "react";
import type { NaladaMomentu } from "@naex/core";
import { api } from "../lib/api.ts";
import { MELICHAR_PREDVOLENY, useUcet } from "../lib/ucet.tsx";
import { hlasitostZvuku, zamiesaj, type Skladba } from "./Hudba.tsx";

/** Hláška má rovnaký tvar ako skladba — nazov je jej text; trvanieMs pre soundboard, skupina = priečinok pri importe. */
export type HlaskaMelichara = Skladba & { readonly trvanieMs?: number; readonly skupina?: string };

/** Skupina hlášok (dáta z importu, server skupiny.json). */
export interface SkupinaMelichara {
  readonly id: string;
  readonly nazov: string;
  readonly citat: string;
  readonly ikona: string;
  readonly farba: string;
  readonly klaves: string | null;
  readonly nalady: readonly NaladaMomentu[];
}

export interface Melichar {
  readonly hlasky: readonly HlaskaMelichara[];
  readonly skupiny: readonly SkupinaMelichara[];
}

/** Po hláške aspoň chvíľu ticho, nech jedna nenadväzuje na druhú. */
const TICHO_MS = 4_000;
/** Melichar reaguje s oneskorením, nie v tej istej chvíli ako pečiatka. */
const ONESKORENIE_MS = 350;

/** Hlášky skupín s danou náladou; žiadna → Údiv (nech Melichar nemlčí, keď chýba nahrávka). */
export function hlaskyNalady({ hlasky, skupiny }: Melichar, nalada: NaladaMomentu): HlaskaMelichara[] {
  const z = (n: NaladaMomentu): HlaskaMelichara[] => {
    const ids = new Set(skupiny.filter((s) => s.nalady.includes(n)).map((s) => s.id));
    return hlasky.filter((h) => h.skupina !== undefined && ids.has(h.skupina));
  };
  const v = z(nalada);
  return v.length > 0 || nalada === "udiv" ? v : z("udiv");
}

let nacitane: Promise<Melichar> | null = null;

/** Hlášky a skupiny — načítajú sa raz za návštevu; po chybe sa skúsi znova nabudúce. */
export function nacitajMelichara(): Promise<Melichar> {
  nacitane ??= api
    .get<{ hlasky: HlaskaMelichara[]; skupiny?: SkupinaMelichara[] }>("/melichar")
    .then((r) => ({ hlasky: r.hlasky, skupiny: r.skupiny ?? [] }))
    .catch(() => {
      nacitane = null;
      return { hlasky: [], skupiny: [] };
    });
  return nacitane;
}

export const nacitajHlasky = (): Promise<readonly HlaskaMelichara[]> => nacitajMelichara().then((m) => m.hlasky);

export const urlHlasky = (h: HlaskaMelichara): string => `/melichar/${h.subor}`;

interface Hlas {
  readonly audio: HTMLAudioElement;
  posledna: string | null;
  hovori: boolean;
  tichoDo: number;
  caka: ReturnType<typeof setTimeout> | undefined;
  skoncil(): void;
}

/** aktivny = rozohraná partia proti počítaču. ozviMoment(nalada) volaj pri pečiatke momentu. */
export function useMelichar(aktivny: boolean): { readonly ozviMoment: (nalada: NaladaMomentu) => void } {
  const ja = useUcet().ja;
  const hlasitost = ja?.melichar ?? MELICHAR_PREDVOLENY;
  const zapnuty = aktivny && hlasitost > 0;
  const hlas = useRef<Hlas | null>(null);
  const nastavenie = useRef({ hlasitost });
  nastavenie.current = { hlasitost };

  useEffect(() => {
    if (hlas.current !== null) hlas.current.audio.volume = hlasitostZvuku(hlasitost);
  }, [hlasitost]);

  useEffect(() => {
    if (!zapnuty) return;
    void nacitajHlasky();
    const h: Hlas = {
      audio: new Audio(),
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

  const ozviMoment = useCallback((nalada: NaladaMomentu): void => {
    const h = hlas.current;
    if (h === null || h.hovori || Date.now() < h.tichoDo) return;
    // Obsadené hneď — ďalší moment počas oneskorenia už novú hlášku nespustí.
    h.hovori = true;
    h.caka = setTimeout(() => {
      void nacitajMelichara().then((m) => {
        if (hlas.current !== h) return;
        const hlaska = zamiesaj(hlaskyNalady(m, nalada), h.posledna)[0] as HlaskaMelichara | undefined;
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

  return { ozviMoment };
}
