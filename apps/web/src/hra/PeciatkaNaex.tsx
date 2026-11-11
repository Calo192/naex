// Pečiatka NA EX! cez ilustráciu karty, na ktorej leží poldeci (Michal 2026-11-09: „chcem, aby mala
// cez seba pečiatku“). Je vo farbe hráča, ktorý ho dal, bez mena, a leží bližšie k jeho strane stola
// (Michal 2026-11-11): moje dole, súperovo hore. Pri zrážke sú na karte dve NA EX! a VÝTRŽNÍK!.
// Kreslí sa len to, čo pohľad hráča nesie (naexBy, vlastné či cez Bzdochu viditeľné skryté NA EX).
// Ostatné stavy karty v línii (Vzbura, Výtržník, Forsáž…) sú pečiatky v tom istom jazyku, nie nápis
// nad kartou (Michal 2026-11-11: „nech to majú cez karty nalepené pečiatkou podobne ako NA EX“).

import type { ReactNode } from "react";
import type { PlayerId } from "@naex/core";
import { opponentOf } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

/** NA EX na karte tak, ako ho hráč vidí. */
export interface NaexNaKarte {
  /** Čie poldeci: moje, súperovo, alebo zrážka (Výtržník). */
  readonly od: "ja" | "su" | "obaja";
  /** Kto ho dal — len pre čítačku, na pečiatke meno nie je. Pri zrážke meno súpera. */
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
  if (n.naexBy !== undefined && n.naexBy2 !== undefined) return { od: "obaja", kto: menoHraca(opponentOf(ja)) };
  if (n.naexBy !== undefined) return n.naexBy === ja ? { od: "ja", kto: t("peciatka.tvoj") } : { od: "su", kto: menoHraca(n.naexBy) };
  if (n.skryteMoje) return { od: "ja", kto: t("peciatka.tvoj"), skryto: true };
  if (n.skryteSupera) return { od: "su", kto: menoHraca(opponentOf(ja)), skryto: true };
  return undefined;
}

/** Jedna pečiatka NA EX! vo farbe hráča (ja / su); pri zrážke ich karta dostane dve. */
export function PeciatkaNaex({ naex }: { readonly naex: NaexNaKarte & { readonly od: "ja" | "su" } }) {
  const kto = naex.skryto === true ? `${naex.kto} · ${t("peciatka.skryto")}` : naex.kto;
  return (
    <span className={`naex-peciatka naex-peciatka-${naex.od}${naex.skryto === true ? " naex-peciatka-skryto" : ""}`} role="img" aria-label={`NA EX — ${kto}`}>
      <span className="naex-peciatka-text">NA EX!</span>
    </span>
  );
}

/** NA EX na karte rozložené na pečiatky: pri zrážke súperova a moja, každá pri svojej strane. */
export function peciatkyNaex(naex: NaexNaKarte | undefined): { readonly hore: (NaexNaKarte & { readonly od: "su" }) | null; readonly dole: (NaexNaKarte & { readonly od: "ja" }) | null } {
  if (naex === undefined) return { hore: null, dole: null };
  const skryto = naex.skryto === true ? { skryto: true } : {};
  if (naex.od === "obaja") return { hore: { od: "su", kto: naex.kto }, dole: { od: "ja", kto: t("peciatka.tvoj") } };
  return naex.od === "su" ? { hore: { od: "su", kto: naex.kto, ...skryto }, dole: null } : { hore: null, dole: { od: "ja", kto: naex.kto, ...skryto } };
}

/** Stav karty kreslený pečiatkou; druh určuje farbu (hra.css .stav-peciatka-<druh>). */
export type DruhStavu = "vytrznik" | "vzbura" | "forsaz" | "vyhral" | "remiza";

export interface StavNaKarte {
  readonly druh: DruhStavu;
  /** Krátke slovo veľkými písmenami („VZBURA!“). */
  readonly text: string;
  /** Malý riadok pod slovom (komu sú Rany, kto vyhral…). */
  readonly pod?: string | undefined;
  /** Vysvetlenie stavu — title pečiatky. */
  readonly titul: string;
  /** Pečiatka vo farbe hráča (VYHRAL! na lokalite). */
  readonly hrac?: "ja" | "su" | undefined;
}

export function PeciatkaStavu({ stav }: { readonly stav: StavNaKarte }) {
  return (
    <span
      className={`naex-peciatka stav-peciatka stav-peciatka-${stav.druh}${stav.hrac === undefined ? "" : ` stav-peciatka-${stav.hrac}`}`}
      role="img"
      aria-label={stav.pod === undefined ? stav.text : `${stav.text} — ${stav.pod}`}
      title={stav.titul}
    >
      <span className="naex-peciatka-text">{stav.text}</span>
      {stav.pod !== undefined && <span className="naex-peciatka-kto">{stav.pod}</span>}
    </span>
  );
}

/**
 * Všetky pečiatky karty cez ilustráciu: súperovo NA EX hore, moje dole, stavy medzi nimi. Viac
 * pečiatok sa zmenší a stavy sa striedavo nakloní, aby sa neprekryli (hra.css .peciatky-karty).
 */
export function PeciatkyKarty({ naex, stavy }: { readonly naex?: NaexNaKarte | undefined; readonly stavy: readonly StavNaKarte[] }): ReactNode {
  const { hore, dole } = peciatkyNaex(naex);
  const n = (hore === null ? 0 : 1) + (dole === null ? 0 : 1) + stavy.length;
  if (n === 0) return undefined;
  return (
    <span className={`peciatky-karty peciatky-${Math.min(n, 3)}`}>
      <span className="peciatky-hore">{hore !== null && <PeciatkaNaex naex={hore} />}</span>
      <span className="peciatky-stavy">
        {stavy.map((s) => (
          <PeciatkaStavu key={s.druh} stav={s} />
        ))}
      </span>
      <span className="peciatky-dole">{dole !== null && <PeciatkaNaex naex={dole} />}</span>
    </span>
  );
}
