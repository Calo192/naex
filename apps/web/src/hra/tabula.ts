// Čísla pultu a tabule ty | súper na šírku telefónu (PultHraca.tsx) — čisté funkcie bez DOM.

import type { ClientState, PlayerId, SpakyTeraz, StavZavislosti } from "@naex/core";
import { KONSTANTY, limitZhromazdenia } from "@naex/core";

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
