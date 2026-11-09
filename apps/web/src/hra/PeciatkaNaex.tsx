// Pečiatka NA EX! cez ilustráciu karty, na ktorej leží poldeci (Michal 2026-11-09: „chcem, aby mala
// cez seba pečiatku“) — vzhľad tlačidla NA EX! v Pitke. Pod nápisom kto ho dal vo farbe hráča. Kreslí
// sa len to, čo pohľad hráča nesie (naexBy, vlastné či cez Bzdochu viditeľné skryté NA EX).

import type { PlayerId } from "@naex/core";
import { opponentOf } from "@naex/core";

/** NA EX na karte tak, ako ho hráč vidí. */
export interface NaexNaKarte {
  /** Čie poldeci: moje, súperovo, alebo zrážka (Výtržník). */
  readonly od: "ja" | "su" | "obaja";
  /** Malý text pod nápisom — „tvoj“, meno súpera, „obaja“. */
  readonly kto: string;
  /** Ešte neodkryté (vlastné, alebo súperovo cez Bzdochu) — súper o ňom nevie. */
  readonly skryto?: boolean;
}

/**
 * NA EX na karte z pohľadu hráča ja: odkryté z línie (naexBy, pri zrážke aj naexBy2), zo skrytých len
 * tie, ktoré pohľad nesie — moje, a súperove cez Bzdochu (pitkaStav.skryteNaex). Iné skryté NA EX
 * klient nemá, takže ich nemá ako prezradiť.
 */
export function naexNaKarte(
  n: { readonly naexBy: PlayerId | undefined; readonly naexBy2: PlayerId | undefined; readonly skryteMoje: boolean; readonly skryteSupera: boolean },
  ja: PlayerId,
  menoHraca: (p: PlayerId) => string,
): NaexNaKarte | undefined {
  if (n.naexBy !== undefined && n.naexBy2 !== undefined) return { od: "obaja", kto: "obaja" };
  if (n.naexBy !== undefined) return n.naexBy === ja ? { od: "ja", kto: "tvoj" } : { od: "su", kto: menoHraca(n.naexBy) };
  if (n.skryteMoje) return { od: "ja", kto: "tvoj", skryto: true };
  if (n.skryteSupera) return { od: "su", kto: menoHraca(opponentOf(ja)), skryto: true };
  return undefined;
}

export function PeciatkaNaex({ naex }: { readonly naex: NaexNaKarte }) {
  const kto = naex.skryto === true ? `${naex.kto} · skryto` : naex.kto;
  return (
    <span className={`naex-peciatka naex-peciatka-${naex.od}${naex.skryto === true ? " naex-peciatka-skryto" : ""}`} role="img" aria-label={`NA EX — ${kto}`}>
      <span className="naex-peciatka-text">NA EX!</span>
      <span className="naex-peciatka-kto">{kto}</span>
    </span>
  );
}
