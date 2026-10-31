// Stôl pre telefón na šírku (Michal 2026-10-31): hráči sú v úzkych zvislých stĺpcoch po stranách
// (ty vľavo, súper vpravo), v strede je celá výška pre líniu, šenok a ruku. Stĺpec má len ikonu
// a číslo každého zdroja; ťuk na zdroj otvorí okno s podrobnosťami v štýle medziobrazoviek,
// ťuk na hráča tabuľu porovnania ty | súper (dizajn B). Karty sú aj cieľom kliatby či Nástroja.

import { useEffect, useState, type ReactNode } from "react";
import type { ClientState, PlayerId } from "@naex/core";
import { IKONY } from "../karta/ikony.ts";
import { Avatar } from "../komponenty.tsx";
import { IkonaAbstak, IkonaCigareta, IkonaKarty, IkonaPoldeci, type KartyDlazdica } from "./Panely.tsx";
import { IkonaPriazne } from "./IkonaPriazne.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import type { HracInfo } from "./useHra.ts";
import { detailZdroja, riadkyTabule, type CislaHraca, type ZdrojStlpca } from "./tabula.ts";
import { Medziobrazovka } from "./Medziobrazovka.tsx";

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

export interface StlpecHracaProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  readonly info: HracInfo | null;
  readonly meno: string;
  readonly cisla: CislaHraca;
  readonly naTahu: boolean;
  readonly karty: KartyDlazdica;
  /** Ťuk na zdroj: okno s podrobnosťami (DetailZdroja). */
  readonly detail: (zdroj: ZdrojStlpca) => void;
  /** Ťuk na starších: línia starších na stole. */
  readonly starsi: { readonly stlacene: boolean; readonly prepni: () => void };
  /** Ťuk na hráča: tabuľa porovnania ty | súper. */
  readonly tabula: { readonly otvorena: boolean; readonly prepni: () => void };
}

/**
 * Úzky zvislý stĺpec hráča (Michal 2026-10-31, po skúške na telefóne): ty vľavo, súper vpravo —
 * ako kraje línie. Len ikona a číslo každého zdroja; ťuk otvorí okno s podrobnosťami.
 */
export function StlpecHraca({ view, p, info, meno, cisla, naTahu, karty, detail, starsi, tabula }: StlpecHracaProps) {
  const ja = p === view.ja;
  const utoci = view.utocnik === p;
  const c = karty.ciel;
  const cip = (zdroj: ZdrojStlpca, ikona: ReactNode, n: ReactNode, popis: string, zle = false): ReactNode => (
    <button type="button" className={`stlpec-cip stlpec-${zdroj}${zle ? " zle" : ""}`} aria-label={popis} title={popis} onClick={() => detail(zdroj)}>
      {ikona}
      <b>{n}</b>
    </button>
  );
  return (
    <section className={`stlpec-hraca ${ja ? "moj" : "superov"}${naTahu ? " na-tahu" : ""}`} aria-label={`Hráč ${meno}`}>
      <button type="button" className="stlpec-kto" aria-expanded={tabula.otvorena} title={`${ja ? "Ty" : meno} · ${utoci ? "útočník" : "obranca"} — ťuk ukáže tabuľu: ty a súper`} onClick={tabula.prepni}>
        <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={30} farba={ja ? "ja" : "su"} />
        <span className={`stlpec-rola ${utoci ? "utocnik" : "obranca"}`} aria-hidden="true">
          {utoci ? "⚔" : "⛨"}
        </span>
      </button>
      <button
        type="button"
        className={["stlpec-cip stlpec-karty", c !== null ? "ako-ciel" : "", c?.aktivny === true ? "ciel-zona" : "", c?.zamknute != null ? "zamknuta" : ""].join(" ")}
        data-ciel={c?.dataCiel}
        aria-label={c !== null ? (c.zamknute ?? `${c.nazov}: ${c.pozn}`) : `Karty v ruke ${cisla.karty}`}
        title={c !== null ? (c.zamknute ?? `${c.nazov}: ${c.pozn}`) : `Karty v ruke ${cisla.karty}`}
        onClick={c?.onKlik ?? (() => detail("karty"))}
      >
        <IkonaKarty />
        <b>{c !== null ? "sem" : cisla.karty}</b>
      </button>
      {cip("poldeci", <IkonaPoldeci />, cisla.poldeci, `Poldeci plné ${cisla.poldeci}, vypité ${cisla.vypite}, limit kariet ${cisla.limit}`)}
      {cisla.chut !== null && cip("chut", <IkonaAbstak />, cisla.chut, `Chuť ${cisla.chut}, neresti dnes ${cisla.nerestiDnes}`, cisla.chutHrozi)}
      {cip("pecen", <Pikto kluc="PoškodeniePečene" />, cisla.pecen, `Pečeň ${cisla.pecen} z ${cisla.prahPecene}`, cisla.pecen >= cisla.prahPecene - 1)}
      {cip("dlhy", <Pikto kluc="Dlh" />, cisla.dlhy, `Dlhy ${cisla.dlhy}, zadĺženie ${cisla.zadlzenie} z ${cisla.prahDlhu}`, cisla.exekucia > 0)}
      {cip("cigarety", <IkonaCigareta />, cisla.cigarety, `Cigarety ${cisla.cigarety}`)}
      {cip("spaky", <IkonaSpaku />, cisla.spaky, `Špaky ${cisla.spaky}`)}
      <button type="button" className={`stlpec-cip stlpec-starsi${starsi.stlacene ? " stlacene" : ""}`} aria-pressed={starsi.stlacene} aria-label={`Starší: priazeň ${cisla.priazen} — ťuk ukáže líniu starších`} title="Starší — línia starších" onClick={starsi.prepni}>
        <IkonaPriazne />
        <b>{cisla.priazen}</b>
      </button>
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

export interface OknoZdrojaProps {
  readonly zdroj: ZdrojStlpca;
  readonly cisla: CislaHraca;
  readonly ja: boolean;
  readonly meno: string;
  readonly zavri: () => void;
  /** Tlačidlo pod tabuľkou (napr. „Ukázať karty“, „Nástenka“). */
  readonly akcia?: { readonly text: string; readonly spusti: () => void } | undefined;
}

/** Okno zdroja: čo na počítači ukazuje dlaždica baru a jej nápoveda — ako medziobrazovka. */
export function OknoZdroja({ zdroj, cisla, ja, meno, zavri, akcia }: OknoZdrojaProps) {
  const d = detailZdroja(zdroj, cisla, ja);
  return (
    <Medziobrazovka obsah={{ kluc: `zdroj-${zdroj}`, nadnadpis: ja ? "ty" : meno, nadpis: d.nadpis, text: d.text }} onRozumiem={zavri} vypinac={false} zavrietMimo trieda="okno-zdroja">
      <dl className="okno-zdroja-riadky">
        {d.riadky.map(([k, v]) => (
          <span key={k} className="okno-zdroja-riadok">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </span>
        ))}
      </dl>
      {akcia !== undefined && (
        <button type="button" className="tlacidlo-male okno-zdroja-akcia" onClick={akcia.spusti}>
          {akcia.text}
        </button>
      )}
    </Medziobrazovka>
  );
}

const KLUC_PODRZANIA = "naex.mobil.podrz";

/**
 * Jednorazová nápoveda na telefóne (playtest mobilu 2026-10-31: o zväčšení podržaním nikde nič):
 * karty sú malé, podržanie prsta ich zväčší. Zmizne ťukom alebo sama; ukáže sa raz na prehliadač.
 */
export function NapovedaPodrzania() {
  const [ukaz, setUkaz] = useState(() => {
    try {
      return localStorage.getItem(KLUC_PODRZANIA) !== "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!ukaz) return;
    try {
      localStorage.setItem(KLUC_PODRZANIA, "1");
    } catch {
      // bez úložiska sa ukáže aj nabudúce — nevadí
    }
    const t = setTimeout(() => setUkaz(false), 9000);
    return () => clearTimeout(t);
  }, [ukaz]);
  if (!ukaz) return null;
  return (
    <button type="button" className="napoveda-podrzania" onClick={() => setUkaz(false)}>
      <span aria-hidden="true">☝</span> Podrž kartu = zväčšenie · ťuk na kartu = výber
    </button>
  );
}
