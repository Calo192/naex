// Bodový bar (Michal 2026-10-23): po kliku na Body ukáže stôl líniu starších
// a oba bary hráčov sa prepnú zo zdrojov na body — jedna dlaždica na typ
// podmienky so súčtom bodov zo všetkých starších. Prejdenie myšou po dlaždici
// zvýrazní v línii starších, u ktorých tá podmienka boduje (aj podmienku samu).
// Body a Karty ostávajú na svojom mieste.

import type { CSSProperties } from "react";
import type { BodyTeraz, ElderState, GameData, Podmienka, PlayerId } from "@naex/core";
import { ALL_PODMIENKY, podmienkyStarsieho } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { znamienko } from "./Scorecard.tsx";

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
  readonly body: number;
  /** Starší, u ktorých podmienka boduje (aktívna), s bodmi pre tohto hráča. */
  readonly aktivne: readonly { readonly meno: string; readonly body: number }[];
  readonly neaktivne: number;
  readonly kusy: number;
}

/** Súčty podmienok cez všetkých starších pre hráča p — len typy, ktoré na scorecardoch v hre sú. */
export function typyPodmienok(data: GameData, starsi: readonly ElderState[], body: BodyTeraz, p: PlayerId, meno: (e: ElderState) => string): Typ[] {
  return ALL_PODMIENKY.flatMap((podmienka): Typ[] => {
    let sucet = 0;
    let kusy = 0;
    let neaktivne = 0;
    let vHre = false;
    const aktivne: { meno: string; body: number }[] = [];
    for (const e of starsi) {
      const tu = podmienkyStarsieho(data, e).filter((x) => x.podmienka === podmienka);
      if (tu.length === 0) continue;
      vHre = true;
      const polozky = body.starsi.find((b) => b.elderId === e.elderId)?.polozky[p].filter((x) => x.podmienka === podmienka) ?? [];
      const b = polozky.reduce((s, x) => s + x.body, 0);
      if (tu.some((x) => x.aktivna)) aktivne.push({ meno: meno(e), body: b });
      else neaktivne++;
      sucet += b;
      kusy = Math.max(kusy, ...polozky.map((x) => x.kusy));
    }
    return vHre ? [{ podmienka, body: sucet, aktivne, neaktivne, kusy }] : [];
  });
}

export function BodovyBar({ p, data, starsi, body, ikony, mena, menoStarsieho, zvyraznena, zvyrazni }: BodovyBarProps) {
  const typy = typyPodmienok(data, starsi, body, p, menoStarsieho);
  return (
    <div className="bodovy-bar" style={{ "--n": typy.length } as CSSProperties} role="list" aria-label={`Body podľa podmienok — ${mena[p]}`}>
      {typy.map((t) => {
        const popis = [
          `${NAZOV_PODMIENKY[t.podmienka]} — ${mena[p]} ${znamienko(t.body)} b spolu`,
          ...t.aktivne.map((a) => `${a.meno}: ${znamienko(a.body)}`),
          ...(t.neaktivne > 0 ? [`neaktívna u ${t.neaktivne} ${t.neaktivne === 1 ? "staršieho" : "starších"} (karta na ukazovateli tu nemá akciu)`] : []),
        ].join("\n");
        return (
          <div
            key={t.podmienka}
            role="listitem"
            tabIndex={0}
            className={`zdroj bodova-dlazdica ${t.body > 0 ? "plus" : t.body < 0 ? "minus" : ""}${zvyraznena === t.podmienka ? " zvyraznena" : ""}`}
            title={popis}
            onMouseEnter={() => zvyrazni(t.podmienka)}
            onMouseLeave={() => zvyrazni(null)}
            onFocus={() => zvyrazni(t.podmienka)}
            onBlur={() => zvyrazni(null)}
          >
            <span className="zdroj-nazov">{KRATKO_PODMIENKA[t.podmienka]}</span>
            <span className="zdroj-hodnota">
              <IkonaPodmienky podmienka={t.podmienka} ikony={ikony} />
              <span className="velke-cislo">{znamienko(t.body)}</span>
            </span>
            <span className="zdroj-pod">
              {t.aktivne.length === 0 ? "nikde neboduje" : `boduje u ${t.aktivne.length} · ${t.kusy} ks`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
