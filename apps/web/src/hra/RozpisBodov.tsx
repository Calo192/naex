// Rozpis bodov po starších — záverečné vyúčtovanie na konci hry. Michal 2026-10-16:
// hráč musí jednoznačne vidieť, za čo má body. Pravidlá v5 (davka.md): pri každom
// staršom súboj podmienka po podmienke; body za staršieho získa, kto ich vyhrá viac
// (1 + zóny strachu, s priazňou či v strede 1), pri rovnosti obaja. Jeden riadok na
// staršieho — celé vyúčtovanie sa zmestí aj na nízky notebook.

import type { BodyTeraz, ElderState, GameData, PlayerId } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { KRATKO_PODMIENKA } from "./BodovyBar.tsx";
import { jednotka, kohoBoduje, preco, subojeStarsieho } from "./bodyPodmienok.tsx";
import { znamienko } from "./Scorecard.tsx";

export interface RozpisBodovProps {
  readonly body: BodyTeraz;
  readonly starsi: readonly ElderState[];
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  readonly menoKarty: (defId: string) => string;
  readonly nadpis: string;
}

export function RozpisBodov({ body, starsi, ja, menoSupera, menoKarty, nadpis }: RozpisBodovProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  if (body.starsi.length === 0) return <p className="tlmene">V hre nie sú žiadni starší.</p>;
  const kto = (p: PlayerId): string => (p === ja ? "ty" : menoSupera);
  return (
    <table className="rozpis-bodov rozpis-v5">
      <caption>{nadpis}</caption>
      <thead>
        <tr>
          <th scope="col">starší</th>
          <th scope="col">
            súboje <span className="moje">ty</span> : <span className="superove">{menoSupera}</span>
          </th>
          <th scope="col" className="cislo moje">
            ty
          </th>
          <th scope="col" className="cislo superove">
            {menoSupera}
          </th>
        </tr>
      </thead>
      <tbody>
        {body.starsi.map((s) => {
          const elder = starsi.find((e) => e.elderId === s.elderId);
          const meno = elder === undefined ? s.elderId : menoKarty(elder.karta.defId);
          const zisk = kohoBoduje(s);
          return (
            <tr key={s.elderId} className="prvy">
              <th scope="row">
                {meno}
                <small className="rozpis-skore">
                  {s.vyhry[ja]} : {s.vyhry[su]}
                  {zisk === "obaja" ? " · rovnosť" : ""}
                </small>
              </th>
              <td className="rozpis-suboje">
                {subojeStarsieho(s).map((x) => (
                  <span
                    key={x.kluc}
                    className={`rozpis-suboj ${x.vitaz === null ? "remiza" : x.vitaz === ja ? "moje" : "superove"}`}
                    title={`${NAZOV_PODMIENKY[x.podmienka]}: ty ${x.hodnoty[ja]} · ${menoSupera} ${x.hodnoty[su]} ${jednotka(x.podmienka, x.hodnoty[su])} → ${x.vitaz === null ? "rovnosť, nevyhrá nikto" : `vyhráva ${kto(x.vitaz)}`}`}
                  >
                    {KRATKO_PODMIENKA[x.podmienka]}{" "}
                    <b className={x.vitaz === ja ? "vyhral" : undefined}>{x.hodnoty[ja]}</b>:<b className={x.vitaz === su ? "vyhral" : undefined}>{x.hodnoty[su]}</b>
                  </span>
                ))}
                {s.polozky[0].length === 0 && <span className="tlmene">bez aktívnej podmienky — rovnosť</span>}
              </td>
              {([ja, su] as const).map((p) => (
                <td
                  key={p}
                  className={`cislo ${p === ja ? "moje" : "superove"} ${s.body[p] > 0 ? "plus" : ""}`}
                  title={s.body[p] > 0 && elder !== undefined ? `${kto(p)}: ${preco(elder, p)}` : undefined}
                >
                  <b>{znamienko(s.body[p])}</b>
                  {s.body[p] > 0 && elder !== undefined && <small className="rozpis-preco">({preco(elder, p)})</small>}
                </td>
              ))}
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
          <td className="cislo superove">{body.spolu[su]}</td>
        </tr>
      </tfoot>
    </table>
  );
}
