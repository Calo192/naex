// Predsedova vila (Pitka, frakcie 2026-11-08): za každé 2 cigarety vyfajčené v Pitke zdvihne hráč
// reči pri staršom o stupeň — čo ponúknuť. Bez Reactu a routera, testuje sa bez prehliadača.

import { dalsiStupenReci, opisReci, sMarkerom, type ClientState } from "@naex/core";

export interface MoznostVily {
  readonly elderId: string;
  readonly defId: string;
  /** Moje reči na teplomere súpera pred zdvihom a po ňom slovom („nič“, „žltá až oranžová“, v11.12). */
  readonly pred: string;
  readonly po: string;
}

/** Starší, pri ktorých smie vila zdvihnúť moje reči — nie pri plnom teplomere súpera (v11.12). */
export function moznostiVily(view: Pick<ClientState, "starsi" | "ja">): readonly MoznostVily[] {
  return view.starsi.flatMap((e) => {
    const na = dalsiStupenReci(e, view.ja);
    if (na === null) return [];
    return [{ elderId: e.elderId, defId: e.karta.defId, pred: opisReci(e, view.ja), po: opisReci(sMarkerom(e, view.ja, "reci", na), view.ja) }];
  });
}
