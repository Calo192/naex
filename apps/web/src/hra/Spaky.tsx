// Špaky na stole (pravidlá v6, Michal 2026-10-26, docs/napady/spaky.html bod 12):
// víťazné body sa zbierajú ako špaky (dlaždica pri mene hráča) a krčmová
// nástenka ukazuje nad každou lokalitou fotku víťaza a koľko špakov za ňu získal
// (aj finále). Čísla ráta jadro (nástenka, rozpisSpakov), tu sa len kreslia.

import type { CSSProperties, ReactNode } from "react";
import type { BitkaNaNastenke, CardInstance, CielKola, PlayerId } from "@naex/core";
import { KONSTANTY, spakov } from "@naex/core";
import { Avatar } from "../komponenty.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import "./spaky.css";

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

/** Prečo a ako sa bitka rozhodla — krátko pod lokalitu na nástenke. */
export function poznamkaBitky(b: BitkaNaNastenke, kto: (p: PlayerId) => string): string[] {
  const out: string[] = [];
  if (b.rozhodlo === "abstak") out.push("remíza → menej Absťákov");
  if (b.rozhodlo === "dlhy") out.push("remíza → menej Dlhov");
  if (b.abstakZrazka > 0) out.push(`−${b.abstakZrazka} za Absťák`);
  if (b.zoSekery > 0) out.push(`+${b.zoSekery} zo sekery`);
  if (b.prepadlo > 0) out.push(`${spakov(b.prepadlo)} prepadlo`);
  for (const p of [0, 1] as const) if (b.exekutor[p] > 0) out.push(`Exekútor: ${kto(p)} −${b.exekutor[p]}`);
  for (const p of [0, 1] as const) if (b.prebytok[p] > 0) out.push(`prebytok: ${kto(p)} +${b.prebytok[p]}`);
  return out;
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
export function Nastenka({ nastenka, zostava, ciel, ja, mena, avatary, karta, menoKarty, sirkaKarty = 90, kompaktna = false, koniec = false }: NastenkaProps) {
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const listky: Listok[] = [
    ...nastenka.map((b, i): Listok => ({ kluc: `b${i}`, lokalita: b.lokalita, finale: b.lokalita === null, stav: "odohrana", bitka: b })),
    ...(ciel !== null && !koniec ? [{ kluc: "teraz", lokalita: ciel.lokalita, finale: ciel.typ === "finale", stav: "teraz" as const }] : []),
    ...(koniec ? [] : zostava.map((k): Listok => ({ kluc: `z${k.uid}`, lokalita: k, finale: false, stav: "caka" }))),
  ];
  const finaleHotove = listky.some((l) => l.finale);
  if (!finaleHotove && !koniec) listky.push({ kluc: "finale", lokalita: null, finale: true, stav: "caka" });
  const pitkyFinale = KONSTANTY.FINALE_PITKY;

  return (
    <ol className={`nastenka${kompaktna ? " kompaktna" : ""}`} aria-label="Krčmová nástenka">
      {listky.map((l, i) => {
        const b = l.bitka;
        const nazov = l.finale ? "Finále" : l.lokalita === null ? "lokalita" : menoKarty(l.lokalita.defId);
        const vitaz = b?.vitaz ?? null;
        const zisk = b === undefined || vitaz === null ? 0 : b.zaBitku[vitaz];
        const pozn = b === undefined ? [] : poznamkaBitky(b, kto);
        // Sekera: špaky si vzal víťaz najbližšej ďalšej bitky (ak už bola).
        const vzal = b === undefined || vitaz !== null ? null : (nastenka.slice(i + 1).find((x) => x.vitaz !== null)?.vitaz ?? null);
        const popis =
          b === undefined
            ? l.stav === "teraz"
              ? `${nazov}: bije sa teraz`
              : l.finale
                ? `Finále: posledná bitka bez lokality, ${pitkyFinale} Pitky`
                : `${nazov}: ešte sa o ňu nehralo`
            : vitaz === null
              ? `${nazov} (kolo ${b.kolo}): sekera — ${b.prepadlo > 0 ? `${spakov(b.prepadlo)} prepadlo` : vzal !== null ? `${spakov(b.pitky)} vzal víťaz ďalšej bitky (${kto(vzal)})` : `${spakov(b.pitky)} čaká na víťaza ďalšej bitky`}`
              : `${nazov} (kolo ${b.kolo}): ${vitaz === ja ? "tvoja výhra" : `výhra – ${mena[vitaz]}`}, ${spakov(zisk)} za ${b.pitky} ${b.pitky === 1 ? "Pitku" : b.pitky < 5 ? "Pitky" : "Pitiek"}${pozn.length > 0 ? ` (${pozn.join(", ")})` : ""}`;
        return (
          <li
            key={l.kluc}
            className={`nastenka-listok ${l.stav}${l.finale ? " finale" : ""}${vitaz === null ? "" : vitaz === ja ? " moja" : " superova"}`}
            style={{ "--naklon": `${((i * 37) % 5) - 2}deg` } as CSSProperties}
            title={popis}
          >
            <span className="nastenka-vitaz">
              {b === undefined ? (
                <span className="nastenka-otaznik">{l.stav === "teraz" ? "teraz" : "?"}</span>
              ) : vitaz === null ? (
                <span className="nastenka-sekera">
                  sekera <small>{b.prepadlo > 0 ? `−${b.prepadlo}` : vzal !== null ? `${b.pitky} → ${kto(vzal)}` : `${b.pitky} čaká`}</small>
                </span>
              ) : (
                <>
                  <Avatar meno={mena[vitaz]} avatar={avatary[vitaz]} velkost={kompaktna ? 24 : 34} />
                  <b className="nastenka-zisk">
                    +{zisk}
                    <IkonaSpaku />
                  </b>
                </>
              )}
            </span>
            {!kompaktna && karta !== undefined && l.lokalita !== null ? (
              <span className="nastenka-karta">{karta(l.lokalita, sirkaKarty)}</span>
            ) : !kompaktna && l.finale ? (
              <span className="nastenka-karta nastenka-finale" style={{ width: sirkaKarty, height: Math.round(sirkaKarty * 1.48) }}>
                <b>Finále</b>
                <small>bez lokality · {pitkyFinale} Pitky</small>
              </span>
            ) : null}
            <span className="nastenka-nazov">{nazov}</span>
            {!kompaktna && pozn.length > 0 && <span className="nastenka-pozn">{pozn.join(" · ")}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Mini nástenka do tlačidla v hlavičke stola: bodka za každú bitku (farba víťaza), prázdne čakajú. */
export function MiniNastenka({ nastenka, zostava, ja }: { readonly nastenka: readonly BitkaNaNastenke[]; readonly zostava: number; readonly ja: PlayerId }) {
  const finale = nastenka.some((b) => b.lokalita === null);
  return (
    <span className="mini-nastenka" aria-hidden="true">
      {nastenka.map((b, i) => (
        <i key={i} className={`${b.vitaz === null ? "sekera" : b.vitaz === ja ? "moja" : "superova"}${b.lokalita === null ? " finale" : ""}`} />
      ))}
      {Array.from({ length: Math.max(0, zostava) }, (_, i) => (
        <i key={`z${i}`} />
      ))}
      {!finale && <i className="finale" />}
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
}: {
  readonly b: BitkaNaNastenke;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly pred?: readonly [number, number] | undefined;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "—");
  const zaBitku = (p: PlayerId): string => {
    if (b.zaBitku[p] === 0) return "";
    const casti = [`${b.pitky} ${b.pitky === 1 ? "Pitka" : b.pitky < 5 ? "Pitky" : "Pitiek"}`];
    if (b.abstakZrazka > 0) casti.push(`−${b.abstakZrazka} Absťák`);
    if (b.zoSekery > 0) casti.push(`+${b.zoSekery} zo sekery`);
    return casti.join(" ");
  };
  const riadky: { readonly kluc: string; readonly nazov: string; readonly h: readonly [number, number]; readonly pozn?: (p: PlayerId) => string }[] = [
    { kluc: "bitka", nazov: "za bitku", h: b.zaBitku, pozn: zaBitku },
    { kluc: "starsi", nazov: "za starších", h: b.zaStarsich },
    ...(b.prebytok[0] + b.prebytok[1] > 0 ? [{ kluc: "prebytok", nazov: b.lokalita === null ? "prebytok (finále)" : "prebytok", h: b.prebytok }] : []),
    ...(b.exekutor[0] + b.exekutor[1] > 0 ? [{ kluc: "exekutor", nazov: "Exekútor", h: [-b.exekutor[0], -b.exekutor[1]] as const }] : []),
  ];
  return (
    <div className="spaky-bitky" role="table" aria-label="Špaky z bitky">
      <span className="sb-hlava" role="row">
        <span role="columnheader">špaky</span>
        <span role="columnheader" className="moje">
          ty
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
              {r.pozn !== undefined && r.pozn(p) !== "" && <small> {r.pozn(p)}</small>}
            </span>
          ))}
        </span>
      ))}
      <span className="sb-riadok sb-spolu" role="row">
        <span role="rowheader">v popolníku</span>
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
            ? `Sekera vo finále: ${spakov(b.prepadlo)} prepadlo.`
            : `Sekera: ${spakov(b.pitky)} za bitku čaká na víťaza ďalšej bitky.`}
        </span>
      )}
    </div>
  );
}

/** Špaky bitky jedným riadkom (účet bitky nad stolom): „ty 4 → 5 (+1 starší) · Fero 0 → 2 (+1 bitka, +1 starší)“. */
export function textSpakovBitky(b: BitkaNaNastenke, pred: readonly [number, number], poradie: readonly [PlayerId, PlayerId], kto: (p: PlayerId) => string): string {
  const za = (p: PlayerId): string => {
    const casti: string[] = [];
    if (b.zaBitku[p] > 0) casti.push(`+${b.zaBitku[p]} bitka${b.zoSekery > 0 ? ` (z toho ${b.zoSekery} zo sekery)` : ""}`);
    if (b.zaStarsich[p] > 0) casti.push(`+${b.zaStarsich[p]} starší`);
    if (b.prebytok[p] > 0) casti.push(`+${b.prebytok[p]} prebytok`);
    if (b.exekutor[p] > 0) casti.push(`−${b.exekutor[p]} Exekútor`);
    return casti.length === 0 ? "" : ` (${casti.join(", ")})`;
  };
  const sekera = b.vitaz !== null ? "" : b.prepadlo > 0 ? ` · sekera: ${spakov(b.prepadlo)} prepadlo` : ` · sekera: ${spakov(b.pitky)} čaká`;
  return poradie.map((p) => `${kto(p)} ${sMinusom(pred[p])} → ${sMinusom(b.spakyPo[p])}${za(p)}`).join(" · ") + sekera;
}

/** Špaky v popolníkoch pred bitkou — zo záznamu nástenky (po bitke mínus to, čo bitka dala a vzala). */
export function spakyPredBitkou(b: BitkaNaNastenke): readonly [number, number] {
  const pred = (p: PlayerId): number => b.spakyPo[p] - b.zaBitku[p] - b.zaStarsich[p] - b.prebytok[p] + b.exekutor[p];
  return [pred(0), pred(1)];
}
