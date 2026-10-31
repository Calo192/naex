// Stôl pre telefón na šírku (Michal 2026-10-31, dizajn stol-landscape A „Pult“ + tabuľa z B):
// namiesto dvoch plných barov má každý hráč jeden riadok čipov (ikona a číslo) — súper hore,
// ty v doku vľavo dole. Ťuk na hráča otvorí tabuľu porovnania ty | súper so všetkými číslami,
// ktoré na počítači nesú dlaždice baru. Čipy Karty, Špaky a dlaždica Starší robia to isté
// ako ich dlaždice (vrstva Karty, nástenka, línia starších); Karty je aj cieľom kliatby.

import { useEffect, type ReactNode } from "react";
import type { ClientState, PlayerId, SpakyTeraz } from "@naex/core";
import { IKONY } from "../karta/ikony.ts";
import { Avatar } from "../komponenty.tsx";
import { IkonaAbstak, IkonaCigareta, IkonaKarty, IkonaPoldeci, type KartyDlazdica } from "./Panely.tsx";
import { DlazdicaStarsich, type DlazdicaStarsichProps } from "./Starsi.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import type { HracInfo } from "./useHra.ts";
import { riadkyTabule, type CislaHraca } from "./tabula.ts";

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
      <div className="porovnanie-zaves" onClick={zavri} />
      <div className="porovnanie" role="dialog" aria-label="Ty a súper">
        <div className="porovnanie-hlava">
          <strong>Ty a súper</strong>
          <button type="button" className="porovnanie-zavri" onClick={zavri} aria-label="Zavrieť">
            ✕
          </button>
        </div>
        <div className="porovnanie-telo">
          <span className="porovnanie-l" />
          <span className="porovnanie-v ja">{avatary[0]}</span>
          <span className="porovnanie-v su">{avatary[1]}</span>
          {riadkyTabule(ja, su).map((r) => (
            <span key={r.kluc} className="porovnanie-riadok">
              <span className="porovnanie-l">
                {r.kluc === "dlhy" && <Pikto kluc="Dlh" />}
                {r.kluc === "pecen" && <Pikto kluc="PoškodeniePečene" />}
                {r.popis}
              </span>
              <span className={`porovnanie-v ja${r.zleJa === true ? " zle" : ""}`}>{r.ja}</span>
              <span className={`porovnanie-v su${r.zleSu === true ? " zle" : ""}`}>{r.su}</span>
            </span>
          ))}
        </div>
        {akcie !== undefined && <div className="porovnanie-akcie">{akcie}</div>}
      </div>
    </>
  );
}
