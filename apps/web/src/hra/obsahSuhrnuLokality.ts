// Súhrn lokality (Michal 2026-10-31: „ktorý hráč v ktorej Pitke koľko čoho získal“) — čísla
// pre okno po kliku na odohranú lokalitu, bez Reactu, aby sa dali otestovať. Zmeny zdrojov
// sa rátajú zo stavu po každej Pitke: Pitka 1 nesie aj stavbu šenku a prvé Zhromaždenie,
// ďalšie Pitky svoje Zhromaždenie, posledný riadok bitku a koniec kola (Chuť, Exekútor, Robota).

import type { LokalitaVHistorii, OdpovedVHistorii, PlayerId, ZdrojeVHistorii } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

export interface ZmenaVSuhrne {
  readonly kluc: "cigarety" | "poldeci" | "dlhy" | "cirhozy" | "chut" | "abstaky" | "naex" | "pas" | "spaky";
  readonly text: string;
  /** Pre hráča dobré (zelené), zlé (červené), alebo len fakt. */
  readonly ton: "dobre" | "zle" | "fakt";
}

export interface RiadokSuhrnu {
  readonly kluc: string;
  readonly nazov: string;
  /** Číslo Pitky; null = bitka a koniec kola. */
  readonly pitka: number | null;
  readonly zmeny: readonly [readonly ZmenaVSuhrne[], readonly ZmenaVSuhrne[]];
}

const sZnamienkom = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);
/** „+2 Dlhy“: znamienko a tvar počítaného slova podľa čísla (kľúč suhrnZmena.<slovo>). */
const sTvarom = (kluc: string, n: number): string => t(`suhrnZmena.${kluc}`, { n, z: sZnamienkom(n) });

/** Zmeny verejných zdrojov hráča medzi dvoma okamihmi (len tie, ktoré sa pohli). */
function zmenyZdrojov(pred: ZdrojeVHistorii, po: ZdrojeVHistorii, sSpakmi: boolean): ZmenaVSuhrne[] {
  const out: ZmenaVSuhrne[] = [];
  const d = (k: keyof ZdrojeVHistorii): number => po[k] - pred[k];
  if (d("cigarety") !== 0) out.push({ kluc: "cigarety", text: sTvarom("cigarety", d("cigarety")), ton: d("cigarety") > 0 ? "dobre" : "fakt" });
  if (d("poldeci") !== 0) out.push({ kluc: "poldeci", text: sTvarom("poldeci", d("poldeci")), ton: d("poldeci") > 0 ? "dobre" : "fakt" });
  if (d("dlhy") !== 0) out.push({ kluc: "dlhy", text: sTvarom("dlhy", d("dlhy")), ton: d("dlhy") > 0 ? "zle" : "dobre" });
  if (d("chut") !== 0) out.push({ kluc: "chut", text: t("suhrnZmena.chut", { pred: pred.chut, po: po.chut }), ton: d("chut") > 0 ? "zle" : "dobre" });
  if (d("abstaky") !== 0) out.push({ kluc: "abstaky", text: sTvarom("abstaky", d("abstaky")), ton: d("abstaky") > 0 ? "zle" : "dobre" });
  if (sSpakmi && d("spaky") !== 0) out.push({ kluc: "spaky", text: sTvarom("spaky", d("spaky")), ton: d("spaky") > 0 ? "dobre" : "zle" });
  return out;
}

/**
 * Riadky súhrnu: každá Pitka (pasy, NA EX, Cirhózy z rekapitulácie, zmeny zdrojov) a na konci
 * bitka s koncom kola, keď už kolo skončilo.
 */
export function riadkySuhrnuLokality(z: LokalitaVHistorii): RiadokSuhrnu[] {
  const pitky = [...z.pitky].sort((a, b) => a.pitka - b.pitka);
  const out: RiadokSuhrnu[] = [];
  let pred = z.zaciatok;
  for (const pk of pitky) {
    const pre = (p: PlayerId): ZmenaVSuhrne[] => {
      const zmeny: ZmenaVSuhrne[] = [];
      const pasy = pk.pasy.filter((x) => x.kto === p);
      for (const pas of pasy) zmeny.push({ kluc: "pas", text: pas.cigarety > 0 ? t("suhrnZmena.pasCig", { n: pas.cigarety }) : t("suhrnZmena.pas"), ton: "fakt" });
      const naex = pk.rekap.naex.karty.filter((k) => k.dal === p).length;
      if (naex > 0) zmeny.push({ kluc: "naex", text: naex === 1 ? t("suhrnZmena.naex") : t("suhrnZmena.naexKrat", { n: naex }), ton: "fakt" });
      const cirhozy = pk.rekap.pecen.cirhozy[p];
      if (cirhozy > 0) zmeny.push({ kluc: "cirhozy", text: sTvarom("cirhozy", cirhozy), ton: "zle" });
      // Pas povie, koľko cigariet dal; zmena cigariet za ním je čistý rozdiel stavu (aj s nákupmi).
      return [...zmeny, ...zmenyZdrojov(pred[p], pk.po[p], false)];
    };
    out.push({ kluc: `p${pk.pitka}`, nazov: t("suhrnZmena.pitka", { n: pk.pitka }), pitka: pk.pitka, zmeny: [pre(0), pre(1)] });
    pred = pk.po;
  }
  if (z.koniec !== null) {
    const koniec = z.koniec;
    out.push({ kluc: "bitka", nazov: t("suhrnZmena.bitkaKoniec"), pitka: null, zmeny: [zmenyZdrojov(pred[0], koniec[0], true), zmenyZdrojov(pred[1], koniec[1], true)] });
  }
  return out;
}

/** Odpovede na NA EX celého kola v poradí — blok „z Pitiek kola“ v rekapitulácii bitky ich povie slovami. */
export function odpovedeKola(z: LokalitaVHistorii): readonly OdpovedVHistorii[] {
  return [...z.pitky].sort((a, b) => a.pitka - b.pitka).flatMap((p) => p.odpovede);
}
