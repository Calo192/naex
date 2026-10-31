// Stôl pre telefón na šírku (Michal 2026-10-31, dizajn stol-landscape A „Pult“ + tabuľa z B):
// namiesto dvoch plných barov má každý hráč jeden riadok čipov (ikona a číslo) — súper hore,
// ty v doku vľavo dole. Ťuk na hráča otvorí tabuľu porovnania ty | súper so všetkými číslami,
// ktoré na počítači nesú dlaždice baru. Čipy Karty, Špaky a dlaždica Starší robia to isté
// ako ich dlaždice (vrstva Karty, nástenka, línia starších); Karty je aj cieľom kliatby.

import { useEffect, type ReactNode } from "react";
import type { ClientState, PlayerId, SpakyTeraz, StavZavislosti } from "@naex/core";
import { KONSTANTY, limitZhromazdenia } from "@naex/core";
import { IKONY } from "../karta/ikony.ts";
import { Avatar } from "../komponenty.tsx";
import { IkonaAbstak, IkonaCigareta, IkonaKarty, IkonaPoldeci, type KartyDlazdica } from "./Panely.tsx";
import { DlazdicaStarsich, type DlazdicaStarsichProps } from "./Starsi.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import type { HracInfo } from "./useHra.ts";

/** Prahy hráča (prahyHraca) — to, čo z nich pult a tabuľa ukazujú. */
export interface PrahyPultu {
  readonly cirhoza: number;
  readonly dlh: number;
  readonly exekucia: number;
  readonly priznaneDlhy: number;
}

/** Čísla jedného hráča pre pult a tabuľu. */
export interface CislaHraca {
  readonly karty: number;
  readonly balicek: number;
  readonly odhodene: number;
  readonly poldeci: number;
  readonly vypite: number;
  readonly limit: number;
  readonly chut: number | null;
  readonly nerestiDnes: number;
  /** Chuť hrozí Absťákom (neresti pod latkou). */
  readonly chutHrozi: boolean;
  readonly abstaky: number;
  readonly dlhy: number;
  readonly exekucia: number;
  readonly zadlzenie: number;
  readonly prahDlhu: number;
  readonly cigarety: number;
  readonly pecen: number;
  readonly prahPecene: number;
  readonly spaky: number;
  readonly zaStarsich: number;
  readonly priznane: number;
  readonly dedicstvo: number;
  readonly vazni: number;
  readonly cirhozyNepriznane: number;
}

/**
 * Čísla hráča z pohľadu: plné poldeci bez skrytých NA EX (tie už ležia na stole,
 * ako v bare na počítači), Chuť len keď ju partia má.
 */
export function cislaHraca(view: ClientState, p: PlayerId, prahy: PrahyPultu, z: StavZavislosti, body: SpakyTeraz): CislaHraca {
  const h = view.hraci[p];
  const skryte = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
  return {
    karty: h.rukaPocet,
    balicek: h.doberaciPocet,
    odhodene: h.odhadzovaci.length,
    poldeci: Math.max(0, h.poldeciPlne - skryte),
    vypite: h.poldeciVypite,
    limit: limitZhromazdenia(view, p),
    chut: view.bezChuti === true ? null : z.chut,
    nerestiDnes: z.teraz,
    chutHrozi: z.vyhlad === "ziska",
    abstaky: z.abstaky,
    dlhy: prahy.priznaneDlhy,
    exekucia: prahy.exekucia,
    zadlzenie: h.zadlzenie,
    prahDlhu: prahy.dlh,
    cigarety: h.cigarety,
    pecen: h.pecen,
    prahPecene: prahy.cirhoza,
    spaky: view.spaky[p],
    zaStarsich: body.zaStarsich[p],
    priznane: h.priznane.length,
    dedicstvo: h.dedicstvo.length,
    vazni: view.vazni.filter((v) => v.hrac === p).length,
    cirhozyNepriznane: view.nepriznaneKliatby[p].cirhoza,
  };
}

/** Riadok tabule: popis a hodnoty oboch; `zle` = hodnota, ktorá hráčovi škodí. */
export interface RiadokTabule {
  readonly kluc: string;
  readonly popis: string;
  readonly ja: string;
  readonly su: string;
  readonly zleJa?: boolean;
  readonly zleSu?: boolean;
}

/** Riadky tabule ty | súper — všetko, čo na počítači ukazujú dlaždice oboch barov. */
export function riadkyTabule(ja: CislaHraca, su: CislaHraca): RiadokTabule[] {
  const r = (kluc: string, popis: string, f: (c: CislaHraca) => string, zle?: (c: CislaHraca) => boolean): RiadokTabule => ({
    kluc,
    popis,
    ja: f(ja),
    su: f(su),
    ...(zle === undefined ? {} : { zleJa: zle(ja), zleSu: zle(su) }),
  });
  const riadky: RiadokTabule[] = [
    r("karty", "Karty v ruke", (c) => String(c.karty)),
    r("poldeci", "Poldeci plné · vypité", (c) => `${c.poldeci} · ${c.vypite}`),
    r("limit", "Limit kariet", (c) => String(c.limit)),
    r("cigarety", "Cigarety", (c) => String(c.cigarety)),
    r("spaky", "Špaky", (c) => String(c.spaky)),
    r("zaStarsich", "Za starších po bitke", (c) => (c.zaStarsich > 0 ? `+${c.zaStarsich}` : "0")),
  ];
  if (ja.chut !== null || su.chut !== null) {
    riadky.push(r("chut", "Chuť · neresti dnes", (c) => (c.chut === null ? "–" : `${c.chut} · ${c.nerestiDnes}`), (c) => c.chutHrozi));
  }
  riadky.push(
    r("abstaky", "Absťáky v balíčku", (c) => String(c.abstaky), (c) => c.abstaky > 0),
    r("dlhy", "Dlhy", (c) => (c.exekucia > 0 ? `${c.dlhy} (−${c.exekucia} š.)` : String(c.dlhy)), (c) => c.exekucia > 0),
    r("zadlzenie", "Zadĺženie", (c) => `${c.zadlzenie}/${c.prahDlhu}`, (c) => c.zadlzenie >= c.prahDlhu - 1),
    r("pecen", "Pečeň", (c) => `${c.pecen}/${c.prahPecene}`, (c) => c.pecen >= c.prahPecene - 1),
    r("cirhozy", "Nepriznaná Cirhóza", (c) => String(c.cirhozyNepriznane), (c) => c.cirhozyNepriznane > 0),
    r("balicek", "Balíček · odhodené", (c) => `${c.balicek} · ${c.odhodene}`),
    r("priznane", "Priznané kliatby", (c) => String(c.priznane)),
    r("dedicstvo", "Dedičstvo (náradie)", (c) => String(c.dedicstvo)),
    r("vazni", "Väzni", (c) => `${c.vazni}/${KONSTANTY.VAZNI_NA_VYHRU}`),
  );
  return riadky;
}

/** Piktogram akcie z karty (IKONY) v štvorci 0..100. */
function Pikto({ kluc }: { readonly kluc: "Dlh" | "PoškodeniePečene" }) {
  return (
    <svg className="pult-pikto" viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[kluc].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

function Cip({ ikona, n, popis, zle = false, trieda = "" }: { readonly ikona: ReactNode; readonly n: ReactNode; readonly popis: string; readonly zle?: boolean; readonly trieda?: string }) {
  return (
    <span className={`pult-cip${zle ? " zle" : ""}${trieda === "" ? "" : ` ${trieda}`}`} title={popis} aria-label={popis}>
      {ikona}
      <b>{n}</b>
    </span>
  );
}

export interface PultHracaProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  readonly info: HracInfo | null;
  readonly meno: string;
  readonly cisla: CislaHraca;
  readonly naTahu: boolean;
  readonly starsi: DlazdicaStarsichProps["starsi"];
  readonly body: SpakyTeraz;
  readonly karty: KartyDlazdica;
  readonly spakyKlik: { readonly stlacene: boolean; readonly prepni: () => void };
  /** Ťuk na hráča: tabuľa porovnania. */
  readonly tabula: { readonly otvorena: boolean; readonly prepni: () => void };
}

export function PultHraca({ view, p, info, meno, cisla, naTahu, starsi, body, karty, spakyKlik, tabula }: PultHracaProps) {
  const ja = p === view.ja;
  const utoci = view.utocnik === p;
  const c = karty.ciel;
  return (
    <section className={`pult-hraca ${ja ? "moj" : "superov"}${naTahu ? " na-tahu" : ""}`} aria-label={`Hráč ${meno}`}>
      <button
        type="button"
        className="pult-kto"
        aria-expanded={tabula.otvorena}
        title={`${ja ? "Ty" : meno} — ťuk ukáže tabuľu: ty a súper`}
        onClick={tabula.prepni}
      >
        <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={ja ? 34 : 30} farba={ja ? "ja" : "su"} />
        {!ja && (
          <span className="pult-meno">
            <strong>{meno}</strong>
            <span className={`pult-rola ${utoci ? "utocnik" : "obranca"}`}>{utoci ? "⚔ útočník" : "⛨ obranca"}</span>
          </span>
        )}
      </button>
      <span className="pult-cipy">
        <button
          type="button"
          className={["pult-cip pult-karty", c !== null ? "ako-ciel" : "", c?.aktivny === true ? "ciel-zona" : "", c?.zamknute != null ? "zamknuta" : ""].join(" ")}
          data-ciel={c?.dataCiel}
          title={c !== null ? (c.zamknute ?? `${c.nazov}: ${c.pozn}`) : `Karty v ruke ${cisla.karty} · balíček ${cisla.balicek} · odhodené ${cisla.odhodene} — ťuk ukáže karty`}
          onClick={c?.onKlik ?? karty.otvor}
        >
          <IkonaKarty />
          <b>{c !== null ? c.nazov : cisla.karty}</b>
        </button>
        <Cip ikona={<IkonaPoldeci />} n={cisla.poldeci} popis={`Poldeci plné ${cisla.poldeci}, vypité ${cisla.vypite} · limit kariet ${cisla.limit}`} />
        {cisla.chut !== null && <Cip ikona={<IkonaAbstak />} n={cisla.chut} popis={`Chuť ${cisla.chut} · neresti dnes ${cisla.nerestiDnes}`} zle={cisla.chutHrozi} />}
        <Cip ikona={<Pikto kluc="Dlh" />} n={cisla.dlhy} popis={`Dlhy ${cisla.dlhy} · zadĺženie ${cisla.zadlzenie}/${cisla.prahDlhu}`} zle={cisla.exekucia > 0} />
        <Cip ikona={<IkonaCigareta />} n={cisla.cigarety} popis={`Cigarety ${cisla.cigarety}`} />
        <button
          type="button"
          className={`pult-cip pult-spaky${spakyKlik.stlacene ? " stlacene" : ""}`}
          aria-pressed={spakyKlik.stlacene}
          title={`Špaky ${cisla.spaky} — ťuk ukáže nástenku`}
          onClick={spakyKlik.prepni}
        >
          <IkonaSpaku />
          <b>{cisla.spaky}</b>
        </button>
      </span>
      <DlazdicaStarsich view={view} p={p} zaStarsich={body.zaStarsich[p]} naUdrzanie={body.naUdrzanie[p]} starsi={starsi} />
    </section>
  );
}

export interface TabulaProps {
  readonly ja: CislaHraca;
  readonly su: CislaHraca;
  readonly avatary: readonly [ReactNode, ReactNode];
  readonly zavri: () => void;
  readonly akcie?: ReactNode;
}

/** Tabuľa porovnania (dizajn B): ty | súper, riadok po riadku. */
export function Tabula({ ja, su, avatary, zavri, akcie }: TabulaProps) {
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") zavri();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [zavri]);
  return (
    <>
      <div className="tabula-zaves" onClick={zavri} />
      <div className="tabula" role="dialog" aria-label="Ty a súper">
        <div className="tabula-hlava">
          <strong>Ty a súper</strong>
          <button type="button" className="tabula-zavri" onClick={zavri} aria-label="Zavrieť">
            ✕
          </button>
        </div>
        <div className="tabula-telo">
          <span className="tabula-l" />
          <span className="tabula-v ja">{avatary[0]}</span>
          <span className="tabula-v su">{avatary[1]}</span>
          {riadkyTabule(ja, su).map((r) => (
            <span key={r.kluc} className="tabula-riadok">
              <span className="tabula-l">
                {r.kluc === "dlhy" && <Pikto kluc="Dlh" />}
                {r.kluc === "pecen" && <Pikto kluc="PoškodeniePečene" />}
                {r.popis}
              </span>
              <span className={`tabula-v ja${r.zleJa === true ? " zle" : ""}`}>{r.ja}</span>
              <span className={`tabula-v su${r.zleSu === true ? " zle" : ""}`}>{r.su}</span>
            </span>
          ))}
        </div>
        {akcie !== undefined && <div className="tabula-akcie">{akcie}</div>}
      </div>
    </>
  );
}
