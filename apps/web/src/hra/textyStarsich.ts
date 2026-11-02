// Texty o staršom na jednom mieste (Michal 2026-10-28: „každá informácia na JEDNOM mieste“).
// Línia starších, lupa, dlaždice v baroch aj titulok stupnice skladajú vety o priazni, strachu
// a posunoch odtiaľto — keď sa zmení, kedy a koľko starší platí za strach, mení sa len tu.

import type { Favour } from "@naex/core";
import { NAZVY_ZON, STAV_STARSIEHO } from "@naex/core";
import { UCINOK_KRATKO } from "./Scorecard.tsx";
import { type PosunMarkera } from "./staraStupnica.ts";

export const NAZOV_ZDROJA: Readonly<Record<PosunMarkera["zdroj"] | "pohorsenie" | "prebytok" | "patronat", string>> = {
  pohorsenie: "Pohoršenie",
  prebytok: "Nakladačka",
  patronat: "Patronát",
  zajatie: "Zajatie zlyhalo",
  kseft: "Predsedova vila",
  nastup: "Kapybara",
  nakladacka: "Nakladačka",
  hadka: "Hádka",
  bodovanie: "Bodovanie",
  zanik: "Reči zanikli",
};

const spakov = (n: number): string => (n === 1 ? "špak" : n < 5 ? "špaky" : "špakov");

/**
 * Riadok priazne pod staršinom: komu a akú priazeň dáva — bez priazne účinok pri +1
 * (Michal 2026-10-23). Sila je už v účinku („+2 tuhé v bitke“), druhýkrát sa nepíše (2026-10-30).
 */
export function riadokPriazne(fav: Favour, komu: string | null, sila: number): string {
  return komu === null || sila <= 0 ? `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` : `${komu}: ${UCINOK_KRATKO[fav](sila)}`;
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

/** Ako starší platí za strach (v8.3) — titulok stupnice. */
export const PRAVIDLO_STRACHU =
  "Bojí sa toho druhého. Stupeň, kam sa marker dostal, zaplatí až vtedy, keď sa na ňom marker udrží do konca nasledujúceho kola: žltá 1, oranžová 2, červená 3 (zo stredu po červenú spolu 6) — tomu, koho sa bojí, nech bitku vyhrá ktokoľvek. Každý stupeň raz; odtlačený stupeň nič a ústup k stredu zaplatené stupne zmaže. Vo finále nové stupne nič, udržané z posledného kola sa vyplatia po finále. V sivom strede nikomu.";

/** Štítok posunu na portréte — len zdroj a počet, kto posúval nesie farba. */
export function stitokStopy(zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly pocet: number }[]): string {
  return zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

/**
 * Názov kroku rozdeľovania na stole (bublina, línia starších) — na jednom mieste. Prebytok
 * poškodenia sa hráčovi volá Nakladačka (Michal 2026-10-30); v kóde ostáva „prebytok“.
 */
export const NAZOV_DELENIA = { hadka: "Hádka", reci: "Hádka", prebytok: "Nakladačka" } as const;

/** Cena posunu o pole (v8.2, Michal 2026-10-30) — Nakladačka aj hádka (v10). */
export const CENA_POLA = "pole von zo stredu stojí 1 / 2 / 3, k stredu 2 / 3 / 4";

/**
 * Ako čítať stupnicu — titulok na stupnici staršieho. Predtým legenda za tlačidlom „? stupnica“,
 * ktoré zaberalo miesto starším (Michal 2026-10-30).
 */
export const POPIS_STUPNICE =
  "Tvoja polovica stupnice je vždy vľavo, súperova vpravo. Stupne od stredu: 0 sivý stred (pokojný), 1 žltá (znepokojený), 2 oranžová (vystrašený), 3 červená (vydesený). " +
  "Priazeň má ten, na koho polovici marker leží — sila = stupeň (+1 / +2 / +3). " +
  PRAVIDLO_STRACHU +
  ` Marker posúva Nakladačka po bitke (${CENA_POLA}); hádka (v10) mení len silu priazne do konca kola.`;
