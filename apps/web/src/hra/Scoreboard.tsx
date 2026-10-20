// Scoreboard nad panelom starších (Michal 2026-10-18): body po bodovacích
// milníkoch, nie po starších — hráč hneď vidí, kto má za čo koľko. Rozpis
// po starších ostáva v RozpisBodov.
//
// Michal 2026-10-19: väčšie písmo, názov v strede a body po stranách (ty
// vľavo, súper vpravo); prejdenie myšou ukáže, odkiaľ body idú.

import type { BodPodmienky, BodyTeraz, GameData, Podmienka, PlayerId } from "@naex/core";
import { KONSTANTY } from "@naex/core";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { vypocetPodmienky, znamienko } from "./Scorecard.tsx";

const PORADIE: readonly Podmienka[] = ["lokality", "starsi", "cigarety", "znepokojenie", "strach", "vydesenie", "dlh", "cirhoza"];

/** Za čo podmienka dáva kusy — prvý riadok popisu. */
const ZA_CO: Readonly<Record<Podmienka, string>> = {
  lokality: "Za každú ovládnutú lokalitu (vyhraná bitka o lokalitu).",
  starsi: "Za každého staršieho, ktorého si získal patronátom (vyhral si bitku, keď si ho mal v ruke).",
  cigarety: `Za každé ${KONSTANTY.CIGARIET_NA_KUS} cigarety, ktoré ti ostanú na konci hry.`,
  znepokojenie: "Za každého staršieho, ktorý sa ťa bojí aspoň na úrovni 1 (marker v žltej zóne na súperovej polovici).",
  strach: "Za každého staršieho, ktorý sa ťa bojí aspoň na úrovni 2 (oranžová zóna).",
  vydesenie: "Za každého vydeseného staršieho (červená krajná pozícia).",
  dlh: "Za každý nepriznaný Dlh v ruke a v balíčkoch — priznaním sa ho zbavíš.",
  cirhoza: "Za každú nepriznanú Cirhózu v ruke a v balíčkoch — priznaj ju.",
};

export interface ScoreboardProps {
  readonly body: BodyTeraz;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly menoSupera: string;
  /** Meno staršieho (karty na ukazovateli) podľa elderId — pre rozpis v popise. */
  readonly menoStarsieho: (elderId: string) => string;
}

interface Zdroj {
  /** Starší a pozícia podmienky na jeho scorecarde — tá istá podmienka môže byť aktívna dvakrát. */
  readonly kluc: string;
  readonly elderId: string;
  readonly polozky: readonly [BodPodmienky | null, BodPodmienky | null];
}

interface Milnik {
  readonly podmienka: Podmienka;
  readonly body: [number, number];
  readonly kusy: [number, number];
  /** Scorecardy, na ktorých je podmienka aktívna, a čo z nich má každý hráč. */
  readonly zdroje: Zdroj[];
}

export function Scoreboard({ body, data, ja, menoSupera, menoStarsieho }: ScoreboardProps) {
  const { tip, ukaz, skry } = useTip();
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const milniky = new Map<Podmienka, Milnik>();
  for (const s of body.starsi) {
    for (const p of [0, 1] as const) {
      for (const pol of s.polozky[p]) {
        const m = milniky.get(pol.podmienka) ?? { podmienka: pol.podmienka, body: [0, 0], kusy: [0, 0], zdroje: [] };
        m.body[p] += pol.body;
        // Kusy sú pre hráča rovnaké na každom scorecarde (lokality, strach…) — stačí najväčší.
        m.kusy[p] = Math.max(m.kusy[p], pol.kusy);
        const kluc = `${s.elderId}/${pol.strana}/${pol.index}`;
        const zdroj = m.zdroje.find((z) => z.kluc === kluc);
        if (zdroj === undefined) m.zdroje.push({ kluc, elderId: s.elderId, polozky: p === 0 ? [pol, null] : [null, pol] });
        else m.zdroje[m.zdroje.indexOf(zdroj)] = { ...zdroj, polozky: p === 0 ? [pol, zdroj.polozky[1]] : [zdroj.polozky[0], pol] };
        milniky.set(pol.podmienka, m);
      }
    }
  }
  const rad = PORADIE.map((p) => milniky.get(p)).filter((m): m is Milnik => m !== undefined);
  const neisteSuper = body.neiste[su];

  const popis = (m: Milnik): TipObsah => {
    const zaKus = data.bodyPodmienok[m.podmienka];
    const kliatba = m.podmienka === "dlh" || m.podmienka === "cirhoza";
    const vypocet = (pol: BodPodmienky | null): string => (pol === null ? "0" : vypocetPodmienky(pol, zaKus));
    return {
      nadpis: `${NAZOV_PODMIENKY[m.podmienka]} — ty ${znamienko(m.body[ja])}, ${menoSupera} ${znamienko(m.body[su])}${kliatba && neisteSuper ? "?" : ""}`,
      text: (
        <>
          {ZA_CO[m.podmienka]} {zaKus > 0 ? "+" : "−"}
          {Math.abs(zaKus)} za kus na každom scorecarde, kde je podmienka aktívna — teraz na{" "}
          {m.zdroje.length === 1 ? "jednom" : `${m.zdroje.length}`}. Boduje obom hráčom.
          {m.zdroje.map((z) => (
            <span key={z.kluc} className="tip-riadok">
              <b>{menoStarsieho(z.elderId)}:</b> ty {vypocet(z.polozky[ja])} · {menoSupera} {vypocet(z.polozky[su])}
            </span>
          ))}
          {kliatba && neisteSuper && (
            <span className="tip-stav">Súperove kliatby v ruke a balíčku nevidíš — jeho mínus môže byť ešte väčšie.</span>
          )}
        </>
      ),
    };
  };

  const strana = (kto: "ja" | "su", ks: number | null, b: number, neiste: boolean) => (
    <span className={`sb-strana sb-${kto}`} role="cell">
      <b>
        {znamienko(b)}
        {neiste ? "?" : ""}
      </b>
      {ks !== null && <small>{ks} ks</small>}
    </span>
  );

  return (
    <div className="scoreboard" role="table" aria-label="Body po bodovacích milníkoch, keby hra skončila teraz">
      {rad.length === 0 && <span className="sb-prazdny">Zatiaľ žiadny starší nemá aktívnu bodovaciu podmienku.</span>}
      {rad.map((m) => {
        const zaKus = data.bodyPodmienok[m.podmienka];
        const kliatba = m.podmienka === "dlh" || m.podmienka === "cirhoza";
        const vediem = m.body[ja] > m.body[su] ? "ja" : m.body[ja] < m.body[su] ? "su" : "";
        const obsah = popis(m);
        return (
          <div
            key={m.podmienka}
            className={`sb-milnik ${vediem}`}
            role="row"
            tabIndex={0}
            onMouseEnter={(e) => ukaz(e.currentTarget, obsah)}
            onMouseLeave={skry}
            onFocus={(e) => ukaz(e.currentTarget, obsah)}
            onBlur={skry}
          >
            {strana("ja", m.kusy[ja], m.body[ja], false)}
            <span className="sb-stred">
              <span className="sb-nazov" role="rowheader">
                {NAZOV_PODMIENKY[m.podmienka]}
              </span>
              <span className="sb-pravidlo">
                {m.zdroje.length}× · {zaKus > 0 ? "+" : "−"}
                {Math.abs(zaKus)} za kus
              </span>
            </span>
            {strana("su", m.kusy[su], m.body[su], kliatba && neisteSuper)}
          </div>
        );
      })}
      <div className={`sb-milnik sb-spolu ${body.spolu[ja] > body.spolu[su] ? "ja" : body.spolu[ja] < body.spolu[su] ? "su" : ""}`} role="row">
        {strana("ja", null, body.spolu[ja], false)}
        <span className="sb-stred">
          <span className="sb-nazov" role="rowheader">
            Spolu
          </span>
          <span className="sb-pravidlo">ty · {menoSupera}</span>
        </span>
        {strana("su", null, body.spolu[su], neisteSuper)}
      </div>
      {tip}
    </div>
  );
}
