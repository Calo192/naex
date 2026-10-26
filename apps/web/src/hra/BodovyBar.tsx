// Bodový bar (Michal 2026-10-23; v6 špaky, Michal 2026-10-26): po kliku na
// Špaky ukáže stôl líniu starších a oba bary hráčov sa prepnú zo zdrojov na
// odkiaľ hráč špaky má a čo ešte príde — bitky, starší po bitke, nepriznaná
// Cirhóza a odhad do konca hry. Popolník ostáva v dlaždici Špaky.

import type { CSSProperties } from "react";
import type { PlayerId, RozpisSpakov, SpakyTeraz } from "@naex/core";
import { KONSTANTY } from "@naex/core";

export interface BodovyBarProps {
  /** Čí bar — špaky tohto hráča. */
  readonly p: PlayerId;
  readonly body: SpakyTeraz;
  /** Odkiaľ má hráč špaky doteraz (rozpisSpakov z nástenky). */
  readonly rozpis: RozpisSpakov;
  readonly mena: readonly [string, string];
}

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function BodovyBar({ p, body, rozpis, mena }: BodovyBarProps) {
  const dlazdice = [
    {
      kluc: "bitky",
      nazov: "Bitky",
      hodnota: zn(rozpis.zaBitky),
      trieda: rozpis.zaBitky > 0 ? "plus" : "",
      pod: rozpis.exekutor < 0 ? `Exekútor ${zn(rozpis.exekutor)}` : "za vyhraté bitky",
      popis: `Špaky hráča ${mena[p]} za vyhraté bitky (odohrané Pitky mínus rozdiel Absťákov, aspoň 1; so sekerou).${rozpis.exekutor < 0 ? ` Exekútor mu spálil ${-rozpis.exekutor}.` : ""}`,
    },
    {
      kluc: "starsi",
      nazov: "Starší",
      hodnota: zn(body.zaStarsich[p]),
      trieda: body.zaStarsich[p] > 0 ? "plus" : "",
      pod: `po bitke · doteraz ${zn(rozpis.zaStarsich)}`,
      popis: "Koľko špakov dajú starší, ktorí sa hráča boja, po najbližšej bitke (žltá 1, oranžová 2, červená 3), a koľko ich dali doteraz.",
    },
    {
      kluc: "cirhoza",
      nazov: "Cirhóza",
      hodnota: zn(-body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU),
      trieda: body.cirhozy[p] > 0 ? "minus" : "",
      pod: `${body.cirhozy[p]} nepriznané`,
      popis: `Nepriznaná Cirhóza zoberie na konci hry ${KONSTANTY.SPAKY_ZA_CIRHOZU} špakov za kus (ruka aj oba balíčky).`,
    },
    {
      kluc: "odhad",
      nazov: "Odhad",
      hodnota: body.odhad[p] < 0 ? `−${-body.odhad[p]}` : String(body.odhad[p]),
      trieda: "",
      pod: `ešte ${body.vyplat}× starší`,
      popis: "Odhad konečných špakov, keby sa markery už nepohli: špaky − Cirhózy + starší × bitky, ktoré ešte prídu. Výhry v bitkách nerátá.",
    },
  ];
  return (
    <div className="bodovy-bar" style={{ "--n": dlazdice.length } as CSSProperties} role="list" aria-label={`Špaky — ${mena[p]}`}>
      {dlazdice.map((d) => (
        <div key={d.kluc} role="listitem" tabIndex={0} className={`zdroj bodova-dlazdica ${d.trieda}`} title={d.popis}>
          <span className="zdroj-nazov">{d.nazov}</span>
          <span className="zdroj-hodnota">
            <span className="velke-cislo">{d.hodnota}</span>
          </span>
          <span className="zdroj-pod">{d.pod}</span>
        </div>
      ))}
    </div>
  );
}
