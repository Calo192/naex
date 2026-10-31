// Karta v hre: inštancia zo stavu hry → líce karty so živým vyhodnotením.
//
// Hráči sedia oproti sebe: kartu, ktorú zahral súper, vidíš otočenú o 180°,
// takže sa na spoji stretávajú akcie otočené proti sebe ako na stole.
// Kreslí sa vždy vytlačené rozloženie (v ňom je aj vyhodnotenie línie)
// a otočenie robí CSS — ľavá strana sa tak sama stane pravou s obráteným
// poradím slotov. Na čítanie ju narovná lupa (Lupa.tsx).

import { createContext, useContext } from "react";
import type { CardInstance, CardLineEval, ClientState, GameData, PlayerId } from "@naex/core";
import { printedSides } from "@naex/core";
import type { KartaNavrh, RozlozenieStrany, Sada } from "@naex/tvorba";
import { PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import { KartaLico, type SlotStav, type ZarNaKarte } from "../karta/KartaLico.tsx";
import { zarSlotu } from "../karta/zar.ts";
import { vzhladSady } from "../lib/sada.tsx";

/**
 * Stôl pre žeravé ikony: komu karta patrí (ruka, línia) a čo mu posilňuje
 * Dedičstvo. Mimo stola (náhľady, šenok, tvorca) karta nežhne.
 */
export interface ZarStola {
  readonly view: Pick<ClientState, "ja" | "ruka" | "strany" | "vplyvyAkcii">;
  /** Kedy sa ktorá zmena ikony ukázala prvý raz — iskra odletí len pri prvom zobrazení. */
  readonly videne: Map<string, number>;
}

export const ZarStolaKontext = createContext<ZarStola | null>(null);

/** Ako dlho po prvom zobrazení beží iskra (karta.css kl-iskra-let) — prekreslenie ju nepreruší. */
const TRVANIE_ISKRY_MS = 1200;

/** Kde karta leží a komu patrí — len ruka hráča a línia. */
function miestoKarty(view: ZarStola["view"], uid: number): { readonly majitel: PlayerId; readonly miesto: "ruka" | "linia"; readonly uplatky: number } | null {
  for (const strana of view.strany) {
    const pl = strana.find((x) => x.card.uid === uid);
    if (pl !== undefined) return { majitel: pl.playedBy, miesto: "linia", uplatky: pl.vytrznik === true ? 0 : (pl.uplatky ?? 0) };
  }
  return view.ruka.some((k) => k.uid === uid) ? { majitel: view.ja, miesto: "ruka", uplatky: 0 } : null;
}

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
  /** Prepínač výberu (stavba šenku): aria-pressed a pri plnom výbere aria-disabled. */
  readonly stlacena?: boolean | undefined;
  readonly zakazana?: boolean | undefined;
}

export function HernaKarta({ karta, sada, data, sirka, otocena = false, eval: ev, onClick, vybrana, bezPopisov, hranaVnutorna, spoj, vytrznik = false, stlacena, zakazana }: HernaKartaProps) {
  const vytlacene = printedSides(data, karta);
  const stol = useContext(ZarStolaKontext);
  // Lupa a karta na stole majú rovnaký kľúč — lupa otvorená po iskre ju už nezopakuje.
  const teraz = Date.now();
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
  const kde = stol === null ? null : miestoKarty(stol.view, karta.uid);
  const zar = (ps: "left" | "right", roz: RozlozenieStrany): (ZarNaKarte | null)[] =>
    [0, 1, 2, 3].map((k) => {
      const a = roz[k] ?? null;
      if (stol === null || kde === null || a === null) return null;
      const z = zarSlotu(a, stol.view.vplyvyAkcii?.[kde.majitel] ?? [], kde.uplatky, (id) => data.cards.get(id)?.name ?? id, karta.uid);
      if (z === null) return null;
      const kluc = `${karta.uid}:${kde.miesto}:${ps}${k}:${z.pricina}`;
      const prvy = stol.videne.get(kluc) ?? teraz;
      if (!stol.videne.has(kluc)) stol.videne.set(kluc, prvy);
      return { ...z, nova: teraz - prvy < TRVANIE_ISKRY_MS };
    });
  const zarL = zar("left", l.roz);
  const zarP = zar("right", p.roz);
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
      zar={zarL.some((z) => z !== null) || zarP.some((z) => z !== null) ? { lava: zarL, prava: zarP } : undefined}
      odznaky={odznaky}
      onClick={onClick}
      vybrana={vybrana ?? false}
      stlacena={stlacena}
      zakazana={zakazana}
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
