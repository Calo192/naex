// Pečiatka NA EX! cez ilustráciu karty, na ktorej leží poldeci (Michal 2026-11-09: „chcem, aby mala
// cez seba pečiatku“) — vzhľad tlačidla NA EX! v Pitke. Pod nápisom kto ho dal vo farbe hráča. Kreslí
// sa len to, čo pohľad hráča nesie (naexBy, vlastné či cez Bzdochu viditeľné skryté NA EX).
// Ostatné stavy karty v línii (Vzbura, Výtržník, Forsáž…) sú pečiatky v tom istom jazyku, nie nápis
// nad kartou (Michal 2026-11-11: „nech to majú cez karty nalepené pečiatkou podobne ako NA EX“).

import type { ReactNode } from "react";
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

/** Stav karty v línii kreslený pečiatkou; druh určuje farbu (hra.css .stav-peciatka-<druh>). */
export type DruhStavu = "vytrznik" | "vzbura" | "forsaz" | "zahasene" | "posilnene" | "zaverecna" | "odpoved";

export interface StavNaKarte {
  readonly druh: DruhStavu;
  /** Krátke slovo veľkými písmenami („VZBURA!“). */
  readonly text: string;
  /** Malý riadok pod slovom (komu sú Rany, lícom dole…). */
  readonly pod?: string | undefined;
  /** Vysvetlenie stavu — title pečiatky. */
  readonly titul: string;
}

export function PeciatkaStavu({ stav }: { readonly stav: StavNaKarte }) {
  return (
    <span className={`naex-peciatka stav-peciatka stav-peciatka-${stav.druh}`} role="img" aria-label={stav.pod === undefined ? stav.text : `${stav.text} — ${stav.pod}`} title={stav.titul}>
      <span className="naex-peciatka-text">{stav.text}</span>
      {stav.pod !== undefined && <span className="naex-peciatka-kto">{stav.pod}</span>}
    </span>
  );
}

/**
 * Všetky pečiatky karty cez ilustráciu: NA EX navrchu, pod ním stavy. Viac pečiatok sa zmenší
 * a striedavo nakloní, aby sa neprekryli (hra.css .peciatky-karty).
 */
export function PeciatkyKarty({ naex, stavy }: { readonly naex?: NaexNaKarte | undefined; readonly stavy: readonly StavNaKarte[] }): ReactNode {
  const n = (naex === undefined ? 0 : 1) + stavy.length;
  if (n === 0) return undefined;
  return (
    <span className={`peciatky-karty peciatky-${Math.min(n, 3)}`}>
      {naex !== undefined && <PeciatkaNaex naex={naex} />}
      {stavy.map((s) => (
        <PeciatkaStavu key={s.druh} stav={s} />
      ))}
    </span>
  );
}
