// Starší v rade dlaždíc (Michal 2026-10-27, dizajn spaky-starsi-20261027, S1 stupienky):
// dlaždica Starší ukáže na prvý pohľad, koľko starších dáva hráčovi priazeň (krígeľ)
// (stĺpček hore) a koľko sa ho bojí (stĺpček dole, špaky po vyhratej bitke); výška stĺpčeka
// je zóna, aby sa dala prečítať aj bez farieb. Klik prepne stôl na líniu starších
// a oba bary na bar starších — po dlaždici na každého staršieho: priazeň (účinok je v línii),
// alebo strach so špakmi, patronát a posun od poslednej bitky.

import type { CSSProperties } from "react";
import type { ClientState, GameData, PlayerId } from "@naex/core";
import { STUPNICA_ZONY, priazenSila, strachNaUdrzanie, strachNaVyplatu, prahVydesenia, vydesil } from "@naex/core";
import { farbaZony, ucinokPriazne } from "./LiniaStarsich.tsx";
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
  readonly starsi: { readonly stlacene: boolean; readonly prepni: () => void; readonly id: string; readonly posuny?: number };
}

export function DlazdicaStarsich({ view, p, zaStarsich, naUdrzanie, starsi }: DlazdicaStarsichProps) {
  const ja = p === view.ja;
  const { priazen, strach, stlpce } = stupienkyStarsich(view.starsi, p);
  // Výkričníky pred špakmi za strach: najvyšší stupeň, v akom sa hráča niekto bojí (ako v línii).
  const najStrach = Math.max(0, ...stlpce.filter((s) => s.smer === "dole").map((s) => s.zona));
  const posuny = starsi.posuny ?? 0;
  // Vydesení (Michal 2026-10-27, dizajn timeline-lista A): z osi do dlaždice — každému jeho číslo.
  const vyd = view.starsi.filter((e) => vydesil(e, p)).length;
  const prah = prahVydesenia(view);
  const desiHrozi = vyd >= prah - 1;
  // Ohlásené vydesenie (toast na stole zmizne) drží odznak: svieti a titulok povie, do kedy.
  const ohlasene = view.koniec === null ? view.ohlaseneVydesenie[p] : null;
  const desiTitul =
    `Vydesení starší: ${vyd} z ${prah}. Kto vydesí ${prah} starších (stupeň 3, krajná červená) a udrží ich do konca ďalšieho kola, vyhrá.` +
    (ohlasene === null ? "" : ` Ohlásené: ak ich ${ja ? "udržíš" : "udrží"} do konca kola ${ohlasene + 1}, ${ja ? "vyhráš" : "vyhrá"}.`);
  return (
    <button
      type="button"
      className={`zdroj zdroj-starsi${starsi.stlacene ? " stlacene" : ""}`}
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
          {priazen}
        </span>
        <span className="stupienky" aria-hidden="true">
          {stlpce.map((s) => (
            <i key={s.elderId} className={s.smer} style={{ "--zona": s.zona, "--farba-zony": farbaZony(s.zona) } as CSSProperties} />
          ))}
        </span>
      </span>
      <span className="zdroj-pod">
        <span>
          {/* v8.3: strach platí za udržanie na konci kola; koľko starších sa bojí, ukazujú stĺpčeky dole a nápoveda (na 1366 sa oboje nezmestí). */}
          {strach > 0 && <ZnackaStrachu uroven={najStrach} trieda={ja ? "moje" : "superove"} />}
          {strach === 0
            ? `nikto sa ${ja ? "ťa" : "ho"} nebojí`
            : zaStarsich > 0
              ? `+${zaStarsich} ${riadokDlazdice("dole", ja)}`
              : naUdrzanie > 0
                ? `+${naUdrzanie} ${riadokDlazdice("dole", ja, 0, naUdrzanie)}`
                : riadokDlazdice("dole", ja, 0)}
          {strach > 0 && zaStarsich > 0 && <IkonaSpaku />}
        </span>
        <span className={`starsi-desi-riadok${desiHrozi ? " hrozi" : ""}`} title={desiTitul}>
          vydesení {vyd}/{prah}
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
}

/** Bar starších (Michal 2026-10-27): kto hráčovi prejavuje akú priazeň, kto sa ho bojí, kto mu dáva špaky. */
export function BarStarsich({ view, data, p, menoKarty }: BarStarsichProps) {
  const ja = p === view.ja;
  const su: PlayerId = p === 0 ? 1 : 0;
  return (
    <div className="bar-starsich" style={{ "--n": view.starsi.length } as CSSProperties} role="list" aria-label="Starší">
      {view.starsi.map((e) => {
        const smer = smerStarsieho(e, p);
        const zona = STUPNICA_ZONY[e.marker];
        const meno = menoKarty(e.karta.defId);
        const ucinok = ucinokPriazne(data, e);
        // v8.3: udržané nezaplatené stupne (koniec kola) a nové, ktoré čakajú na udržanie.
        const strach = strachNaVyplatu(e, p);
        const caka = strachNaUdrzanie(e, p);
        const patron = view.patronat[p]?.elderId === e.elderId ? p : view.patronat[su]?.elderId === e.elderId ? su : null;
        const posuny = (view.posunyMarkerov ?? []).filter((x) => x.elderId === e.elderId);
        const hodnota =
          smer === "hore" ? (
            <span className="velke-cislo">
              <IkonaPriazne />+{priazenSila(e)}
            </span>
          ) : smer === "dole" ? (
            <span className="velke-cislo">
              +{strach}
              <IkonaSpaku />
            </span>
          ) : (
            <span className="velke-cislo nic">—</span>
          );
        // Účinok priazne a koho sa bojí ukazuje línia nad barom (Michal 2026-10-28: dlaždica
        // nemusí opakovať panel) — tu len krátke slovo; patrón a posun ako značky v tom istom riadku.
        const riadok = patron !== null ? `patrón${patron === p ? "" : " súpera"}` : riadokDlazdice(smer, ja, strach, caka);
        const popis =
          smer === "hore"
            ? `${meno}: ${ucinok.cely}. ${textStupna(zona)}.`
            : smer === "dole"
              ? `${titulStrachu(meno, ja, zona, strach, caka)} Priazeň má súper — ${ucinok.cely}.`
              : `${meno} je v strede, priazeň nemá nikto. ${ucinok.cely}.`;
        return (
          <div
            key={e.elderId}
            role="listitem"
            tabIndex={0}
            className={`zdroj starsi-dlazdica ${smer}`}
            style={{ "--znakov": meno.length } as CSSProperties}
            title={
              popis +
              (patron === null ? "" : ` Patrón: ${patron === view.ja ? "ty" : "súper"}.`) +
              (posuny.length === 0 ? "" : ` Od bitky sa pohol ${posuny.length}× (${[...new Set(posuny.map((x) => NAZOV_ZDROJA[x.zdroj]))].join(", ")}).`)
            }
          >
            <span className="zdroj-nazov">
              <span className="starsi-meno">{meno}</span>
            </span>
            <span className="zdroj-hodnota">{hodnota}</span>
            <span className="zdroj-pod">
              <span className="starsi-riadok">
                {/* Výkričníky len pri tom, kto sa hráča bojí — v jeho farbe; priazeň nesie krígeľ v čísle. */}
                {smer === "dole" && <ZnackaStrachu uroven={zona} trieda={ja ? "moje" : "superove"} />}
                {riadok}
                {posuny.length > 0 && <span className="starsi-posun">⇄</span>}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
