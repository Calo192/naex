// Starší v rade dlaždíc (Michal 2026-10-27, dizajn spaky-starsi-20261027, S1 stupienky):
// dlaždica Starší ukáže na prvý pohľad, koľko starších dáva hráčovi priazeň ♥
// (stĺpček hore) a koľko sa ho bojí (stĺpček dole, špaky po bitke); výška stĺpčeka
// je zóna, aby sa dala prečítať aj bez farieb. Klik prepne stôl na líniu starších
// a oba bary na bar starších — po dlaždici na každého staršieho: priazeň s efektom,
// alebo strach so špakmi, patronát a posun od poslednej bitky.

import type { CSSProperties } from "react";
import type { ClientState, GameData, PlayerId } from "@naex/core";
import { NAZVY_ZON, STUPNICA_ZONY, priazenSila, strachZ } from "@naex/core";
import { farbaZony, ucinokPriazne } from "./LiniaStarsich.tsx";
import { IkonaSpaku } from "./Spaky.tsx";
import { smerStarsieho, stupienkyStarsich } from "./spakyAStarsi.ts";

export interface DlazdicaStarsichProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  /** Špaky od starších po najbližšej bitke (spakyTeraz). */
  readonly zaStarsich: number;
  readonly starsi: { readonly stlacene: boolean; readonly prepni: () => void; readonly id: string; readonly posuny?: number };
}

export function DlazdicaStarsich({ view, p, zaStarsich, starsi }: DlazdicaStarsichProps) {
  const ja = p === view.ja;
  const { priazen, strach, stlpce } = stupienkyStarsich(view.starsi, p);
  const posuny = starsi.posuny ?? 0;
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
          : `Priazeň ♥ ${ja ? "ti" : "mu"} dáva ${priazen} z ${view.starsi.length} starších (stĺpček hore) — ich efekt ${ja ? "máš" : "má"}. ` +
            `${strach} sa ${ja ? "ťa" : "ho"} bojí (stĺpček dole): po bitke +${zaStarsich} špakov. Výška = zóna. Klik ukáže starších.` +
            (posuny > 0 ? ` Od bitky sa pohlo starších: ${posuny}.` : "")
      }
      onClick={starsi.prepni}
    >
      <span className="zdroj-nazov">
        Starší {starsi.stlacene ? "▴" : "▾"}
        {!starsi.stlacene && posuny > 0 && <span className="zdroj-posuny">⇄ {posuny}</span>}
      </span>
      <span className="zdroj-hodnota">
        <span className="velke-cislo starsi-priazen">♥{priazen}</span>
        <span className="stupienky" aria-hidden="true">
          {stlpce.map((s) => (
            <i key={s.elderId} className={s.smer} style={{ "--zona": s.zona, "--farba-zony": farbaZony(s.zona) } as CSSProperties} />
          ))}
        </span>
      </span>
      <span className="zdroj-pod">
        <span>
          {strach > 0 ? `${strach} sa ${ja ? "ťa" : "ho"} bojí · +${zaStarsich}` : `nikto sa ${ja ? "ťa" : "ho"} nebojí`}
          {strach > 0 && <IkonaSpaku />}
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
        const strach = strachZ(e, p);
        const patron = view.patronat[p]?.elderId === e.elderId ? p : view.patronat[su]?.elderId === e.elderId ? su : null;
        const posuny = (view.posunyMarkerov ?? []).filter((x) => x.elderId === e.elderId);
        const hodnota =
          smer === "hore" ? (
            <span className="velke-cislo">♥ +{priazenSila(e)}</span>
          ) : smer === "dole" ? (
            <span className="velke-cislo">
              +{strach}
              <IkonaSpaku />
            </span>
          ) : (
            <span className="velke-cislo nic">—</span>
          );
        const riadok =
          smer === "hore" ? ucinok.kratko : smer === "dole" ? `bojí sa ${ja ? "ťa" : "ho"} · po bitke` : `neutrálny · ${ucinok.kratko}`;
        const popis =
          smer === "hore"
            ? `${meno}: ${ucinok.cely}. Zóna ${NAZVY_ZON[zona]}.`
            : smer === "dole"
              ? `${meno} sa ${ja ? "ťa" : "ho"} bojí (${NAZVY_ZON[zona]}): po každej bitke ${ja ? "ti" : "mu"} dá ${strach} ${strach === 1 ? "špak" : "špaky"}. Priazeň má súper — ${ucinok.cely}.`
              : `${meno} je v strede, priazeň nemá nikto. ${ucinok.cely}.`;
        return (
          <div
            key={e.elderId}
            role="listitem"
            tabIndex={0}
            className={`zdroj starsi-dlazdica ${smer}`}
            style={{ "--farba-zony": farbaZony(zona) } as CSSProperties}
            title={
              popis +
              (patron === null ? "" : ` Patrón: ${patron === view.ja ? "ty" : "súper"}.`) +
              (posuny.length === 0 ? "" : ` Od bitky sa pohol ${posuny.length}× (${[...new Set(posuny.map((x) => x.zdroj))].join(", ")}).`)
            }
          >
            <span className="zdroj-nazov">
              <i className="ls-znacka" aria-hidden="true" />
              <span className="starsi-meno">{meno}</span>
            </span>
            <span className="zdroj-hodnota">
              {hodnota}
              {patron !== null && <span className="starsi-cip">patrón{patron === p ? "" : " súpera"}</span>}
              {posuny.length > 0 && <span className="zdroj-posuny">⇄</span>}
            </span>
            <span className="zdroj-pod">
              <span>{riadok}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
