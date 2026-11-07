// Kšeft Predsedovej vily — čo ponúknuť a kľúč tlačidla pre výučbu. Bez Reactu a routera:
// číta ho aj Vyucba.tsx, ktorá sa testuje bez prehliadača.

import { dalsiStupenReci, opisReci, sMarkerom, vilaNaStarsieho, type ClientState } from "@naex/core";

export interface MoznostVily {
  readonly elderId: string;
  readonly defId: string;
  /** Moje reči na teplomere súpera pred Kšeftom a po ňom slovom („nič“, „žltá až oranžová“, v11.12). */
  readonly pred: string;
  readonly po: string;
}

/** Starší, pri ktorých smie Kšeft vily zdvihnúť moje reči — nie pri plnom teplomere súpera (v11.12). */
export function moznostiVily(view: Pick<ClientState, "starsi" | "ja">): readonly MoznostVily[] {
  return view.starsi
    .filter((e) => vilaNaStarsieho(e, view.ja))
    .map((e) => {
      const na = dalsiStupenReci(e, view.ja);
      const po = na === null ? e : sMarkerom(e, view.ja, "reci", na);
      return { elderId: e.elderId, defId: e.karta.defId, pred: opisReci(e, view.ja), po: opisReci(po, view.ja) };
    });
}

/**
 * Kľúč tlačidla pre výučbu: krok s Kšeftom vily rozsvieti presne to, ktoré čaká (Vyucba.tsx).
 * Od v11 má vila pri staršom jedno tlačidlo (reči o stupeň) s kľúčom `kseft:<elderId>:0`;
 * `kSebe` ostáva kvôli tvaru kľúča z čias posunu markera.
 */
export const klucVily = (elderId: string, kSebe = false): string => `kseft:${elderId}:${kSebe ? 1 : 0}`;
