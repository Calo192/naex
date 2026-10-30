// Špaky na stole (pravidlá v6, Michal 2026-10-26, docs/napady/spaky.html bod 12):
// víťazné body sa zbierajú ako špaky (dlaždica pri mene hráča) a krčmová
// nástenka ukazuje nad každou lokalitou fotku víťaza a koľko špakov za ňu získal
// (aj finále). Čísla ráta jadro (nástenka, rozpisSpakov), tu sa len kreslia.

import type { CSSProperties, ReactNode } from "react";
import type { BitkaNaNastenke, CardInstance, CielKola, PlayerId, SpakyTeraz } from "@naex/core";
import { KONSTANTY, jeFinaleNaNastenke, pocet, rozpisSpakov, spakov } from "@naex/core";
import { Avatar } from "../komponenty.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
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

/** Z čoho sú špaky za bitku: od v8 karty v línii, v starších záznamoch odohrané Pitky. */
export function zakladBitky(b: Pick<BitkaNaNastenke, "karty" | "pitky">): number {
  return b.karty ?? b.pitky;
}

/** „6 kariet v línii“ (v8), v starších záznamoch „2 Pitky“. */
export function textZakladu(b: Pick<BitkaNaNastenke, "karty" | "pitky">): string {
  return b.karty !== undefined ? `${pocet(b.karty, "karta", "karty", "kariet")} v línii` : pocet(b.pitky, "Pitka", "Pitky", "Pitiek");
}

/** Kultúrny dom (v8): špaky porazeného za jeho karty v línii; inak 0. */
export function spakyPorazeneho(b: BitkaNaNastenke): number {
  if (b.vitaz === null || b.lokalita?.defId !== "kulturny_dom") return 0;
  return b.zaBitku[b.vitaz === 0 ? 1 : 0] - (b.noviny ?? 0);
}

/** Prečo a ako sa bitka rozhodla — krátko pod lokalitu na nástenke. */
export function poznamkaBitky(b: BitkaNaNastenke, kto: (p: PlayerId) => string): string[] {
  const out: string[] = [];
  const porazenemu = spakyPorazeneho(b);
  if (porazenemu > 0 && b.vitaz !== null) out.push(`${kto(b.vitaz === 0 ? 1 : 0)} +${porazenemu} za svoje karty (Kultúrny dom)`);
  if ((b.noviny ?? 0) > 0 && b.vitaz !== null) out.push(`${kto(b.vitaz === 0 ? 1 : 0)} +${b.noviny} za Dlhy víťaza (Noviny)`);
  if (b.rozhodlo === "abstak") out.push("remíza → menej Absťákov");
  if (b.rozhodlo === "dlhy") out.push("remíza → menej Dlhov");
  if (b.abstakZrazka > 0) out.push(`−${b.abstakZrazka} za Absťák`);
  const herna = spakyZaHernu(b);
  if (herna > 0) out.push(`+${herna} za Dlhy porazeného (Herňa)`);
  if (b.zoSekery > 0) out.push(`+${b.zoSekery} zo sekery`);
  if (b.prepadlo > 0) out.push(`${spakov(b.prepadlo)} prepadlo`);
  for (const p of [0, 1] as const) if (b.exekutor[p] > 0) out.push(`Exekútor: ${kto(p)} −${b.exekutor[p]}`);
  for (const p of [0, 1] as const) if (b.prebytok[p] > 0) out.push(`prebytok: ${kto(p)} +${b.prebytok[p]}`);
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
export function Nastenka({ nastenka, zostava, ciel, ja, mena, avatary, karta, menoKarty, sirkaKarty = 90, kompaktna = false, koniec = false, ucet, vyber, mierka = 1, sirkaVyberu = sirkaKarty }: NastenkaProps) {
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const poradie: readonly [PlayerId, PlayerId] = ucet === undefined || ucet.zvyraznit === ja ? [ja, ja === 0 ? 1 : 0] : [ucet.zvyraznit, ja];
  const listky: Listok[] = [
    ...nastenka.map((b, i): Listok => ({ kluc: `b${i}`, lokalita: b.lokalita, finale: jeFinaleNaNastenke(b), stav: "odohrana", bitka: b })),
    ...(ciel !== null && !koniec ? [{ kluc: "teraz", lokalita: ciel.lokalita, finale: ciel.typ === "finale", stav: "teraz" as const }] : []),
    ...(koniec ? [] : zostava.map((k): Listok => ({ kluc: `z${k.uid}`, lokalita: k, finale: false, stav: "caka" }))),
  ];
  const finaleHotove = listky.some((l) => l.finale);
  if (!finaleHotove && !koniec) listky.push({ kluc: "finale", lokalita: null, finale: true, stav: "caka" });
  // Finále sa boduje ako každá bitka (Michal 2026-10-30: „1 špak za kartu v línii — a normálne
  // to neplatí?“) — lístok to tak aj hovorí, pravidlo bodovania sa neopakuje len pri ňom.
  const finaleText = "posledná bitka, boduje sa ako každá";
  const dvojica = (h: readonly [number, number], f: (n: number) => string): string => poradie.map((p) => `${kto(p)} ${f(h[p])}`).join(" · ");
  // Účtenka je úzka: čísla oboch v poradí popolníkov nad nástenkou („ty : súper“), bez mien.
  const pomer = (h: readonly [number, number], f: (n: number) => string): string => poradie.map((p) => f(h[p])).join(" : ");

  const zoznam = (
    <ol className={`nastenka${kompaktna ? " kompaktna" : ""}${vyber !== undefined ? " volba" : ""}`} aria-label="Krčmová nástenka" data-vyucba={vyber !== undefined ? "lokality" : undefined}>
      {listky.map((l, i) => {
        const b = l.bitka;
        const nazov = l.finale ? (l.lokalita === null ? "Finále" : `Finále · ${menoKarty(l.lokalita.defId)}`) : l.lokalita === null ? "lokalita" : menoKarty(l.lokalita.defId);
        const vitaz = b?.vitaz ?? null;
        const zisk = b === undefined || vitaz === null ? 0 : b.zaBitku[vitaz];
        const zaklad = b === undefined ? 0 : zakladBitky(b);
        const pozn = b === undefined ? [] : poznamkaBitky(b, kto);
        // Sekera: špaky si vzal víťaz najbližšej ďalšej bitky (ak už bola).
        const vzal = b === undefined || vitaz !== null ? null : (nastenka.slice(i + 1).find((x) => x.vitaz !== null)?.vitaz ?? null);
        const popis =
          b === undefined
            ? l.stav === "teraz"
              ? `${nazov}: bije sa teraz`
              : l.finale
                ? `Finále: ${finaleText} — o vrcholovú lokalitu; po ňom výkupné a Cirhóza (Koniec)`
                : `${nazov}: ešte sa o ňu nehralo`
            : vitaz === null
              ? `${nazov} (kolo ${b.kolo}): sekera — ${b.prepadlo > 0 ? `${spakov(b.prepadlo)} prepadlo` : vzal !== null ? `${spakov(zaklad)} vzal víťaz ďalšej bitky (${kto(vzal)})` : `${spakov(zaklad)} čaká na víťaza ďalšej bitky`}`
              : `${nazov} (kolo ${b.kolo}): ${vitaz === ja ? "tvoja výhra" : `výhra – ${mena[vitaz]}`}, ${spakov(zisk)} (${b.karty !== undefined ? "1 za kartu v línii" : "1 za Pitku"}, ${textZakladu(b)})${pozn.length > 0 ? ` (${pozn.join(", ")})` : ""}`;
        if (vyber !== undefined && l.stav === "caka" && l.lokalita !== null)
          return (
            <li key={l.kluc} className="nastenka-listok caka na-vyber" style={{ "--naklon": `${((i * 37) % 5) - 2}deg`, "--i": i } as CSSProperties}>
              <span className="nastenka-karta">{vyber(l.lokalita, sirkaVyberu)}</span>
            </li>
          );
        // Bez funkcie karta (nízka plsť) sú lístky bez kariet, ale stĺpcom ako s kartou.
        const sKartou = !kompaktna && karta !== undefined;
        return (
          <li
            key={l.kluc}
            className={`nastenka-listok ${l.stav}${l.finale ? " finale" : ""}${vitaz === null ? "" : vitaz === ja ? " moja" : " superova"}`}
            style={{ "--naklon": `${((i * 37) % 5) - 2}deg`, "--i": i } as CSSProperties}
            title={popis}
          >
            <span className="nastenka-vitaz">
              {b === undefined ? (
                <span className="nastenka-otaznik">{l.stav === "teraz" ? "teraz" : "?"}</span>
              ) : vitaz === null ? (
                <span className="nastenka-sekera">
                  sekera <small>{b.prepadlo > 0 ? `−${b.prepadlo}` : vzal !== null ? `${zaklad} → ${kto(vzal)}` : `${zaklad} čaká`}</small>
                </span>
              ) : (
                <>
                  <Avatar meno={mena[vitaz]} avatar={avatary[vitaz]} velkost={Math.round((kompaktna ? 24 : 34) * mierka)} farba={vitaz === ja ? "ja" : "su"} />
                  <b className="nastenka-zisk">
                    +{zisk}
                    <IkonaSpaku />
                  </b>
                </>
              )}
            </span>
            {sKartou && karta !== undefined && l.lokalita !== null ? (
              <span className="nastenka-karta">{karta(l.lokalita, sirkaKarty)}</span>
            ) : sKartou && l.finale ? (
              <span className="nastenka-karta nastenka-finale" style={{ width: sirkaKarty, height: Math.round(sirkaKarty * 1.48) }}>
                <b>Finále</b>
                <small>{finaleText}</small>
              </span>
            ) : null}
            <span className="nastenka-nazov">{nazov}</span>
            {!kompaktna && pozn.length > 0 && <span className="nastenka-pozn">{pozn.join(" · ")}</span>}
            {ucet !== undefined && b !== undefined && <Uctenka b={b} riadok={pomer} kto={poradie.map(kto).join(" : ")} poradie={poradie} ja={ja} menoKarty={menoKarty} />}
          </li>
        );
      })}
      {ucet !== undefined && !koniec && (
        <li
          className="nastenka-listok koniec"
          style={{ "--naklon": "1deg" } as CSSProperties}
          title={`Po finále sa vykúpi, čo hráčom ostalo: každý plný poldeci ${KONSTANTY.SPAKY_ZA_POLDECI} špak, každých celých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak (teraz ${dvojica(ucet.body.vykupne.map((v) => v.poldeci) as [number, number], (n) => `${n} poldeci`)}; ${dvojica(ucet.body.vykupne.map((v) => v.cigarety) as [number, number], (n) => `${n} cig.`)}). Každá nepriznaná Cirhóza (ruka aj oba balíčky) zoberie ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}.`}
        >
          <span className="nastenka-vitaz">
            <span className="nastenka-otaznik">koniec</span>
          </span>
          <span className="nastenka-nazov">Koniec · po finále</span>
          {/* Komu čo, menami (Michal 2026-10-30: „výkupné +2 : +2“ nebolo jasné komu). */}
          <span className="nastenka-uctenka nastenka-koniec">
            <span className="nk-nadpis">výkupné zdrojov</span>
            {poradie.map((p) => (
              <span key={`v${p}`} className={`nk-hrac ${p === ja ? "moje" : "superove"}`}>
                {kto(p)} <b className={ucet.body.vykupne[p].spaky > 0 ? "plus" : ""}>{ucet.body.vykupne[p].spaky > 0 ? `+${ucet.body.vykupne[p].spaky}` : "0"}</b>
              </span>
            ))}
            <span className="nk-nadpis">nepriznaná Cirhóza</span>
            {poradie.map((p) => (
              <span key={`c${p}`} className={`nk-hrac ${p === ja ? "moje" : "superove"}`}>
                {kto(p)} <b className={ucet.body.cirhozy[p] > 0 ? "minus" : ""}>{ucet.body.cirhozy[p] > 0 ? `−${ucet.body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU}` : "0"}</b>
              </span>
            ))}
          </span>
        </li>
      )}
    </ol>
  );
  if (ucet === undefined) return zoznam;
  const rozpis = rozpisSpakov({ nastenka, koniec: null, spaky: ucet.body.spaky });
  const { body } = ucet;
  return (
    <div className="nastenka-ucet">
      <div className="nastenka-popolniky">
        {poradie.map((p) => {
          const r = rozpis[p];
          const casti = [
            `bitky ${zn(r.zaBitky)}`,
            `starší ${zn(r.zaStarsich)}`,
            ...(r.prebytok > 0 ? [`prebytok +${r.prebytok}`] : []),
            ...(r.exekutor < 0 ? [`Exekútor ${zn(r.exekutor)}`] : []),
          ];
          return (
            <div key={p} className={`nastenka-popolnik ${p === ja ? "moj" : "superov"}${p === ucet.zvyraznit ? " zvyrazneny" : ""}`}>
              <Avatar meno={mena[p]} avatar={avatary[p]} velkost={Math.round(30 * mierka)} farba={p === ja ? "ja" : "su"} />
              <span className="np-meno">{p === ja ? "ty" : mena[p]}</span>
              <PocetSpakov n={body.spaky[p]} kto={p === ja ? "moj" : "superov"} />
              <span className="np-rozpis">{casti.join(" · ")}</span>
            </div>
          );
        })}
      </div>
      {zoznam}
    </div>
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
 * Rozpis za starších s výkričníkmi (Michal 2026-10-27): stupeň strachu = špaky, ktoré starší dal,
 * farba = hráč, ktorého sa bál a ktorý ich dostal. Noviny sú bez výkričníkov — nie sú starší.
 */
export function RozpisStarsich({ b, p, ja, menoKarty }: { readonly b: BitkaNaNastenke; readonly p: PlayerId; readonly ja: PlayerId; readonly menoKarty: (defId: string) => string }) {
  const polozky = b.zaStarsichRozpis?.[p] ?? [];
  return (
    <>
      {polozky.map((x, i) => (
        <span key={i} className="rozpis-starsieho">
          {i > 0 && ", "}
          {x.elderId !== null && <ZnackaStrachu uroven={x.spaky} trieda={p === ja ? "moje" : "superove"} />}
          {menoKarty(x.defId)} +{x.spaky}
        </span>
      ))}
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
      title={`Po bitke (${kto}): starší, ktorí sa hráča boja (${b.vitaz === null ? "pri sekere obom" : "len víťazovi"}), Exekútor, prebytok a stav popolníkov.`}
    >
      <span>starší {riadok(b.zaStarsich, plus)}</span>
      {rozpis.map((p) => (
        <span key={p} className={`nastenka-rozpis ${p === ja ? "moje" : "superove"}`}>
          <RozpisStarsich b={b} p={p} ja={ja} menoKarty={menoKarty} />
        </span>
      ))}
      {b.exekutor[0] + b.exekutor[1] > 0 && <span className="minus">Exekútor {riadok(b.exekutor, (n) => (n > 0 ? `−${n}` : "0"))}</span>}
      {b.prebytok[0] + b.prebytok[1] > 0 && <span>prebytok {riadok(b.prebytok, plus)}</span>}
      <b>stav {riadok(b.spakyPo, sMinusom)}</b>
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
}: {
  readonly b: BitkaNaNastenke;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly pred?: readonly [number, number] | undefined;
  /** S menami kariet ukáže pri špakoch za starších, ktorý starší koľko dal. */
  readonly menoKarty?: ((defId: string) => string) | undefined;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "—");
  const zaBitku = (p: PlayerId): string => {
    if (b.zaBitku[p] === 0) return "";
    if (b.vitaz !== null && b.vitaz !== p && spakyPorazeneho(b) > 0) return "svoje karty (Kultúrny dom)";
    const casti = [textZakladu(b)];
    if (b.abstakZrazka > 0) casti.push(`−${b.abstakZrazka} Absťák`);
    const herna = spakyZaHernu(b);
    if (herna > 0) casti.push(`+${herna} Dlhy (Herňa)`);
    if (b.zoSekery > 0) casti.push(`+${b.zoSekery} zo sekery`);
    return casti.join(" ");
  };
  const zaStarsich = (p: PlayerId): string => (menoKarty === undefined ? "" : textRozpisuStarsich(b, p, menoKarty));
  const riadky: {
    readonly kluc: string;
    readonly nazov: string;
    readonly h: readonly [number, number];
    readonly pozn?: (p: PlayerId) => string;
    /** Poznámka pod číslom (dlhý rozpis by bunku roztiahol). */
    readonly pod?: boolean;
  }[] = [
    { kluc: "bitka", nazov: "za bitku", h: b.zaBitku, pozn: zaBitku },
    // v8.3: starší platia na konci kola za udržané stupne — obom, nech bitku vyhral ktokoľvek.
    { kluc: "starsi", nazov: "za starších — udržaný strach (koniec kola)", h: b.zaStarsich, pozn: zaStarsich, pod: true },
    ...(b.prebytok[0] + b.prebytok[1] > 0 ? [{ kluc: "prebytok", nazov: jeFinaleNaNastenke(b) ? "prebytok (finále)" : "prebytok", h: b.prebytok }] : []),
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
            : `Sekera: ${spakov(zakladBitky(b))} za bitku čaká na víťaza ďalšej bitky.`}
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
  const sekera = b.vitaz !== null ? "" : b.prepadlo > 0 ? ` · sekera: ${spakov(b.prepadlo)} prepadlo` : ` · sekera: ${spakov(zakladBitky(b))} čaká`;
  return poradie.map((p) => `${kto(p)} ${sMinusom(pred[p])} → ${sMinusom(b.spakyPo[p])}${za(p)}`).join(" · ") + sekera;
}

/** Špaky v popolníkoch pred bitkou — zo záznamu nástenky (po bitke mínus to, čo bitka dala a vzala). */
export function spakyPredBitkou(b: BitkaNaNastenke): readonly [number, number] {
  const pred = (p: PlayerId): number => b.spakyPo[p] - b.zaBitku[p] - b.zaStarsich[p] - b.prebytok[p] + b.exekutor[p];
  return [pred(0), pred(1)];
}
