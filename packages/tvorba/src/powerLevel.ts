// Power level kariet (stránka Karty, Michal 2026-11-08): sila karty = akcie na
// oboch stranách (počet × spoločná váha typu akcie) + vlastná váha efektu karty.
// Váhy nastavuje admin; kladná akcia power level zvyšuje, záporná znižuje.

import type { KartaNavrh } from "./typy.ts";

export const ROZSAH_VAHY = { min: -10, max: 10, krok: 0.5 } as const;

/**
 * TODO Michal: predvolené váhy — odhad z PRAVIDLA.md §2 (Akcie), admin ich prestaví
 * slidermi. Záporné sú akcie, ktoré škodia hráčovi, čo ich aktivuje: Hazard dá Dlh
 * (a s ním Exekútora), Poškodenie pečene vedie k Cirhóze. Poldeci je kladné len
 * slabo, lebo v Pitke tiež poškodzuje pečeň. Akcia, ktorá tu chýba (vlastná
 * akcia tvorcu), má váhu 0.
 */
export const PREDVOLENE_VAHY_AKCII: Readonly<Record<string, number>> = {
  Rana: 1,
  Pecka: 2,
  Petelica: 3,
  Povera: 1,
  Pohoršenie: 2,
  Viera: 1.5,
  Cigareta: 1,
  Vízia: 1.5,
  Poldeci: 0.5,
  Posilnenie: 1.5,
  Odpor: 1,
  Pakt: 1,
  Robota: 1,
  Obmedzenie: 1,
  Dlh: -2,
  PoškodeniePečene: -1.5,
};

export interface VahyPowerLevelu {
  /** Kľúč akcie → váha jedného kusu. */
  readonly akcie: Readonly<Record<string, number>>;
  /** Id karty → váha jej efektu. */
  readonly efekty: Readonly<Record<string, number>>;
}

export const PREDVOLENE_VAHY: VahyPowerLevelu = { akcie: PREDVOLENE_VAHY_AKCII, efekty: {} };

export type StranaPowerLevelu = "lava" | "prava";

export interface PolozkaPowerLevelu {
  readonly strana: StranaPowerLevelu;
  readonly akcia: string;
  readonly pocet: number;
  readonly vaha: number;
  /** pocet × vaha */
  readonly body: number;
}

export interface PowerLevel {
  readonly lava: number;
  readonly prava: number;
  readonly efekt: number;
  /** lava + prava + efekt */
  readonly spolu: number;
  /** Akcie oboch strán, ako ležia v cards.json (kľúče s počtom 0 vynechané). */
  readonly polozky: readonly PolozkaPowerLevelu[];
}

export function vahaAkcie(vahy: VahyPowerLevelu, kluc: string): number {
  return vahy.akcie[kluc] ?? 0;
}

/** Karta bez textu efektu nemá čo vážiť — aj uložená váha z čias, keď efekt mala, sa ignoruje. */
export function vahaEfektu(vahy: VahyPowerLevelu, karta: Pick<KartaNavrh, "id" | "efekt">): number {
  return karta.efekt.trim() === "" ? 0 : (vahy.efekty[karta.id] ?? 0);
}

/** Súčty sa zaokrúhľujú na stotiny, aby 0,1 + 0,2 nevyzeralo v zozname ako 0,30000000000000004. */
const zaokruhli = (x: number): number => Math.round(x * 100) / 100 + 0;

export function powerLevelKarty(karta: Pick<KartaNavrh, "id" | "efekt" | "lava" | "prava">, vahy: VahyPowerLevelu): PowerLevel {
  const polozky: PolozkaPowerLevelu[] = [];
  const sucet: Record<StranaPowerLevelu, number> = { lava: 0, prava: 0 };
  for (const strana of ["lava", "prava"] as const) {
    for (const [akcia, pocet] of Object.entries(karta[strana].akcie)) {
      if (pocet <= 0) continue;
      const vaha = vahaAkcie(vahy, akcia);
      polozky.push({ strana, akcia, pocet, vaha, body: pocet * vaha });
      sucet[strana] += pocet * vaha;
    }
  }
  const efekt = vahaEfektu(vahy, karta);
  return {
    lava: zaokruhli(sucet.lava),
    prava: zaokruhli(sucet.prava),
    efekt,
    spolu: zaokruhli(sucet.lava + sucet.prava + efekt),
    polozky,
  };
}

/** Uložené váhy nad predvolenými — admin mení len to, čo chce; chýbajúci efekt má 0. */
export function zlucVahy(ulozene: VahyPowerLevelu, zaklad: VahyPowerLevelu = PREDVOLENE_VAHY): VahyPowerLevelu {
  return { akcie: { ...zaklad.akcie, ...ulozene.akcie }, efekty: { ...zaklad.efekty, ...ulozene.efekty } };
}

/** Platná váha slidera: číslo v rozsahu na celé kroky, inak null. */
export function platnaVaha(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < ROZSAH_VAHY.min || v > ROZSAH_VAHY.max) return null;
  const kroky = v / ROZSAH_VAHY.krok;
  return Math.abs(kroky - Math.round(kroky)) < 1e-9 ? Math.round(kroky) * ROZSAH_VAHY.krok + 0 : null;
}
