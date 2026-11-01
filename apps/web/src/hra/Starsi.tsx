// Starší v rade dlaždíc (Michal 2026-10-27, dizajn spaky-starsi-20261027, S1 stupienky):
// dlaždica Starší ukáže na prvý pohľad, koľko starších dáva hráčovi priazeň (krígeľ)
// (stĺpček hore) a koľko sa ho bojí (stĺpček dole, špaky po vyhratej bitke); výška stĺpčeka
// je zóna, aby sa dala prečítať aj bez farieb. Klik prepne stôl na líniu starších
// a oba bary na bar starších — po dlaždici na každého staršieho: priazeň (účinok je v línii),
// alebo strach so špakmi, pokus o zajatie a posun od poslednej bitky. Odznak počíta väzňov (v9).

import type { CSSProperties } from "react";
import type { ClientState, ElderState, GameData, Klebety, MarkerPos, PlayerId } from "@naex/core";
import { KONSTANTY, STUPNICA_ZONY, favourStarsieho, klebetyKola, obavanyHrac, strachNaUdrzanie, strachNaVyplatu, vydesil, opponentOf } from "@naex/core";
import { farbaZony } from "./LiniaStarsich.tsx";
import { KruzokPriazne, ListokHadky, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { ktoPriazen, listokHadky, obsahNapovedy, pocetPriazniKola, priazenKola, riadokPriazneDlazdice } from "./priazenKola.ts";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
import { IkonaPriazne } from "./IkonaPriazne.tsx";
import { IkonaSpaku } from "./Spaky.tsx";
import { smerStarsieho, stupienkyStarsich } from "./spakyAStarsi.ts";
import { NAZOV_ZDROJA, riadokDlazdice, textStupna, titulStrachu, titulStrachuSpolu } from "./textyStarsich.ts";

export interface DlazdicaStarsichProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  /** Špaky od starších po najbližšej bitke, ak ju hráč vyhrá (spakyTeraz). */
  readonly zaStarsich: number;
  /** Strach, ktorý čaká na udržanie (v8.3) — zaplatí ho koniec ďalšieho kola. */
  readonly naUdrzanie: number;
  readonly starsi: {
    readonly stlacene: boolean;
    readonly prepni: () => void;
    readonly id: string;
    readonly posuny?: number;
    readonly suhrn?: SuhrnDlazdice | undefined;
  };
}

/**
 * Dlaždica počas súhrnu kola (mock 5): svieti, svetlo ide stĺpčekmi zľava doprava a stĺpček
 * zobrazeného staršieho sa mení spolu s markerom v bubline. Stĺpčeky sú starší zo začiatku kola.
 */
export interface SuhrnDlazdice {
  /** Marker, ktorý stĺpček práve ukazuje; null = starší je už väzeň. */
  readonly stlpce: readonly { readonly elderId: string; readonly marker: MarkerPos | null }[];
  /** Stĺpček pod svetlom. */
  readonly sken: string | null;
  /** Stĺpček, z ktorého vyskočila bublina. */
  readonly aktivny: string | null;
  /** Stĺpčeky, ktoré svetlo prešlo bez bubliny. */
  readonly preskoceni: ReadonlySet<string>;
}

export function DlazdicaStarsich({ view, p, zaStarsich, naUdrzanie, starsi }: DlazdicaStarsichProps) {
  const ja = p === view.ja;
  const suhrn = starsi.suhrn;
  const { strach, stlpce: stlpceTeraz } = stupienkyStarsich(view.starsi, p);
  // Priazne tohto kola (po hádke, Michal 2026-10-31); stĺpčeky ostávajú podľa markera (strach).
  const priazen = pocetPriazniKola(view.starsi, klebetyKola(view), p);
  const stlpce =
    suhrn === undefined
      ? stlpceTeraz
      : suhrn.stlpce.map((s) => (s.marker === null ? { elderId: s.elderId, smer: "vazen" as const, zona: 0 } : stupienkyStarsich([{ elderId: s.elderId, marker: s.marker }], p).stlpce[0]!));
  // Výkričníky pred špakmi za strach: najvyšší stupeň, v akom sa hráča niekto bojí (ako v línii).
  const najStrach = Math.max(0, ...stlpce.filter((s) => s.smer === "dole").map((s) => s.zona));
  const posuny = starsi.posuny ?? 0;
  // Väzni (v9): tretí vyhráva. Vydesení starší (stupeň 3) sú ciele pokusu o zajatie.
  const vyd = view.vazni.filter((v) => v.hrac === p).length;
  const prah = KONSTANTY.VAZNI_NA_VYHRU;
  const ciele = view.starsi.filter((e) => vydesil(e, p)).length;
  const desiHrozi = vyd >= prah - 1;
  const desiTitul =
    `Väzni: ${vyd} z ${prah}. Kto zajme tretieho staršieho, vyhrá.` +
    (ciele > 0 ? ` Na stupni 3 sa ${ja ? "ťa" : "ho"} bojí ${ciele} — ${ciele === 1 ? "toho" : "tých"} sa dá po šenku skúsiť zajať.` : "");
  return (
    <button
      type="button"
      className={`zdroj zdroj-starsi${starsi.stlacene ? " stlacene" : ""}${suhrn === undefined ? "" : " suhrn-ziari"}`}
      aria-pressed={starsi.stlacene}
      aria-controls={starsi.id}
      data-vyucba-prvok="starsi"
      title={
        starsi.stlacene
          ? "Späť na stôl (Esc)"
          : `Priazeň ${ja ? "ti" : "mu"} dáva ${priazen} z ${view.starsi.length} starších (stĺpček hore) — ich efekt ${ja ? "máš" : "má"}. ` +
            `${titulStrachuSpolu(strach, ja, zaStarsich, naUdrzanie)} Výška = stupeň. Klik ukáže starších.` +
            (posuny > 0 ? ` Od bitky sa pohlo starších: ${posuny}.` : "")
      }
      onClick={starsi.prepni}
    >
      <span className="zdroj-nazov">
        Starší {starsi.stlacene ? "▴" : "▾"}
        {!starsi.stlacene && posuny > 0 && <span className="zdroj-posuny">⇄ {posuny}</span>}
        {/* Na nízkom okne nie je riadok pod číslom — vydesení sú odznakom pri nadpise (hra.css). */}
        <span className={`starsi-desi${desiHrozi ? " hrozi" : ""}`} title={desiTitul}>
          {vyd}/{prah}
        </span>
      </span>
      <span className="zdroj-hodnota">
        <span className="velke-cislo starsi-priazen">
          <IkonaPriazne />
          {/* Počas súhrnu číslo ide so stĺpčekmi, nie dopredu. */}
          {suhrn === undefined ? priazen : stlpce.filter((s) => s.smer === "hore").length}
        </span>
        <span className="stupienky" aria-hidden="true">
          {stlpce.map((s) => (
            <i
              key={s.elderId}
              className={
                suhrn === undefined
                  ? s.smer
                  : `${s.smer}${suhrn.sken === s.elderId ? " sken" : ""}${suhrn.aktivny === s.elderId ? " aktivny" : ""}${suhrn.preskoceni.has(s.elderId) ? " sedy" : ""}`
              }
              style={{ "--zona": s.zona, "--farba-zony": farbaZony(s.zona) } as CSSProperties}
              data-suhrn-stlpcek={suhrn === undefined ? undefined : s.elderId}
            />
          ))}
        </span>
      </span>
      <span className="zdroj-pod">
        <span>
          {/* v8.3: strach platí za udržanie na konci kola; koľko starších sa bojí, ukazujú stĺpčeky dole a nápoveda (na 1366 sa oboje nezmestí). */}
          {strach > 0 && <ZnackaStrachu uroven={najStrach} trieda={ja ? "moje" : "superove"} />}
          {/* Ikona špakov hneď za číslom — na 1366–1440 sa riadok oreže na konci a ikona by odpadla. */}
          {strach === 0 ? (
            `nikto sa ${ja ? "ťa" : "ho"} nebojí`
          ) : zaStarsich > 0 ? (
            <>
              +{zaStarsich}
              <IkonaSpaku /> {riadokDlazdice("dole", ja)}
            </>
          ) : naUdrzanie > 0 ? (
            `+${naUdrzanie} ${riadokDlazdice("dole", ja, 0, naUdrzanie)}`
          ) : (
            riadokDlazdice("dole", ja, 0)
          )}
        </span>
        <span className={`starsi-desi-riadok${desiHrozi ? " hrozi" : ""}`} title={desiTitul}>
          väzni {vyd}/{prah}
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
  /** Meno súpera toho, kto sa pozerá (nápoveda, lístok Hádky). */
  readonly menoSupera: string;
}

/**
 * Bar starších (Michal 2026-10-27): pri každom staršom krúžok priazne tohto kola (Michal 2026-10-31 —
 * vždy, aj pri staršom, ktorý sa hráča bojí: vtedy vedľa neho špaky), krátke slovo pod ním
 * a lístok Hádky v rohu. Vety o priazni a strachu sú v nápovede.
 */
export function BarStarsich({ view, data, p, menoKarty, menoSupera }: BarStarsichProps) {
  const klebety = klebetyKola(view);
  return (
    <div className="bar-starsich" style={{ "--n": view.starsi.length } as CSSProperties} role="list" aria-label="Starší">
      {view.starsi.map((e) => (
        <DlazdicaStarsieho key={e.elderId} view={view} data={data} p={p} e={e} meno={menoKarty(e.karta.defId)} menoSupera={menoSupera} klebety={klebety} />
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
  klebety,
}: {
  readonly view: ClientState;
  readonly data: GameData;
  readonly p: PlayerId;
  readonly e: ElderState;
  readonly meno: string;
  readonly menoSupera: string;
  readonly klebety: Klebety | undefined;
}) {
  const ja = p === view.ja;
  const su = opponentOf(p);
  const smer = smerStarsieho(e, p);
  const zona = STUPNICA_ZONY[e.marker];
  // v8.3: udržané nezaplatené stupne (koniec kola) a nové, ktoré čakajú na udržanie.
  const strach = strachNaVyplatu(e, p);
  const caka = strachNaUdrzanie(e, p);
  const patron = view.pokusy[p]?.elderId === e.elderId ? p : view.pokusy[su]?.elderId === e.elderId ? su : null;
  const posuny = (view.posunyMarkerov ?? []).filter((x) => x.elderId === e.elderId);
  const fav = favourStarsieho(data, e);
  const pk = priazenKola(e, klebety, view.ja);
  const listok = listokHadky(e.elderId, klebety, view.ja);
  const mena: readonly [string, string] = view.ja === 0 ? ["ty", menoSupera] : [menoSupera, "ty"];
  const napoveda = useNapovedaStarsieho(
    () => {
      const o = obavanyHrac(e);
      return obsahNapovedy({
        data,
        elder: e,
        meno,
        klebety,
        ja: view.ja,
        mena,
        spaky: o === null ? 0 : strachNaVyplatu(e, o),
        naUdrzanie: o === null ? 0 : strachNaUdrzanie(e, o),
      });
    },
    { menoSupera },
  );
  // Pod krúžkom len krátke slovo; pokus o zajatie a posun ako značky v tom istom riadku.
  const riadok =
    patron !== null
      ? `v ohrození${patron === p ? "" : " (súper)"}`
      : smer === "dole"
        ? riadokDlazdice(smer, ja, strach, caka)
        : riadokPriazneDlazdice(pk.hrac, p, view.ja);
  const popis =
    `${meno}: priazeň v tomto kole ${ktoPriazen(pk, { ja: "ty", su: menoSupera })}. ` +
    (smer === "dole" ? titulStrachu(meno, ja, zona, strach, caka) : textStupna(zona) + ".") +
    (patron === null ? "" : ` V ohrození — zajať ho skúša ${patron === view.ja ? "ty" : "súper"}; v tomto kole sa nehýbe.`) +
    (posuny.length === 0 ? "" : ` Od bitky sa pohol ${posuny.length}× (${[...new Set(posuny.map((x) => NAZOV_ZDROJA[x.zdroj]))].join(", ")}).`);
  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`zdroj starsi-dlazdica ${smer}`}
      // Lístok Hádky v rohu berie miesto menu — meno sa zmenší, nech sa zmestí vedľa neho.
      style={{ "--znakov": meno.length + (listok !== null ? 3 : 0) } as CSSProperties}
      aria-label={popis}
      {...napoveda.props}
    >
      <span className="zdroj-nazov">
        <span className="starsi-meno">{meno}</span>
      </span>
      <span className="zdroj-hodnota">
        <KruzokPriazne fav={fav} p={pk} trieda="dl-kruzok" />
        {smer === "dole" && strach > 0 && (
          <span className="velke-cislo dl-spaky">
            +{strach}
            <IkonaSpaku />
          </span>
        )}
      </span>
      <span className="zdroj-pod">
        <span className="starsi-riadok">
          {/* Výkričníky len pri tom, kto sa hráča bojí — v jeho farbe. */}
          {smer === "dole" && <ZnackaStrachu uroven={zona} trieda={ja ? "moje" : "superove"} />}
          {riadok}
          {posuny.length > 0 && <span className="starsi-posun">⇄</span>}
        </span>
      </span>
      <ListokHadky listok={listok} menoSupera={menoSupera} roh />
      {napoveda.vrstva}
    </div>
  );
}
