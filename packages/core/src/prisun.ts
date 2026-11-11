// Prísun pre dlaždice Cigarety a Poldeci (Michal 2026-11-06): čo hráč dostal bez vlastnej platby
// a odkiaľ. Čisté skladanie z účtovnej knihy motora (udalosti zmenaCigariet, zmenaPoldeci) a z náhľadu Pitky.

import type { CigaretyPitky, Event, PoldeciPitky, ZdrojCigariet, ZdrojPoldeci } from "./engine.ts";
import type { PlayerId } from "./types.ts";

/** Zdroj, ktorého stav dlaždica ukazuje. */
export type DruhPrisunu = "cigarety" | "poldeci";

export type ZdrojPrisunu = Exclude<ZdrojCigariet | ZdrojPoldeci, "platba">;

const UDALOST_DRUHU = { cigarety: "zmenaCigariet", poldeci: "zmenaPoldeci" } as const;

export const NAZVY_ZDROJOV_PRISUNU: Readonly<Record<ZdrojPrisunu, string>> = {
  akcie: "Akcie",
  obmedzenie: "Obmedzenie",
  porazeny: "Porazený",
  fajciar: "Fajčiar",
  vypalne: "Výpalné",
  sofer: "Šofér",
  podvodnik: "Podvodník",
  policajtka: "Policajtka",
  postarka: "Poštárka",
  obecnyUrad: "Obecný úrad",
  pas: "Za pas",
  pitka: "Po Pitke",
  obnova: "Po bitke",
  jogurt: "Jogurt",
  vinko: "Vínko",
  barter: "Nový poldeci",
  krcmarka: "Krčmárka",
  degustatorka: "Degustátorka",
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
export function prisunZUdalosti(events: readonly Event[], druh: DruhPrisunu = "cigarety"): readonly [PrisunHraca | null, PrisunHraca | null] {
  const pre = (p: PlayerId): PrisunHraca | null => {
    const riadky: RiadokPrisunu[] = [];
    let platba = 0;
    for (const e of events) {
      if ((e.type !== "zmenaCigariet" && e.type !== "zmenaPoldeci") || e.type !== UDALOST_DRUHU[druh] || e.hrac !== p) continue;
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
  const riadky: RiadokPrisunu[] = [{ zdroj: "akcie", suma: c.akcie }];
  if (c.obmedzenie > 0) riadky.push({ zdroj: "obmedzenie", suma: -c.obmedzenie });
  if ((c.urad ?? 0) > 0) riadky.push({ zdroj: "obecnyUrad", suma: c.urad ?? 0 });
  return riadky;
}

/** Riadky čakajúcich poldeci z náhľadu Pitky — len to, čo akcie naozaj otočia. */
export function riadkyCakajucichPoldeci(c: PoldeciPitky): readonly RiadokPrisunu[] {
  return c.casti.map(([zdroj, suma]) => ({ zdroj, suma }));
}

/** „+3“, „−1“ — pravé mínus ako na kartách a v bare. */
export function sumaPrisunu(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}
