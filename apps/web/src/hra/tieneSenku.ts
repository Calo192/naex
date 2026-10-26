// Rad šenku s tieňmi (#111, Michal 2026-10-26): karta, ktorú vzal súper, nechá na svojom
// mieste tieň do konca draftu. Miesta počíta jadro (miestoVSenku) — tu sa len zoradia.

import type { CardInstance, PlayerId, ZobrataVerejne } from "@naex/core";
import { miestoVSenku } from "@naex/core";

export type PolozkaSenku = { readonly typ: "karta"; readonly karta: CardInstance } | { readonly typ: "tien"; readonly zobrata: ZobrataVerejne };

/**
 * Karty `karty` (podmnožina šenku, napr. bez tých, ktoré hráč práve navrhol vziať)
 * a tiene kariet, ktoré vzal `kto`, v poradí miest. Vlastné vzaté karty tieň nenechajú.
 */
export function radSenku(
  senok: readonly CardInstance[],
  karty: readonly CardInstance[],
  zobrate: readonly ZobrataVerejne[],
  kto: PlayerId,
): PolozkaSenku[] {
  const miesta = new Map(senok.map((k, i) => [k.uid, miestoVSenku(i, zobrate)]));
  return [
    ...karty.map((k) => ({ miesto: miesta.get(k.uid) ?? 0, p: { typ: "karta", karta: k } as const })),
    ...zobrate.filter((z) => z.hrac === kto).map((z) => ({ miesto: z.miesto, p: { typ: "tien", zobrata: z } as const })),
  ]
    .sort((a, b) => a.miesto - b.miesto)
    .map((x) => x.p);
}
