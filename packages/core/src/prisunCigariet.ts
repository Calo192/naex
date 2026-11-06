// Prísun cigariet pre dlaždicu Cigarety (Michal 2026-11-06): čo hráč dostal bez vlastnej platby
// a odkiaľ. Čisté skladanie z účtovnej knihy motora (udalosť zmenaCigariet) a z náhľadu Pitky.

import type { CigaretyPitky, Event, ZdrojCigariet } from "./engine.ts";
import type { PlayerId } from "./types.ts";

export type ZdrojPrisunu = Exclude<ZdrojCigariet, "platba">;

export const NAZVY_ZDROJOV_PRISUNU: Readonly<Record<ZdrojPrisunu, string>> = {
  akcie: "Akcie",
  obmedzenie: "Obmedzenie",
  pas: "Za pas",
  porazeny: "Porazený",
  fajciar: "Fajčiar",
  vypalne: "Výpalné",
  sofer: "Šofér",
  podvodnik: "Podvodník",
  policajtka: "Policajtka",
  postarka: "Poštárka",
};

export interface RiadokPrisunu {
  readonly zdroj: ZdrojPrisunu;
  readonly suma: number;
}

export interface PrisunHraca {
  readonly riadky: readonly RiadokPrisunu[];
  /** Čistý rozdiel riadkov. */
  readonly suma: number;
  /** Vlastná útrata v tom istom ťahu — „3 ▸ 5“ by bez nej nesedelo. */
  readonly platba: number;
}

/** Prísun oboch hráčov z udalostí jedného ťahu; null = hráčovi nič neprišlo ani neodišlo. Platba prísun nie je. */
export function prisunZUdalosti(events: readonly Event[]): readonly [PrisunHraca | null, PrisunHraca | null] {
  const pre = (p: PlayerId): PrisunHraca | null => {
    const riadky: RiadokPrisunu[] = [];
    let platba = 0;
    for (const e of events) {
      if (e.type !== "zmenaCigariet" || e.hrac !== p) continue;
      if (e.zdroj === "platba") {
        platba -= e.suma;
        continue;
      }
      // Ten istý zdroj rovnakým smerom sa zlúči (dvaja Podvodníci v jednom ťahu); výpalné oboma smermi ostáva vedľa seba.
      const i = riadky.findIndex((r) => r.zdroj === e.zdroj && r.suma > 0 === e.suma > 0);
      if (i < 0) riadky.push({ zdroj: e.zdroj, suma: e.suma });
      else riadky[i] = { zdroj: e.zdroj, suma: (riadky[i] as RiadokPrisunu).suma + e.suma };
    }
    if (riadky.length === 0) return null;
    return { riadky, suma: riadky.reduce((a, r) => a + r.suma, 0), platba };
  };
  return [pre(0), pre(1)];
}

/** Riadky čakajúceho prísunu z náhľadu Pitky (nahladPitky). */
export function riadkyCakajuceho(c: CigaretyPitky): readonly RiadokPrisunu[] {
  if (c.akcie === 0) return [];
  const akcie: RiadokPrisunu = { zdroj: "akcie", suma: c.akcie };
  return c.obmedzenie === 0 ? [akcie] : [akcie, { zdroj: "obmedzenie", suma: -c.obmedzenie }];
}

/** „+3“, „−1“ — pravé mínus ako na kartách a v bare. */
export function sumaPrisunu(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}
