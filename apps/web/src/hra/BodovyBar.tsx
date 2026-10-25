// Bodový bar (Michal 2026-10-23): po kliku na Body ukáže stôl líniu starších
// a oba bary hráčov sa prepnú zo zdrojov na súboje — jedna dlaždica na typ
// podmienky: koľko jej súbojov pri starších hráč vyhráva (v5 sa za podmienku
// body nedávajú, dáva ich starší víťazovi väčšiny súbojov). Prejdenie myšou po
// dlaždici zvýrazní v línii starších, u ktorých je podmienka aktívna.
// Body a Karty ostávajú na svojom mieste.

import type { CSSProperties } from "react";
import type { BodyTeraz, ElderState, GameData, Podmienka, PlayerId } from "@naex/core";
import { ALL_PODMIENKY, podmienkyStarsieho } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { jednotka, subojePoPodmienkach } from "./bodyPodmienok.tsx";

/** Krátke názvy do dlaždice — dlhé (NAZOV_PODMIENKY) sú v nápovede. */
export const KRATKO_PODMIENKA: Readonly<Record<Podmienka, string>> = {
  znepokojenie: "Znepokojenie",
  strach: "Strach",
  vydesenie: "Vydesenie",
  lokality: "Lokality",
  starsi: "Starší",
  cigarety: "Cigarety",
  cirhoza: "Cirhóza",
  dlh: "Dlhy",
  abstak: "Absťáky",
  rezerva: "Rezerva",
};

export interface BodovyBarProps {
  /** Čí bar — body tohto hráča. */
  readonly p: PlayerId;
  readonly data: GameData;
  readonly starsi: readonly ElderState[];
  readonly body: BodyTeraz;
  readonly ikony: readonly IkonaBodovania[];
  readonly mena: readonly [string, string];
  /** Meno staršieho (karta na ukazovateli) do nápovedy. */
  readonly menoStarsieho: (e: ElderState) => string;
  readonly zvyraznena: Podmienka | null;
  readonly zvyrazni: (p: Podmienka | null) => void;
}

interface Typ {
  readonly podmienka: Podmienka;
  /** Súboje tejto podmienky: koľko vyhráva hráč, koľko súper, koľko ich je. */
  readonly vyhry: number;
  readonly prehry: number;
  readonly pocet: number;
  /** Starší, u ktorých je podmienka aktívna, a ich súboj (hodnota hráča : súpera). */
  readonly aktivne: readonly { readonly meno: string; readonly ja: number; readonly su: number; readonly vitaz: "ja" | "su" | null }[];
  readonly neaktivne: number;
  readonly kusy: number;
}

/** Súboje podmienok cez všetkých starších pre hráča p — len typy, ktoré na scorecardoch v hre sú. */
export function typyPodmienok(data: GameData, starsi: readonly ElderState[], body: BodyTeraz, p: PlayerId, meno: (e: ElderState) => string): Typ[] {
  const su: PlayerId = p === 0 ? 1 : 0;
  const suboje = subojePoPodmienkach(body);
  return ALL_PODMIENKY.flatMap((podmienka): Typ[] => {
    const vHre = starsi.filter((e) => podmienkyStarsieho(data, e).some((x) => x.podmienka === podmienka));
    if (vHre.length === 0) return [];
    const t = suboje.get(podmienka);
    const neaktivne = vHre.filter((e) => !podmienkyStarsieho(data, e).some((x) => x.podmienka === podmienka && x.aktivna)).length;
    const aktivne = (t?.starsi ?? []).map(({ elderId, suboj }) => {
      const e = starsi.find((x) => x.elderId === elderId);
      return {
        meno: e === undefined ? elderId : meno(e),
        ja: suboj.hodnoty[p],
        su: suboj.hodnoty[su],
        vitaz: suboj.vitaz === null ? null : suboj.vitaz === p ? ("ja" as const) : ("su" as const),
      };
    });
    return [{ podmienka, vyhry: t?.vyhry[p] ?? 0, prehry: t?.vyhry[su] ?? 0, pocet: t?.pocet ?? 0, aktivne, neaktivne, kusy: t?.hodnoty[p] ?? 0 }];
  });
}

export function BodovyBar({ p, data, starsi, body, ikony, mena, menoStarsieho, zvyraznena, zvyrazni }: BodovyBarProps) {
  const typy = typyPodmienok(data, starsi, body, p, menoStarsieho);
  const su: PlayerId = p === 0 ? 1 : 0;
  return (
    <div className="bodovy-bar" style={{ "--n": typy.length } as CSSProperties} role="list" aria-label={`Súboje podľa podmienok — ${mena[p]}`}>
      {typy.map((t) => {
        const popis = [
          `${NAZOV_PODMIENKY[t.podmienka]} — ${mena[p]} vyhráva ${t.vyhry} z ${t.pocet} súbojov`,
          ...t.aktivne.map((a) => `${a.meno}: ${a.ja} : ${a.su} ${a.vitaz === null ? "rovnosť" : a.vitaz === "ja" ? `vyhráva ${mena[p]}` : `vyhráva ${mena[su]}`}`),
          ...(t.neaktivne > 0 ? [`neaktívna u ${t.neaktivne} ${t.neaktivne === 1 ? "staršieho" : "starších"} (karta na ukazovateli tu nemá akciu)`] : []),
        ].join("\n");
        return (
          <div
            key={t.podmienka}
            role="listitem"
            tabIndex={0}
            className={`zdroj bodova-dlazdica ${t.vyhry > t.prehry ? "plus" : t.vyhry < t.prehry ? "minus" : ""}${zvyraznena === t.podmienka ? " zvyraznena" : ""}`}
            title={popis}
            onMouseEnter={() => zvyrazni(t.podmienka)}
            onMouseLeave={() => zvyrazni(null)}
            onFocus={() => zvyrazni(t.podmienka)}
            onBlur={() => zvyrazni(null)}
          >
            <span className="zdroj-nazov">{KRATKO_PODMIENKA[t.podmienka]}</span>
            <span className="zdroj-hodnota">
              <IkonaPodmienky podmienka={t.podmienka} ikony={ikony} />
              <span className="velke-cislo">
                {t.vyhry}
                <small>/{t.pocet}</small>
              </span>
            </span>
            <span className="zdroj-pod">
              {t.pocet === 0 ? "nikde aktívna" : `súbojov · má ${t.kusy} ${jednotka(t.podmienka, t.kusy)}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
