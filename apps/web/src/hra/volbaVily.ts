// Kšeft Predsedovej vily — čo ponúknuť a kľúč tlačidla pre výučbu. Bez Reactu a routera:
// číta ho aj Vyucba.tsx, ktorá sa testuje bez prehliadača.

import { dalsiStupenReci, najvyssiMarker, vilaNaStarsieho, type ClientState, type Stupen } from "@naex/core";

export interface MoznostVily {
  readonly elderId: string;
  readonly defId: string;
  /** Reči pôjdu zo stupňa `z` (najvyšší marker — reči, inak strach) na `na` (v11). */
  readonly z: Stupen;
  readonly na: Stupen;
}

/** Starší, pri ktorých smie Kšeft vily (v11) zdvihnúť moje reči — nie na červenej. */
export function moznostiVily(view: Pick<ClientState, "starsi" | "ja">): readonly MoznostVily[] {
  return view.starsi
    .filter((e) => vilaNaStarsieho(e, view.ja))
    .map((e) => {
      const z = najvyssiMarker(e, view.ja);
      return { elderId: e.elderId, defId: e.karta.defId, z, na: dalsiStupenReci(e, view.ja) ?? z };
    });
}

/**
 * Kľúč tlačidla pre výučbu: krok s Kšeftom vily rozsvieti presne to, ktoré čaká (Vyucba.tsx).
 * Od v11 má vila pri staršom jedno tlačidlo (reči o stupeň) s kľúčom `kseft:<elderId>:0`;
 * `kSebe` ostáva kvôli tvaru kľúča z čias posunu markera.
 */
export const klucVily = (elderId: string, kSebe = false): string => `kseft:${elderId}:${kSebe ? 1 : 0}`;
