// Pruh pokynu na telefóne na šírku (Michal 2026-10-31, variant 2 „Pokyn je tlačidlo“): spodok
// displeja patrí len ruke, preto sú ťahy v pokyne hore na plsti. Vľavo text pokynu v jednom riadku
// (ťuk ho rozbalí celý), vpravo hlavná akcia chvíle ako žltý segment a ▾ s vedľajšími akciami
// (záverečná, ✕ zrušiť, ↺ späť, nákupy za cigarety). Keď nie je čo stlačiť, je tam len text.
//
// Ťahy prichádzajú ako hotové tlačidlá z HernaPlocha (tie isté, čo na počítači ležia na hrane
// stola). ✕ a ↺ sedia v rohu hlavnej pečiatky — v pruhu sa skryjú a v ▾ ich ukáže druhá kópia
// pečiatky, v ktorej je zasa skryté všetko okrem nich (CSS mobil-sirka.css).
//
// Oprava 4 (Michal 2026-10-31): nič nepláva cez líniu — hlásenie o súperovom ťahu sa ukáže
// na chvíľu v pruhu namiesto textu pokynu a odhad bitky je malý segment vľavo (ťuk = okno).
// Pri binárnej voľbe (Vízia „zahodiť“, Hasič „vrátiť“) je druhá voľba tmavý segment vedľa hlavnej.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";

export interface PruhPokynuProps {
  readonly nadpis: ReactNode;
  readonly text: ReactNode;
  /** Hlavná akcia chvíle (PAS, POTVRDIŤ, NA EX!, Skončiť Pitku…). */
  readonly hlavna: ReactNode;
  /** Vedľajšie akcie do ▾ (nákupy, záverečná, druhá voľba). */
  readonly vedlajsie: ReactNode;
  /** Pri novom ťahu sa ▾ aj rozbalený text zatvoria. */
  readonly kluc: string;
  readonly jednotny?: boolean;
  readonly odkaz?: Ref<HTMLDivElement>;
  /** Druhá voľba binárneho rozhodnutia — tmavý segment hneď za hlavnou akciou. */
  readonly druha?: ReactNode | undefined;
  /** Odhad bitky ako malý segment vľavo (tlačidlo, ťuk = okno odhadu). */
  readonly odhad?: ReactNode;
  /** Hlásenie (súperov ťah, účet Pitky, chyba) — na chvíľu nahradí text pokynu. */
  readonly sprava?: { readonly text: string; readonly chyba: boolean } | null;
  readonly onZrusSpravu?: (() => void) | undefined;
  /** Potvrdenie či varovanie: celé znenie sa ukáže pod pruhom samo (oprava 5 — „Skončiť bez NA EX?“ bolo orezané). */
  readonly naliehavy?: boolean;
}

/** Ako dlho ostane hlásenie v pruhu (chyba o niečo dlhšie). */
const SPRAVA_MS = 4500;
const CHYBA_MS = 7000;

/** Má prvok viditeľné tlačidlo? (skryté kópie majú display: none — žiadny obdĺžnik) */
function maTlacidlo(el: HTMLElement | null): boolean {
  return el !== null && [...el.querySelectorAll<HTMLElement>("button, select")].some((b) => b.getClientRects().length > 0);
}

export function PruhPokynu({ nadpis, text, hlavna, vedlajsie, kluc, jednotny = false, odkaz, druha, odhad, sprava = null, onZrusSpravu, naliehavy = false }: PruhPokynuProps) {
  const [ukazanaSprava, setUkazanaSprava] = useState<{ readonly text: string; readonly chyba: boolean } | null>(null);
  useEffect(() => {
    if (sprava === null) return;
    setUkazanaSprava(sprava);
    const t = setTimeout(() => setUkazanaSprava(null), sprava.chyba ? CHYBA_MS : SPRAVA_MS);
    return () => clearTimeout(t);
  }, [sprava?.text, sprava?.chyba]);
  const [otvorene, setOtvorene] = useState(false);
  const [rozbaleny, setRozbaleny] = useState(false);
  const [maMenu, setMaMenu] = useState(false);
  const [maHlavnu, setMaHlavnu] = useState(false);
  const obal = useRef<HTMLDivElement>(null);
  // Potvrdenie sa ukáže celé pod pruhom, len keď sa do dvoch riadkov pruhu nezmestí.
  const [orezany, setOrezany] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const hlavnaRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    setOtvorene(false);
    setRozbaleny(false);
  }, [kluc]);
  // Pokyn s kartami (Vízia, Hasič, výkup zo šrotu) sa rozbalí sám — v jednom riadku karty nevidno.
  const sKartami = useRef(false);
  useLayoutEffect(() => {
    const teraz = obal.current?.querySelector(".pruh-text :is(.vizia-karta, .zberatel-ponuka)") != null;
    if (teraz && !sKartami.current) setRozbaleny(true);
    sKartami.current = teraz;
  });

  // Čo sa dá stlačiť, vie až DOM (fragmenty bez tlačidiel, skryté kópie) — po každom prekreslení.
  useLayoutEffect(() => {
    const t = obal.current?.querySelector<HTMLElement>(".pruh-text .pilulka-text");
    const o = t !== null && t !== undefined && t.scrollHeight > t.clientHeight + 1;
    if (o !== orezany) setOrezany(o);
    const m = maTlacidlo(menu.current);
    const h = maTlacidlo(hlavnaRef.current);
    if (m !== maMenu) setMaMenu(m);
    if (h !== maHlavnu) setMaHlavnu(h);
    if (!m && otvorene) setOtvorene(false);
  });

  // Ťuk mimo pruhu zavrie ▾ aj rozbalený text.
  const nieco = otvorene || rozbaleny;
  useEffect(() => {
    if (!nieco) return;
    const mimo = (e: PointerEvent): void => {
      if (e.target instanceof Node && obal.current?.contains(e.target) === true) return;
      setOtvorene(false);
      setRozbaleny(false);
    };
    document.addEventListener("pointerdown", mimo, true);
    return () => document.removeEventListener("pointerdown", mimo, true);
  }, [nieco]);

  return (
    <div
      ref={obal}
      className={`pruh-pokynu${maHlavnu ? " s-akciou" : ""}${jednotny ? " jednotna" : ""}${naliehavy ? " naliehavy" : ""}`}
    >
      <div ref={odkaz} className="linia-stav pruh-pokynu-riadok" role="status" aria-live="polite">
        {odhad !== undefined && odhad !== null && <span className="pruh-odhad">{odhad}</span>}
        {ukazanaSprava !== null ? (
          <button
            type="button"
            className={`pruh-text pruh-sprava${ukazanaSprava.chyba ? " chyba" : ""}`}
            title="Ťuk hlásenie zavrie — celé je v Logu"
            onClick={() => {
              setUkazanaSprava(null);
              if (ukazanaSprava.chyba) onZrusSpravu?.();
            }}
          >
            <span className="pilulka-text">
              {ukazanaSprava.chyba ? "⚠ Ťah neprešiel: " : "↺ "}
              {ukazanaSprava.text}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="pruh-text"
            aria-expanded={rozbaleny}
            title="Ťuk ukáže celý pokyn"
            onClick={() => {
              setRozbaleny((r) => !r);
              setOtvorene(false);
            }}
          >
            {nadpis !== null && <strong className="pilulka-nadpis">{nadpis}</strong>}
            {text !== null && <span className="pilulka-text">{text}</span>}
          </button>
        )}
        <span ref={hlavnaRef} className="pruh-hlavna">
          {hlavna}
        </span>
        {druha !== undefined && druha !== null && <span className="pruh-druha">{druha}</span>}
        {maMenu && (
          <button
            type="button"
            className="pruh-viac"
            aria-expanded={otvorene}
            aria-label={otvorene ? "Zavrieť ďalšie akcie" : "Ďalšie akcie"}
            onClick={() => {
              setOtvorene((o) => !o);
              setRozbaleny(false);
            }}
          >
            ▾
          </button>
        )}
      </div>
      {(rozbaleny || (naliehavy && orezany && !otvorene)) && (
        <div className={`pruh-cely${naliehavy ? " naliehavy" : ""}`} onClick={() => setRozbaleny(false)}>
          {nadpis !== null && <strong className="pilulka-nadpis">{nadpis}</strong>} {text}
        </div>
      )}
      <div
        ref={menu}
        className={`pruh-menu${otvorene ? " otvorene" : ""}`}
        role="menu"
        aria-hidden={!otvorene}
        onClick={(e) => {
          // Po výbere sa ▾ zavrie (aj pri nedostupnom nákupe — povie prečo a zmizne).
          if (e.target instanceof Element && e.target.closest("button") !== null) setOtvorene(false);
        }}
      >
        {vedlajsie}
      </div>
    </div>
  );
}
