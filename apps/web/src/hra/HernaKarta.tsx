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
  readonly onClick?: (() => void) | undefined;
  readonly vybrana?: boolean;
  readonly bezPopisov?: boolean;
  /** Vytlačená strana, ktorou sa karta páruje k lokalite (návrh vyloženia). */
  readonly hranaVnutorna?: "left" | "right" | undefined;
  /** Sloty vytlačených strán (indexy zhora), ktoré vytvoria spoj — výber miesta na stole. */
  readonly spoj?: { readonly left: readonly number[]; readonly right: readonly number[] } | undefined;
  /** Zrážka NA EX (v5): karta je počas bitky Výtržník — každá jej akcia je Rana pre majiteľa. */
  readonly vytrznik?: boolean | undefined;
}

export function HernaKarta({ karta, sada, data, sirka, otocena = false, eval: ev, onClick, vybrana, bezPopisov, hranaVnutorna, spoj, vytrznik = false }: HernaKartaProps) {
  const vytlacene = printedSides(data, karta);
  const strana = (ps: "left" | "right"): { roz: RozlozenieStrany; sloty: (SlotStav | null)[] | null } => {
    // Výtržník kreslí Rany na miestach vytlačených akcií — hráč má vidieť, čo karta naozaj robí.
    const roz = [0, 1, 2, 3].map((k) => {
      const a = vytlacene[ps][k] ?? null;
      return vytrznik && a !== null ? "Rana" : a;
    }) as unknown as RozlozenieStrany;
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
  // NA EX na karte ukazuje štítok nad kartou v línii (HernaPlocha), nie odznak v nej.
  const odznaky = vytrznik ? <span className="odznak-vytrznik">Výtržník!</span> : ev?.vzbura === true ? <span>Vzbura!</span> : undefined;

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
      hranaVnutorna={hranaVnutorna === undefined ? undefined : hranaVnutorna === "left" ? "lava" : "prava"}
      bezPopisov={bezPopisov ?? false}
      slotyBezFokusu
      spoj={spoj === undefined ? undefined : { lava: spoj.left, prava: spoj.right }}
      idKarty={karta.defId}
      uidKarty={karta.uid}
    />
  );
}
