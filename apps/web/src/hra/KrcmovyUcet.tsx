// Krčmový účet — rozpis bodov „keby sa teraz zatváralo“ (Michal 2026-10-22,
// dizajn stol-oproti-c2-20261022-1030). Hráč si v profile vyberie spoločný
// účet (ty vľavo, súper vpravo, podmienka v strede) alebo dva účty proti sebe
// (súperov vľavo, tvoj vpravo, čísla pri strednej osi). Leží ako vrstva cez
// starších, takže stôl pri otvorení neposkočí. Papier sú obrátené tokeny.

import { useState } from "react";
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
  readonly dva: boolean;
  readonly onZavri: () => void;
}

interface Riadok {
  readonly podmienka: Podmienka;
  readonly m: BodyPodmienky | undefined;
  /** Body za kus na všetkých scorecardoch, kde je podmienka aktívna. */
  readonly zaKus: number;
}

const trieda = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

export function KrcmovyUcet({ body, data, ja, mena, menoStarsieho, kolo, dva, onZavri }: KrcmovyUcetProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const podmienky = bodyPoPodmienkach(body);
  const riadky: Riadok[] = PORADIE_PODMIENOK.map((podmienka) => {
    const m = podmienky.get(podmienka);
    return { podmienka, m, zaKus: data.bodyPodmienok[podmienka] * (m?.zdroje.length ?? 0) };
  });
  // Prejdenie riadku zvýrazní ten istý riadok aj v druhom účte.
  const [nad, setNad] = useState<Podmienka | null>(null);

  const kusy = (r: Riadok, p: PlayerId): string => `${r.m?.kusy[p] ?? 0} ${JEDNOTKA[r.podmienka]}`;
  const starsi = (r: Riadok): string =>
    r.m === undefined ? "nikde aktívna" : `zo starších: ${r.m.zdroje.map((z) => menoStarsieho(z.elderId)).join(", ")}`;
  const titul = (r: Riadok): string => `${NAZOV_PODMIENKY[r.podmienka]}: ${ZA_CO[r.podmienka]} ${starsi(r)}.`;
  const peciatka = (p: PlayerId) => {
    const o: PlayerId = p === 0 ? 1 : 0;
    const rozdiel = body.spolu[p] - body.spolu[o];
    return (
      <span className={`ucet-peciatka ${rozdiel >= 0 ? "vedie" : "chyba"}`}>
        {rozdiel > 0 ? `vedie o ${rozdiel}` : rozdiel < 0 ? `chýba ${-rozdiel}` : "remíza"}
      </span>
    );
  };
  const hlavicka = (nazov: string, sKolom: boolean) => (
    <header className="ucet-hlava">
      <button type="button" className="ucet-spat" onClick={onZavri}>
        ← späť
      </button>
      <strong>{nazov}</strong>
      {sKolom && (
        <span className="ucet-pozn">
          kolo {kolo} · <kbd>Esc</kbd> zavrie
        </span>
      )}
    </header>
  );
  const riadokProps = (r: Riadok) => ({
    className: `ucet-riadok ${r.m === undefined ? "neaktivna" : ""} ${nad === r.podmienka ? "nad" : ""}`,
    title: titul(r),
    onMouseEnter: () => setNad(r.podmienka),
    onMouseLeave: () => setNad(null),
  });

  if (!dva) {
    return (
      <section className="krcmovy-ucet spolocny" role="dialog" aria-label="Účet — body, keby sa teraz zatváralo">
        {hlavicka("Účet · keby sa teraz zatváralo", true)}
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
            <div key={r.podmienka} role="row" {...riadokProps(r)}>
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
              Spolu {peciatka(ja)}
            </span>
            <b className={`ucet-sucet ${trieda(body.spolu[su])}`}>{znamienko(body.spolu[su])}</b>
            <span />
          </div>
        </div>
        <p className="ucet-pata">za kus = body podmienky × počet scorecardov, kde je aktívna · súčet = kusy × za kus</p>
      </section>
    );
  }

  // Dva účty: súperov vľavo, tvoj vpravo — čísla pri strednej osi.
  const papier = (p: PlayerId, zrkadlo: boolean) => (
    <div className={`ucet-papier ${p === ja ? "moj" : "superov"} ${zrkadlo ? "zrkadlo" : ""}`} role="table" aria-label={`Účet — ${mena[p]}`}>
      {hlavicka(`Účet · ${mena[p]}${p === ja ? " (ty)" : ""}`, p === ja)}
      <div className="ucet-riadok ucet-zahlavie" role="row">
        <span>podmienka</span>
        <span>kusy × za kus</span>
        <span>súčet</span>
      </div>
      {riadky.map((r) => (
        <div key={r.podmienka} role="row" {...riadokProps(r)}>
          <span className="ucet-nazov">{NAZOV_PODMIENKY[r.podmienka]}</span>
          <span className="ucet-kusy">
            {kusy(r, p)} × {r.m === undefined ? "—" : znamienko(r.zaKus)}
          </span>
          <b className={`ucet-sucet ${trieda(r.m?.body[p] ?? 0)}`}>{znamienko(r.m?.body[p] ?? 0)}</b>
        </div>
      ))}
      <div className="ucet-riadok ucet-spolu" role="row">
        <span className="ucet-nazov">Spolu</span>
        <span>{peciatka(p)}</span>
        <b className={`ucet-sucet ${trieda(body.spolu[p])}`}>{znamienko(body.spolu[p])}</b>
      </div>
    </div>
  );
  return (
    <section className="krcmovy-ucet dva" role="dialog" aria-label="Účty — body, keby sa teraz zatváralo">
      {papier(su, false)}
      {papier(ja, true)}
    </section>
  );
}
