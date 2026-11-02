// Kšeft Predsedovej vily — čo ponúknuť a kľúč tlačidla pre výučbu. Bez Reactu a routera:
// číta ho aj Vyucba.tsx, ktorá sa testuje bez prehliadača.

import { vilaNaStarsieho, type ClientState } from "@naex/core";

export interface MoznostVily {
  readonly elderId: string;
  readonly defId: string;
}

/** Starší, pri ktorých smie Kšeft vily (v11) zdvihnúť moje reči — nie v ohrození, nie na červenej. */
export function moznostiVily(view: Pick<ClientState, "starsi" | "pokusy" | "ja">): readonly MoznostVily[] {
  return view.starsi.filter((e) => vilaNaStarsieho(view, e, view.ja)).map((e) => ({ elderId: e.elderId, defId: e.karta.defId }));
}

/** Kľúč tlačidla pre výučbu: krok s Kšeftom vily rozsvieti presne to, ktoré čaká (Vyucba.tsx). */
export const klucVily = (elderId: string, kSebe: boolean): string => `kseft:${elderId}:${kSebe ? 1 : 0}`;
