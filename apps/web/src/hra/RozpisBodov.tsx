// Rozpis bodov po scorecardoch a podmienkach — počas hry („keby hra skončila
// teraz“) aj na konci. Michal 2026-10-16: hráč musí jednoznačne vidieť, koľko
// má za ktorú bodovaciu podmienku ktorého staršieho.

import type { BodyTeraz, ElderState, GameData, PlayerId } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { vypocetPodmienky, znamienko } from "./Scorecard.tsx";

export interface RozpisBodovProps {
  readonly body: BodyTeraz;
  readonly starsi: readonly ElderState[];
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  readonly menoKarty: (defId: string) => string;
  readonly nadpis: string;
}

export function RozpisBodov({ body, starsi, data, ja, menoSupera, menoKarty, nadpis }: RozpisBodovProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const riadky = body.starsi.flatMap((s) => {
    const elder = starsi.find((e) => e.elderId === s.elderId);
    const meno = elder === undefined ? s.elderId : menoKarty(elder.karta.defId);
    return s.polozky[ja].map((moja, i) => ({ kluc: `${s.elderId}-${i}`, meno, prvy: i === 0, pocet: s.polozky[ja].length, moja, jeho: s.polozky[su][i], neiste: s.neiste }));
  });
  if (riadky.length === 0) return <p className="tlmene">Žiadny starší nemá aktívnu bodovaciu podmienku.</p>;
  return (
    <table className="rozpis-bodov">
      <caption>{nadpis}</caption>
      <thead>
        <tr>
          <th scope="col">starší</th>
          <th scope="col">podmienka</th>
          <th scope="col" className="moje">ty</th>
          <th scope="col" className="superove">{menoSupera}</th>
        </tr>
      </thead>
      <tbody>
        {riadky.map((r) => {
          const zaKus = data.bodyPodmienok[r.moja.podmienka];
          const kliatba = r.moja.podmienka === "dlh" || r.moja.podmienka === "cirhoza";
          return (
            <tr key={r.kluc} className={r.prvy ? "prvy" : ""}>
              {r.prvy && (
                <th scope="row" rowSpan={r.pocet}>
                  {r.meno}
                </th>
              )}
              <td>{NAZOV_PODMIENKY[r.moja.podmienka]}</td>
              <td className={`cislo moje ${r.moja.body > 0 ? "plus" : r.moja.body < 0 ? "minus" : ""}`} title={vypocetPodmienky(r.moja, zaKus)}>
                <b>{znamienko(r.moja.body)}</b> <small>{vypocetPodmienky(r.moja, zaKus).split(" =")[0]}</small>
              </td>
              <td className="cislo superove" title={r.jeho === undefined ? undefined : vypocetPodmienky(r.jeho, zaKus)}>
                {r.jeho === undefined ? "0" : znamienko(r.jeho.body)}
                {r.neiste && kliatba ? "?" : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2}>
            spolu
          </th>
          <td className="cislo moje">
            <b>{body.spolu[ja]}</b>
          </td>
          <td className="cislo superove">
            {body.spolu[su]}
            {body.neiste[su] ? "?" : ""}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
