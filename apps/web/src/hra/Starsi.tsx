// Starší v rade dlaždíc (Michal 2026-10-27, dizajn spaky-starsi-20261027, S1 stupienky; v11
// Strach a reči 2026-11-02): dlaždica Starší ukáže na prvý pohľad, koľko starších dáva hráčovi
// priazeň (krígeľ, stĺpček hore) a koľko sa ho bojí (stĺpček dole), a stav okamžitých výhier —
// červené x/4 a väzni x/N. Klik prepne stôl na líniu starších (Teplomery, Pult) a oba bary na
// bar starších — po dlaždici na každého staršieho: priazeň, strach a reči hráča.

import type { CSSProperties } from "react";
import type { ClientState, ElderState, GameData, PlayerId } from "@naex/core";
import { favourStarsieho, spakyOdStarsieho } from "@naex/core";
import { farbaZony } from "./LiniaStarsich.tsx";
import { KruzokPriazne, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { ktoPriazen, obsahNapovedy, pocetPriazniKola, priazenKola, riadokPriazneDlazdice, textMarkerov } from "./priazenKola.ts";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
import { IkonaPriazne } from "./IkonaPriazne.tsx";
import { IkonaSpaku } from "./Spaky.tsx";
import { smerStarsieho, stupienkyStarsich } from "./spakyAStarsi.ts";
import { NAZOV_ZDROJA, riadokDlazdice } from "./textyStarsich.ts";
import { textCervenych } from "./vyhraStrachom.ts";
import { t } from "../i18n/jazyk.tsx";

export interface DlazdicaStarsichProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  /** Špaky od starších po najbližšej bitke, keď ju hráč vyhrá (spakyTeraz). */
  readonly zaStarsich: number;
  /** … keď ju prehrá (len reči). */
  readonly zaStarsichPrehra: number;
  readonly starsi: {
    readonly stlacene: boolean;
    readonly prepni: () => void;
    readonly id: string;
    readonly posuny?: number;
  };
}

export function DlazdicaStarsich({ view, p, zaStarsich, zaStarsichPrehra, starsi }: DlazdicaStarsichProps) {
  const ja = p === view.ja;
  const { strach, stlpce } = stupienkyStarsich(view.starsi, p);
  const priazen = pocetPriazniKola(view.starsi, p);
  // Výkričníky pred špakmi: najvyšší strach hráča pri niektorom staršom.
  const najStrach = Math.max(0, ...view.starsi.map((e) => e.strach[p]));
  const posuny = starsi.posuny ?? 0;
  // Okamžité výhry (v11): červené strachy (väzni sa rátajú) a väzni — obe len vo vyhratej bitke.
  const v = view.vyhry;
  const cervene = v.cervene[p];
  const vazni = v.vazni[p];
  const hrozi = cervene >= v.cervenychNaVyhru - 1 || vazni >= v.vazniNaVyhru - 1;
  const tc = textCervenych(cervene, vazni, v.cervenychNaVyhru);
  const titulVyhier = t("starsi.titulVyhier", { titul: tc.titul, vazni, naVyhru: v.vazniNaVyhru, cervenych: v.cervenychNaVyhru });
  return (
    <button
      type="button"
      className={`zdroj zdroj-starsi${starsi.stlacene ? " stlacene" : ""}`}
      aria-pressed={starsi.stlacene}
      aria-controls={starsi.id}
      data-vyucba-prvok="starsi"
      title={
        starsi.stlacene
          ? t("starsi.spatNaStol")
          : (ja
              ? t("starsi.titulJa", { priazen, z: view.starsi.length, strach, vyhra: zaStarsich, prehra: zaStarsichPrehra, vyhry: titulVyhier })
              : t("starsi.titulSu", { priazen, z: view.starsi.length, strach, vyhra: zaStarsich, prehra: zaStarsichPrehra, vyhry: titulVyhier })) +
            (posuny > 0 ? t("starsi.zmenyMarkerov", { n: posuny }) : "")
      }
      onClick={starsi.prepni}
    >
      <span className="zdroj-nazov">
        {t("starsi.nazov")} {starsi.stlacene ? "▴" : "▾"}
        {!starsi.stlacene && posuny > 0 && <span className="zdroj-posuny">⇄ {posuny}</span>}
        {/* Na nízkom okne nie je riadok pod číslom — stav výhier je odznakom pri nadpise (hra.css). */}
        <span className={`starsi-desi${hrozi ? " hrozi" : ""}`} title={titulVyhier}>
          {tc.odznak}
        </span>
      </span>
      <span className="zdroj-hodnota">
        <span className="velke-cislo starsi-priazen">
          <IkonaPriazne />
          {priazen}
        </span>
        <span className="stupienky" aria-hidden="true">
          {stlpce.map((s) => (
            <i
              key={s.elderId}
              className={s.smer}
              style={{ "--zona": s.zona, "--farba-zony": farbaZony(s.zona) } as CSSProperties}
            />
          ))}
        </span>
      </span>
      <span className="zdroj-pod">
        <span>
          {strach > 0 && <ZnackaStrachu uroven={najStrach} trieda={ja ? "moje" : "superove"} />}
          {/* Ikona špakov hneď za číslom — na 1366–1440 sa riadok oreže na konci a ikona by odpadla. */}
          {strach === 0 && zaStarsich === 0 ? (
            ja ? t("starsi.niktoTa") : t("starsi.niktoHo")
          ) : (
            <>
              +{zaStarsich}
              <IkonaSpaku /> {t("starsi.poVyhre")}
            </>
          )}
        </span>
        <span className={`starsi-desi-riadok${hrozi ? " hrozi" : ""}`} title={titulVyhier}>
          {t("starsi.cervene")} {tc.kratko} · {vazni > 0 ? "⛓" : t("starsi.vazni")} {vazni}/{v.vazniNaVyhru}
        </span>
      </span>
    </button>
  );
}

export interface BarStarsichProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly p: PlayerId;
  readonly menoKarty: (defId: string) => string;
  /** Meno súpera toho, kto sa pozerá (nápoveda). */
  readonly menoSupera: string;
  readonly mena?: readonly [string, string] | undefined;
}

/**
 * Bar starších (Michal 2026-10-27): pri každom staršom krúžok priazne (Michal 2026-10-31 —
 * vždy), špaky, ktoré hráčovi dá po vyhratej bitke, a krátke slovo pod ním. Vety sú v nápovede.
 */
export function BarStarsich({ view, data, p, menoKarty, menoSupera, mena }: BarStarsichProps) {
  return (
    <div className="bar-starsich" style={{ "--n": view.starsi.length } as CSSProperties} role="list" aria-label={t("starsi.nazov")}>
      {view.starsi.map((e) => (
        <DlazdicaStarsieho key={e.elderId} view={view} data={data} p={p} e={e} meno={menoKarty(e.karta.defId)} menoSupera={menoSupera} mena={mena} />
      ))}
    </div>
  );
}

function DlazdicaStarsieho({
  view,
  data,
  p,
  e,
  meno,
  menoSupera,
  mena: menaHracov,
}: {
  readonly view: ClientState;
  readonly data: GameData;
  readonly p: PlayerId;
  readonly e: ElderState;
  readonly meno: string;
  readonly menoSupera: string;
  readonly mena?: readonly [string, string] | undefined;
}) {
  const ja = p === view.ja;
  const smer = smerStarsieho(e, p);
  const vyhra = spakyOdStarsieho(e, p, true);
  // Presvedčený (v11.4): kto ho presvedčil — verejné, pri staršom.
  const presvedcil = e.presvedcil ?? null;
  const zmeny = view.zmenyMarkerov.filter((x) => x.elderId === e.elderId);
  const fav = favourStarsieho(data, e);
  const pk = priazenKola(e, view.ja);
  const ty = t("stol.ty");
  const mena: readonly [string, string] = menaHracov ?? (view.ja === 0 ? [ty, menoSupera] : [menoSupera, ty]);
  const napoveda = useNapovedaStarsieho(() => obsahNapovedy({ data, elder: e, meno, ja: view.ja, mena }));
  const riadok = presvedcil !== null ? (presvedcil === p ? t("starsi.presvedceny") : t("starsi.presvedcenySuperom")) : smer === "dole" ? riadokDlazdice(smer, ja) : riadokPriazneDlazdice(pk.hrac, p, view.ja);
  const popis =
    t("starsi.popis", { meno, kto: ktoPriazen(pk, { ja: ty, su: menoSupera }), hrac: ja ? t("starsi.Ty") : menoSupera, markery: textMarkerov(e.strach[p], e.reci[p]), vyhra }) +
    (presvedcil === null ? "" : presvedcil === view.ja ? t("starsi.presvedcilTy") : t("starsi.presvedcilSuper")) +
    (zmeny.length === 0 ? "" : t("starsi.zmenyOdBitky", { n: zmeny.length, zdroje: [...new Set(zmeny.map((x) => NAZOV_ZDROJA[x.zdroj]))].join(", ") }));
  return (
    <div role="listitem" tabIndex={0} className={`zdroj starsi-dlazdica ${smer}`} style={{ "--znakov": meno.length } as CSSProperties} aria-label={popis} {...napoveda.props}>
      <span className="zdroj-nazov">
        <span className="starsi-meno">{meno}</span>
      </span>
      <span className="zdroj-hodnota">
        <KruzokPriazne fav={fav} p={pk} trieda="dl-kruzok" />
        {vyhra > 0 && (
          <span className="velke-cislo dl-spaky">
            +{vyhra}
            <IkonaSpaku />
          </span>
        )}
      </span>
      <span className="zdroj-pod">
        <span className="starsi-riadok">
          {/* Výkričníky len pri tom, kto sa hráča bojí — v jeho farbe. */}
          {e.strach[p] > 0 && <ZnackaStrachu uroven={e.strach[p]} trieda={ja ? "moje" : "superove"} />}
          {riadok}
          {zmeny.length > 0 && <span className="starsi-posun">⇄</span>}
        </span>
      </span>
      {napoveda.vrstva}
    </div>
  );
}
