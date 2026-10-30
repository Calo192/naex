// Kšeft Predsedovej vily — čo ponúknuť a kľúč tlačidla pre výučbu. Bez Reactu a routera:
// číta ho aj Vyucba.tsx, ktorá sa testuje bez prehliadača.

import type { ClientState } from "@naex/core";

/** Cena Kšeftu vily — rovnaká ako VILA_CENA v jadre (engine.ts). */
export const CENA_VILY = 2;

export interface MoznostVily {
  readonly elderId: string;
  readonly defId: string;
}

/** Starší, ktorých smie Kšeft vily posunúť — bez tých, o ktorých sa práve hrá pokus. */
export function moznostiVily(view: Pick<ClientState, "starsi" | "pokusy">): readonly MoznostVily[] {
  return view.starsi.filter((e) => !view.pokusy.some((x) => x?.elderId === e.elderId)).map((e) => ({ elderId: e.elderId, defId: e.karta.defId }));
}

/** Kľúč tlačidla pre výučbu: krok s Kšeftom vily rozsvieti presne to, ktoré čaká (Vyucba.tsx). */
export const klucVily = (elderId: string, kSebe: boolean): string => `kseft:${elderId}:${kSebe ? 1 : 0}`;
