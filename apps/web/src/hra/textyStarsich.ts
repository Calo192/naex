// Texty o staršom na jednom mieste (Michal 2026-10-28: „každá informácia na JEDNOM mieste“).
// Línia starších, lupa, dlaždice v baroch aj titulok stupnice skladajú vety o priazni, strachu
// a posunoch odtiaľto — keď sa zmení, kedy a koľko starší platí za strach, mení sa len tu.

import type { ElderState, Favour, Klebety, PlayerId, PosunMarkera } from "@naex/core";
import { NAZVY_ZON, STAV_STARSIEHO, ucinnaPriazen } from "@naex/core";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";

export const NAZOV_ZDROJA: Readonly<Record<PosunMarkera["zdroj"], string>> = {
  pohorsenie: "Pohoršenie",
  prebytok: "Nakladačka",
  patronat: "Patronát",
  zajatie: "Zajatie zlyhalo",
  kseft: "Predsedova vila",
  nastup: "Kapybara",
};

const spakov = (n: number): string => (n === 1 ? "špak" : n < 5 ? "špaky" : "špakov");

/**
 * Riadok priazne pod staršinom: komu a akú priazeň dáva — bez priazne účinok pri +1
 * (Michal 2026-10-23). Sila je už v účinku („+2 tuhé v bitke“), druhýkrát sa nepíše (2026-10-30).
 */
export function riadokPriazne(fav: Favour, komu: string | null, sila: number): string {
  return komu === null || sila <= 0 ? `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` : `${komu}: ${UCINOK_KRATKO[fav](sila)}`;
}

/** Plné znenie priazne do lupy (na karte je len krátke). */
export function plnaPriazen(fav: Favour, sila: number): string {
  return sila > 0 ? UCINOK_PRIAZNE[fav](sila) : `${UCINOK_PRIAZNE[fav](1)} (pri +1)`;
}

/** Stupeň so zónou a stavom staršieho (pojmy v8.3): „stupeň 2, oranžová — vystrašený“. */
export function textStupna(zona: number): string {
  return zona === 0 ? "stred — pokojný" : `stupeň ${zona}, ${NAZVY_ZON[zona]} — ${STAV_STARSIEHO[zona]}`;
}

/**
 * Riadok strachu pod stupnicou (v8.3): koho sa bojí, koľko mu zaplatí koniec tohto kola
 * (udržané stupne, strachNaVyplatu jadra) a koľko čaká na udržanie (strachNaUdrzanie) —
 * nech bitku vyhrá ktokoľvek. `koho` = null, ak sa nebojí nikoho; `ty` = bojí sa hráča,
 * ktorý sa pozerá.
 */
export function riadokStrachu(koho: string | null, ty: boolean, spaky: number, naUdrzanie = 0): string {
  if (koho === null) return "nikoho sa nebojí";
  const komu = ty ? "teba" : koho;
  // Krátko — riadok pod stupnicou má najviac dva riadky karty (stupnica.test).
  if (spaky > 0) return `bojí sa ${komu} · +${spaky} š na konci kola${naUdrzanie > 0 ? ` +${naUdrzanie} čaká` : ""}`;
  return `bojí sa ${komu} · ${naUdrzanie > 0 ? `+${naUdrzanie} š čaká na udržanie` : "stupne zaplatené"}`;
}

/** Krátky riadok dlaždice v bare hráča: ako starší k nemu stojí (číslo nad ním povie koľko). */
export function riadokDlazdice(smer: "hore" | "dole" | "nic", ja: boolean, spaky = 1, naUdrzanie = 0): string {
  if (smer === "hore") return ja ? "pomáha ti" : "pomáha mu";
  if (smer === "dole") return spaky > 0 ? "na konci kola" : naUdrzanie > 0 ? "čaká na udržanie" : "zaplatené";
  return "neutrálny";
}

/** Čo starší zaplatí za strach (v8.3) — koniec tohto kola a čo čaká na udržanie. */
function vetaVyplaty(ja: boolean, spaky: number, naUdrzanie: number, mnozne = false): string {
  const casti = [
    spaky > 0 ? `na konci tohto kola ${ja ? "ti" : "mu"} ${mnozne ? "dajú" : "dá"} ${spaky} ${spakov(spaky)} za stupne udržané od minulého kola` : null,
    naUdrzanie > 0 ? `${naUdrzanie} ${spakov(naUdrzanie)} čaká na udržanie — zaplatí ich koniec ďalšieho kola, ak marker dovtedy neustúpi (vo finále nové stupne nič)` : null,
  ].filter((x) => x !== null);
  if (casti.length === 0) return `stupne už ${mnozne ? "zaplatili" : "zaplatil"} — ďalší špak až po novom postupe markera.`;
  return `${casti.join("; ")}. Nezáleží, kto bitku vyhrá.`;
}

/** Titulok dlaždice staršieho, ktorý sa hráča bojí (v8.3: platí udržaný stupeň). */
export function titulStrachu(meno: string, ja: boolean, zona: number, spaky: number, naUdrzanie = 0): string {
  return `${meno} sa ${ja ? "ťa" : "ho"} bojí (${textStupna(zona)}): ${vetaVyplaty(ja, spaky, naUdrzanie)}`;
}

/** Strach v titulku dlaždice Starší (súhrn za všetkých starších). */
export function titulStrachuSpolu(pocet: number, ja: boolean, spaky: number, naUdrzanie = 0): string {
  return `${pocet} sa ${ja ? "ťa" : "ho"} bojí (stĺpček dole): ${vetaVyplaty(ja, spaky, naUdrzanie, true)}`;
}

/** Ako starší platí za strach (v8.3) — titulok stupnice a lupa staršieho. */
export const PRAVIDLO_STRACHU =
  "Bojí sa toho druhého. Stupeň, kam sa marker dostal, zaplatí až vtedy, keď sa na ňom marker udrží do konca nasledujúceho kola: žltá 1, oranžová 2, červená 3 (zo stredu po červenú spolu 6) — tomu, koho sa bojí, nech bitku vyhrá ktokoľvek. Každý stupeň raz; odtlačený stupeň nič a ústup k stredu zaplatené stupne zmaže. Vo finále nové stupne nič, udržané z posledného kola sa vyplatia po finále. V sivom strede nikomu.";

/** Čo prinesie vydesenie (stupeň 3, červená) — lupa staršieho. */
export function textVydesenia(fav: Favour): string {
  return `Vydesíš ho (červená) → keď sa tam marker udrží do konca ďalšieho kola, zaplatí ti ju (+3 š), ale súper ♥ +3 (${UCINOK_KRATKO[fav](3)}). Vydesí ho súper → ty ♥ +3.`;
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
 * Náhľad posunu markera v hlavičke línie (v8.3): koľko tento starší po posune zaplatí za
 * strach na konci kola a koľko bude čakať na udržanie — nahladPosunuMarkera/Prebytkom
 * jadra (spakyZaStarsieho, naUdrzanie).
 */
export function nahladStrachu(ty: number, su: number, menoSupera: string, cakaTy = 0, cakaSu = 0): string {
  const kto = (a: number, b: number): string => (a > 0 ? `ty +${a}` : `${menoSupera} +${b}`);
  const casti = [
    ty > 0 || su > 0 ? `za strach na konci kola ${kto(ty, su)}` : null,
    cakaTy > 0 || cakaSu > 0 ? `čaká na udržanie ${kto(cakaTy, cakaSu)}` : null,
  ].filter((x) => x !== null);
  return casti.length === 0 ? "za strach nič nové" : casti.join(" · ");
}

/**
 * Názov kroku rozdeľovania na stole (bublina, línia starších) — na jednom mieste. Prebytok
 * poškodenia sa hráčovi volá Nakladačka (Michal 2026-10-30); v kóde ostáva „prebytok“.
 */
export const NAZOV_DELENIA = { pohorsenie: "Pohoršenie", prebytok: "Nakladačka" } as const;

/**
 * Náhľad Povery na staršom (v8.3 „Výpožička priazne“): priazeň v tomto kole pred a po —
 * marker sa nehýbe, strach ani udržanie sa nemenia.
 */
export function textPovery(elder: Pick<ElderState, "marker" | "elderId">, ja: PlayerId, klebety: Klebety | undefined, menoSupera: string): string {
  const kto = (u: { readonly hrac: PlayerId | null; readonly sila: number }): string => (u.hrac === null ? "nikto" : `${u.hrac === ja ? "ty" : menoSupera} +${u.sila}`);
  const pred = ucinnaPriazen(elder, klebety);
  const po = ucinnaPriazen(elder, { ...klebety, [elder.elderId]: (klebety?.[elder.elderId] ?? 0) + (ja === 0 ? 1 : -1) });
  return `Povera: priazeň v tomto kole ${kto(pred)} → ${kto(po)} (marker sa nehýbe)`;
}

/** Cena posunu markera o pole (v8.2, Michal 2026-10-30) — Pohoršenie aj prebytok. */
export const CENA_POLA = "pole von zo stredu stojí 1 / 2 / 3, k stredu 2 / 3 / 4";

/**
 * Ako čítať stupnicu — titulok na stupnici staršieho. Predtým legenda za tlačidlom „? stupnica“,
 * ktoré zaberalo miesto starším (Michal 2026-10-30).
 */
export const POPIS_STUPNICE =
  "Tvoja polovica stupnice je vždy vľavo, súperova vpravo. Stupne od stredu: 0 sivý stred (pokojný), 1 žltá (znepokojený), 2 oranžová (vystrašený), 3 červená (vydesený). " +
  "♥ Priazeň má ten, na koho polovici marker leží — sila = stupeň (+1 / +2 / +3). " +
  PRAVIDLO_STRACHU +
  ` Posúva ho Nakladačka po bitke a Pohoršenie — od seba (desíš) alebo k sebe (upokojuješ); ${CENA_POLA}.`;
