// Čísla pre bar špakov a dlaždicu Starší (Michal 2026-10-27) — bez Reactu, aby sa dali
// otestovať: odkiaľ hráč špaky má (súčet dá popolník) a ako stoja starší k hráčovi.

import type { BitkaNaNastenke, CardInstance, ClientState, ElderState, PlayerId } from "@naex/core";
import { STUPNICA_ZONY, jeFinaleNaNastenke, obavanyHrac, priazenHraca, strachZ } from "@naex/core";

export interface SpakyPodlaZdroja {
  /** Špaky za vyhraté bitky o lokality (so sekerou, ktorú víťaz zobral). */
  readonly zaLokality: number;
  /** Lokality, o ktoré hráč bitku vyhral, v poradí nástenky. */
  readonly vyhrate: readonly CardInstance[];
  /** Z toho zo sekery. */
  readonly zoSekery: number;
  readonly zaStarsich: number;
  /** Finále (v7 na pinnacle lokalite) a prebytok. */
  readonly zaFinale: number;
  readonly finale: BitkaNaNastenke | null;
  readonly prebytok: number;
  /** Zhorené pri exekúcii — záporné. */
  readonly exekutor: number;
}

/**
 * Rozpis popolníka hráča podľa zdroja. Pred koncom hry platí
 * zaLokality + zaStarsich + zaFinale + exekutor = view.spaky[p].
 */
export function spakyPodlaZdroja(view: Pick<ClientState, "nastenka">, p: PlayerId): SpakyPodlaZdroja {
  const sucet = (f: (b: BitkaNaNastenke) => number): number => view.nastenka.reduce((a, b) => a + f(b), 0);
  const lokality = view.nastenka.filter((b) => !jeFinaleNaNastenke(b));
  const finale = view.nastenka.find((b) => jeFinaleNaNastenke(b)) ?? null;
  const prebytok = sucet((b) => b.prebytok[p]);
  return {
    // Robota bez Dlhov (Náradie 2026-10-30) dáva špaky v bitke — rátajú sa k bitke.
    zaLokality: lokality.reduce((a, b) => a + b.zaBitku[p] + (b.robota?.[p] ?? 0), 0),
    vyhrate: lokality.flatMap((b) => (b.vitaz === p && b.lokalita !== null ? [b.lokalita] : [])),
    zoSekery: sucet((b) => (b.vitaz === p ? b.zoSekery : 0)),
    zaStarsich: sucet((b) => b.zaStarsich[p]),
    zaFinale: (finale?.zaBitku[p] ?? 0) + (finale?.robota?.[p] ?? 0) + prebytok,
    finale,
    prebytok,
    exekutor: -sucet((b) => b.exekutor[p]),
  };
}

export type SmerStarsieho = "hore" | "dole" | "nic";

/** Ako starší stojí k hráčovi: hore = dáva mu priazeň ♥, dole = bojí sa ho (špaky po bitke), nic = stred. */
export function smerStarsieho(e: Pick<ElderState, "marker">, p: PlayerId): SmerStarsieho {
  return priazenHraca(e) === p ? "hore" : obavanyHrac(e) === p ? "dole" : "nic";
}

export interface StupienkyStarsich {
  /** Koľko starších dáva hráčovi priazeň. */
  readonly priazen: number;
  /** Koľko starších sa hráča bojí. */
  readonly strach: number;
  /** Stĺpček na každého staršieho v poradí línie; zóna 0–3 je jeho výška. */
  readonly stlpce: readonly { readonly elderId: string; readonly smer: SmerStarsieho; readonly zona: number }[];
}

export function stupienkyStarsich(starsi: readonly Pick<ElderState, "elderId" | "marker">[], p: PlayerId): StupienkyStarsich {
  return {
    priazen: starsi.filter((e) => priazenHraca(e) === p).length,
    strach: starsi.filter((e) => strachZ(e, p) > 0).length,
    stlpce: starsi.map((e) => ({ elderId: e.elderId, smer: smerStarsieho(e, p), zona: STUPNICA_ZONY[e.marker] })),
  };
}

/**
 * Čo ukážu rady dlaždíc hráčov (Michal 2026-10-27, Leader 2026-10-27): dlaždice špakov len
 * po kliku na Špaky (nástenka otvorená hráčom), bar starších pri línii starších; nástenka,
 * ktorá sa ukázala sama pri voľbe cieľa, rady neprepína — zdroje ostanú.
 */
export function rezimRadov(s: {
  /** Hráč otvoril nástenku dlaždicou Špaky. */
  readonly nastenkaKlikom: boolean;
  /** Nástenka naozaj leží na stole (neustúpila ťahaniu ani kroku na staršom). */
  readonly nastenkaNaStole: boolean;
  /** Stôl ukazuje líniu starších po kliku na Starších. */
  readonly liniaStarsich: boolean;
}): "spaky" | "starsi" | undefined {
  if (s.nastenkaKlikom && s.nastenkaNaStole) return "spaky";
  return s.liniaStarsich ? "starsi" : undefined;
}
