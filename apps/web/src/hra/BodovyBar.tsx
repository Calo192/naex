// Bodový bar (Michal 2026-10-23; v6 špaky, Michal 2026-10-26): po kliku na
// Body ukáže stôl líniu starších a oba bary hráčov sa prepnú zo zdrojov na
// špaky — koľko ich hráč má, koľko mu dajú starší po bitke a odhad do konca
// hry. Bodovacie podmienky v6 nie sú; popolník a nástenku kreslí UI v6.

import type { CSSProperties } from "react";
import type { ElderState, GameData, Podmienka, PlayerId, SpakyTeraz } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";

export interface BodovyBarProps {
  /** Čí bar — špaky tohto hráča. */
  readonly p: PlayerId;
  readonly data: GameData;
  readonly starsi: readonly ElderState[];
  readonly body: SpakyTeraz;
  readonly ikony: readonly IkonaBodovania[];
  readonly mena: readonly [string, string];
  /** Meno staršieho (karta na ukazovateli) do nápovedy. */
  readonly menoStarsieho: (e: ElderState) => string;
  readonly zvyraznena: Podmienka | null;
  readonly zvyrazni: (p: Podmienka | null) => void;
}

export function BodovyBar({ p, body, mena }: BodovyBarProps) {
  const dlazdice = [
    { kluc: "spaky", nazov: "Špaky", hodnota: body.spaky[p], pod: "v popolníku", popis: `Špaky hráča ${mena[p]} teraz.` },
    {
      kluc: "starsi",
      nazov: "Po bitke",
      hodnota: body.zaStarsich[p],
      pod: "od starších",
      popis: "Koľko špakov dajú starší, ktorí sa hráča boja, po najbližšej bitke (žltá 1, oranžová 2, červená 3).",
    },
    {
      kluc: "cirhoza",
      nazov: "Cirhóza",
      hodnota: -body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU,
      pod: `${body.cirhozy[p]} nepriznaných`,
      popis: `Nepriznaná Cirhóza stojí na konci hry ${KONSTANTY.SPAKY_ZA_CIRHOZU} špakov za kus (ruka aj oba balíčky).`,
    },
    {
      kluc: "odhad",
      nazov: "Odhad",
      hodnota: body.odhad[p],
      pod: `ešte ${body.vyplat}× starší`,
      popis: "Odhad konečných špakov, keby sa markery už nepohli: špaky − Cirhózy + starší × bitky, ktoré ešte prídu. Bitky samotné nerátá.",
    },
  ];
  return (
    <div className="bodovy-bar" style={{ "--n": dlazdice.length } as CSSProperties} role="list" aria-label={`Špaky — ${mena[p]}`}>
      {dlazdice.map((d) => (
        <div key={d.kluc} role="listitem" tabIndex={0} className={`zdroj bodova-dlazdica ${d.hodnota > 0 ? "plus" : d.hodnota < 0 ? "minus" : ""}`} title={d.popis}>
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
