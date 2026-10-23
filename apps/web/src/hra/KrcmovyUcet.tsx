// Krčmový účet — záverečné bodovanie v detaile dohratej partie (Michal 2026-10-22,
// dizajn stol-oproti-c2-20261022-1030): ty vľavo, súper vpravo, podmienka v strede.
// Počas partie ostali len dlaždice v bare (roadmapa #70). Papier sú obrátené tokeny.

import type { BodyTeraz, GameData, PlayerId, Podmienka } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { PORADIE_PODMIENOK, ZA_CO, bodyPoPodmienkach, type BodyPodmienky } from "./bodyPodmienok.tsx";
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

export function KrcmovyUcet({ body, data, ja, mena, menoStarsieho, kolo }: KrcmovyUcetProps) {
  const kedy = `zatvorené po kole ${kolo}`;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const podmienky = bodyPoPodmienkach(body);
  const riadky: Riadok[] = PORADIE_PODMIENOK.map((podmienka) => {
    const m = podmienky.get(podmienka);
    return { podmienka, m, zaKus: data.bodyPodmienok[podmienka] * (m?.zdroje.length ?? 0) };
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
            title={`${NAZOV_PODMIENKY[r.podmienka]}: ${ZA_CO[r.podmienka]} ${starsi(r)}.`}
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
