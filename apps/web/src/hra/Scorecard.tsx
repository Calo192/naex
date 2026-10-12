// Ukazovateľ staršieho v hre: scorecard s kartou staršieho v rámčeku,
// markerom na stupnici a stavom bodovacích podmienok.
//
// Starší ležia pre oboch hráčov rovnako, nohami nadol (rozhodnutie Michala
// 2026-10-11) — ľavá strana scorecardu patrí hráčovi 0, pravá hráčovi 1.
// Ktorá je tvoja, ukazuje farba zvýraznenia a popis nad radom starších.

import type { CSSProperties, ReactNode } from "react";
import type { BodyStarsieho, ElderState, Favour, GameData, PlayerId, Podmienka } from "@naex/core";
import {
  KONSTANTY,
  STUPNICA_ZONY,
  favourStarsieho,
  obavanyHrac,
  podmienkyStarsieho,
  prahPodmienky,
  prebudenyPre,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
} from "@naex/core";
import type { BodovaciaKarta, IkonaBodovania, Sada } from "@naex/tvorba";
import { geometriaBodovacej, PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import { BodovaciaSvg, type StavSlotuBodovania } from "../karta/BodovaciaSvg.tsx";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY, popisPodmienky } from "../karta/podmienky.ts";
import { useTip } from "../karta/Tip.tsx";

const FARBA_JA = "#5cc0cf";
const FARBA_SUPER = "#e0805f";

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
}

export function Scorecard({ elder, data, sada, ja, sirka, karta, onClick }: ScorecardProps) {
  const { tip, ukaz, skry } = useTip();
  const { karta: bk, ikony } = vzhladScorecardu(sada, data, elder.scorecard);
  const g = geometriaBodovacej(bk);
  const mierka = sirka / g.sirka;
  const o = g.odtlacok;

  const obavany = obavanyHrac(elder);
  const zona = STUPNICA_ZONY[elder.marker];
  const podmienky = podmienkyStarsieho(data, elder);
  const stavPodmienky = (strana: "lava" | "prava", i: number) => podmienky.find((p) => p.strana === strana && p.index === i);
  const stavSlotu = (strana: "lava" | "prava", i: number): StavSlotuBodovania | null => {
    const p = stavPodmienky(strana, i);
    if (p === undefined) return null;
    const farba = p.hrac === ja ? FARBA_JA : FARBA_SUPER;
    if (!p.aktivna) return { stav: "neaktivna", farba };
    return { stav: obavany === p.hrac && zona >= prahPodmienky(p.podmienka) ? "plati" : "aktivna", farba };
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
      <BodovaciaSvg karta={bk} ikony={ikony} sirka={sirka} marker={elder.marker} stavSlotu={stavSlotu} />
      <div className="scorecard-karta" style={{ left: pct(o.x, g.sirka), top: pct(o.y, g.vyska), width: pct(o.w, g.sirka) }}>
        {karta(o.w * mierka)}
      </div>
      {/* Tooltipy podmienok — rovnaké ako pri akciách kariet. */}
      {(["lava", "prava"] as const).flatMap((strana) =>
        (strana === "lava" ? g.slotyLave : g.slotyPrave).map((r, i) => {
          const p = stavPodmienky(strana, i);
          if (p === undefined) return null;
          const st = stavSlotu(strana, i);
          const komu = p.hrac === ja ? "Tvoja strana" : "Súperova strana";
          const stav = !p.aktivna
            ? "Neaktívna — karta staršieho tu nemá akciu."
            : st?.stav === "plati"
              ? "Aktívna a teraz by bodovala."
              : obavany === p.hrac
                ? `Aktívna — boduje, keď bude marker aspoň v ${["", "žltej", "oranžovej", "červenej"][prahPodmienky(p.podmienka)]} zóne.`
                : "Aktívna — boduje, ak sa ťa starší bude báť.";
          const obsah = {
            nadpis: NAZOV_PODMIENKY[p.podmienka],
            ikona: (
              <span className="tip-ikona-ram tip-ikona-svetla">
                <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
              </span>
            ),
            text: (
              <>
                {popisPodmienky(p.podmienka, data.bodyPodmienok[p.podmienka])}
                <span className="tip-stav">
                  {komu} · {stav}
                </span>
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
            />
          );
        }),
      )}
      {tip}
    </div>
  );
}

/** Čo priazeň daného druhu dáva — pri sile 1 alebo 2 (PRAVIDLA §9). */
export const UCINOK_PRIAZNE: Readonly<Record<Favour, (sila: number) => string>> = {
  ZBERATEL: (s) => `Limit ruky na konci kola ${KONSTANTY.LIMIT_RUKY_ZAKLAD + s} namiesto ${KONSTANTY.LIMIT_RUKY_ZAKLAD}.`,
  LAKOMEC: (s) => `„Trocha“ v efektoch kariet je ${1 + s} namiesto 1.`,
  NEPRAJNIK: (s) => `„Zopár“ v efektoch kariet je ${2 + s} namiesto 2.`,
  BITKAR: (s) => `+${s} tuhého poškodenia v každej bitke.`,
  VERIACI: (s) => `Tvoja Viera má hodnotu ${1 + s} namiesto 1.`,
  FAJCIAR: (s) => `+${s} Cigaretiek v prvej Pitke bitky o lokalitu.`,
  ALKOHOLIK: (s) => `Prah Cirhózy ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD + s} namiesto ${KONSTANTY.PRAH_CIRHOZY_ZAKLAD} — Cirhózu dostaneš neskôr.`,
  EXEKUTOR: (s) => `Prah Exekútora ${10 + 2 * s} namiesto 10.`,
};

/**
 * Popis staršieho pod scorecardom — dve veci, ktoré sa nesmú pliesť:
 * PRIAZEŇ (počas hry) má hráč, ku ktorému je marker posunutý; BOJÍ SA toho
 * druhého a na konci hry boduje len ten, koho sa bojí.
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
          ? `Marker je v strede — priazeň nemá nikto. Kto ho dostane na svoju polovicu, získa: ${UCINOK_PRIAZNE[favour](1)} (ďalej od stredu: ${UCINOK_PRIAZNE[favour](2)})`
          : `${priazen === ja ? "Máš" : "Súper má"} priazeň sily ${sila}: ${UCINOK_PRIAZNE[favour](sila)}`}
        <span className="tip-stav">Priazeň má ten, ku komu je marker posunutý. Platí počas hry, nie sú to body.</span>
      </>
    ),
  };
  const bodyText =
    obavany === null
      ? "Nikoho sa nebojí (marker v sivej zóne) — na konci by tu nebodoval nikto."
      : `Bojí sa ${kto(obavany)} — na konci hry tu boduje len ${obavany === ja ? "ty" : "súper"}, podmienkami na ${obavany === ja ? "tvojej" : "jeho"} strane scorecardu.`;
  const polozky = (body?.polozky ?? []).map((p) => `${NAZOV_PODMIENKY[p.podmienka]} ${p.body > 0 ? "+" : ""}${p.body}`).join(", ");
  const tipStrachu = {
    nadpis: obavany === null ? "Strach: nikto" : `Strach: bojí sa ${kto(obavany)}`,
    text: (
      <>
        {bodyText}
        {obavany !== null && (
          <span className="tip-stav">
            Keby hra skončila teraz: {body?.body ?? 0} b. {polozky !== "" ? `(${polozky})` : "— žiadna jeho podmienka neplatí"}
            {body?.neiste === true ? " · súperove skryté Dlhy a Cirhózy môžu body ešte znížiť" : ""}
          </span>
        )}
      </>
    ),
  };

  return (
    <div className="scorecard-stav">
      <strong>{meno}</strong>
      {elder.nahradeny && (
        <span className="znacka tlmeny" title="Na ukazovateli leží náhrada. Scorecard hrá ďalej (marker, priazeň, body), len o neho sa už bojovať nedá.">
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
      <span
        className={`starsi-riadok strach ${obavany === null ? "" : obavany === ja ? "moja" : "superova"}`}
        onMouseEnter={(e) => ukaz(e.currentTarget, tipStrachu)}
        onMouseLeave={skry}
      >
        {obavany === null ? (
          "body: nikto"
        ) : (
          <>
            <span aria-hidden="true">★</span> {obavany === ja ? "tvoje body" : "body súpera"} {body?.body ?? 0}
            {body?.neiste === true ? "?" : ""}
          </>
        )}
      </span>
      {prebudeny !== null && <span className={prebudeny === ja ? "dobry" : "zly"}>prebudený pre {kto(prebudeny)}</span>}
      {akcia !== undefined && <span className="starsi-akcia">{akcia}</span>}
      {tip}
    </div>
  );
}
