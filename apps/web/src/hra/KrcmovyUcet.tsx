// Krčmový účet — záverečné bodovanie v detaile dohratej partie (Michal 2026-10-22,
// dizajn stol-oproti-c2-20261022-1030): ty vľavo, súper vpravo, v strede starší
// (v5) či podmienka (partie do v4, body za kusy). Papier sú obrátené tokeny.

import type { GameData, PlayerId, Podmienka } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { PORADIE_PODMIENOK, SMER_V5, ZA_CO, bodyPoPodmienkach, jeBodovanieV5, kohoBoduje, subojeStarsieho, type BodyPodmienky, type BodyTeraz } from "./bodyPodmienok.tsx";
import { znamienko } from "./Scorecard.tsx";

const JEDNOTKA: Readonly<Record<Podmienka, string>> = {
  lokality: "ks",
  starsi: "ks",
  cigarety: "ks",
  znepokojenie: "starších",
  strach: "starších",
  vydesenie: "starších",
  dlh: "ks",
  cirhoza: "ks",
  abstak: "ks",
  rezerva: "ks",
};

export interface KrcmovyUcetProps {
  readonly body: BodyTeraz;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly menoStarsieho: (elderId: string) => string;
  readonly kolo: number;
}

interface Riadok {
  readonly podmienka: Podmienka;
  readonly m: BodyPodmienky | undefined;
  /** Body za kus na všetkých scorecardoch, kde je podmienka aktívna. */
  readonly zaKus: number;
}

const trieda = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

/** Do v4 sa za podmienky bodovalo za kus — nápoveda starej partie (ZA_CO je už súboj v5). */
const ZA_V4: Readonly<Partial<Record<Podmienka, string>>> = {
  lokality: "Za každú ovládnutú lokalitu.",
  cigarety: "Za každé 3 cigarety na konci hry.",
  dlh: "Za každý Dlh, aj priznaný.",
  cirhoza: "Za každú nepriznanú Cirhózu.",
};

/**
 * Pravidlá v5: riadok za každého staršieho — koľko jeho súbojov kto vyhral a kto
 * za neho dostal body (pri rovnosti obaja).
 */
function UcetV5({ body, ja, mena, menoStarsieho, kolo }: KrcmovyUcetProps) {
  const kedy = `zatvorené po kole ${kolo}`;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const rozdiel = body.spolu[ja] - body.spolu[su];
  return (
    <section className="krcmovy-ucet" role="region" aria-label={`Účet — body, ${kedy}`}>
      <header className="ucet-hlava">
        <strong>Účet · {kedy}</strong>
      </header>
      <div className="ucet-mena">
        <span className="ucet-meno ja">{mena[ja]} (ty)</span>
        <span className="ucet-meno su">{mena[su]}</span>
      </div>
      <div className="ucet-tabulka" role="table">
        <div className="ucet-riadok ucet-zahlavie" role="row">
          <span>súboje</span>
          <span>body</span>
          <span className="ucet-stred">starší · body získa</span>
          <span>body</span>
          <span>súboje</span>
        </div>
        {body.starsi.map((s) => {
          const kto = kohoBoduje(s);
          const suboje = subojeStarsieho(s);
          const popis = suboje
            .map((x) => `${NAZOV_PODMIENKY[x.podmienka]} ${x.hodnoty[ja]} : ${x.hodnoty[su]}${x.vitaz === null ? " (rovnosť)" : x.vitaz === ja ? " (ty)" : ` (${mena[su]})`}`)
            .join(" · ");
          return (
            <div key={s.elderId} role="row" className="ucet-riadok" title={`${menoStarsieho(s.elderId)}: ${popis || "bez aktívnej podmienky"}`}>
              <span className="ucet-kusy">{s.vyhry[ja]} z {suboje.length}</span>
              <b className={`ucet-sucet ${trieda(s.body[ja])}`}>{znamienko(s.body[ja])}</b>
              <span className="ucet-stred">
                {menoStarsieho(s.elderId)}{" "}
                <span className="ucet-zakus">{kto === null ? "nikto" : kto === "obaja" ? "obaja" : kto === ja ? "ty" : mena[su]}</span>
              </span>
              <b className={`ucet-sucet ${trieda(s.body[su])}`}>{znamienko(s.body[su])}</b>
              <span className="ucet-kusy">{s.vyhry[su]} z {suboje.length}</span>
            </div>
          );
        })}
        <div className="ucet-riadok ucet-spolu" role="row">
          <span />
          <b className={`ucet-sucet ${trieda(body.spolu[ja])}`}>{znamienko(body.spolu[ja])}</b>
          <span className="ucet-stred">
            Spolu{" "}
            <span className={`ucet-peciatka ${rozdiel >= 0 ? "vedie" : "chyba"}`}>
              {rozdiel > 0 ? `výhra o ${rozdiel}` : rozdiel < 0 ? `prehra o ${-rozdiel}` : "remíza"}
            </span>
          </span>
          <b className={`ucet-sucet ${trieda(body.spolu[su])}`}>{znamienko(body.spolu[su])}</b>
          <span />
        </div>
      </div>
      <p className="ucet-pata">
        súboje = vyhraté aktívne podmienky staršieho · body za staršieho získa, kto ich vyhrá viac (rovnosť = obaja): 1 + zóny strachu, s
        priazňou či v strede 1
      </p>
    </section>
  );
}

export function KrcmovyUcet(props: KrcmovyUcetProps) {
  return jeBodovanieV5(props.body) ? <UcetV5 {...props} /> : <UcetV4 {...props} />;
}

/** Partie do v4: body za kusy po podmienkach (kusy × body × počet scorecardov). */
function UcetV4({ body, data, ja, mena, menoStarsieho, kolo }: KrcmovyUcetProps) {
  const kedy = `zatvorené po kole ${kolo}`;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const podmienky = bodyPoPodmienkach(body);
  const riadky: Riadok[] = PORADIE_PODMIENOK.map((podmienka) => {
    const m = podmienky.get(podmienka);
    return { podmienka, m, zaKus: SMER_V5[podmienka] * (m?.zdroje.length ?? 0) };
  });

  const kusy = (r: Riadok, p: PlayerId): string => `${r.m?.kusy[p] ?? 0} ${JEDNOTKA[r.podmienka]}`;
  const starsi = (r: Riadok): string =>
    r.m === undefined ? "nikde aktívna" : `zo starších: ${r.m.zdroje.map((z) => menoStarsieho(z.elderId)).join(", ")}`;
  const rozdiel = body.spolu[ja] - body.spolu[su];

  return (
    <section className="krcmovy-ucet" role="region" aria-label={`Účet — body, ${kedy}`}>
      <header className="ucet-hlava">
        <strong>Účet · {kedy}</strong>
      </header>
      <div className="ucet-mena">
        <span className="ucet-meno ja">{mena[ja]} (ty)</span>
        <span className="ucet-meno su">{mena[su]}</span>
      </div>
      <div className="ucet-tabulka" role="table">
        <div className="ucet-riadok ucet-zahlavie" role="row">
          <span>kusy</span>
          <span>súčet</span>
          <span className="ucet-stred">podmienka · za kus</span>
          <span>súčet</span>
          <span>kusy</span>
        </div>
        {riadky.map((r) => (
          <div
            key={r.podmienka}
            role="row"
            className={`ucet-riadok ${r.m === undefined ? "neaktivna" : ""}`}
            title={`${NAZOV_PODMIENKY[r.podmienka]}: ${ZA_V4[r.podmienka] ?? ZA_CO[r.podmienka]} ${starsi(r)}.`}
          >
            <span className="ucet-kusy">{kusy(r, ja)}</span>
            <b className={`ucet-sucet ${trieda(r.m?.body[ja] ?? 0)}`}>{znamienko(r.m?.body[ja] ?? 0)}</b>
            <span className="ucet-stred">
              {NAZOV_PODMIENKY[r.podmienka]} <span className="ucet-zakus">{r.m === undefined ? "—" : znamienko(r.zaKus)}</span>
            </span>
            <b className={`ucet-sucet ${trieda(r.m?.body[su] ?? 0)}`}>{znamienko(r.m?.body[su] ?? 0)}</b>
            <span className="ucet-kusy">{kusy(r, su)}</span>
          </div>
        ))}
        <div className="ucet-riadok ucet-spolu" role="row">
          <span />
          <b className={`ucet-sucet ${trieda(body.spolu[ja])}`}>{znamienko(body.spolu[ja])}</b>
          <span className="ucet-stred">
            Spolu{" "}
            <span className={`ucet-peciatka ${rozdiel >= 0 ? "vedie" : "chyba"}`}>
              {rozdiel > 0 ? `výhra o ${rozdiel}` : rozdiel < 0 ? `prehra o ${-rozdiel}` : "remíza"}
            </span>
          </span>
          <b className={`ucet-sucet ${trieda(body.spolu[su])}`}>{znamienko(body.spolu[su])}</b>
          <span />
        </div>
      </div>
      <p className="ucet-pata">za kus = body podmienky × počet scorecardov, kde je aktívna · súčet = kusy × za kus</p>
    </section>
  );
}
