// Súhrn hráča pre profil (Michal 2026-10-22): metriky z posledných partií,
// porovnanie so súpermi v tých istých partiách a s hráčmi, silné a slabé
// stránky a trend. Čísla sa ukazujú od 1. partie s počtom, stránky od 5 partií,
// trend od 10, priemer hráčov až od 10 ľudí s 5+ partiami (bez AI a botov).
// Čistý výpočet nad riadkami z archívu — DB číta Profily.

import type { StatistikyHraca } from "@naex/core";
import type { Vysledok } from "./frajerina.ts";

/** Jedna partia z pohľadu hráča: jeho štatistiky a súperove v tej istej partii. */
export interface PartiaSuhrnu {
  readonly vysledok: Vysledok;
  readonly body: number | null;
  readonly superBody: number | null;
  readonly ja: StatistikyHraca;
  readonly super: StatistikyHraca;
}

type Jednotka = "b" | "%" | "x";

interface DefMetriky {
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly jednotka: Jednotka;
  readonly lepsie: "viac" | "menej";
  /** Hodnota v jednej partii; null = v partii sa nedá určiť (napr. bez bitky či bez bodovania). */
  readonly z: (ja: StatistikyHraca, vysledok: Vysledok, body: number | null, superBody: number | null) => number | null;
}

const podiel = (a: number, b: number): number | null => (b > 0 ? (100 * a) / b : null);
const naBitku = (a: number, s: StatistikyHraca): number | null => (s.bitky > 0 ? a / s.bitky : null);

export const METRIKY: readonly DefMetriky[] = [
  { kluc: "vyhry", nazov: "Výhry", popis: "Podiel vyhratých partií (remíza za pol).", jednotka: "%", lepsie: "viac", z: (_s, v) => (v === "vyhra" ? 100 : v === "remiza" ? 50 : 0) },
  { kluc: "body", nazov: "Body na partiu", popis: "Body zo záverečného bodovania (len partie dohraté do konca).", jednotka: "b", lepsie: "viac", z: (_s, _v, b) => b },
  { kluc: "rozdielBodov", nazov: "Rozdiel bodov", popis: "O koľko bodov si mal viac (alebo menej) ako súper na konci partie.", jednotka: "b", lepsie: "viac", z: (_s, _v, b, sb) => (b === null || sb === null ? null : b - sb) },
  { kluc: "bitkyVyhrane", nazov: "Vyhraté bitky", popis: "Podiel bitiek o lokalitu, ktoré si vyhral.", jednotka: "%", lepsie: "viac", z: (s) => podiel(s.bitkyVyhrane, s.bitky) },
  { kluc: "tuheNaBitku", nazov: "Tuhé na bitku", popis: "Koľko tuhého poškodenia si udelil priemerne v jednej bitke.", jednotka: "x", lepsie: "viac", z: (s) => naBitku(s.tuheUdelene, s) },
  { kluc: "obdrzaneNaBitku", nazov: "Obdržané na bitku", popis: "Koľko poškodenia ti súper udelil priemerne v jednej bitke.", jednotka: "x", lepsie: "menej", z: (s) => naBitku(s.poskodenieObdrzane, s) },
  { kluc: "naexUspech", nazov: "Úspešné NA EX", popis: "NA EX, ktoré po súperovej odpovedi zlepšilo bitku v tvoj prospech.", jednotka: "%", lepsie: "viac", z: (s) => podiel(s.naexUspesne, s.naexHodnotene) },
  { kluc: "naex", nazov: "NA EX na partiu", popis: "Koľkokrát v partii si dal NA EX.", jednotka: "x", lepsie: "viac", z: (s) => s.naex },
  { kluc: "senokKarty", nazov: "Karty zo šenku", popis: "Koľko kariet si za partiu vzal zo šenku.", jednotka: "x", lepsie: "viac", z: (s) => (s.partieV2 > 0 ? s.senokKarty : null) },
  { kluc: "dlhyNaKonci", nazov: "Dlhy na konci", popis: "Koľko Dlhov si mal na konci partie (každý uberá body).", jednotka: "x", lepsie: "menej", z: (s) => (s.partieV2 > 0 ? s.dlhyNaKonci : null) },
  { kluc: "lokality", nazov: "Ovládnuté lokality", popis: "Koľko lokalít si v partii ovládol.", jednotka: "x", lepsie: "viac", z: (s) => s.lokalityOvladnute },
  { kluc: "vydeseni", nazov: "Vydesení starší", popis: "Koľko starších sa ťa na konci partie bálo naplno.", jednotka: "x", lepsie: "viac", z: (s) => s.starsiVydeseni },
];

/** Rozdiel, ktorý je už prakticky veľký (UX návrh: body 2, percentá 10 p. b.). */
const PRAH: Readonly<Record<Jednotka, number>> = { b: 2, "%": 10, x: 0.5 };
export const OD_STRANOK = 5;
export const OD_TRENDU = 10;
export const HRACOV_NA_PRIEMER = 10;
export const PARTII_NA_PRIEMER = 5;

export interface Metrika {
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly jednotka: Jednotka;
  readonly lepsie: "viac" | "menej";
  readonly hodnota: number | null;
  /** Z koľkých partií hodnota je. */
  readonly partii: number;
  readonly porovnanie: { readonly superi: number | null; readonly hraci: number | null };
  /** Novšia polovica okna mínus staršia — od OD_TRENDU partií. */
  readonly trend: number | null;
}

export interface Stranka {
  readonly kluc: string;
  readonly text: string;
  readonly dokaz: string;
}

export interface Suhrn {
  readonly partii: number;
  readonly metriky: readonly Metrika[];
  readonly silne: readonly Stranka[];
  readonly slabe: readonly Stranka[];
}

const priemer = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
const zaokruhli = (x: number | null): number | null => (x === null ? null : Math.round(x * 10) / 10);
const otoc: Record<Vysledok, Vysledok> = { vyhra: "prehra", prehra: "vyhra", remiza: "remiza" };

const hodnotyHraca = (m: DefMetriky, partie: readonly PartiaSuhrnu[]): (number | null)[] => partie.map((p) => m.z(p.ja, p.vysledok, p.body, p.superBody));
const hodnotySupera = (m: DefMetriky, partie: readonly PartiaSuhrnu[]): (number | null)[] => partie.map((p) => m.z(p.super, otoc[p.vysledok], p.superBody, p.body));
const bezNull = (xs: readonly (number | null)[]): number[] => xs.filter((x): x is number => x !== null);

/** Priemer metriky jedného hráča — pre porovnanie s hráčmi. */
export function priemeryHraca(partie: readonly PartiaSuhrnu[]): Readonly<Record<string, number | null>> {
  return Object.fromEntries(METRIKY.map((m) => [m.kluc, priemer(bezNull(hodnotyHraca(m, partie)))]));
}

/**
 * Súhrn z partií hráča (najnovšia prvá). `populacia` = priemery ostatných hráčov
 * s aspoň PARTII_NA_PRIEMER partiami; priemer hráčov sa ukáže až pri HRACOV_NA_PRIEMER.
 * `sStrankami` = vlastník a správca (cudzí silné a slabé stránky nevidí).
 */
export function spocitajSuhrn(partie: readonly PartiaSuhrnu[], populacia: readonly Readonly<Record<string, number | null>>[], sStrankami: boolean): Suhrn {
  const silne: { s: Stranka; sila: number }[] = [];
  const slabe: { s: Stranka; sila: number }[] = [];
  const metriky = METRIKY.map((m): Metrika => {
    const moje = hodnotyHraca(m, partie);
    const ich = hodnotySupera(m, partie);
    const platne = bezNull(moje);
    const hraci = populacia.length >= HRACOV_NA_PRIEMER ? priemer(bezNull(populacia.map((p) => p[m.kluc] ?? null))) : null;
    // Trend: partie sú od najnovšej, novšia polovica je na začiatku.
    let trend: number | null = null;
    if (platne.length >= OD_TRENDU) {
      const pol = Math.floor(platne.length / 2);
      trend = (priemer(platne.slice(0, pol)) ?? 0) - (priemer(platne.slice(pol)) ?? 0);
    }
    // Silné a slabé stránky: rozdiel oproti súperovi v tej istej partii.
    if (sStrankami) {
      const smer = m.lepsie === "viac" ? 1 : -1;
      const rozdiely: number[] = [];
      moje.forEach((x, i) => {
        const y = ich[i];
        if (x !== null && y !== null && y !== undefined) rozdiely.push(smer * (x - y));
      });
      if (rozdiely.length >= OD_STRANOK) {
        const n = rozdiely.length;
        const str = priemer(rozdiely) ?? 0;
        const sd = Math.sqrt(rozdiely.reduce((a, d) => a + (d - str) ** 2, 0) / Math.max(1, n - 1));
        const se = sd / Math.sqrt(n);
        const rovnako = rozdiely.filter((d) => Math.sign(d) === Math.sign(str) && d !== 0).length;
        if (Math.abs(str) >= PRAH[m.jednotka] && Math.abs(str) >= 2 * se && rovnako / n >= 0.7) {
          const ja = zaokruhli(priemer(platne));
          const su = zaokruhli(priemer(bezNull(ich)));
          const s: Stranka = {
            kluc: m.kluc,
            text: `${m.nazov}: ${ja}${m.jednotka === "%" ? " %" : m.jednotka === "b" ? " b" : ""} oproti ${su} u súperov`,
            dokaz: `${str > 0 ? "lepšie" : "horšie"} v ${rovnako} z ${n} partií`,
          };
          (str > 0 ? silne : slabe).push({ s, sila: Math.abs(str) / PRAH[m.jednotka] });
        }
      }
    }
    return {
      kluc: m.kluc,
      nazov: m.nazov,
      popis: m.popis,
      jednotka: m.jednotka,
      lepsie: m.lepsie,
      hodnota: zaokruhli(priemer(platne)),
      partii: platne.length,
      porovnanie: { superi: zaokruhli(priemer(bezNull(ich))), hraci: zaokruhli(hraci) },
      trend: zaokruhli(trend),
    };
  });
  const top = (xs: { s: Stranka; sila: number }[]): Stranka[] => xs.sort((a, b) => b.sila - a.sila).slice(0, 2).map((x) => x.s);
  return { partii: partie.length, metriky, silne: top(silne), slabe: top(slabe) };
}
