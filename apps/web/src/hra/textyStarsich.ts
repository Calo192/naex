// Texty o staršom na jednom mieste (Michal 2026-10-28: „každá informácia na JEDNOM mieste“;
// v11 Strach a reči 2026-11-02). Línia starších (Teplomery, Pult), dlaždice v baroch, súhrny
// a nástenka skladajú vety o strachu, rečiach a ich zmenách odtiaľto.

import type { Favour, PlayerId, ZmenaMarkera } from "@naex/core";
import { KONSTANTY, NAZVY_ZON } from "@naex/core";
import { UCINOK_KRATKO } from "./Scorecard.tsx";

/** Prečo sa marker zmenil (ZmenaMarkera.zdroj) — krátko, na štítok a do logu zmien. */
export const NAZOV_ZDROJA: Readonly<Record<ZmenaMarkera["zdroj"], string>> = {
  nakladacka: "Nakladačka",
  hadka: "Hádka",
  bodovanie: "Bodovanie",
  vila: "Predsedova vila",
  nastup: "Kapybara",
  posun: "Reči sa posunuli",
};

const spakov = (n: number): string => (n === 1 ? "špak" : n > 1 && n < 5 ? "špaky" : "špakov");

/**
 * Riadok priazne: komu a akú priazeň dáva — bez priazne účinok pri +1 (Michal 2026-10-23).
 * Sila je už v účinku („+2 tuhé v bitke“), druhýkrát sa nepíše (2026-10-30).
 */
export function riadokPriazne(fav: Favour, komu: string | null, sila: number): string {
  return komu === null || sila <= 0 ? `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` : `${komu}: ${UCINOK_KRATKO[fav](sila)}`;
}

/** Názov stupňa: „žltá“; 0 = „nič“. */
export const nazovStupna = (s: number): string => (s === 0 ? "nič" : (NAZVY_ZON[s] ?? ""));

/**
 * Zmena markera slovami z pohľadu hráča `ja`: „tvoj strach žltá → oranžová“,
 * „reči Fera oranžová → zanikli“.
 */
export function textZmeny(z: Pick<ZmenaMarkera, "hrac" | "marker" | "z" | "na">, ja: PlayerId, mena: readonly [string, string]): string {
  const ty = z.hrac === ja;
  const co = z.marker === "strach" ? (ty ? "tvoj strach" : `strach (${mena[z.hrac]})`) : ty ? "tvoje reči" : `reči (${mena[z.hrac]})`;
  const na = z.na === 0 ? (z.marker === "strach" ? "nič" : "zanikli") : nazovStupna(z.na);
  return `${co} ${nazovStupna(z.z)} → ${na}`;
}

/** Krátky riadok dlaždice v bare hráča: ako starší k nemu stojí. */
export function riadokDlazdice(smer: "hore" | "dole" | "nic", ja: boolean): string {
  if (smer === "hore") return ja ? "pomáha ti" : "pomáha mu";
  if (smer === "dole") return ja ? "bojí sa ťa" : "bojí sa ho";
  return "neutrálny";
}

/** Ako sa čítajú teplomery (v11.12) — titulok v hlavičke línie a v ukážkach. */
export const PRAVIDLO_STRACHU =
  `Každý hráč má pri staršom svoj teplomer: plná časť je jeho strach, šrafa sú súperove reči. Stupeň staršieho pre hráča ` +
  `je jeho strach (znepokojený, vystrašený, vydesený). Strach dvíha víťaz bitky Nakladačkou a neklesá; reči dvíha víťaz hádky ` +
  `na teplomere súpera, od vrchu jeho strachu nadol. Stupeň stojí ${KONSTANTY.CENA_STUPNA[1]} / ${KONSTANTY.CENA_STUPNA[2]} / ${KONSTANTY.CENA_STUPNA[3]}. ` +
  `Priazeň dáva starší tomu, koho sa bojí menej — sila je rozdiel strachov, reči sa nerátajú. ` +
  `Po bitke má stupeň hodnotu ${KONSTANTY.HODNOTA_STUPNA[1]} / ${KONSTANTY.HODNOTA_STUPNA[2]} / ${KONSTANTY.HODNOTA_STUPNA[3]} a dostane ju, kto ho drží: reči obaja, strach len víťaz. ` +
  `Kto prehral hádku, tomu reči klesnú zospodu.`;

/** Rod staršieho pre slová stupňov („vydesený“ / „vydesená“). */
export type Rod = "m" | "z";

const ZENSKY_ROD: ReadonlySet<string> = new Set(["krcmarka", "postarka", "vychovavatelka"]);

/**
 * Rod karty staršieho: známi starší podľa karty, inak podľa mena (náhrada bossa) — „-ka“ je
 * ženský rod; „Starosta“ na „-a“ je mužský, preto len „-ka“.
 */
export function rodStarsieho(defId: string, meno: string): Rod {
  if (ZENSKY_ROD.has(defId)) return "z";
  return /ka$/i.test(meno.trim()) ? "z" : "m";
}

const SLOVA_STUPNOV: Readonly<Record<Rod, readonly [string, string, string, string]>> = {
  m: ["pokojný", "znepokojený", "vystrašený", "vydesený"],
  z: ["pokojná", "znepokojená", "vystrašená", "vydesená"],
};

/** Stupeň slovom v rode staršieho — nikdy farbou (Michal 2026-11-02). */
export const slovoStupna = (s: number, rod: Rod): string => SLOVA_STUPNOV[rod][s] ?? SLOVA_STUPNOV[rod][0];

/**
 * Názov kroku rozdeľovania na stole (bublina, línia starších) — na jednom mieste. Prebytok
 * poškodenia sa hráčovi volá Nakladačka (Michal 2026-10-30); v kóde ostáva „prebytok“.
 */
export const NAZOV_DELENIA = { hadka: "Hádka", reci: "Hádka", prebytok: "Nakladačka" } as const;

/** Cena stupňa (v11): do žltej 1, do oranžovej 2, do červenej 3 — Nakladačka aj hádka. */
export const CENA_POLA = `stupeň stojí ${KONSTANTY.CENA_STUPNA[1]} / ${KONSTANTY.CENA_STUPNA[2]} / ${KONSTANTY.CENA_STUPNA[3]} (žltá / oranžová / červená)`;

/** Špaky slovom („1 špak“, „3 špaky“). */
export const textSpakov = (n: number): string => `${n} ${spakov(n)}`;
