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
 * Riadok strachu pod stupnicou: koho sa bojí a koľko mu zaplatí pri ďalšej výhre — v8 len
 * zóny, ktoré mu ešte nezaplatil (strachNaVyplatu jadra). `koho` = null, ak sa nebojí nikoho;
 * `ty` = bojí sa hráča, ktorý sa pozerá; `spaky` = 0 pri zaplatených zónach.
 */
export function riadokStrachu(koho: string | null, ty: boolean, spaky: number): string {
  if (koho === null) return "nikoho sa nebojí";
  const komu = ty ? "teba" : koho;
  return spaky > 0 ? `bojí sa ${komu} · +${spaky} š za ďalšiu výhru` : `bojí sa ${komu} · zóny zaplatené`;
}

/** Krátky riadok dlaždice v bare hráča: ako starší k nemu stojí (číslo nad ním povie koľko). */
export function riadokDlazdice(smer: "hore" | "dole" | "nic", ja: boolean, spaky = 1): string {
  if (smer === "hore") return ja ? "pomáha ti" : "pomáha mu";
  if (smer === "dole") return spaky > 0 ? (ja ? "ak vyhráš" : "ak vyhrá") : "zaplatené";
  return "neutrálny";
}

/** Titulok dlaždice staršieho, ktorý sa hráča bojí (v8: platí len nové zóny). */
export function titulStrachu(meno: string, ja: boolean, zona: number, spaky: number): string {
  return (
    `${meno} sa ${ja ? "ťa" : "ho"} bojí (${NAZVY_ZON[zona]}): ` +
    (spaky > 0
      ? `po najbližšej bitke, ktorú ${ja ? "vyhráš" : "vyhrá"}, ${ja ? "ti" : "mu"} dá ${spaky} ${spakov(spaky)} za zóny, ktoré ešte nezaplatil.`
      : "zóny už zaplatil — ďalší špak až po novom postupe markera.")
  );
}

/** Strach v titulku dlaždice Starší (súhrn za všetkých starších). */
export function titulStrachuSpolu(pocet: number, ja: boolean, spaky: number): string {
  return `${pocet} sa ${ja ? "ťa" : "ho"} bojí (stĺpček dole): po najbližšej výhre +${spaky} ${spakov(spaky)} za zóny, ktoré ešte nezaplatili (porazený od starších nič, pri sekere obaja).`;
}

/** Ako starší platí za strach (v8) — legenda stupnice a lupa staršieho. */
export const PRAVIDLO_STRACHU =
  "Bojí sa toho druhého — po bitke, ktorú ten vyhrá (aj finále), mu zaplatí každú zónu raz: žltá 1, oranžová 2, červená 3 (zo stredu po červenú spolu 6). Zaparkovaný marker po výplate nedá nič; ústup k stredu zaplatené zóny zmaže. Porazenému nedá nič, pri sekere obom. V sivom strede nikomu.";

/** Príklad do legendy stupnice: jeden starší mimo stredu z tejto partie. */
export function prikladStrachu(o: {
  readonly meno: string;
  readonly zona: number;
  readonly ty: boolean;
  readonly super: string;
  readonly sila: number;
  readonly ucinok: string;
  /** Nezaplatené zóny (strachNaVyplatu) — koľko dá pri najbližšej výhre. */
  readonly spaky: number;
}): string {
  const { meno, zona, ty, super: su, sila, ucinok, spaky } = o;
  return (
    `${meno} je v zóne ${NAZVY_ZON[zona]} na ${ty ? `strane ${su}` : "tvojej strane"}. ${ty ? `Priazeň +${sila} má ${su}` : `Priazeň +${sila} máš ty`} (${ucinok}). ` +
    `Bojí sa ${ty ? "teba" : su}: za každú zónu raz — po najbližšej bitke, ktorú ${ty ? "vyhráš" : "vyhrá"}, ${ty ? "dostaneš" : `${su} dostane`} ${spaky} ${spakov(spaky)} za zóny, ktoré ešte nezaplatil.`
  );
}

/** Čo prinesie vydesenie (krajná červená) — lupa staršieho. */
export function textVydesenia(fav: Favour): string {
  return `Vydesíš ho → pri ďalšej výhre ti zaplatí aj červenú zónu (+3 š), ale súper ♥ +3 (${UCINOK_KRATKO[fav](3)}). Vydesí ho súper → ty ♥ +3.`;
}

/** Zdroje posunov od poslednej bitky: „Prebytok · Michal ×3“. */
export function textStopy(zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly kto: PlayerId; readonly pocet: number }[], kto: (p: PlayerId) => string): string {
  return zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]} · ${kto(x.kto)}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

/** Štítok posunu na portréte — len zdroj a počet, kto posúval nesie farba (celé znenie je v lupe). */
export function stitokStopy(zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly pocet: number }[]): string {
  return zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

/**
 * Náhľad posunu markera v hlavičke línie (v8): koľko tento starší zaplatí za strach pri
 * najbližšej výhre po posune — nahladPosunuMarkera/Prebytkom jadra (spakyZaStarsieho).
 */
export function nahladStrachu(ty: number, su: number, menoSupera: string): string {
  if (ty === 0 && su === 0) return "za strach nič nové";
  return `za strach pri ďalšej výhre ${ty > 0 ? `ty +${ty}` : `${menoSupera} +${su}`}`;
}

/** Pokyn v hlavičke línie počas Prebytku: koľko posunov ešte zostáva. */
export function pokynPrebytku(zostava: number, cena: number): string {
  const n = cena > 0 ? Math.floor(zostava / cena) : 0;
  const cenaText = cena > 1 ? `, posun stojí ${cena} (Miňištrant)` : "";
  return `Prebytok ${zostava}${cenaText} — vystačí na ${n} ${posunov(n)}. Prejdi myšou na staršieho: riadky pod stupnicou ukážu stav po posune.`;
}
