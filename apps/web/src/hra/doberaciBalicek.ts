// Doberací balíček na stole (Michal 2026-10-23): zloženie vlastného balíčka
// zoskupené podľa typu karty a v skupine podľa mena. Poradie balíčka klient
// nemá — viewFor posiela len zoradené defId s počtom (mojBalicekZlozenie).

import type { CardInstance, GameData, ZlozeniePolozka } from "@naex/core";

export interface SkupinaBalicka {
  readonly nazov: string;
  readonly pocet: number;
  readonly karty: readonly { readonly karta: CardInstance; readonly meno: string; readonly pocet: number }[];
}

// Karta s viacerými typmi patrí do prvej zhody (Cirhóza je Občan aj Kliatba
// — hráča zaujíma, že je kliatba). Poradie skupín na stole je iné, viď SKUPINY.
const PODLA_TAGU: readonly (readonly [string, string])[] = [
  ["Kliatba", "Kliatby"],
  ["Zviera", "Zvieratá"],
  ["Nástroj", "Nástroje"],
  ["Starešina", "Starešinovia"],
  ["Lokalita", "Lokality"],
  ["Občan", "Občania"],
];
const SKUPINY = ["Občania", "Zvieratá", "Starešinovia", "Nástroje", "Lokality", "Kliatby", "Ostatné"];

export function skupinyBalicka(data: GameData, zlozenie: readonly ZlozeniePolozka[]): SkupinaBalicka[] {
  const podla = new Map<string, { karta: CardInstance; meno: string; pocet: number }[]>();
  zlozenie.forEach(({ defId, pocet }, i) => {
    const def = data.cards.get(defId);
    const tagy: readonly string[] = def?.tags ?? [];
    const skupina = PODLA_TAGU.find(([tag]) => tagy.includes(tag))?.[1] ?? "Ostatné";
    // Náhradná inštancia len na kreslenie — skutočné uid kariet v balíčku klient nemá.
    const karta: CardInstance = { uid: -100000 - i, defId, leftLayout: 0, rightLayout: 0 };
    const zoznam = podla.get(skupina) ?? [];
    zoznam.push({ karta, meno: def?.name ?? defId, pocet });
    podla.set(skupina, zoznam);
  });
  return SKUPINY.flatMap((nazov) => {
    const karty = podla.get(nazov);
    if (karty === undefined) return [];
    karty.sort((a, b) => a.meno.localeCompare(b.meno, "sk"));
    return [{ nazov, pocet: karty.reduce((s, k) => s + k.pocet, 0), karty }];
  });
}
