// Hlášky majstra Melichara (Michal 2026-10-21): v partii proti počítaču sa ozve
// pri pečiatke momentu (Michal 2026-10-23, nápad 5) — už nie náhodne po NA EX —
// hláškou zo skupiny podľa toho, komu sa moment stal: Pohoda, Smola, inak Údiv.
// Hlasitosť si hráč nastaví v profile (0 = Melichar mlčí). Hudba hrá ďalej
// rovnako nahlas a názov hlášky sa neukazuje (Michal 2026-10-22).

import { useCallback, useEffect, useRef } from "react";
import type { Moment, PlayerId } from "@naex/core";
import { api } from "../lib/api.ts";
import { MELICHAR_PREDVOLENY, useUcet } from "../lib/ucet.tsx";
import { hlasitostZvuku, zamiesaj, type Skladba } from "./Hudba.tsx";

/** Hláška má rovnaký tvar ako skladba — nazov je jej text; trvanieMs pre soundboard. */
export type HlaskaMelichara = Skladba & { readonly trvanieMs?: number };

/** Po hláške aspoň chvíľu ticho, nech jedna nenadväzuje na druhú. */
const TICHO_MS = 4_000;
/** Melichar reaguje s oneskorením, nie v tej istej chvíli ako pečiatka. */
const ONESKORENIE_MS = 350;

/** Skupina hlášky k momentu: kto sa teší, kto sa ľutuje, alebo spoločný údiv. */
export type SkupinaHlasky = "pohoda" | "smola" | "udiv";

/**
 * Hlášky k momentom podľa názvu (Michal ich schváli). Smola je sebaľútosť, nie
 * posmech — hlášky, ktoré by porazeného zosmiešňovali alebo urážali, k momentom
 * nepatria. Hláška mimo zoznamu sa pri momente nepustí.
 */
const SKUPINY: Readonly<Record<string, SkupinaHlasky>> = {
  "toto je zivot": "pohoda",
  "keksy a kokotiny": "pohoda",
  "no teda toto som nevideu": "udiv",
  "no toto je marha": "udiv",
  "boha": "udiv",
  "ach boha": "smola",
  "uz mam v pici nervy zas": "smola",
  "to zas bude vyzerat": "smola",
  "jebem ja tvojho boha": "smola",
};

const kluc = (nazov: string): string => nazov.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Skupina hlášky pre hráča `ja`: moment v jeho prospech = Pohoda, v súperov = Smola. */
export function skupinaMomentu(moment: Moment, ja: PlayerId): SkupinaHlasky {
  return moment.hrac === null ? "udiv" : moment.hrac === ja ? "pohoda" : "smola";
}

/** Hlášky danej skupiny; prázdna skupina → Údiv (nech Melichar nemlčí, keď chýba nahrávka). */
export function hlaskySkupiny(hlasky: readonly HlaskaMelichara[], skupina: SkupinaHlasky): HlaskaMelichara[] {
  const v = hlasky.filter((h) => SKUPINY[kluc(h.nazov)] === skupina);
  return v.length > 0 || skupina === "udiv" ? v : hlasky.filter((h) => SKUPINY[kluc(h.nazov)] === "udiv");
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
  posledna: string | null;
  hovori: boolean;
  tichoDo: number;
  caka: ReturnType<typeof setTimeout> | undefined;
  skoncil(): void;
}

/** aktivny = rozohraná partia proti počítaču. ozviMoment(skupina) volaj pri pečiatke momentu. */
export function useMelichar(aktivny: boolean): { readonly ozviMoment: (skupina: SkupinaHlasky) => void } {
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

  const ozviMoment = useCallback((skupina: SkupinaHlasky): void => {
    const h = hlas.current;
    if (h === null || h.hovori || Date.now() < h.tichoDo) return;
    // Obsadené hneď — ďalší moment počas oneskorenia už novú hlášku nespustí.
    h.hovori = true;
    h.caka = setTimeout(() => {
      void nacitajHlasky().then((hlasky) => {
        if (hlas.current !== h) return;
        const hlaska = zamiesaj(hlaskySkupiny(hlasky, skupina), h.posledna)[0] as HlaskaMelichara | undefined;
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
