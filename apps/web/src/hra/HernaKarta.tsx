// Karta v hre: inštancia zo stavu hry → líce karty so živým vyhodnotením.
//
// Otočená karta (nohami hore voči partii) sa nekreslí hore nohami — text by
// bol nečitateľný. Zobrazia sa jej EFEKTÍVNE strany (vymenené a s obráteným
// poradím indexov) + odznak ⟳. Funkčne je to presne to, čo leží na stole.

import type { CardInstance, CardLineEval, GameData } from "@naex/core";
import { printedSides } from "@naex/core";
import type { KartaNavrh, RozlozenieStrany, Sada } from "@naex/tvorba";
import { PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import { KartaLico, type SlotStav } from "../karta/KartaLico.tsx";
import { vzhladSady } from "../lib/sada.tsx";

export function vzhladKarty(sada: Sada, data: GameData, defId: string): KartaNavrh {
  const k = sada.karty.find((x) => x.id === defId);
  if (k !== undefined) return k;
  const def = data.cards.get(defId);
  return {
    id: defId,
    nazov: def?.name ?? defId,
    tagy: def?.tags ?? [],
    efekt: def?.effectText ?? "",
    obrazok: null,
    farba: null,
    ...PREDVOLENE_NASTAVENIA,
    kopie: 1,
    lava: { blokovane: [], akcie: {}, povolene: {} },
    prava: { blokovane: [], akcie: {}, povolene: {} },
    upravene: 0,
  };
}

export interface HernaKartaProps {
  readonly karta: CardInstance;
  readonly sada: Sada;
  readonly data: GameData;
  readonly sirka: number;
  readonly otocena?: boolean;
  readonly eval?: CardLineEval | null;
  readonly naex?: string | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly vybrana?: boolean;
  readonly bezPopisov?: boolean;
}

export function HernaKarta({ karta, sada, data, sirka, otocena = false, eval: ev, naex, onClick, vybrana, bezPopisov }: HernaKartaProps) {
  const vytlacene = printedSides(data, karta);
  const strana = (s: "lava" | "prava"): { roz: RozlozenieStrany; sloty: (SlotStav | null)[] | null } => {
    const ps = (otocena ? (s === "lava" ? "right" : "left") : s === "lava" ? "left" : "right") as "left" | "right";
    const roz = [0, 1, 2, 3].map((k) => vytlacene[ps][otocena ? 3 - k : k] ?? null) as unknown as RozlozenieStrany;
    const sloty =
      ev === undefined || ev === null
        ? null
        : [0, 1, 2, 3].map((k) => {
            const se = ev[ps][otocena ? 3 - k : k];
            return se === null || se === undefined ? null : { stav: se.stav, nasobok: se.nasobok };
          });
    return { roz, sloty };
  };
  const l = strana("lava");
  const p = strana("prava");
  const odznaky =
    otocena || naex !== undefined || ev?.vzbura === true ? (
      <>
        {otocena && <span title="Otočená o 180° — zahral ju súper">⟳ otočená</span>}
        {naex !== undefined && <span title={`NA EX — poldeci hráča ${naex}`}>🥃 {naex}</span>}
        {ev?.vzbura === true && <span>Vzbura!</span>}
      </>
    ) : undefined;

  return (
    <KartaLico
      karta={vzhladKarty(sada, data, karta.defId)}
      lava={l.roz}
      prava={p.roz}
      vzhlad={vzhladSady(sada)}
      sirka={sirka}
      sloty={l.sloty !== null && p.sloty !== null ? { lava: l.sloty, prava: p.sloty } : null}
      odznaky={odznaky}
      onClick={onClick}
      vybrana={vybrana ?? false}
      bezPopisov={bezPopisov ?? false}
    />
  );
}
