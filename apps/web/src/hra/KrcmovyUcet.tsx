// Krčmový účet — záverečné bodovanie v detaile dohratej partie (Michal 2026-10-22,
// dizajn stol-oproti-c2-20261022-1030): ty vľavo, súper vpravo, v strede starší
// (v5) či podmienka (partie do v4, body za kusy). Papier sú obrátené tokeny.

import { opponentOf, type PlayerId, type Podmienka } from "@naex/core";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { PORADIE_PODMIENOK, SMER_V5, ZA_CO, bodyPoPodmienkach, jeBodovanieV5, kohoBoduje, subojeStarsieho, type BodyPodmienky, type BodyTeraz } from "./bodyPodmienok.tsx";
import { znamienko } from "./Scorecard.tsx";
import { t } from "../i18n/jazyk.tsx";

/** Jednotka kusov podmienky — kľúč v sk.json (krcmovyUcet.ks, krcmovyUcet.starsich). */
const JEDNOTKA: Readonly<Record<Podmienka, "ks" | "starsich">> = {
  lokality: "ks",
  starsi: "ks",
  cigarety: "ks",
  znepokojenie: "starsich",
  strach: "starsich",
  vydesenie: "starsich",
  dlh: "ks",
  cirhoza: "ks",
  abstak: "ks",
  rezerva: "ks",
};

export interface KrcmovyUcetProps {
  readonly body: BodyTeraz;
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
const ZA_V4: ReadonlySet<Podmienka> = new Set(["lokality", "cigarety", "dlh", "cirhoza"]);
const zaV4 = (p: Podmienka): string | undefined => (ZA_V4.has(p) ? t(`krcmovyUcet.zaV4.${p}`) : undefined);

/**
 * Pravidlá v5: riadok za každého staršieho — koľko jeho súbojov kto vyhral a kto
 * za neho dostal body (pri rovnosti obaja).
 */
function UcetV5({ body, ja, mena, menoStarsieho, kolo }: KrcmovyUcetProps) {
  const kedy = t("krcmovyUcet.zatvorene", { kolo });
  const su = opponentOf(ja);
  const rozdiel = body.spolu[ja] - body.spolu[su];
  return (
    <section className="krcmovy-ucet" role="region" aria-label={t("krcmovyUcet.aria", { kedy })}>
      <header className="ucet-hlava">
        <strong>{t("krcmovyUcet.hlava", { kedy })}</strong>
      </header>
      <div className="ucet-mena">
        <span className="ucet-meno ja">{t("krcmovyUcet.ty", { meno: mena[ja] })}</span>
        <span className="ucet-meno su">{mena[su]}</span>
      </div>
      <div className="ucet-tabulka" role="table">
        <div className="ucet-riadok ucet-zahlavie" role="row">
          <span>{t("krcmovyUcet.suboje")}</span>
          <span>{t("krcmovyUcet.body")}</span>
          <span className="ucet-stred">{t("krcmovyUcet.starsiBody")}</span>
          <span>{t("krcmovyUcet.body")}</span>
          <span>{t("krcmovyUcet.suboje")}</span>
        </div>
        {body.starsi.map((s) => {
          const kto = kohoBoduje(s);
          const suboje = subojeStarsieho(s);
          const popis = suboje
            .map((x) => `${NAZOV_PODMIENKY[x.podmienka]} ${x.hodnoty[ja]} : ${x.hodnoty[su]}${x.vitaz === null ? t("krcmovyUcet.rovnost") : x.vitaz === ja ? t("krcmovyUcet.tyZatvorka") : ` (${mena[su]})`}`)
            .join(" · ");
          return (
            <div key={s.elderId} role="row" className="ucet-riadok" title={`${menoStarsieho(s.elderId)}: ${popis || t("krcmovyUcet.bezPodmienky")}`}>
              <span className="ucet-kusy">{t("krcmovyUcet.zPoctu", { n: s.vyhry[ja], spolu: suboje.length })}</span>
              <b className={`ucet-sucet ${trieda(s.body[ja])}`}>{znamienko(s.body[ja])}</b>
              <span className="ucet-stred">
                {menoStarsieho(s.elderId)}{" "}
                <span className="ucet-zakus">{kto === null ? t("krcmovyUcet.nikto") : kto === "obaja" ? t("krcmovyUcet.obaja") : kto === ja ? t("krcmovyUcet.tyMale") : mena[su]}</span>
              </span>
              <b className={`ucet-sucet ${trieda(s.body[su])}`}>{znamienko(s.body[su])}</b>
              <span className="ucet-kusy">{t("krcmovyUcet.zPoctu", { n: s.vyhry[su], spolu: suboje.length })}</span>
            </div>
          );
        })}
        <div className="ucet-riadok ucet-spolu" role="row">
          <span />
          <b className={`ucet-sucet ${trieda(body.spolu[ja])}`}>{znamienko(body.spolu[ja])}</b>
          <span className="ucet-stred">
            {t("krcmovyUcet.spolu")}{" "}
            <span className={`ucet-peciatka ${rozdiel >= 0 ? "vedie" : "chyba"}`}>
              {rozdiel > 0 ? t("krcmovyUcet.vyhraO", { n: rozdiel }) : rozdiel < 0 ? t("krcmovyUcet.prehraO", { n: -rozdiel }) : t("krcmovyUcet.remiza")}
            </span>
          </span>
          <b className={`ucet-sucet ${trieda(body.spolu[su])}`}>{znamienko(body.spolu[su])}</b>
          <span />
        </div>
      </div>
      <p className="ucet-pata">{t("krcmovyUcet.pataV5")}</p>
    </section>
  );
}

export function KrcmovyUcet(props: KrcmovyUcetProps) {
  return jeBodovanieV5(props.body) ? <UcetV5 {...props} /> : <UcetV4 {...props} />;
}

/** Partie do v4: body za kusy po podmienkach (kusy × body × počet scorecardov). */
function UcetV4({ body, ja, mena, menoStarsieho, kolo }: KrcmovyUcetProps) {
  const kedy = t("krcmovyUcet.zatvorene", { kolo });
  const su = opponentOf(ja);
  const podmienky = bodyPoPodmienkach(body);
  const riadky: Riadok[] = PORADIE_PODMIENOK.map((podmienka) => {
    const m = podmienky.get(podmienka);
    return { podmienka, m, zaKus: SMER_V5[podmienka] * (m?.zdroje.length ?? 0) };
  });

  const kusy = (r: Riadok, p: PlayerId): string => `${r.m?.kusy[p] ?? 0} ${t(`krcmovyUcet.${JEDNOTKA[r.podmienka]}`)}`;
  const starsi = (r: Riadok): string =>
    r.m === undefined ? t("krcmovyUcet.nikdeAktivna") : t("krcmovyUcet.zoStarsich", { mena: r.m.zdroje.map((z) => menoStarsieho(z.elderId)).join(", ") });
  const rozdiel = body.spolu[ja] - body.spolu[su];

  return (
    <section className="krcmovy-ucet" role="region" aria-label={t("krcmovyUcet.aria", { kedy })}>
      <header className="ucet-hlava">
        <strong>{t("krcmovyUcet.hlava", { kedy })}</strong>
      </header>
      <div className="ucet-mena">
        <span className="ucet-meno ja">{t("krcmovyUcet.ty", { meno: mena[ja] })}</span>
        <span className="ucet-meno su">{mena[su]}</span>
      </div>
      <div className="ucet-tabulka" role="table">
        <div className="ucet-riadok ucet-zahlavie" role="row">
          <span>{t("krcmovyUcet.kusy")}</span>
          <span>{t("krcmovyUcet.sucet")}</span>
          <span className="ucet-stred">{t("krcmovyUcet.podmienkaZaKus")}</span>
          <span>{t("krcmovyUcet.sucet")}</span>
          <span>{t("krcmovyUcet.kusy")}</span>
        </div>
        {riadky.map((r) => (
          <div
            key={r.podmienka}
            role="row"
            className={`ucet-riadok ${r.m === undefined ? "neaktivna" : ""}`}
            title={`${NAZOV_PODMIENKY[r.podmienka]}: ${zaV4(r.podmienka) ?? ZA_CO[r.podmienka]} ${starsi(r)}.`}
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
            {t("krcmovyUcet.spolu")}{" "}
            <span className={`ucet-peciatka ${rozdiel >= 0 ? "vedie" : "chyba"}`}>
              {rozdiel > 0 ? t("krcmovyUcet.vyhraO", { n: rozdiel }) : rozdiel < 0 ? t("krcmovyUcet.prehraO", { n: -rozdiel }) : t("krcmovyUcet.remiza")}
            </span>
          </span>
          <b className={`ucet-sucet ${trieda(body.spolu[su])}`}>{znamienko(body.spolu[su])}</b>
          <span />
        </div>
      </div>
      <p className="ucet-pata">{t("krcmovyUcet.pataV4")}</p>
    </section>
  );
}
