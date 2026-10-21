// Hudba počas partie (Michal 2026-10-20): skladby z playlistu NaEx – PLEBS v náhodnom
// poradí, medzi skladbami 10 s ticho a na začiatku skladby krátko jej názov.
// Hlasitosť si hráč nastaví v profile (0 = hudba vypnutá).

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.ts";
import { HUDBA_PREDVOLENA, useUcet } from "../lib/ucet.tsx";

export interface Skladba {
  readonly id: string;
  readonly nazov: string;
  /** Súbor pod /hudba/. */
  readonly subor: string;
}

const PAUZA_MS = 10_000;
const OZNAM_MS = 4_500;

/** Udalosť na window (detail: boolean) — kým hovorí majster Melichar, hudba hrá tichšie. */
export const TLMENIE_HUDBY = "naex:tlmenie-hudby";
const TLMENA_HLASITOST = 0.3;

let zoznam: Promise<readonly Skladba[]> | null = null;

/** Zoznam skladieb — načíta sa raz za návštevu; po chybe sa skúsi znova nabudúce. */
export function nacitajSkladby(): Promise<readonly Skladba[]> {
  zoznam ??= api
    .get<{ skladby: Skladba[] }>("/hudba")
    .then((r) => r.skladby)
    .catch(() => {
      zoznam = null;
      return [];
    });
  return zoznam;
}

export const urlSkladby = (s: Skladba): string => `/hudba/${s.subor}`;

/** Ucho vníma hlasitosť logaritmicky — s kvadrátom posuvník pôsobí rovnomerne. */
export const hlasitostZvuku = (percenta: number): number => Math.min(1, Math.max(0, percenta / 100)) ** 2;

/** Zamiešané poradie; nové kolo nezačne skladbou, ktorá práve dohrala. */
export function zamiesaj(skladby: readonly Skladba[], posledna: string | null): Skladba[] {
  const rad = [...skladby];
  for (let i = rad.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rad[i], rad[j]] = [rad[j] as Skladba, rad[i] as Skladba];
  }
  if (rad.length > 1 && rad[0]?.id === posledna) [rad[0], rad[rad.length - 1]] = [rad[rad.length - 1] as Skladba, rad[0]];
  return rad;
}

export function HudbaPartie() {
  const hlasitost = useUcet().ja?.hudba ?? HUDBA_PREDVOLENA;
  const zapnuta = hlasitost > 0;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [oznam, setOznam] = useState<{ readonly kluc: number; readonly nazov: string } | null>(null);
  const [tlmena, setTlmena] = useState(false);
  const hlasitostTeraz = hlasitostZvuku(hlasitost) * (tlmena ? TLMENA_HLASITOST : 1);

  useEffect(() => {
    const zmena = (e: Event): void => setTlmena(e instanceof CustomEvent && e.detail === true);
    window.addEventListener(TLMENIE_HUDBY, zmena);
    return () => window.removeEventListener(TLMENIE_HUDBY, zmena);
  }, []);

  useEffect(() => {
    if (audio.current !== null) audio.current.volume = hlasitostTeraz;
  }, [hlasitostTeraz]);

  useEffect(() => {
    if (!zapnuta) return;
    const a = new Audio();
    a.volume = hlasitostTeraz;
    audio.current = a;
    let zive = true;
    let rad: Skladba[] = [];
    let hra: Skladba | null = null;
    let oznamena = false;
    let pauza: ReturnType<typeof setTimeout> | undefined;

    // Prehliadač pustí zvuk až po interakcii so stránkou — vtedy to skúsime znova.
    const spusti = (): void => {
      a.play().catch((err: unknown) => {
        if (!zive || !(err instanceof DOMException) || err.name !== "NotAllowedError") return;
        window.addEventListener("pointerdown", spusti, { once: true });
        window.addEventListener("keydown", spusti, { once: true });
      });
    };
    const dalsia = async (): Promise<void> => {
      const skladby = await nacitajSkladby();
      if (!zive || skladby.length === 0) return;
      if (rad.length === 0) rad = zamiesaj(skladby, hra?.id ?? null);
      hra = rad.shift() ?? null;
      if (hra === null) return;
      oznamena = false;
      a.src = urlSkladby(hra);
      spusti();
    };
    const poPauze = (): void => {
      clearTimeout(pauza);
      pauza = setTimeout(() => void dalsia(), PAUZA_MS);
    };
    const hraje = (): void => {
      if (oznamena || hra === null) return;
      oznamena = true;
      setOznam({ kluc: Date.now(), nazov: hra.nazov });
    };

    a.addEventListener("playing", hraje);
    a.addEventListener("ended", poPauze);
    // Skladba, ktorá sa nedá prehrať, sa preskočí — tiež až po pauze, nech chyba nekrúti dokola.
    a.addEventListener("error", poPauze);
    void dalsia();

    return () => {
      zive = false;
      clearTimeout(pauza);
      window.removeEventListener("pointerdown", spusti);
      window.removeEventListener("keydown", spusti);
      a.removeEventListener("playing", hraje);
      a.removeEventListener("ended", poPauze);
      a.removeEventListener("error", poPauze);
      a.pause();
      a.removeAttribute("src");
      a.load();
      audio.current = null;
    };
    // Hlasitosť mení len efekt vyššie — zmena nesmie skladbu pustiť odznova.
  }, [zapnuta]);

  useEffect(() => {
    if (oznam === null) return;
    const t = setTimeout(() => setOznam(null), OZNAM_MS);
    return () => clearTimeout(t);
  }, [oznam]);

  if (oznam === null) return null;
  return (
    <div key={oznam.kluc} className="hudba-oznam" role="status">
      <span className="hudba-oznam-nota" aria-hidden="true">♪</span>
      <span>{oznam.nazov}</span>
    </div>
  );
}
