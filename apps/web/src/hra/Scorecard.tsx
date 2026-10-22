// Ukazovateľ staršieho v hre: scorecard s kartou staršieho v rámčeku,
// markerom na stupnici a stavom bodovacích podmienok.
//
// Starší ležia pre oboch hráčov rovnako, nohami nadol (rozhodnutie Michala
// 2026-10-11). Pri bodovaní strany nemá (Michal 2026-10-16): každá aktívna
// podmienka boduje obom — odznak pri nej ukazuje, koľko z nej máš ty.

import type { CSSProperties, ReactNode } from "react";
import type { BodPodmienky, BodyStarsieho, ElderState, Favour, GameData, PlayerId, Podmienka } from "@naex/core";
import {
  KONSTANTY,
  STUPNICA_ZONY,
  favourStarsieho,
  obavanyHrac,
  podmienkyStarsieho,
  prebudenyPre,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
  urovenPodmienky,
} from "@naex/core";
import type { BodovaciaKarta, IkonaBodovania, Sada } from "@naex/tvorba";
import { geometriaBodovacej, PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import { BodovaciaSvg, type StavSlotuBodovania } from "../karta/BodovaciaSvg.tsx";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY, POZN_ZONOVYCH, popisPodmienky } from "../karta/podmienky.ts";
import { useTip } from "../karta/Tip.tsx";

const FARBA_AKTIVNA = "#5cc0cf";

/** „+4“, „−2“, „0“. */
export function znamienko(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

/** Výpočet jednej podmienky pre hráča: „2 starší × 2 = +4“. */
export function vypocetPodmienky(p: BodPodmienky, bodyZaKus: number): string {
  const kusy =
    urovenPodmienky(p.podmienka) !== null
      ? `${p.kusy} ${p.kusy === 1 ? "starší" : "starších"}`
      : `${p.kusy} ks`;
  return `${kusy} × ${bodyZaKus < 0 ? `−${-bodyZaKus}` : bodyZaKus} = ${znamienko(p.body)}`;
}

/** Vzhľad scorecardu zo sady; staršie sady ho nemajú — poskladá sa z herných dát. */
function vzhladScorecardu(sada: Sada, data: GameData, id: string): { karta: BodovaciaKarta; ikony: readonly IkonaBodovania[] } {
  const ikony = sada.ikonyBodovania ?? [];
  const ulozena = sada.bodovacie?.find((b) => b.id === id);
  if (ulozena !== undefined) return { karta: ulozena, ikony };
  const sc = data.scorecards.find((s) => s.id === id);
  const ikona = (p: Podmienka | null): string | null => (p === null ? null : (ikony.find((i) => i.podmienka === p)?.id ?? null));
  return {
    karta: {
      id,
      nazov: sc?.nazov ?? id,
      sirkaMm: PREDVOLENE_NASTAVENIA.sirkaMm,
      vyskaMm: PREDVOLENE_NASTAVENIA.vyskaMm,
      mierkaIkon: PREDVOLENE_NASTAVENIA.mierkaIkon,
      farba: null,
      pozadie: null,
      lava: (sc?.lava ?? []).map(ikona),
      prava: (sc?.prava ?? []).map(ikona),
      upravene: 0,
    },
    ikony,
  };
}

export interface ScorecardProps {
  readonly elder: ElderState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly ja: PlayerId;
  /** Šírka scorecardu v px. */
  readonly sirka: number;
  /** Karta staršieho v rámčeku danej šírky. */
  readonly karta: (sirka: number) => ReactNode;
  readonly onClick?: (() => void) | undefined;
  /** Živý odhad bodov tohto scorecardu (bodyTeraz) — odznaky pri podmienkach. */
  readonly body?: BodyStarsieho | undefined;
}

export function Scorecard({ elder, data, sada, ja, sirka, karta, onClick, body }: ScorecardProps) {
  const { tip, ukaz, skry } = useTip();
  const { karta: bk, ikony } = vzhladScorecardu(sada, data, elder.scorecard);
  const g = geometriaBodovacej(bk);
  const mierka = sirka / g.sirka;
  const o = g.odtlacok;
  const su = (ja === 0 ? 1 : 0) as PlayerId;

  const podmienky = podmienkyStarsieho(data, elder);
  const stavPodmienky = (strana: "lava" | "prava", i: number) => podmienky.find((p) => p.strana === strana && p.index === i);
  const bodyPre = (p: PlayerId, strana: "lava" | "prava", i: number): BodPodmienky | undefined =>
    body?.polozky[p].find((x) => x.strana === strana && x.index === i);
  const stavSlotu = (strana: "lava" | "prava", i: number): StavSlotuBodovania | null => {
    const p = stavPodmienky(strana, i);
    if (p === undefined) return null;
    if (!p.aktivna) return { stav: "neaktivna", farba: FARBA_AKTIVNA };
    return { stav: (bodyPre(ja, strana, i)?.body ?? 0) !== 0 ? "plati" : "aktivna", farba: FARBA_AKTIVNA };
  };

  const pct = (v: number, z: number): string => `${(v / z) * 100}%`;

  return (
    <div
      className={`scorecard${onClick !== undefined ? " klikatelny" : ""}`}
      style={{ width: sirka } as CSSProperties}
      onClick={onClick}
      role={onClick !== undefined ? "button" : undefined}
      tabIndex={onClick !== undefined ? 0 : undefined}
      onKeyDown={onClick !== undefined ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      {/* Zrkadlenie (Michal 2026-10-22, #55): každý vidí svoju polovicu stupnice na svojej strane
          (ako svoju stranu línie) — hráčovi 2 sa poloha markera obráti. Zóny sú súmerné. */}
      <BodovaciaSvg karta={bk} ikony={ikony} sirka={sirka} marker={ja === 0 ? elder.marker : 8 - elder.marker} stavSlotu={stavSlotu} nahlad />
      <div className="scorecard-karta" style={{ left: pct(o.x, g.sirka), top: pct(o.y, g.vyska), width: pct(o.w, g.sirka) }}>
        {karta(o.w * mierka)}
      </div>
      {/* Tooltipy podmienok — rovnaké ako pri akciách kariet. */}
      {(["lava", "prava"] as const).flatMap((strana) =>
        (strana === "lava" ? g.slotyLave : g.slotyPrave).map((r, i) => {
          const p = stavPodmienky(strana, i);
          if (p === undefined) return null;
          const bodyZaKus = data.bodyPodmienok[p.podmienka];
          const moje = bodyPre(ja, strana, i);
          const jeho = bodyPre(su, strana, i);
          const obsah = {
            nadpis: NAZOV_PODMIENKY[p.podmienka],
            ikona: (
              <span className="tip-ikona-ram tip-ikona-svetla">
                <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
              </span>
            ),
            text: (
              <>
                {popisPodmienky(p.podmienka, bodyZaKus)}
                {urovenPodmienky(p.podmienka) !== null && <span className="tip-stav">{POZN_ZONOVYCH}</span>}
                {!p.aktivna ? (
                  <span className="tip-stav">Neaktívna — karta staršieho tu nemá akciu, neboduje nikomu.</span>
                ) : (
                  <span className="tip-stav">
                    Aktívna — boduje obom. Keby hra skončila teraz: <b>ty {moje === undefined ? "0" : vypocetPodmienky(moje, bodyZaKus)}</b>
                    {" · "}súper {jeho === undefined ? "0" : vypocetPodmienky(jeho, bodyZaKus)}
                  </span>
                )}
              </>
            ),
          };
          return (
            <span
              key={`${strana}${i}`}
              className="scorecard-slot"
              style={{ left: pct(r.x, g.sirka), top: pct(r.y, g.vyska), width: pct(r.w, g.sirka), height: pct(r.h, g.vyska) }}
              onMouseEnter={(e) => ukaz(e.currentTarget, obsah)}
              onMouseLeave={skry}
            >
              {p.aktivna && moje !== undefined && (
                <span className={`scorecard-odznak ${strana} ${moje.body > 0 ? "plus" : moje.body < 0 ? "minus" : "nula"}`} style={{ fontSize: Math.max(9, r.h * mierka * 0.42) }}>
                  {znamienko(moje.body)}
                </span>
              )}
            </span>
          );
        }),
      )}
      {tip}
    </div>
  );
}

/**
 * Čo priazeň danej sily (1 / 2 / 3) dáva — bonus je NASOBOK_PRIAZNE × sila
 * (Michal 2026-10-16: dvojnásobný účinok). PRAVIDLA §9.
 */
export const UCINOK_PRIAZNE: Readonly<Record<Favour, (sila: number) => string>> = {
  // Michal 2026-10-20: Úžerník nahradil Zberateľa — prah Dlhu + sila (bez dvojnásobku).
  UZERNIK: (s) => `Prah Dlhu ${KONSTANTY.PRAH_DLHU_ZAKLAD + s} namiesto ${KONSTANTY.PRAH_DLHU_ZAKLAD} — Dlh dostaneš neskôr.`,
  // Michal 2026-10-18: Trocha a Zopár zmizli — Lakomec zlacní barter, Neprajník pustí Povery nad priznané Dlhy.
  LAKOMEC: (s) => `Stokársky barter (nový poldeci) za ${KONSTANTY.BARTER_CENA - s} cigariet namiesto ${KONSTANTY.BARTER_CENA}.`,
  NEPRAJNIK: (s) => `Tvoje Povery smú dať mäkké poškodenie o ${bonus(s)} viac, než má súper priznaných Dlhov.`,
  BITKAR: (s) => `+${bonus(s)} tuhého poškodenia v každej bitke.`,
  // Michal 2026-10-20: Viera navyše rovná sile — predtým vyššia hodnota každej Viery (dve Viery = štít 10).
  VERIACI: (s) => `+${s} ${s === 1 ? "Viera" : "Viery"} v každej bitke (ruší súperove Povery a uberá jeho tuhé poškodenie).`,
  // Michal 2026-10-19: cigarety platia šenok aj Dedičstvo — Fajčiar dáva silu, bez dvojnásobku.
  FAJCIAR: (s) => `+${s} ${s === 1 ? "cigareta" : "cigarety"} v prvej Pitke bitky o lokalitu.`,
  ALKOHOLIK: (s) => `Prah Cirhózy ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD + bonus(s)} namiesto ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD} — Cirhózu dostaneš neskôr.`,
  EXEKUTOR: (s) => `Prah Exekútora ${KONSTANTY.PRAH_EXEKUTORA_ZAKLAD + 2 * bonus(s)} namiesto ${KONSTANTY.PRAH_EXEKUTORA_ZAKLAD}.`,
};

/** Bonus priazne danej sily (Michal 2026-10-16: dvojnásobný účinok). */
function bonus(sila: number): number {
  return KONSTANTY.NASOBOK_PRIAZNE * sila;
}

/**
 * Popis staršieho pod scorecardom: PRIAZEŇ (počas hry) má hráč, ku ktorému
 * je marker posunutý, a BOJÍ SA toho druhého — ten strach sa ráta do
 * zónových podmienok všetkých scorecardov. BODY dáva scorecard obom hráčom.
 */
export function StavStarsieho({
  elder,
  data,
  ja,
  meno,
  body,
  akcia,
}: {
  readonly elder: ElderState;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly meno: string;
  /** Živý odhad bodov tohto staršieho (bodyTeraz). */
  readonly body: BodyStarsieho | undefined;
  readonly akcia?: string | undefined;
}) {
  const { tip, ukaz, skry } = useTip();
  const priazen = priazenHraca(elder);
  const sila = priazenSila(elder);
  const prebudeny = prebudenyPre(elder);
  const sc = scorecardStarsieho(data, elder);
  const favour = favourStarsieho(data, elder);
  const obavany = obavanyHrac(elder);
  const kto = (p: PlayerId) => (p === ja ? "teba" : "súpera");

  const tipPriazne = {
    nadpis: `Priazeň: ${sc.nazov}`,
    text: (
      <>
        {priazen === null
          ? `Marker je v strede — priazeň nemá nikto. Kto ho dostane na svoju polovicu, získa: ${UCINOK_PRIAZNE[favour](1)} Ďalej od stredu silnejšie — sila 2: ${UCINOK_PRIAZNE[favour](2)} Sila 3: ${UCINOK_PRIAZNE[favour](3)}`
          : `${priazen === ja ? "Máš" : "Súper má"} priazeň sily ${sila}: ${UCINOK_PRIAZNE[favour](sila)}`}
        <span className="tip-stav">Priazeň má ten, ku komu je marker posunutý. Platí počas hry, nie sú to body.</span>
      </>
    ),
  };
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  const uroven = obavany === null ? 0 : STUPNICA_ZONY[elder.marker];
  const rozpis = (p: PlayerId): ReactNode => {
    const polozky = body?.polozky[p] ?? [];
    if (polozky.length === 0) return "žiadna aktívna podmienka";
    return polozky.map((x) => `${NAZOV_PODMIENKY[x.podmienka]}: ${vypocetPodmienky(x, data.bodyPodmienok[x.podmienka])}`).join(" · ");
  };
  const tipBodov = {
    nadpis: `Body zo scorecardu ${meno}`,
    text: (
      <>
        Každá aktívna podmienka boduje obom hráčom — bez ohľadu na to, koho sa {meno} bojí. Keby hra skončila teraz:
        <span className="tip-stav">
          <b>Ty {znamienko(body?.body[ja] ?? 0)}</b> — {rozpis(ja)}
        </span>
        <span className="tip-stav">
          Súper {znamienko(body?.body[su] ?? 0)} — {rozpis(su)}
        </span>
        <span className="tip-stav">
          {obavany === null
            ? `${meno} sa nebojí nikoho — zónovým podmienkam nepridáva nič.`
            : `${meno} sa bojí ${kto(obavany)} (úroveň ${uroven}) — ráta sa to do Znepokojenia, Strachu a Vydesenia na všetkých scorecardoch.`}
        </span>
      </>
    ),
  };

  return (
    <div className="scorecard-stav">
      <strong>{meno}</strong>
      {elder.nahradeny && (
        <span className="znacka" title="Na ukazovateli leží náhrada. Scorecard hrá ďalej (marker, priazeň, body), len do ruky si ho už nikto nevezme (patronát).">
          náhrada
        </span>
      )}
      <span
        className={`starsi-riadok priazen ${priazen === null ? "" : priazen === ja ? "moja" : "superova"}`}
        onMouseEnter={(e) => ukaz(e.currentTarget, tipPriazne)}
        onMouseLeave={skry}
      >
        <span aria-hidden="true">♥</span> {sc.nazov}
        {priazen === null ? " · nikto" : ` +${sila} · ${priazen === ja ? "tvoja" : "súperova"}`}
      </span>
      <span className="starsi-riadok strach" onMouseEnter={(e) => ukaz(e.currentTarget, tipBodov)} onMouseLeave={skry}>
        <span aria-hidden="true">★</span> <b className="moje">ty {znamienko(body?.body[ja] ?? 0)}</b> · súper {znamienko(body?.body[su] ?? 0)}
      </span>
      {obavany !== null && (
        <span className={`starsi-riadok boji-sa ${obavany === ja ? "moja" : "superova"}`}>
          bojí sa {kto(obavany)} · úroveň {uroven}
        </span>
      )}
      {prebudeny !== null && <span className={prebudeny === ja ? "dobry" : "zly"}>prebudený pre {kto(prebudeny)}</span>}
      {akcia !== undefined && <span className="starsi-akcia">{akcia}</span>}
      {tip}
    </div>
  );
}
