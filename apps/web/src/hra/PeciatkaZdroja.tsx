// Pečiatka na dlaždici zdroja: Cigarety (Michal 2026-11-06, mock 4 v docs/napady/dlazdica-cigariet-mocky.html)
// a Poldeci. Svieti len kým to ešte len príde (čiarkovaná): „keď ich už má na svojom účte, pečiatka nie je
// potrebná“. Prísun, ktorý príde hneď, dopadne ako krátky prechod a zmizne.

import { useEffect, useRef, useState } from "react";
import { NAZVY_ZDROJOV_PRISUNU, prisunZUdalosti, sumaPrisunu, type DruhPrisunu, type Event, type PlayerId, type PrisunHraca, type RiadokPrisunu } from "@naex/core";
import { IkonaCigareta, IkonaPoldeci } from "./ikonyZdrojov.tsx";
import "./peciatka-zdroja.css";

/** Dĺžka prechodu pri príchode; časovač ho zhasne aj bez animácie (prefers-reduced-motion). */
const DOPAD_MS = 1800;

export interface DopadPrisunu {
  readonly id: number;
  readonly suma: number;
}

/** Posledný prísun; bez čísel „z ▸ na“, keď v tom istom ťahu hráč aj platil. */
export interface NedavnyPrisun extends PrisunHraca {
  readonly na: number;
}

/** Čo ešte príde podľa náhľadu Pitky (nahladPitky). */
export interface CakajuciPrisun {
  /** Čistý rozdiel, ktorý ukáže pečiatka. */
  readonly suma: number;
  readonly riadky: readonly RiadokPrisunu[];
  /** Kedy to príde: „na konci Pitky“, „v bitke“. */
  readonly kedy: string;
  /** Riadok „po Pitke 3 ▸ 5“ v okne zdroja. */
  readonly po: string;
}

/** Čo dlaždica zdroja hráča ukazuje navyše oproti číslu. */
export interface PrisunDlazdice {
  readonly druh: DruhPrisunu;
  /** Číslo na dlaždici. */
  readonly hodnota: number;
  /** Mimo Zhromaždenia a Pitky null. */
  readonly cakajuci: CakajuciPrisun | null;
  readonly dopad: DopadPrisunu | null;
  readonly nedavny: NedavnyPrisun | null;
}

type Dvojica<T> = readonly [T, T];

/**
 * Prísun z udalostí ťahu: dopad oboch hráčov na krátky čas a posledný rozpis do nápovedy.
 * `pozdrz`: kým počítadlo bitky drží starý stôl, číslo sa nepohlo — pečiatka počká s ním.
 */
export function usePrisunZdroja(
  druh: DruhPrisunu,
  udalosti: { readonly id: number; readonly events: readonly Event[] } | undefined,
  hodnoty: Dvojica<number>,
  pozdrz: boolean,
): { readonly dopady: Dvojica<DopadPrisunu | null>; readonly nedavne: Dvojica<NedavnyPrisun | null> } {
  const [dopady, setDopady] = useState<Dvojica<DopadPrisunu | null>>([null, null]);
  const [nedavne, setNedavne] = useState<Dvojica<NedavnyPrisun | null>>([null, null]);
  const ucet = useRef(hodnoty);
  ucet.current = hodnoty;

  useEffect(() => {
    if (udalosti === undefined) return;
    const prisun = prisunZUdalosti(udalosti.events, druh);
    if (prisun[0] === null && prisun[1] === null) return;
    const pre = <T,>(p: PlayerId, f: (x: PrisunHraca) => T, inak: T): T => {
      const x = prisun[p];
      return x === null ? inak : f(x);
    };
    setNedavne((n) => [pre(0, (x) => ({ ...x, na: ucet.current[0] }), n[0]), pre(1, (x) => ({ ...x, na: ucet.current[1] }), n[1])]);
    // Ďalší ťah počas prechodu: pečiatka ukáže spoločný čistý rozdiel, nech nezmizne prvé číslo bez stopy.
    const dalsi = (d: DopadPrisunu | null, x: PrisunHraca): DopadPrisunu | null => {
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
export function PeciatkaZdroja({ prisun }: { readonly prisun: PrisunDlazdice }) {
  const { druh, dopad, cakajuci } = prisun;
  const suma = dopad?.suma ?? cakajuci?.suma ?? 0;
  if (suma === 0) return null;
  const pride = dopad === null;
  return (
    <span
      key={pride ? `pride${suma}` : `dopad${dopad.id}`}
      className={`peciatka-zdroja ${pride ? "cakajuca" : "dopad"}${suma < 0 ? " zaporna" : ""}`}
      role="img"
      aria-label={`${pride ? "Príde" : "Prísun"} ${sumaPrisunu(suma)} ${druh === "cigarety" ? "cigariet" : "poldeci"}`}
    >
      {sumaPrisunu(suma)}
      {druh === "cigarety" ? <IkonaCigareta /> : <IkonaPoldeci />}
    </span>
  );
}

function Riadky({ riadky }: { readonly riadky: readonly RiadokPrisunu[] }) {
  return (
    <>
      {riadky.map((r, i) => (
        <span key={i} className="rozpis-zdroja-riadok">
          <span>{NAZVY_ZDROJOV_PRISUNU[r.zdroj]}</span>
          <b className={r.suma < 0 ? "minus" : "plus"}>{sumaPrisunu(r.suma)}</b>
        </span>
      ))}
    </>
  );
}

/** Rozpis pod myšou: čo ešte príde a odkiaľ prišiel posledný prísun. */
export function RozpisZdroja({ prisun }: { readonly prisun: PrisunDlazdice }) {
  const { cakajuci, nedavny, hodnota } = prisun;
  const riadky = cakajuci?.riadky ?? [];
  if (riadky.length === 0 && nedavny === null) return null;
  return (
    <span className="rozpis-zdroja">
      {riadky.length > 0 && cakajuci !== null && (
        <>
          <em>Príde {cakajuci.kedy}</em>
          <Riadky riadky={riadky} />
          <span className="rozpis-zdroja-riadok spolu">
            <span>Spolu</span>
            <span>
              {hodnota} ▸ {hodnota + cakajuci.suma}
            </span>
          </span>
        </>
      )}
      {nedavny !== null && (
        <>
          <em>Naposledy</em>
          <Riadky riadky={nedavny.riadky} />
          <span className="rozpis-zdroja-riadok spolu">
            <span>Spolu</span>
            <span>{nedavny.platba === 0 ? `${nedavny.na - nedavny.suma} ▸ ${nedavny.na}` : sumaPrisunu(nedavny.suma)}</span>
          </span>
        </>
      )}
    </span>
  );
}
