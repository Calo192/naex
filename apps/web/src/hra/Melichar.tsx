// Hlášky majstra Melichara (Michal 2026-10-21): v partii proti počítaču po
// hráčovom ťahu občas utrúsi hlášku. Hlasitosť a frekvenciu si hráč nastaví
// v profile (hlasitosť 0 = Melichar mlčí). Kým hovorí, hudba sa stíši.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Command } from "@naex/core";
import { api } from "../lib/api.ts";
import { MELICHAR_FREKVENCIA_PREDVOLENA, MELICHAR_PREDVOLENY, useUcet } from "../lib/ucet.tsx";
import { TLMENIE_HUDBY, hlasitostZvuku, zamiesaj, type Skladba } from "./Hudba.tsx";

/** Hláška má rovnaký tvar ako skladba — nazov je jej text. */
export type HlaskaMelichara = Skladba;

/** Po hláške aspoň chvíľu ticho, nech jedna nenadväzuje na druhú. */
const TICHO_MS = 4_000;
/** Melichar reaguje s oneskorením, nie v tej istej chvíli ako klik. */
const ONESKORENIE_MS = 350;
/** Titulok ostane chvíľu po dohraní — krátka hláška by inak len blikla. */
const DOZNIEVANIE_MS = 1_500;

/** Príkazy, ktoré nie sú ťahom (vzdať sa, nechať tak) — Melichar k nim mlčí. */
const TICHE_PRIKAZY: ReadonlySet<Command["type"]> = new Set(["skipNaex", "bezReakcie", "draftStop", "skipLiecba", "bezPatronatu", "vzdat"]);

/** Šanca, že sa Melichar ozve po príkaze; na NA EX! dvojnásobná. */
export function sancaHlasky(cmd: Command, frekvencia: number): number {
  if (TICHE_PRIKAZY.has(cmd.type)) return 0;
  const naex = cmd.type === "naex" || (cmd.type === "tah" && cmd.kroky.some((k) => k.type === "naex"));
  return Math.min(1, (frekvencia / 100) * (naex ? 2 : 1));
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

const tlmHudbu = (tlm: boolean): void => {
  window.dispatchEvent(new CustomEvent(TLMENIE_HUDBY, { detail: tlm }));
};

export interface Titulok {
  readonly kluc: number;
  readonly text: string;
}

interface Hlas {
  readonly audio: HTMLAudioElement;
  rad: HlaskaMelichara[];
  posledna: string | null;
  hovori: boolean;
  tichoDo: number;
  caka: ReturnType<typeof setTimeout> | undefined;
  zhasni: ReturnType<typeof setTimeout> | undefined;
  skoncil(): void;
}

/** aktivny = rozohraná partia proti počítaču. ozvi(cmd) volaj pri každom hráčovom príkaze. */
export function useMelichar(aktivny: boolean): { readonly ozvi: (cmd: Command) => void; readonly titulok: Titulok | null } {
  const ja = useUcet().ja;
  const hlasitost = ja?.melichar ?? MELICHAR_PREDVOLENY;
  const frekvencia = ja?.melicharFrekvencia ?? MELICHAR_FREKVENCIA_PREDVOLENA;
  const zapnuty = aktivny && hlasitost > 0;
  const [titulok, setTitulok] = useState<Titulok | null>(null);
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
      zhasni: undefined,
      skoncil: () => {
        if (!h.hovori) return;
        h.hovori = false;
        h.tichoDo = Date.now() + TICHO_MS;
        tlmHudbu(false);
        clearTimeout(h.zhasni);
        h.zhasni = setTimeout(() => setTitulok(null), DOZNIEVANIE_MS);
      },
    };
    h.audio.addEventListener("ended", h.skoncil);
    h.audio.addEventListener("error", h.skoncil);
    hlas.current = h;

    return () => {
      clearTimeout(h.caka);
      clearTimeout(h.zhasni);
      h.audio.removeEventListener("ended", h.skoncil);
      h.audio.removeEventListener("error", h.skoncil);
      h.audio.pause();
      h.audio.removeAttribute("src");
      h.audio.load();
      if (h.hovori) tlmHudbu(false);
      hlas.current = null;
      setTitulok(null);
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
        clearTimeout(h.zhasni);
        setTitulok({ kluc: Date.now(), text: hlaska.nazov });
        tlmHudbu(true);
        h.audio.play().catch(h.skoncil);
      });
    }, ONESKORENIE_MS);
  }, []);

  return { ozvi, titulok };
}

export function MelicharTitulok({ titulok }: { readonly titulok: Titulok | null }) {
  if (titulok === null) return null;
  return (
    <div key={titulok.kluc} className="melichar-titulok" role="status">
      <span className="melichar-meno">Majster Melichar:</span>
      <span>„{titulok.text}“</span>
    </div>
  );
}
