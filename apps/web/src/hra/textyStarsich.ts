// Texty o staršom na jednom mieste (Michal 2026-10-28: „každá informácia na JEDNOM mieste“).
// Línia starších, lupa, dlaždice v baroch aj legenda skladajú vety o priazni, strachu
// a posunoch odtiaľto — keď sa zmení, kedy a koľko starší platí za strach, mení sa len tu.

import type { Favour, PlayerId, PosunMarkera } from "@naex/core";
import { NAZVY_ZON } from "@naex/core";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";

export const NAZOV_ZDROJA: Readonly<Record<PosunMarkera["zdroj"], string>> = {
  pohorsenie: "Pohoršenie",
  prebytok: "Prebytok",
  patronat: "Patronát",
  kseft: "Predsedova vila",
  nastup: "Kapybara",
};

const spakov = (n: number): string => (n === 1 ? "špak" : n < 5 ? "špaky" : "špakov");
const posunov = (n: number): string => (n === 1 ? "posun" : n < 5 ? "posuny" : "posunov");

/** Riadok priazne pod stupnicou: komu a krátky účinok — bez priazne účinok pri +1 (Michal 2026-10-23). */
export function riadokPriazne(fav: Favour, komu: string | null, sila: number): string {
  return komu === null || sila <= 0 ? `nikto · pri +1: ${UCINOK_KRATKO[fav](1)}` : `${komu} +${sila} · ${UCINOK_KRATKO[fav](sila)}`;
}

/** Plné znenie priazne do lupy (na karte je len krátke). */
export function plnaPriazen(fav: Favour, sila: number): string {
  return sila > 0 ? UCINOK_PRIAZNE[fav](sila) : `${UCINOK_PRIAZNE[fav](1)} (pri +1)`;
}

/**
 * Riadok strachu pod stupnicou: koho sa bojí a koľko špakov mu dá po vyhratej bitke (v6.1).
 * `koho` = null, ak sa nebojí nikoho; `ty` = bojí sa hráča, ktorý sa pozerá.
 */
export function riadokStrachu(koho: string | null, ty: boolean, spaky: number): string {
  if (koho === null) return "nikoho sa nebojí";
  const komu = ty ? "teba" : koho;
  return spaky > 0 ? `bojí sa ${komu} · +${spaky} š, keď ${ty ? "vyhráš" : "vyhrá"}` : `bojí sa ${komu}`;
}

/** Krátky riadok dlaždice v bare hráča: ako starší k nemu stojí (číslo nad ním povie koľko). */
export function riadokDlazdice(smer: "hore" | "dole" | "nic", ja: boolean): string {
  return smer === "hore" ? (ja ? "pomáha ti" : "pomáha mu") : smer === "dole" ? (ja ? "ak vyhráš" : "ak vyhrá") : "neutrálny";
}

/** Titulok dlaždice staršieho, ktorý sa hráča bojí. */
export function titulStrachu(meno: string, ja: boolean, zona: number, spaky: number): string {
  return `${meno} sa ${ja ? "ťa" : "ho"} bojí (${NAZVY_ZON[zona]}): po každej bitke, ktorú ${ja ? "vyhráš" : "vyhrá"}, ${ja ? "ti" : "mu"} dá ${spaky} ${spakov(spaky)}.`;
}

/** Strach v titulku dlaždice Starší (súhrn za všetkých starších). */
export function titulStrachuSpolu(pocet: number, ja: boolean, spaky: number): string {
  return `${pocet} sa ${ja ? "ťa" : "ho"} bojí (stĺpček dole): po bitke +${spaky} ${spakov(spaky)}, ak ju ${ja ? "vyhráš" : "vyhrá"} (porazený od starších nič, pri sekere obaja).`;
}

/** Ako starší platí za strach — legenda stupnice a lupa staršieho. */
export const PRAVIDLO_STRACHU =
  "Bojí sa toho druhého — a po bitke, ktorú ten vyhrá (aj finále), mu dá špaky: žltá 1, oranžová 2, červená 3. Porazenému nedá nič, pri sekere dajú starší obom. V sivom strede nedá nikomu nič.";

/** Príklad do legendy stupnice: jeden starší mimo stredu z tejto partie. */
export function prikladStrachu(o: {
  readonly meno: string;
  readonly zona: number;
  readonly ty: boolean;
  readonly super: string;
  readonly sila: number;
  readonly ucinok: string;
}): string {
  const { meno, zona, ty, super: su, sila, ucinok } = o;
  return (
    `${meno} je v zóne ${NAZVY_ZON[zona]} na ${ty ? `strane ${su}` : "tvojej strane"}. ${ty ? `Priazeň +${sila} má ${su}` : `Priazeň +${sila} máš ty`} (${ucinok}). ` +
    `Bojí sa ${ty ? "teba" : su}: po každej bitke, ktorú ${ty ? "vyhráš" : "vyhrá"}, ${ty ? "dostaneš" : `${su} dostane`} ${zona} ${spakov(zona)}.`
  );
}

/** Čo prinesie vydesenie (krajná červená) — lupa staršieho. */
export function textVydesenia(fav: Favour): string {
  return `Vydesíš ho → 3 š po každej tvojej výhre, ale súper ♥ +3 (${UCINOK_KRATKO[fav](3)}). Vydesí ho súper → ty ♥ +3.`;
}

/** Zdroje posunov od poslednej bitky: „Prebytok · Michal ×3“. */
export function textStopy(zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly kto: PlayerId; readonly pocet: number }[], kto: (p: PlayerId) => string): string {
  return zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]} · ${kto(x.kto)}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

/** Štítok posunu na portréte — len zdroj a počet, kto posúval nesie farba (celé znenie je v lupe). */
export function stitokStopy(zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly pocet: number }[]): string {
  return zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

/** Pokyn v hlavičke línie počas Prebytku: koľko posunov ešte zostáva. */
export function pokynPrebytku(zostava: number, cena: number): string {
  const n = cena > 0 ? Math.floor(zostava / cena) : 0;
  const cenaText = cena > 1 ? `, posun stojí ${cena} (Miňištrant)` : "";
  return `Prebytok ${zostava}${cenaText} — vystačí na ${n} ${posunov(n)}. Prejdi myšou na staršieho: riadky pod stupnicou ukážu stav po posune.`;
}
