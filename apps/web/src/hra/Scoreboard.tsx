// Scoreboard nad panelom starších (Michal 2026-10-18): body po bodovacích
// milníkoch, nie po starších — hráč hneď vidí, kto má za čo koľko. Rozpis
// po starších ostáva v RozpisBodov.

import type { BodyTeraz, GameData, Podmienka, PlayerId } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { znamienko } from "./Scorecard.tsx";

const PORADIE: readonly Podmienka[] = ["lokality", "starsi", "cigarety", "znepokojenie", "strach", "vydesenie", "dlh", "cirhoza"];

export interface ScoreboardProps {
  readonly body: BodyTeraz;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly menoSupera: string;
}

interface Milnik {
  readonly podmienka: Podmienka;
  /** Na koľkých scorecardoch je podmienka aktívna. */
  readonly aktivna: number;
  readonly body: [number, number];
  readonly kusy: [number, number];
}

export function Scoreboard({ body, data, ja, menoSupera }: ScoreboardProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const milniky = new Map<Podmienka, Milnik>();
  for (const s of body.starsi) {
    for (const p of [0, 1] as const) {
      for (const pol of s.polozky[p]) {
        const m = milniky.get(pol.podmienka) ?? { podmienka: pol.podmienka, aktivna: 0, body: [0, 0], kusy: [0, 0] };
        m.body[p] += pol.body;
        // Kusy sú pre hráča rovnaké na každom scorecarde (lokality, strach…) — stačí najväčší.
        m.kusy[p] = Math.max(m.kusy[p], pol.kusy);
        milniky.set(pol.podmienka, p === 0 ? { ...m, aktivna: m.aktivna + 1 } : m);
      }
    }
  }
  const rad = PORADIE.map((p) => milniky.get(p)).filter((m): m is Milnik => m !== undefined);
  const neisteSuper = body.neiste[su];

  return (
    <div className="scoreboard" role="table" aria-label="Body po bodovacích milníkoch, keby hra skončila teraz">
      {rad.length === 0 && <span className="sb-prazdny">Zatiaľ žiadny starší nemá aktívnu bodovaciu podmienku.</span>}
      {rad.map((m) => {
        const zaKus = data.bodyPodmienok[m.podmienka];
        const kliatba = m.podmienka === "dlh" || m.podmienka === "cirhoza";
        const vediem = m.body[ja] > m.body[su] ? "ja" : m.body[ja] < m.body[su] ? "su" : "";
        return (
          <div key={m.podmienka} className={`sb-milnik ${vediem}`} role="row">
            <span className="sb-nazov" role="rowheader">
              {NAZOV_PODMIENKY[m.podmienka]}
            </span>
            <span className="sb-pravidlo" title="Na koľkých scorecardoch je podmienka aktívna a koľko dáva za kus">
              {m.aktivna}× · {zaKus > 0 ? "+" : "−"}
              {Math.abs(zaKus)} za kus
            </span>
            <span className="sb-hraci">
              <span className="sb-ja" role="cell" title={`ty: ${m.kusy[ja]} ks`}>
                ty <small>{m.kusy[ja]} ks</small> <b>{znamienko(m.body[ja])}</b>
              </span>
              <span className="sb-su" role="cell" title={`${menoSupera}: ${m.kusy[su]} ks`}>
                {menoSupera} <small>{m.kusy[su]} ks</small>{" "}
                <b>
                  {znamienko(m.body[su])}
                  {kliatba && neisteSuper ? "?" : ""}
                </b>
              </span>
            </span>
          </div>
        );
      })}
      <div className={`sb-milnik sb-spolu ${body.spolu[ja] > body.spolu[su] ? "ja" : body.spolu[ja] < body.spolu[su] ? "su" : ""}`} role="row">
        <span className="sb-nazov" role="rowheader">
          Spolu
        </span>
        <span className="sb-pravidlo">keby hra skončila teraz</span>
        <span className="sb-hraci">
          <span className="sb-ja" role="cell">
            ty <b>{body.spolu[ja]}</b>
          </span>
          <span className="sb-su" role="cell">
            {menoSupera}{" "}
            <b>
              {body.spolu[su]}
              {neisteSuper ? "?" : ""}
            </b>
          </span>
        </span>
      </div>
    </div>
  );
}
