// Obrazovka konca hry (playtest 20261012-055944): víťaz, špaky, krčmová
// nástenka a účet špakov (v6), zmena Frajeriny a návrat do lobby. Kým bol koniec
// len riadok v páse pokynov, hráči ho prehliadli a nevedeli, odkiaľ body sú.

import { useEffect, useRef } from "react";
import type { ClientState, PlayerId, Rod, Vykupne } from "@naex/core";
import { KONSTANTY, VERZIA_PRAVIDIEL, pocet, rozpisSpakov, tvar } from "@naex/core";
import { Odkaz } from "../lib/router.tsx";
import { UcetSpakov } from "./UcetSpakov.tsx";
import { Nastenka, PocetSpakov } from "./Spaky.tsx";
import { SuhrnPoPartii } from "../achievementy/VPartii.tsx";
import type { SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { textHlasky } from "./useHra.ts";

export interface KoniecHryProps {
  readonly view: ClientState;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly frajerina: ZmenyFrajeriny | null;
  /** Získané achievementy a „chýbalo málo“ (príde zo servera po konci). */
  readonly achievementy?: SuhrnAchievementov | null;
  readonly onZavri: () => void;
  readonly opustit: () => void;
  /** Rod hráča pre „Vyhral(a) si!“ (Michal 2026-10-22); chýba = neutrálne. */
  readonly rodJa?: Rod;
  /** Rody oboch hráčov pre dôvod konca („Eva udržala…“); chýba = neutrálne. */
  readonly rody?: readonly [Rod, Rod];
  /** Fotky hráčov na krčmovú nástenku (víťaz bitky). */
  readonly avatary?: readonly [string | null, string | null];
}

/** „2 plné poldeci a 7 cigariet = +3“ — čo sa hráčovi na konci vykúpilo. */
function vykupneText(v: Vykupne | undefined): string {
  if (v === undefined) return "nič";
  return `${pocet(v.poldeci, "plný poldeci", "plné poldeci", "plných poldeci")} a ${pocet(v.cigarety, "cigareta", "cigarety", "cigariet")} = +${v.spaky}`;
}

export function KoniecHry({ view, mena, menoKarty, frajerina, achievementy = null, onZavri, opustit, rodJa = null, rody = [null, null], avatary = [null, null] }: KoniecHryProps) {
  const koniec = view.koniec;
  // Fokus na „späť do lobby“ bez posunu — autoFocus vyroloval vysoké okno nadol a výsledok
  // hore hráč nevidel (UI inšpekcia 2026-10-24).
  const lobbyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => lobbyRef.current?.focus({ preventScroll: true }), [koniec === null]);
  if (koniec === null) return null;
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const nadpis =
    koniec.vitaz === null
      ? "Remíza"
      : koniec.vitaz === ja
        ? tvar(rodJa, "Vyhral si!", "Vyhrala si!", "Výhra!")
        : tvar(rodJa, "Prehral si", "Prehrala si", "Prehra");
  const dovod = textHlasky(koniec.dovod, mena, rody);
  // Účet špakov z nástenky a konca hry (v6) — sčíta sa na koniec.body.
  // Pri vzdaní či vydesení sa nebodovalo — rozpis by mýlil.
  const rozpis = koniec.body === null ? null : rozpisSpakov(view);
  const zmena = frajerina?.[ja];

  return (
    <div className="koniec-vrstva" role="dialog" aria-modal="true" aria-labelledby="koniec-nadpis">
      <div className={`koniec-okno ${koniec.vitaz === null ? "" : koniec.vitaz === ja ? "vyhra" : "prehra"}`}>
        <h2 id="koniec-nadpis">{nadpis}</h2>
        <p className="koniec-dovod">{dovod}</p>
        {/* Špaky (v6): konečné špaky po finále, inak to, čo hráči nazbierali do konca. */}
        <p className="koniec-skore koniec-spaky">
          <span className="moje">
            ty
            <PocetSpakov n={koniec.body?.[ja] ?? view.spaky[ja]} kto="moj" velky />
          </span>
          <span className="dvojbodka">:</span>
          <span className="superove">
            <PocetSpakov n={koniec.body?.[su] ?? view.spaky[su]} kto="superov" velky />
            {mena[su]}
          </span>
        </p>
        {view.nastenka.length > 0 && (
          <Nastenka
            nastenka={view.nastenka}
            zostava={[]}
            ciel={null}
            ja={ja}
            mena={mena}
            avatary={avatary}
            menoKarty={menoKarty}
            kompaktna
            koniec
          />
        )}
        {rozpis !== null && (
          <div className="koniec-rozpis">
            <UcetSpakov rozpis={rozpis} ja={ja} mena={mena} />
            {(koniec.vykupne?.[0]?.spaky ?? 0) + (koniec.vykupne?.[1]?.spaky ?? 0) > 0 && (
              <p className="koniec-cirhozy">
                Výkupné: plný poldeci {KONSTANTY.SPAKY_ZA_POLDECI} špak, každých {KONSTANTY.CIGARIET_ZA_SPAK} cigariet 1 špak — ty{" "}
                {vykupneText(koniec.vykupne?.[ja])}, {mena[su]} {vykupneText(koniec.vykupne?.[su])}.
              </p>
            )}
            {(koniec.vazni?.[0] ?? 0) + (koniec.vazni?.[1] ?? 0) > 0 && (
              <p className="koniec-cirhozy">
                Väzni po finále (poradie zajatia {KONSTANTY.SPAKY_ZA_VAZNOV.join(" / ")}): ty +{koniec.vazni?.[ja] ?? 0}, {mena[su]} +{koniec.vazni?.[su] ?? 0}.
              </p>
            )}
            {(koniec.cirhozy?.[0] ?? 0) + (koniec.cirhozy?.[1] ?? 0) > 0 && (
              <p className="koniec-cirhozy">
                Nepriznaná Cirhóza na konci: {pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")} za kus (ruka aj oba balíčky) — ty ×{koniec.cirhozy?.[ja] ?? 0},{" "}
                {mena[su]} ×{koniec.cirhozy?.[su] ?? 0}.
              </p>
            )}
          </div>
        )}
        {zmena !== undefined && (
          <p className="koniec-frajerina">
            Frajerina {zmena.pred} → <strong>{zmena.po}</strong> ({zmena.po - zmena.pred > 0 ? "+" : zmena.po - zmena.pred < 0 ? "−" : "±"}
            {Math.abs(zmena.po - zmena.pred)})
          </p>
        )}
        {achievementy !== null && <SuhrnPoPartii suhrn={achievementy} />}
        <div className="koniec-tlacidla">
          {/* Na akých pravidlách sa hralo — v riadku tlačidiel, aby okno na notebooku nenarástlo. */}
          <span className="koniec-verzia">pravidlá {VERZIA_PRAVIDIEL}</span>
          <button onClick={onZavri}>pozrieť stôl</button>
          {/* Hodnotenie hry tými istými kritériami ako AI playtesteri (Michal 2026-10-21). */}
          <Odkaz href="/spatna-vazba#hodnotenie" className="tlacidlo">
            ohodnotiť hru
          </Odkaz>
          <button ref={lobbyRef} className="tlacidlo-hlavne" onClick={opustit}>
            späť do lobby
          </button>
        </div>
      </div>
    </div>
  );
}
