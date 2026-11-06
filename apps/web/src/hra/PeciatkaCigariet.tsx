// Pečiatka na dlaždici Cigarety (Michal 2026-11-06, mock 4 v docs/napady/dlazdica-cigariet-mocky.html).
// Svieti len kým cigarety ešte len prídu (čiarkovaná, koniec Pitky): „keď ich už má na svojom účte,
// pečiatka nie je potrebná“. Prísun, ktorý príde hneď, dopadne ako krátky prechod a zmizne.

import { useEffect, useRef, useState } from "react";
import { NAZVY_ZDROJOV_PRISUNU, prisunZUdalosti, riadkyCakajuceho, sumaPrisunu, type CigaretyPitky, type Event, type PlayerId, type PrisunHraca, type RiadokPrisunu } from "@naex/core";
import { IkonaCigareta } from "./ikonyZdrojov.tsx";
import "./peciatka-cigariet.css";

/** Dĺžka prechodu pri príchode; časovač ho zhasne aj bez animácie (prefers-reduced-motion). */
const DOPAD_MS = 1800;

export interface DopadCigariet {
  readonly id: number;
  readonly suma: number;
}

/** Posledný prísun; bez čísel „z ▸ na“, keď v tom istom ťahu hráč aj platil. */
export interface NedavnyPrisun extends PrisunHraca {
  readonly na: number;
}

/** Čo dlaždica Cigarety hráča ukazuje navyše oproti číslu. */
export interface PrisunDlazdice {
  readonly cigarety: number;
  /** Čo ešte pripíše vyhodnotenie Pitky (nahladPitky); mimo Zhromaždenia a Pitky null. */
  readonly cakajuci: CigaretyPitky | null;
  readonly dopad: DopadCigariet | null;
  readonly nedavny: NedavnyPrisun | null;
}

type Dvojica<T> = readonly [T, T];

/**
 * Prísun z udalostí ťahu: dopad oboch hráčov na krátky čas a posledný rozpis do nápovedy.
 * `pozdrz`: kým počítadlo bitky drží starý stôl, číslo sa nepohlo — pečiatka počká s ním.
 */
export function usePrisunCigariet(
  udalosti: { readonly id: number; readonly events: readonly Event[] } | undefined,
  cigarety: Dvojica<number>,
  pozdrz: boolean,
): { readonly dopady: Dvojica<DopadCigariet | null>; readonly nedavne: Dvojica<NedavnyPrisun | null> } {
  const [dopady, setDopady] = useState<Dvojica<DopadCigariet | null>>([null, null]);
  const [nedavne, setNedavne] = useState<Dvojica<NedavnyPrisun | null>>([null, null]);
  const ucet = useRef(cigarety);
  ucet.current = cigarety;

  useEffect(() => {
    if (udalosti === undefined) return;
    const prisun = prisunZUdalosti(udalosti.events);
    if (prisun[0] === null && prisun[1] === null) return;
    const pre = <T,>(p: PlayerId, f: (x: PrisunHraca) => T, inak: T): T => {
      const x = prisun[p];
      return x === null ? inak : f(x);
    };
    setNedavne((n) => [pre(0, (x) => ({ ...x, na: ucet.current[0] }), n[0]), pre(1, (x) => ({ ...x, na: ucet.current[1] }), n[1])]);
    // Ďalší ťah počas prechodu: pečiatka ukáže spoločný čistý rozdiel, nech nezmizne prvé číslo bez stopy.
    const dalsi = (d: DopadCigariet | null, x: PrisunHraca): DopadCigariet | null => {
      const suma = (d?.suma ?? 0) + x.suma;
      return suma === 0 ? null : { id: udalosti.id, suma };
    };
    setDopady((d) => [pre(0, (x) => dalsi(d[0], x), d[0]), pre(1, (x) => dalsi(d[1], x), d[1])]);
    // Len nové udalosti.
  }, [udalosti?.id]);

  useEffect(() => {
    if (pozdrz || (dopady[0] === null && dopady[1] === null)) return;
    const t = setTimeout(() => setDopady([null, null]), DOPAD_MS);
    return () => clearTimeout(t);
  }, [dopady, pozdrz]);

  return { dopady: pozdrz ? [null, null] : dopady, nedavne };
}

/** Pečiatka v rohu dlaždice: dopad má prednosť pred čakajúcim prísunom, ktorý sa potom vráti. */
export function PeciatkaCigariet({ prisun }: { readonly prisun: PrisunDlazdice }) {
  const { dopad, cakajuci } = prisun;
  const suma = dopad?.suma ?? cakajuci?.zisk ?? 0;
  if (suma === 0) return null;
  const pride = dopad === null;
  return (
    <span
      key={pride ? `pride${suma}` : `dopad${dopad.id}`}
      className={`peciatka-cigariet ${pride ? "cakajuca" : "dopad"}${suma < 0 ? " zaporna" : ""}`}
      role="img"
      aria-label={pride ? `Príde ${sumaPrisunu(suma)} cigariet` : `Prísun ${sumaPrisunu(suma)} cigariet`}
    >
      {sumaPrisunu(suma)}
      <IkonaCigareta />
    </span>
  );
}

function Riadky({ riadky }: { readonly riadky: readonly RiadokPrisunu[] }) {
  return (
    <>
      {riadky.map((r, i) => (
        <span key={i} className="rozpis-cigariet-riadok">
          <span>{NAZVY_ZDROJOV_PRISUNU[r.zdroj]}</span>
          <b className={r.suma < 0 ? "minus" : "plus"}>{sumaPrisunu(r.suma)}</b>
        </span>
      ))}
    </>
  );
}

/** Rozpis pod myšou: čo ešte príde a odkiaľ prišiel posledný prísun. */
export function RozpisCigariet({ prisun }: { readonly prisun: PrisunDlazdice }) {
  const { cakajuci, nedavny, cigarety } = prisun;
  const riadky = cakajuci === null ? [] : riadkyCakajuceho(cakajuci);
  if (riadky.length === 0 && nedavny === null) return null;
  return (
    <span className="rozpis-cigariet">
      {riadky.length > 0 && cakajuci !== null && (
        <>
          <em>Príde na konci Pitky</em>
          <Riadky riadky={riadky} />
          <span className="rozpis-cigariet-riadok spolu">
            <span>Spolu</span>
            <span>
              {cigarety} ▸ {cigarety + cakajuci.zisk}
            </span>
          </span>
        </>
      )}
      {nedavny !== null && (
        <>
          <em>Naposledy</em>
          <Riadky riadky={nedavny.riadky} />
          <span className="rozpis-cigariet-riadok spolu">
            <span>Spolu</span>
            <span>{nedavny.platba === 0 ? `${nedavny.na - nedavny.suma} ▸ ${nedavny.na}` : sumaPrisunu(nedavny.suma)}</span>
          </span>
        </>
      )}
    </span>
  );
}
