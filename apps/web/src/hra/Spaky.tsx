// Špaky na stole (pravidlá v6, Michal 2026-10-26, docs/napady/spaky.html bod 12):
// víťazné body sa zbierajú ako špaky (dlaždica pri mene hráča) a krčmová
// nástenka ukazuje nad každou lokalitou fotku víťaza a koľko špakov za ňu získal
// (aj finále). Čísla ráta jadro (nástenka, rozpisSpakov), tu sa len kreslia.

import { useContext, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { BitkaNaNastenke, CardInstance, CielKola, Favour, PlayerId } from "@naex/core";
import { KONSTANTY, jeFinaleNaNastenke, rozpisSpakov, opponentOf } from "@naex/core";
import { spakov } from "../i18n/pocty.ts";
import { Avatar } from "../komponenty.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
import { FavourStarsich, PilulkaPriazne } from "./KruzokPriazne.tsx";
import { POMER, type ListokNaVyber } from "./rozlozenieNastenky.ts";
import { titulBezExekucie, textVyhryStrachom, type VyhraStrachom } from "./vyhraStrachom.ts";
import "./spaky.css";
import type { SpakyTeraz } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

export { IkonaSpaku };

/** Počet špakov so znamienkom mínus (−3), nie spojovníkom. */
export function sMinusom(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}

/** Špaky hráča: piktogram a číslo. Záporné špaky (Exekútor) majú číslo červené. */
export function PocetSpakov({
  n,
  kto,
  titul,
  velky = false,
}: {
  readonly n: number;
  readonly kto: "moj" | "superov";
  readonly titul?: string;
  readonly velky?: boolean;
}) {
  return (
    <span className={`pocet-spakov ${kto}${velky ? " velky" : ""}${n < 0 ? " minus" : ""}`} title={titul ?? spakov(n)}>
      <IkonaSpaku />
      <b className="velke-cislo">{sMinusom(n)}</b>
    </span>
  );
}

/** Z čoho sú špaky za bitku: od v8 karty v línii, v starších záznamoch odohrané Pitky. */
export function zakladBitky(b: Pick<BitkaNaNastenke, "karty" | "pitky">): number {
  return b.karty ?? b.pitky;
}

/** „6 kariet v línii“ (v8), v starších záznamoch „2 Pitky“. */
export function textZakladu(b: Pick<BitkaNaNastenke, "karty" | "pitky">): string {
  return b.karty !== undefined ? t("spaky.kartVLinii", { n: b.karty }) : t("spaky.pitiek", { n: b.pitky });
}

/** Kultúrny dom: špaky porazeného za jeho karty v línii; inak 0. */
export function spakyPorazeneho(b: BitkaNaNastenke): number {
  if (b.vitaz === null || b.lokalita?.defId !== "kulturny_dom") return 0;
  return b.zaBitku[opponentOf(b.vitaz)] - (b.noviny ?? 0);
}

/** Prečo a ako sa bitka rozhodla — krátko pod lokalitu na nástenke. */
export function poznamkaBitky(b: BitkaNaNastenke, kto: (p: PlayerId) => string): string[] {
  const out: string[] = [];
  const porazenemu = spakyPorazeneho(b);
  if (porazenemu > 0 && b.vitaz !== null) out.push(t("spaky.poznKulturak", { kto: kto(opponentOf(b.vitaz)), n: porazenemu }));
  if ((b.noviny ?? 0) > 0 && b.vitaz !== null) out.push(t("spaky.poznNoviny", { kto: kto(opponentOf(b.vitaz)), n: b.noviny ?? 0 }));
  if (b.rozhodlo === "abstak") out.push(t("spaky.remizaAbstaky"));
  if (b.rozhodlo === "dlhy") out.push(t("spaky.remizaDlhy"));
  if (b.abstakZrazka > 0) out.push(t("spaky.poznAbstak", { n: b.abstakZrazka }));
  const herna = spakyZaHernu(b);
  if (herna > 0) out.push(t("spaky.poznHerna", { n: herna }));
  if (b.zoSekery > 0) out.push(t("spaky.poznZoSekery", { n: b.zoSekery }));
  for (const p of [0, 1] as const) if ((b.robota?.[p] ?? 0) > 0) out.push(t("spaky.poznRobota", { kto: kto(p), n: b.robota?.[p] ?? 0 }));
  if (b.prepadlo > 0) out.push(t("spaky.prepadlo", { spaky: spakov(b.prepadlo) }));
  for (const p of [0, 1] as const) if (b.exekutor[p] > 0) out.push(t("spaky.poznExekutor", { kto: kto(p), n: b.exekutor[p] }));
  for (const p of [0, 1] as const) if (b.prebytok[p] > 0) out.push(t("spaky.poznNakladacka", { kto: kto(p), n: b.prebytok[p] }));
  return out;
}

/**
 * Špaky za Dlhy porazeného na Herni (v7) — nástenka ich nenesie zvlášť: zvyšok
 * špakov za bitku po kartách v línii (do v8 mínus Absťáky, aspoň 1) a sekere.
 */
export function spakyZaHernu(b: BitkaNaNastenke): number {
  if (b.vitaz === null || b.lokalita?.defId !== "herna") return 0;
  const spolu = b.zaBitku[0] + b.zaBitku[1] - (b.noviny ?? 0);
  return Math.max(0, spolu - Math.max(1, zakladBitky(b) - b.abstakZrazka) - b.zoSekery);
}

export interface NastenkaProps {
  readonly nastenka: readonly BitkaNaNastenke[];
  /** Lokality, o ktoré sa ešte nehralo (bez aktuálneho cieľa). */
  readonly zostava: readonly CardInstance[];
  /** Cieľ kola, o ktorý sa práve hrá — „teraz“. */
  readonly ciel: CielKola | null;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly avatary: readonly [string | null, string | null];
  /** Karta lokality v danej šírke; bez nej nástenka ukáže len názov. */
  readonly karta?: ((k: CardInstance, sirka: number) => ReactNode) | undefined;
  readonly menoKarty: (defId: string) => string;
  readonly sirkaKarty?: number;
  /** Bez kariet — riadok lístkov (voľba cieľa, koniec hry na nízkom okne). */
  readonly kompaktna?: boolean;
  /** Hra skončila — finále, ktoré sa nehralo (vydesenie, vzdanie), sa neukáže ako čakajúce. */
  readonly koniec?: boolean;
  /**
   * Nástenka s účtom (Michal 2026-10-27, variant A): hore dva popolníky so skóre, pod
   * každým lístkom účtenka bitky (starší, Exekútor, prebytok, stav po bitke), na konci
   * lístok „Koniec“ s výkupným zdrojov a nepriznanou Cirhózou a päta „keby skončila teraz“. `zvyraznit`:
   * čí popolník svieti a kto je v účtenkách prvý (klik na súperove Špaky = súper).
   */
  readonly ucet?: { readonly body: SpakyTeraz; readonly zvyraznit: PlayerId } | undefined;
  /**
   * Voľba cieľa kola (Michal 2026-10-27): lokality, o ktoré sa ešte nehralo, ležia na
   * nástenke ako karty na výber (klik, ťahanie); ostatné lístky sú bez kariet.
   */
  readonly vyber?: ((k: CardInstance, sirka: number) => ReactNode) | undefined;
  /** Mierka avatarov na stole (rozmerNastenky) — písmo škáluje CSS cez --nk. */
  readonly mierka?: number;
  /** Šírka kariet na výber (voľba cieľa) — bez víťaza a účtenky smú byť väčšie. */
  readonly sirkaVyberu?: number;
  /** Režim bez finále (Päta, Lakeť, Otočka): nástenka len ponúka lokality. */
  readonly bezFinale?: boolean;
  /** Rozmer kariet na výber v jednom rade (rozmerNastenky); `vyber` dostane ich šírku. */
  readonly listokVyberu?: ListokNaVyber | null | undefined;
  /**
   * Súhrn lokality po kliku (Michal 2026-10-31): odohraná lokalita, ku ktorej je čo ukázať,
   * dostane funkciu, ktorá ho otvorí; null = lístok sa neklikne (rozpis na myš ostáva).
   */
  readonly suhrn?: ((b: BitkaNaNastenke) => (() => void) | null) | undefined;
  /**
   * Telefón na šírku (mobil-sirka): odohrané lístky po starom — víťaz so špakmi vedľa seba
   * a účtenka pod lístkom, bez rozpisu na myš.
   */
  readonly poStarom?: boolean;
  /** Priazeň staršieho podľa id — krúžok v rozpise za starších (Michal 2026-10-31). */
  readonly favour?: ((elderId: string) => Favour | null) | undefined;
  /** Skončila bitka hru výhrou strachom (vyhraStrachomBitky)? Rozpis na myš povie, že exekúcia nebola. */
  readonly vyhraStrachom?: ((b: BitkaNaNastenke) => VyhraStrachom | null) | undefined;
}

interface Listok {
  readonly kluc: string;
  readonly lokalita: CardInstance | null;
  readonly finale: boolean;
  readonly stav: "odohrana" | "teraz" | "caka";
  readonly bitka?: BitkaNaNastenke;
}

/**
 * Krčmová nástenka: odohrané bitky (fotka víťaza a jeho špaky, pri sekere
 * čakajúce špaky), bitka, o ktorú sa práve hrá, lokality, ktoré ešte len prídu,
 * a na konci finále.
 */
export function Nastenka(props: NastenkaProps) {
  const obsah = <NastenkaObsah {...props} />;
  return props.favour === undefined ? obsah : <FavourStarsich.Provider value={props.favour}>{obsah}</FavourStarsich.Provider>;
}

function NastenkaObsah({ nastenka, zostava, ciel, ja, mena, avatary, karta, menoKarty, sirkaKarty = 90, kompaktna = false, koniec = false, bezFinale = false, ucet, vyber, mierka = 1, sirkaVyberu = sirkaKarty, listokVyberu = null, suhrn, poStarom = false, vyhraStrachom }: NastenkaProps) {
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  // Rozpis na myš aj na fokus klávesnicou: ktorý lístok a jeho prvok (poloha okienka).
  const [naMys, setNaMys] = useState<{ readonly i: number; readonly el: HTMLElement } | null>(null);
  const idRozpisu = useId();
  const poradie: readonly [PlayerId, PlayerId] = ucet === undefined || ucet.zvyraznit === ja ? [ja, opponentOf(ja)] : [ucet.zvyraznit, ja];
  const listky: Listok[] = [
    ...nastenka.map((b, i): Listok => ({ kluc: `b${i}`, lokalita: b.lokalita, finale: jeFinaleNaNastenke(b), stav: "odohrana", bitka: b })),
    ...(ciel !== null && !koniec ? [{ kluc: "teraz", lokalita: ciel.lokalita, finale: ciel.typ === "finale", stav: "teraz" as const }] : []),
    ...(koniec ? [] : zostava.map((k): Listok => ({ kluc: `z${k.uid}`, lokalita: k, finale: false, stav: "caka" }))),
  ];
  const finaleHotove = listky.some((l) => l.finale);
  if (!finaleHotove && !koniec && !bezFinale) listky.push({ kluc: "finale", lokalita: null, finale: true, stav: "caka" });
  // Finále sa boduje ako každá bitka (Michal 2026-10-30: „1 špak za kartu v línii — a normálne
  // to neplatí?“) — lístok to tak aj hovorí, pravidlo bodovania sa neopakuje len pri ňom.
  const finaleText = t("spaky.finaleText");
  const dvojica = (h: readonly [number, number], f: (n: number) => string): string => poradie.map((p) => `${kto(p)} ${f(h[p])}`).join(" · ");
  // Účtenka je úzka: čísla oboch v poradí popolníkov nad nástenkou („ty : súper“), bez mien.
  const pomer = (h: readonly [number, number], f: (n: number) => string): string => poradie.map((p) => f(h[p])).join(" : ");

  // Veľa odohraných bitiek pri voľbe cieľa (finále dlhej hry): krátke lístky bez karty
  // a účtenky v dvoch radoch nad sebou — šírku dostanú lokality na výber (rozmerNastenky).
  const kratkeBitky = vyber !== undefined && listokVyberu?.kratkeBitky === true;
  const kratky = (l: Listok): boolean => kratkeBitky && l.stav === "odohrana";
  // Pri voľbe cieľa má Koniec veľkosť karty na výber (Michal 2026-10-31: „môže mať veľkosť karty“) —
  // nie úzky lístok, z ktorého mená vytŕčali. Pri drobných kartách ostane lístkom podľa obsahu.
  const sirkaKonca = ((): { readonly sirka: number; readonly vyska: number } | null => {
    if (vyber === undefined) return null;
    const w = listokVyberu?.sirka ?? sirkaVyberu;
    return w >= KONIEC_KARTA_MIN ? { sirka: w, vyska: listokVyberu?.vyska ?? Math.round(w * POMER) } : null;
  })();
  const listokEl = (l: Listok, i: number): ReactNode => {
    const b = l.bitka;
    const nazov = l.finale ? (l.lokalita === null ? t("faza.finale") : t("spaky.finaleLokalita", { meno: menoKarty(l.lokalita.defId) })) : l.lokalita === null ? t("stol.lokalita") : menoKarty(l.lokalita.defId);
    const vitaz = b?.vitaz ?? null;
    const spolu = b === undefined ? null : rozpisLokality(b).spolu;
    const zisk = spolu === null || vitaz === null ? 0 : spolu[vitaz];
    const zaklad = b === undefined ? 0 : zakladBitky(b);
    const pozn = b === undefined ? [] : poznamkaBitky(b, kto);
    // Sekera: špaky si vzal víťaz najbližšej ďalšej bitky (ak už bola).
    const vzal = b === undefined || vitaz !== null ? null : (nastenka.slice(i + 1).find((x) => x.vitaz !== null)?.vitaz ?? null);
    const popis =
      b === undefined
        ? l.stav === "teraz"
          ? t("spaky.bijeSaTeraz", { nazov })
          : l.finale
            ? t("spaky.finalePopis", { text: finaleText })
            : t("spaky.nehralo", { nazov })
        : vitaz === null
          ? t("spaky.sekeraPopis", { nazov, kolo: b.kolo, co: b.prepadlo > 0 ? t("spaky.prepadlo", { spaky: spakov(b.prepadlo) }) : vzal !== null ? t("spaky.vzalVitaz", { spaky: spakov(zaklad), kto: kto(vzal) }) : t("spaky.cakaNaVitaza", { spaky: spakov(zaklad) }) })
          : t("spaky.vyhraPopis", { nazov, kolo: b.kolo, vysledok: vitaz === ja ? t("spaky.tvojaVyhra") : t("spaky.vyhraHraca", { meno: mena[vitaz] }), zisk: spakov(zisk), zaBitku: b.zaBitku[vitaz], preco: b.lokalita?.defId === "kulturny_dom" ? t("spaky.zaSvojuKartu") : `${b.karty !== undefined ? t("spaky.zaKartu") : t("spaky.zaPitku")}, ${textZakladu(b)}` }) + (pozn.length > 0 ? ` (${pozn.join(", ")})` : "");
    if (vyber !== undefined && l.stav === "caka" && l.lokalita !== null) {
      const naklon = `${((i * 37) % 5) - 2}deg`;
      if (listokVyberu !== null) {
        const v = listokVyberu;
        return (
          <li
            key={l.kluc}
            className="nastenka-listok caka na-vyber citatelny"
            style={{ "--naklon": naklon, "--i": i, "--lc-sirka": `${v.sirka}px` } as CSSProperties}
          >
            <span className="nastenka-karta">{vyber(l.lokalita, v.sirka)}</span>
          </li>
        );
      }
      return (
        <li key={l.kluc} className="nastenka-listok caka na-vyber" style={{ "--naklon": naklon, "--i": i } as CSSProperties}>
          <span className="nastenka-karta">{vyber(l.lokalita, sirkaVyberu)}</span>
        </li>
      );
    }
    // Bez funkcie karta (nízka plsť) sú lístky bez kariet, ale stĺpcom ako s kartou.
    const sKartou = !kompaktna && karta !== undefined;
    // Odohraná lokalita (Michal 2026-10-31): nad kartou fotka víťaza, pod ňou koľko špakov za ňu
    // získal; rozpis na myš či fokus, klik otvorí súhrn Pitiek a bitky. Telefón po starom.
    const sRozpisom = b !== undefined && !poStarom;
    const vStlpci = sRozpisom && !kompaktna && !kratky(l);
    const otvor = b === undefined || poStarom ? null : (suhrn?.(b) ?? null);
    const ukaz = (el: HTMLElement): void => setNaMys((r) => (r?.i === i && r.el === el ? r : { i, el }));
    const skry = (): void => setNaMys((r) => (r?.i === i ? null : r));
    const naKlaves = (e: KeyboardEvent<HTMLLIElement>): void => {
      if (otvor === null || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      otvor();
    };
    return (
      <li
        key={l.kluc}
        className={`nastenka-listok ${l.stav}${l.finale ? " finale" : ""}${vitaz === null ? "" : vitaz === ja ? " moja" : " superova"}${vStlpci ? " v-stlpci" : ""}${otvor !== null ? " klikatelny" : ""}`}
        style={{ "--naklon": `${((i * 37) % 5) - 2}deg`, "--i": i } as CSSProperties}
        title={sRozpisom ? undefined : popis}
        {...(sRozpisom
          ? {
              tabIndex: 0,
              role: otvor !== null ? "button" : undefined,
              "aria-label": otvor !== null ? t("spaky.ariaSuhrn", { popis }) : popis,
              "aria-describedby": naMys?.i === i ? idRozpisu : undefined,
              onMouseEnter: (e: { currentTarget: HTMLLIElement }) => ukaz(e.currentTarget),
              onMouseLeave: skry,
              onFocus: (e: { currentTarget: HTMLLIElement }) => ukaz(e.currentTarget),
              onBlur: skry,
              onClick: otvor ?? undefined,
              onKeyDown: naKlaves,
            }
          : {})}
      >
        <span className="nastenka-vitaz">
          {b === undefined ? (
            <span className="nastenka-otaznik">{l.stav === "teraz" ? t("spaky.teraz") : "?"}</span>
          ) : vitaz === null ? (
            <span className="nastenka-sekera">
              {t("spaky.sekera")} <small>{b.prepadlo > 0 ? `−${b.prepadlo}` : vzal !== null ? `${zaklad} → ${kto(vzal)}` : t("spaky.caka", { n: zaklad })}</small>
            </span>
          ) : (
            <>
              <Avatar meno={mena[vitaz]} avatar={avatary[vitaz]} velkost={Math.round((kompaktna || kratky(l) ? 24 : vStlpci ? 40 : 34) * mierka)} farba={vitaz === ja ? "ja" : "su"} />
              {!vStlpci && (
                <b className="nastenka-zisk">
                  {zn(zisk)}
                  <IkonaSpaku />
                </b>
              )}
            </>
          )}
        </span>
        {sKartou && karta !== undefined && l.lokalita !== null ? (
          <span className="nastenka-karta">{karta(l.lokalita, sirkaKarty)}</span>
        ) : sKartou && l.finale ? (
          <span className="nastenka-karta nastenka-finale" style={{ width: sirkaKarty, height: Math.round(sirkaKarty * 1.48) }}>
            <b>{t("faza.finale")}</b>
            <small>{finaleText}</small>
          </span>
        ) : null}
        {/* Karta nesie názov sama — pod ňou len špaky; bez karty názov ostáva. */}
        {!(vStlpci && sKartou && l.lokalita !== null) && <span className="nastenka-nazov">{nazov}</span>}
        {vStlpci && b !== undefined && <ZiskLokality b={b} ja={ja} />}
        {!sRozpisom && !kompaktna && !kratky(l) && pozn.length > 0 && <span className="nastenka-pozn">{pozn.join(" · ")}</span>}
        {!sRozpisom && ucet !== undefined && b !== undefined && !kratky(l) && <Uctenka b={b} riadok={pomer} kto={poradie.map(kto).join(" : ")} poradie={poradie} ja={ja} menoKarty={menoKarty} />}
      </li>
    );
  };


  const zoznam = (
    <ol className={`nastenka${kompaktna ? " kompaktna" : ""}${vyber !== undefined ? " volba" : ""}${vyber !== undefined && listokVyberu !== null ? " citatelna" : ""}`} aria-label={t("spaky.nastenka")} data-vyucba={vyber !== undefined ? "lokality" : undefined}>
      {kratkeBitky && listky.some(kratky) && (
        <li className="nastenka-historia">
          <ol aria-label={t("spaky.odohraneBitky")}>{listky.map((l, i) => (kratky(l) ? listokEl(l, i) : null))}</ol>
        </li>
      )}
      {listky.map((l, i) => (kratky(l) ? null : listokEl(l, i)))}
      {ucet !== undefined && !koniec && (
        <ListokKonca
          kartovy={sirkaKonca}
          title={t("spaky.koniecTitul", { zaPoldeci: KONSTANTY.SPAKY_ZA_POLDECI, zaCigarety: KONSTANTY.CIGARIET_ZA_SPAK, poldeci: dvojica(ucet.body.vykupne.map((v) => v.poldeci) as [number, number], (n) => t("spaky.nPoldeci", { n })), cigarety: dvojica(ucet.body.vykupne.map((v) => v.cigarety) as [number, number], (n) => t("tabula.cig", { n })), cirhoza: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) })}
        >
          <span className="nastenka-vitaz">
            <span className="nastenka-otaznik">{t("spaky.koniec")}</span>
          </span>
          <span className="nastenka-nazov">{t("spaky.koniecPoFinale")}</span>
          {/* Komu čo, menami (Michal 2026-10-30: „výkupné +2 : +2“ nebolo jasné komu). */}
          <span className="nastenka-uctenka nastenka-koniec">
            <span className="nk-nadpis">{t("spaky.vykupneZdrojov")}</span>
            {poradie.map((p) => (
              <span key={`v${p}`} className={`nk-hrac ${p === ja ? "moje" : "superove"}`}>
                <span className="nk-meno">{kto(p)}</span> <b className={ucet.body.vykupne[p].spaky > 0 ? "plus" : ""}>{ucet.body.vykupne[p].spaky > 0 ? `+${ucet.body.vykupne[p].spaky}` : "0"}</b>
              </span>
            ))}
            <span className="nk-nadpis">{t("tabula.nepriznanaCirhozaMale")}</span>
            {poradie.map((p) => (
              <span key={`c${p}`} className={`nk-hrac ${p === ja ? "moje" : "superove"}`}>
                <span className="nk-meno">{kto(p)}</span> <b className={ucet.body.cirhozy[p] > 0 ? "minus" : ""}>{ucet.body.cirhozy[p] > 0 ? `−${ucet.body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU}` : "0"}</b>
              </span>
            ))}
          </span>
        </ListokKonca>
      )}
    </ol>
  );
  const bitkaNaMys = naMys === null ? undefined : listky[naMys.i]?.bitka;
  const okienko =
    naMys !== null && bitkaNaMys !== undefined && typeof document !== "undefined"
      ? createPortal(
          <RozpisNaMys id={idRozpisu} b={bitkaNaMys} el={naMys.el} ja={ja} mena={mena} menoKarty={menoKarty} klik={suhrn?.(bitkaNaMys) != null} vyhraStrachom={vyhraStrachom?.(bitkaNaMys) ?? null} />,
          document.body,
        )
      : null;
  if (ucet === undefined)
    return (
      <>
        {zoznam}
        {okienko}
      </>
    );
  const rozpis = rozpisSpakov({ nastenka, koniec: null, spaky: ucet.body.spaky });
  const { body } = ucet;
  // Nízky stôl pri voľbe cieľa (Michal 2026-10-31): popolníky vedľa radu, karty dostanú celú výšku.
  const popolnikyVedla = vyber !== undefined && listokVyberu?.popolnikyVedla === true;
  return (
    <div className={`nastenka-ucet${popolnikyVedla ? " vedla" : ""}`}>
      <div className="nastenka-popolniky">
        {poradie.map((p) => {
          const r = rozpis[p];
          const casti = [
            t("spaky.bitkyN", { n: zn(r.zaBitky) }),
            t("spaky.starsiN", { n: zn(r.zaStarsich) }),
            ...(r.prebytok > 0 ? [t("spaky.nakladackaN", { n: `+${r.prebytok}` })] : []),
            ...(r.exekutor < 0 ? [t("spaky.exekutorN", { n: zn(r.exekutor) })] : []),
          ];
          return (
            <div key={p} className={`nastenka-popolnik ${p === ja ? "moj" : "superov"}${p === ucet.zvyraznit ? " zvyrazneny" : ""}`}>
              <Avatar meno={mena[p]} avatar={avatary[p]} velkost={Math.round(30 * mierka)} farba={p === ja ? "ja" : "su"} />
              <span className="np-meno">{p === ja ? t("stol.ty") : mena[p]}</span>
              <PocetSpakov n={body.spaky[p]} kto={p === ja ? "moj" : "superov"} />
              <span className="np-rozpis">{casti.join(" · ")}</span>
            </div>
          );
        })}
      </div>
      {zoznam}
      {okienko}
    </div>
  );
}

/** Užší Koniec veľkosti karty by text nezmestil čitateľne. */
const KONIEC_KARTA_MIN = 100;
/** Najmenšia mierka písma Konca veľkosti karty, keď sa obsah nezmestí. */
const KONIEC_MIERKA_MIN = 0.7;

/**
 * Lístok „Koniec · po finále“ s výkupným zdrojov, väzňami a nepriznanou Cirhózou. S `kartovy` má
 * rozmer karty na výber a písmo sa zmenší, kým sa celý obsah nezmestí — nič nesmie vytŕčať.
 */
function ListokKonca({ kartovy, title, children }: { readonly kartovy: { readonly sirka: number; readonly vyska: number } | null; readonly title: string; readonly children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || kartovy === null) return;
    const prisposob = (): void => {
      let m = 1;
      el.style.setProperty("--m", "1");
      while (el.scrollHeight > el.clientHeight + 1 && m > KONIEC_MIERKA_MIN) {
        m = Math.round((m - 0.025) * 1000) / 1000;
        el.style.setProperty("--m", String(m));
      }
    };
    prisposob();
    const ro = new ResizeObserver(prisposob);
    ro.observe(el);
    return () => ro.disconnect();
  }, [kartovy?.sirka, kartovy?.vyska]);
  return (
    <li
      ref={ref}
      className={`nastenka-listok koniec${kartovy !== null ? " kartovy" : ""}`}
      style={{ "--naklon": "1deg", ...(kartovy !== null ? { "--lc-sirka": `${kartovy.sirka}px`, "--lc-vyska": `${kartovy.vyska}px` } : {}) } as CSSProperties}
      title={title}
    >
      {children}
    </li>
  );
}

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/**
 * Kto zo starších koľko dal hráčovi p v bitke: „Farár +3, Krčmárka +1“ (Michal 2026-10-27).
 * Záznam spred rozpisu (bez zaStarsichRozpis) vráti "".
 */
export function textRozpisuStarsich(b: BitkaNaNastenke, p: PlayerId, menoKarty: (defId: string) => string): string {
  return (b.zaStarsichRozpis?.[p] ?? []).map((x) => `${menoKarty(x.defId)} +${x.spaky}`).join(", ");
}

/**
 * Rozpis za starších (Michal 2026-10-27): stupeň strachu = špaky, ktoré starší dal. S priazňou
 * staršieho (FavourStarsich) je pred menom krúžok priazne (Michal 2026-10-31) — priazeň toho
 * stupňa patrila súperovi hráča, ktorého sa bál; inak výkričníky vo farbe hráča. Noviny sú bez
 * značky — nie sú starší.
 */
export function RozpisStarsich({ b, p, ja, menoKarty }: { readonly b: BitkaNaNastenke; readonly p: PlayerId; readonly ja: PlayerId; readonly menoKarty: (defId: string) => string }) {
  const favour = useContext(FavourStarsich);
  const polozky = b.zaStarsichRozpis?.[p] ?? [];
  return (
    <>
      {polozky.map((x, i) => {
        const fav = x.elderId === null ? null : favour(x.elderId);
        return (
          <span key={i} className="rozpis-starsieho">
            {i > 0 && ", "}
            {fav !== null ? (
              <PilulkaPriazne fav={fav} p={{ komu: p === ja ? "su" : "ja", sila: Math.min(3, x.spaky) }} />
            ) : (
              x.elderId !== null && <ZnackaStrachu uroven={x.spaky} trieda={p === ja ? "moje" : "superove"} />
            )}{" "}
            {menoKarty(x.defId)} +{x.spaky}
          </span>
        );
      })}
    </>
  );
}

/**
 * Koľko riadkov tabuľky (rekapitulácia bitky) zaberie rozpis za starších pod číslom:
 * do bunky sa zmestia asi tri mená, riadok rozpisu je asi polovica riadku tabuľky.
 */
export function riadkovRozpisuStarsich(b: BitkaNaNastenke): number {
  const najviac = Math.max(b.zaStarsichRozpis?.[0].length ?? 0, b.zaStarsichRozpis?.[1].length ?? 0);
  return Math.ceil(najviac / 3) * 0.55;
}

/** Účtenka pod lístkom bitky: čo dali starší, Exekútor, prebytok a stav popolníkov po bitke. */
function Uctenka({
  b,
  riadok,
  kto,
  poradie,
  ja,
  menoKarty,
}: {
  readonly b: BitkaNaNastenke;
  readonly riadok: (h: readonly [number, number], f: (n: number) => string) => string;
  /** Poradie čísel v riadkoch („ty : Fero“) — ako popolníky nad nástenkou. */
  readonly kto: string;
  readonly poradie: readonly [PlayerId, PlayerId];
  readonly ja: PlayerId;
  readonly menoKarty: (defId: string) => string;
}) {
  const plus = (n: number): string => (n > 0 ? `+${n}` : "0");
  // Lístok je úzky: rozpis bez mien hráčov, čí je, ukáže farba (ako popolníky nad nástenkou).
  const rozpis = poradie.filter((p) => textRozpisuStarsich(b, p, menoKarty) !== "");
  return (
    <span
      className="nastenka-uctenka"
      title={b.vitaz === null ? t("spaky.uctenkaSekera", { kto }) : t("spaky.uctenkaVitaz", { kto })}
    >
      <span>{t("spaky.starsiN", { n: riadok(b.zaStarsich, plus) })}</span>
      {rozpis.map((p) => (
        <span key={p} className={`nastenka-rozpis ${p === ja ? "moje" : "superove"}`}>
          <RozpisStarsich b={b} p={p} ja={ja} menoKarty={menoKarty} />
        </span>
      ))}
      {robotaBitky(b)[0] + robotaBitky(b)[1] > 0 && <span>{t("spaky.robotaN", { n: riadok(robotaBitky(b), plus) })}</span>}
      {b.exekutor[0] + b.exekutor[1] > 0 && <span className="minus">{t("spaky.exekutorN", { n: riadok(b.exekutor, (n) => (n > 0 ? `−${n}` : "0")) })}</span>}
      {b.prebytok[0] + b.prebytok[1] > 0 && <span>{t("spaky.nakladackaN", { n: riadok(b.prebytok, plus) })}</span>}
      <b>{t("spaky.stavN", { n: riadok(b.spakyPo, sMinusom) })}</b>
    </span>
  );
}

/**
 * Špaky jednej bitky po hráčoch (rekapitulácia a účet bitky): za bitku, za starších,
 * prebytok vo finále a na Kultúrnom dome, Exekútor; s `pred` aj stav popolníka pred a po.
 */
export function SpakyBitky({
  b,
  ja,
  mena,
  pred,
  menoKarty,
  vyhraStrachom = null,
}: {
  readonly b: BitkaNaNastenke;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly pred?: readonly [number, number] | undefined;
  /** S menami kariet ukáže pri špakoch za starších, ktorý starší koľko dal. */
  readonly menoKarty?: ((defId: string) => string) | undefined;
  /** Bitka skončila výhrou strachom (vyhraStrachomBitky) — exekúcia po nej nebola. */
  readonly vyhraStrachom?: VyhraStrachom | null | undefined;
}) {
  const su = opponentOf(ja);
  const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "—");
  const zaBitku = (p: PlayerId): string => poznamkaZaBitku(b, p);
  const zaStarsich = (p: PlayerId): string => (menoKarty === undefined ? "" : textRozpisuStarsich(b, p, menoKarty));
  const riadky: {
    readonly kluc: string;
    readonly nazov: string;
    readonly h: readonly [number, number];
    readonly pozn?: (p: PlayerId) => string;
    /** Poznámka pod číslom (dlhý rozpis by bunku roztiahol). */
    readonly pod?: boolean;
  }[] = [
    { kluc: "bitka", nazov: t("spaky.zaBitku"), h: b.zaBitku, pozn: zaBitku },
    ...((b.robota?.[0] ?? 0) + (b.robota?.[1] ?? 0) > 0 ? [{ kluc: "robota", nazov: t("spaky.robotaNemala"), h: robotaBitky(b) }] : []),
    { kluc: "starsi", nazov: t("spaky.zaStarsichPoBitke"), h: b.zaStarsich, pozn: zaStarsich, pod: true },
    ...(b.prebytok[0] + b.prebytok[1] > 0 ? [{ kluc: "prebytok", nazov: jeFinaleNaNastenke(b) ? t("spaky.nakladackaFinale") : t("spaky.prebytok"), h: b.prebytok }] : []),
    ...(b.exekutor[0] + b.exekutor[1] > 0 ? [{ kluc: "exekutor", nazov: t("spaky.exekutor"), h: [-b.exekutor[0], -b.exekutor[1]] as const }] : []),
  ];
  return (
    <div className="spaky-bitky" role="table" aria-label={t("spaky.zBitky")}>
      <span className="sb-hlava" role="row">
        <span role="columnheader">{t("tabula.spakyMale")}</span>
        <span role="columnheader" className="moje">
          {t("stol.ty")}
        </span>
        <span role="columnheader" className="superove">
          {mena[su]}
        </span>
      </span>
      {riadky.map((r) => (
        <span key={r.kluc} className="sb-riadok" role="row">
          <span role="rowheader">{r.nazov}</span>
          {([ja, su] as const).map((p) => (
            <span key={p} role="cell" className={r.h[p] > 0 ? "plus" : r.h[p] < 0 ? "minus" : "nic"} title={r.pozn?.(p) || undefined}>
              {zn(r.h[p])}
              {r.pozn !== undefined &&
                r.pozn(p) !== "" &&
                (r.pod === true ? (
                  <small className="sb-pod">{r.kluc === "starsi" && menoKarty !== undefined ? <RozpisStarsich b={b} p={p} ja={ja} menoKarty={menoKarty} /> : r.pozn(p)}</small>
                ) : (
                  <small> {r.pozn(p)}</small>
                ))}
            </span>
          ))}
        </span>
      ))}
      <span className="sb-riadok sb-spolu" role="row">
        <span role="rowheader">{t("spaky.vPopolniku")}</span>
        {([ja, su] as const).map((p) => (
          <span key={p} role="cell">
            {pred !== undefined && pred[p] !== b.spakyPo[p] && <>{sMinusom(pred[p])} → </>}
            <b>{sMinusom(b.spakyPo[p])}</b>
            <IkonaSpaku />
          </span>
        ))}
      </span>
      {b.vitaz === null && (
        <span className="sb-sekera">
          {b.prepadlo > 0
            ? t("spaky.sekeraFinale", { spaky: spakov(b.prepadlo) })
            : t("spaky.sekeraCaka", { spaky: spakov(zakladBitky(b)) })}
        </span>
      )}
      {vyhraStrachom !== null && (
        <span className="sb-sekera" title={titulBezExekucie()}>
          {textVyhryStrachom(vyhraStrachom)}
        </span>
      )}
    </div>
  );
}

/** Špaky bitky jedným riadkom (účet bitky nad stolom): „ty 4 → 5 (+1 starší) · Fero 0 → 2 (+1 bitka, +1 starší)“. */
export function textSpakovBitky(b: BitkaNaNastenke, pred: readonly [number, number], poradie: readonly [PlayerId, PlayerId], kto: (p: PlayerId) => string): string {
  const za = (p: PlayerId): string => {
    const casti: string[] = [];
    if (b.zaBitku[p] > 0) casti.push(b.zoSekery > 0 ? t("spaky.castBitkaSekera", { n: b.zaBitku[p], sekera: b.zoSekery }) : t("spaky.castBitka", { n: b.zaBitku[p] }));
    if ((b.robota?.[p] ?? 0) > 0) casti.push(t("spaky.castRobota", { n: b.robota?.[p] ?? 0 }));
    if (b.zaStarsich[p] > 0) casti.push(t("spaky.castStarsi", { n: b.zaStarsich[p] }));
    if (b.prebytok[p] > 0) casti.push(t("spaky.castNakladacka", { n: b.prebytok[p] }));
    if (b.exekutor[p] > 0) casti.push(t("spaky.castExekutor", { n: b.exekutor[p] }));
    return casti.length === 0 ? "" : ` (${casti.join(", ")})`;
  };
  const sekera = b.vitaz !== null ? "" : b.prepadlo > 0 ? t("spaky.riadokSekeraPrepadlo", { spaky: spakov(b.prepadlo) }) : t("spaky.riadokSekeraCaka", { spaky: spakov(zakladBitky(b)) });
  return poradie.map((p) => `${kto(p)} ${sMinusom(pred[p])} → ${sMinusom(b.spakyPo[p])}${za(p)}`).join(" · ") + sekera;
}

/** Špaky v popolníkoch pred bitkou — zo záznamu nástenky (po bitke mínus to, čo bitka dala a vzala). */
export function spakyPredBitkou(b: BitkaNaNastenke): readonly [number, number] {
  const pred = (p: PlayerId): number => b.spakyPo[p] - b.zaBitku[p] - (b.robota?.[p] ?? 0) - b.zaStarsich[p] - b.prebytok[p] + b.exekutor[p];
  return [pred(0), pred(1)];
}

/** Špaky za Robotu v bitke (záznamy spred Náradia ju nemajú). */
export function robotaBitky(b: Pick<BitkaNaNastenke, "robota">): readonly [number, number] {
  return [b.robota?.[0] ?? 0, b.robota?.[1] ?? 0];
}

/** Z čoho sú špaky hráča p za bitku: „6 kariet v línii +2 zo sekery“, Kultúrny dom porazenému; "" pri nule. */
export function poznamkaZaBitku(b: BitkaNaNastenke, p: PlayerId): string {
  if (b.zaBitku[p] === 0) return "";
  if (b.vitaz !== null && b.vitaz !== p && spakyPorazeneho(b) > 0) return t("spaky.svojeKarty");
  if (b.vitaz !== null && b.vitaz !== p && (b.noviny ?? 0) > 0) return t("spaky.dlhyVitaza");
  // Kultúrny dom (v11.13): aj víťaz len za svoje karty, nie za celú líniu.
  const casti = [b.lokalita?.defId === "kulturny_dom" ? t("spaky.svojeKarty") : textZakladu(b)];
  if (b.abstakZrazka > 0) casti.push(t("spaky.castAbstak", { n: b.abstakZrazka }));
  const herna = spakyZaHernu(b);
  if (herna > 0) casti.push(t("spaky.castHerna", { n: herna }));
  if (b.zoSekery > 0) casti.push(t("spaky.poznZoSekery", { n: b.zoSekery }));
  return casti.join(" ");
}

export interface RiadokRozpisuLokality {
  readonly kluc: "bitka" | "robota" | "starsi" | "prebytok" | "exekutor";
  readonly nazov: string;
  /** Špaky [hráč 0, hráč 1] so znamienkom — Exekútor záporne. */
  readonly h: readonly [number, number];
  /** Z čoho sú (pod číslom v rozpise); "" = nič. */
  readonly pozn: readonly [string, string];
}

export interface RozpisLokality {
  readonly riadky: readonly RiadokRozpisuLokality[];
  /** Čo kto za lokalitu získal spolu = popolník po bitke mínus pred ňou. */
  readonly spolu: readonly [number, number];
}

/**
 * Koľko špakov kto za lokalitu získal a za čo (Michal 2026-10-31: „nevidno špaky za Robotu“):
 * bitka, Robota, starší na konci kola, Nakladačka vo finále, Exekútor. Riadky s nulou u oboch
 * vynechá, okrem bitky. Číslo pod lokalitou na nástenke je `spolu` víťaza.
 */
export function rozpisLokality(b: BitkaNaNastenke, menoKarty?: (defId: string) => string): RozpisLokality {
  const robota = robotaBitky(b);
  const riadky: RiadokRozpisuLokality[] = [
    { kluc: "bitka", nazov: jeFinaleNaNastenke(b) ? t("spaky.zaFinale") : t("spaky.zaBitku"), h: b.zaBitku, pozn: [poznamkaZaBitku(b, 0), poznamkaZaBitku(b, 1)] },
    { kluc: "robota", nazov: t("spaky.robota"), h: robota, pozn: ["", ""] },
    {
      kluc: "starsi",
      nazov: t("spaky.starsiKoniecKola"),
      h: b.zaStarsich,
      pozn: menoKarty === undefined ? ["", ""] : [textRozpisuStarsich(b, 0, menoKarty), textRozpisuStarsich(b, 1, menoKarty)],
    },
    { kluc: "prebytok", nazov: t("delenie.nakladacka"), h: b.prebytok, pozn: ["", ""] },
    { kluc: "exekutor", nazov: t("spaky.exekutor"), h: [-b.exekutor[0], -b.exekutor[1]], pozn: ["", ""] },
  ];
  const pred = spakyPredBitkou(b);
  return {
    riadky: riadky.filter((r) => r.kluc === "bitka" || r.h[0] !== 0 || r.h[1] !== 0),
    spolu: [b.spakyPo[0] - pred[0], b.spakyPo[1] - pred[1]],
  };
}

/**
 * Pod kartou odohranej lokality: koľko špakov za ňu získal víťaz. Keď niečo získal (alebo stratil)
 * aj porazený — starší, Kultúrny dom, Exekútor — stojí vedľa menšie číslo v jeho farbe; pri
 * sekere obaja, ak niečo dostali.
 */
function ZiskLokality({ b, ja }: { readonly b: BitkaNaNastenke; readonly ja: PlayerId }) {
  const { spolu } = rozpisLokality(b);
  const prvy: PlayerId = b.vitaz ?? ja;
  const druhy = opponentOf(prvy);
  const ukaz = (p: PlayerId): boolean => p === b.vitaz || spolu[p] !== 0;
  return (
    <span className="nastenka-ziskane">
      {([prvy, druhy] as const).filter(ukaz).map((p) => (
        <span key={p} className={`nz-hrac ${p === ja ? "moje" : "superove"}${p === b.vitaz ? " vitaz" : ""}`}>
          <IkonaSpaku />
          <b>{zn(spolu[p])}</b>
        </span>
      ))}
      {!ukaz(prvy) && !ukaz(druhy) && <span className="nz-hrac nic">0</span>}
    </span>
  );
}

const ROZPIS_SIRKA = 290;

/**
 * Rozpis špakov lokality na myš a na fokus (Michal 2026-10-31): kto koľko za čo získal, v ich
 * farbách, spolu na konci. Leží v portáli nad stolom (nástenka sa posúva a lístky sú natočené),
 * vedľa lístka — vpravo, keď sa zmestí, inak vľavo; nikdy nevytŕča z okna.
 */
function RozpisNaMys({
  id,
  b,
  el,
  ja,
  mena,
  menoKarty,
  klik,
  vyhraStrachom,
}: {
  readonly id: string;
  readonly b: BitkaNaNastenke;
  readonly el: HTMLElement;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly klik: boolean;
  readonly vyhraStrachom: VyhraStrachom | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly top: number } | null>(null);
  useLayoutEffect(() => {
    const okno = ref.current;
    if (okno === null) return;
    const r = el.getBoundingClientRect();
    const w = okno.offsetWidth;
    const h = okno.offsetHeight;
    const vpravo = r.right + 10;
    const left = vpravo + w <= window.innerWidth - 8 ? vpravo : Math.max(8, r.left - 10 - w);
    const top = Math.min(Math.max(8, r.top), Math.max(8, window.innerHeight - h - 8));
    setPoloha({ left, top });
  }, [el, b]);
  const su = opponentOf(ja);
  const { riadky, spolu } = rozpisLokality(b, menoKarty);
  const nazov = b.lokalita === null ? (jeFinaleNaNastenke(b) ? t("faza.finale") : t("stol.lokalita")) : jeFinaleNaNastenke(b) ? t("spaky.finaleLokalita", { meno: menoKarty(b.lokalita.defId) }) : menoKarty(b.lokalita.defId);
  const vysledok = b.vitaz === null ? t("spaky.sekera") : b.vitaz === ja ? t("spaky.tvojaVyhra") : t("spaky.vyhraHraca", { meno: mena[b.vitaz] });
  const cislo = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "—");
  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="nastenka-rozpis-na-mys"
      style={{ width: ROZPIS_SIRKA, ...(poloha === null ? { visibility: "hidden", left: 0, top: 0 } : poloha) }}
    >
      <span className="nrm-hlava">
        <b>{nazov}</b>
        <span>{t("spaky.koloVysledok", { kolo: b.kolo, vysledok })}</span>
      </span>
      <table>
        <thead>
          <tr>
            <th scope="col">{t("tabula.spakyMale")}</th>
            <th scope="col" className="moje">
              {t("stol.ty")}
            </th>
            <th scope="col" className="superove">
              {mena[su]}
            </th>
          </tr>
        </thead>
        <tbody>
          {riadky.map((r) => (
            <tr key={r.kluc}>
              <th scope="row">{r.nazov}</th>
              {([ja, su] as const).map((p) => (
                <td key={p} className={`${p === ja ? "moje" : "superove"}${r.h[p] === 0 ? " nic" : r.h[p] < 0 ? " minus" : ""}`}>
                  {cislo(r.h[p])}
                  {r.pozn[p] !== "" && <small>{r.pozn[p]}</small>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t("spaky.spolu")}</th>
            {([ja, su] as const).map((p) => (
              <td key={p} className={`${p === ja ? "moje" : "superove"}${spolu[p] < 0 ? " minus" : ""}`}>
                <b>{spolu[p] === 0 ? "0" : cislo(spolu[p])}</b>
                <IkonaSpaku />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {b.vitaz === null && <small className="nrm-pozn">{b.prepadlo > 0 ? t("spaky.sekeraFinale", { spaky: spakov(b.prepadlo) }) : t("spaky.sekeraIslo", { spaky: spakov(zakladBitky(b)) })}</small>}
      {vyhraStrachom !== null && <small className="nrm-pozn">{textVyhryStrachom(vyhraStrachom)}</small>}
      <small className="nrm-pozn">
        {t("spaky.poKole", { ja: sMinusom(b.spakyPo[ja]), meno: mena[su], su: sMinusom(b.spakyPo[su]) })}
      </small>
      {klik && <small className="nrm-klik">{t("spaky.klikSuhrn")}</small>}
    </div>
  );
}
