// Rozpis bodov ako dlaždice v bare hráča (Michal 2026-10-22, dizajn
// stol-oproti-b2-20261022-1030, riešenie 1): šesť dlaždíc v tých istých
// stĺpcoch ako šesť zdrojov, takže prepnutie Body ⇄ zdroje nemení výšku baru.
// Znepokojenie, Strach a Vydesenie sú jedna dlaždica „Zóny strachu“.
// Súperov bar ukazuje to isté zrkadlovo.

import type { FocusEvent, MouseEvent } from "react";
import type { BodyTeraz, GameData, Podmienka, PlayerId } from "@naex/core";
import { useTip } from "../karta/Tip.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { bodyPoPodmienkach, tipPodmienky, type BodyPodmienky } from "./bodyPodmienok.tsx";
import { znamienko } from "./Scorecard.tsx";

const SKUPINY: readonly { readonly nazov: string; readonly podmienky: readonly Podmienka[] }[] = [
  { nazov: "Lokality", podmienky: ["lokality"] },
  { nazov: "Starší", podmienky: ["starsi"] },
  { nazov: "Cigarety", podmienky: ["cigarety"] },
  { nazov: "Zóny strachu", podmienky: ["znepokojenie", "strach", "vydesenie"] },
  { nazov: "Dlhy", podmienky: ["dlh"] },
  { nazov: "Cirhóza", podmienky: ["cirhoza"] },
];

const ZONA: Partial<Record<Podmienka, number>> = { znepokojenie: 1, strach: 2, vydesenie: 3 };

const trieda = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

export interface RozpisDlazdiceProps {
  readonly body: BodyTeraz;
  readonly data: GameData;
  /** Čí bar to je. */
  readonly p: PlayerId;
  /** Kto sa pozerá — nápoveda hovorí „ty“ jemu. */
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly menoStarsieho: (elderId: string) => string;
  /** Súperov bar: dlaždice v obrátenom poradí. */
  readonly zrkadlo: boolean;
}

export function RozpisDlazdice({ body, data, p, ja, mena, menoStarsieho, zrkadlo }: RozpisDlazdiceProps) {
  const { tip, ukaz, skry } = useTip();
  const druhy: PlayerId = p === 0 ? 1 : 0;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const podmienky = bodyPoPodmienkach(body);
  const tipy = (m: BodyPodmienky | undefined) =>
    m === undefined
      ? {}
      : {
          tabIndex: 0,
          onMouseEnter: (e: MouseEvent<HTMLElement>) => ukaz(e.currentTarget, tipPodmienky(m, data, ja, mena[su], menoStarsieho)),
          onMouseLeave: skry,
          onFocus: (e: FocusEvent<HTMLElement>) => ukaz(e.currentTarget, tipPodmienky(m, data, ja, mena[su], menoStarsieho)),
          onBlur: skry,
        };
  const vypocet = (m: BodyPodmienky): string => {
    const zaKus = data.bodyPodmienok[m.podmienka];
    return `${m.kusy[p]} × ${zaKus > 0 ? "+" : "−"}${Math.abs(zaKus)} × ${m.zdroje.length} sc.`;
  };
  const skupiny = zrkadlo ? [...SKUPINY].reverse() : SKUPINY;

  return (
    <>
      {skupiny.map((s) => {
        const ms = s.podmienky.map((x) => podmienky.get(x)).filter((m): m is BodyPodmienky => m !== undefined);
        const b = ms.reduce((a, m) => a + m.body[p], 0);
        const bd = ms.reduce((a, m) => a + m.body[druhy], 0);
        const jedna = s.podmienky.length === 1 ? ms[0] : undefined;
        return (
          <div
            key={s.nazov}
            className={`rozpis-dlazdica ${trieda(b)} ${ms.length === 0 ? "neaktivna" : ""} ${jedna === undefined ? "skupina" : ""}`}
            role="group"
            aria-label={`${s.nazov}: ${mena[p]} ${znamienko(b)}, ${mena[druhy]} ${znamienko(bd)}`}
            {...(jedna !== undefined ? tipy(jedna) : {})}
          >
            <span className="rd-nazov">{s.nazov}</span>
            <span className="rd-body">
              <b className={`rd-cislo ${trieda(b)}`}>{znamienko(b)}</b>
              <span className={`rd-druhy ${bd === 0 ? "nula" : druhy === ja ? "ja" : "su"}`}>
                {mena[druhy]} {znamienko(bd)}
              </span>
            </span>
            {ms.length === 0 ? (
              <span className="rd-vypocet">nikde aktívna</span>
            ) : jedna !== undefined ? (
              <span className="rd-vypocet">{vypocet(jedna)}</span>
            ) : (
              <span className="rd-stupne">
                {s.podmienky.map((x) => {
                  const m = podmienky.get(x);
                  const bx = m?.body[p] ?? 0;
                  return (
                    <span key={x} className={`rd-stupen ${bx === 0 ? "nula" : ""}`} {...tipy(m)}>
                      <i className={`zona-${ZONA[x] ?? 0}`} aria-hidden="true" />
                      <span className="rd-stupen-nazov">{NAZOV_PODMIENKY[x]}</span>
                      <b className={trieda(bx)}>{znamienko(bx)}</b>
                    </span>
                  );
                })}
              </span>
            )}
          </div>
        );
      })}
      {tip}
    </>
  );
}
