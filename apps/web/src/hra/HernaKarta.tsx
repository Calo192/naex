// Karta v hre: inštancia zo stavu hry → líce karty so živým vyhodnotením.
//
// Hráči sedia oproti sebe: kartu, ktorú zahral súper, vidíš otočenú o 180°,
// takže sa na spoji stretávajú akcie otočené proti sebe ako na stole.
// Kreslí sa vždy vytlačené rozloženie (v ňom je aj vyhodnotenie línie)
// a otočenie robí CSS — ľavá strana sa tak sama stane pravou s obráteným
// poradím slotov. Na čítanie ju narovná lupa (Lupa.tsx).

import type { CardInstance, CardLineEval, GameData } from "@naex/core";
import { printedSides } from "@naex/core";
import type { KartaNavrh, RozlozenieStrany, Sada } from "@naex/tvorba";
import { PREDVOLENE_NASTAVENIA, geometriaKarty } from "@naex/tvorba";
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

/**
 * O koľko px nižšie leží v línii karta, ktorá je voči divákovi vzpriamená.
 * Otočená karta má ilustráciu (a sloty) dole, vzpriamená hore — aby sa na
 * spoji stretli priľahlé akcie, ilustrácie musia byť v jednej výške a názov
 * s popisom vytŕčajú: otočenej hore, vzpriamenej dole.
 */
export function posunVzpriamenej(sada: Sada, data: GameData, defId: string, sirka: number): number {
  const k = vzhladKarty(sada, data, defId);
  const g = geometriaKarty({ ...k, maTagy: k.tagy.length > 0 });
  const prvy = g.slotyLave[0];
  const posledny = g.slotyLave[g.slotyLave.length - 1];
  // Sloty sú symetrické okolo stredu ilustrácie: otočením sa slot s hornou
  // hranou y dostane na výšku H − (y_posledny + s) a posun to vyrovná.
  const posun =
    prvy === undefined || posledny === undefined
      ? g.vyska - g.obrazok.h
      : g.vyska - (prvy.y + posledny.y + posledny.h);
  return (posun * sirka) / g.sirka;
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
  const strana = (ps: "left" | "right"): { roz: RozlozenieStrany; sloty: (SlotStav | null)[] | null } => {
    const roz = [0, 1, 2, 3].map((k) => vytlacene[ps][k] ?? null) as unknown as RozlozenieStrany;
    const sloty =
      ev === undefined || ev === null
        ? null
        : [0, 1, 2, 3].map((k) => {
            const se = ev[ps][k];
            return se === null || se === undefined ? null : { stav: se.stav, nasobok: se.nasobok };
          });
    return { roz, sloty };
  };
  const l = strana("left");
  const p = strana("right");
  const odznaky =
    naex !== undefined || ev?.vzbura === true ? (
      <>
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
      otocena={otocena}
      bezPopisov={bezPopisov ?? false}
    />
  );
}
