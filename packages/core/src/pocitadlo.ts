// Počítadlo bitky (Michal 2026-10-23, roadmapa, nápad 6 z napady-20261023-1447):
// výsledok bitky nerastie naraz, ale po vlnách od lokality von — každá karta
// prispeje svojimi Ranami, Peckami a Petelicami (aj zdvojenými NA EX), potom
// bonusy (Bitkár, Cirhóza, karty) a nakoniec zrážky (Viera súpera ako štít).
// Ten istý výpočet ako vyhodnotenie (zdroje línie a rozpisPoskodenia); čo klient
// nevidí (súperove Absťáky v ruke), dorovná posledný krok „spolu“ na výsledok
// zo servera — počítadlo vždy skončí na čísle z Účtu bitky. Počíta sa z verejnej
// línie, takže ho môžu dostať obaja.

import type { Action } from "./types.ts";
import { rozpisPoskodenia } from "./engine.ts";
import type { GameData } from "./data.ts";
import type { StolBitky } from "./hrozba.ts";
import type { LineEval } from "./partia.ts";
import type { PlayerId } from "./types.ts";

/** Tuhé poškodenie za jednu aktívnu akciu (PRAVIDLA §9.3). */
const SILA: Readonly<Partial<Record<Action, number>>> = { Rana: 1, Pecka: 2, Petelica: 3 };

export interface KrokPocitadla {
  /** Vlna: 0 = lokalita (stred), n = n-tá karta od lokality na oboch stranách, potom bonusy, zrážky, spolu. */
  readonly vlna: number;
  /** Komu krok pridáva (alebo uberá) tuhé. */
  readonly kto: PlayerId;
  readonly druh: "karta" | "bonus" | "zrazka" | "spolu";
  /** Karta v línii (druh karta). */
  readonly uid: number | null;
  /** Zdroj bonusu či zrážky (id karty, „cirhoza“, „BITKAR“, „Viera“, „abstak“…). */
  readonly zdroj: string | null;
  /** O koľko sa tuhé zmení (zrážka záporne). */
  readonly zmena: number;
  /** Najvyšší násobok akcie na karte (2 = NA EX či Posilnenie) — počítadlo sa pri ňom roztrasie. */
  readonly nasobok: number;
  /** Zrážka, ktorá už nemala čo ubrať — tuhé bolo na 0 (vyhodnotenie nejde pod 0). */
  readonly naNule?: boolean;
}

export interface PocitadloBitky {
  readonly kroky: readonly KrokPocitadla[];
  /** Počet vĺn (posledná je „spolu“, ak treba dorovnať). */
  readonly vln: number;
  /** Výsledok, na ktorom počítadlo skončí — tuhé z vyhodnotenia. */
  readonly tuhe: readonly [number, number];
  /** Vlna bonusov a vlna zrážok (Viera súpera) — rekapitulácia pod počítadlom podľa nich ruší Vieru s Poverou. */
  readonly vlnaBonusov: number;
  readonly vlnaZrazok: number;
}

/** Vlna karty v línii: 0 = lokalita (stred), n = n-tá karta od lokality na oboch stranách. */
export function vlnyKariet(stol: StolBitky): ReadonlyMap<number, number> {
  const vlnaKarty = new Map<number, number>();
  if (stol.ciel?.lokalita != null) vlnaKarty.set(stol.ciel.lokalita.uid, 0);
  for (const strana of stol.strany) strana.forEach((pl, i) => vlnaKarty.set(pl.card.uid, i + 1));
  return vlnaKarty;
}

/**
 * Kroky počítadla pre stôl v okamihu bitky. `tuhe` je výsledok zo servera
 * (bitkaVysledok) — rozdiel oproti súčtu krokov (skryté Absťáky, dno 0) dorovná
 * krok „spolu“.
 */
export function pocitadloBitky(data: GameData, stol: StolBitky, linia: LineEval, tuhe: readonly [number, number]): PocitadloBitky {
  const vlnaKarty = vlnyKariet(stol);
  const kartyVln = Math.max(0, ...vlnaKarty.values());

  const kroky: KrokPocitadla[] = [];
  for (const kto of [0, 1] as const) {
    // Príspevok každej karty k tuhému hráča: sila akcie × hodnota (2 = zdvojená).
    const zKariet = new Map<number, { zmena: number; nasobok: number }>();
    for (const [akcia, sila] of Object.entries(SILA) as [Action, number][]) {
      for (const z of linia.zdroje[kto][akcia] ?? []) {
        const x = zKariet.get(z.uid) ?? { zmena: 0, nasobok: 1 };
        zKariet.set(z.uid, { zmena: x.zmena + sila * z.hodnota, nasobok: Math.max(x.nasobok, z.hodnota) });
      }
    }
    for (const [uid, x] of zKariet) {
      if (x.zmena !== 0) kroky.push({ vlna: vlnaKarty.get(uid) ?? 0, kto, druh: "karta", uid, zdroj: null, zmena: x.zmena, nasobok: x.nasobok });
    }
  }
  // Súperove Absťáky v ruke klient nepozná — rozdiel dorovná „spolu“.
  const rozpis = rozpisPoskodenia(data, stol, linia.sums, [0, 0]);
  for (const kto of [0, 1] as const) {
    for (const b of rozpis[kto].bonusy) kroky.push({ vlna: kartyVln + 1, kto, druh: "bonus", uid: null, zdroj: b.zdroj, zmena: b.hodnota, nasobok: 1 });
    // Vyhodnotenie zrazí tuhé najviac na 0 — zrážka uberie len to, čo ešte zostalo
    // (UI inšpekcia: „Viera −2“ pri 0 a potom záhadné „ostatné +2“).
    let zostava = kroky.filter((k) => k.kto === kto).reduce((s, k) => s + k.zmena, 0);
    for (const z of rozpis[kto].zrazky) {
      const ubere = Math.min(z.hodnota, Math.max(0, zostava));
      zostava -= ubere;
      kroky.push({ vlna: kartyVln + 2, kto, druh: "zrazka", uid: null, zdroj: z.zdroj, zmena: -ubere, nasobok: 1, ...(ubere === 0 ? { naNule: true } : {}) });
    }
  }
  let vln = kartyVln + 3;
  for (const kto of [0, 1] as const) {
    const sucet = kroky.filter((k) => k.kto === kto).reduce((s, k) => s + k.zmena, 0);
    if (sucet !== tuhe[kto]) {
      kroky.push({ vlna: kartyVln + 3, kto, druh: "spolu", uid: null, zdroj: null, zmena: tuhe[kto] - sucet, nasobok: 1 });
      vln = kartyVln + 4;
    }
  }
  kroky.sort((a, b) => a.vlna - b.vlna || a.kto - b.kto);
  return { kroky, vln, tuhe, vlnaBonusov: kartyVln + 1, vlnaZrazok: kartyVln + 2 };
}

/** Stav počítadla po vlne `vlna` (vrátane): tuhé oboch, nikdy pod 0 (ako vo vyhodnotení). */
export function stavPocitadla(p: PocitadloBitky, vlna: number): readonly [number, number] {
  const s: [number, number] = [0, 0];
  for (const k of p.kroky) if (k.vlna <= vlna) s[k.kto] += k.zmena;
  return [Math.max(0, s[0]), Math.max(0, s[1])];
}
