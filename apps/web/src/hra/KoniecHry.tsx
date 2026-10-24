// Obrazovka konca hry (playtest 20261012-055944): víťaz, body po starších,
// zmena Frajeriny a návrat do lobby. Kým bol koniec len riadok v páse
// pokynov, hráči ho prehliadli a nevedeli, odkiaľ body sú.

import type { ClientState, GameData, PlayerId, Rod } from "@naex/core";
import { bodyTeraz, tvar } from "@naex/core";
import { Odkaz } from "../lib/router.tsx";
import { RozpisBodov } from "./RozpisBodov.tsx";
import { SuhrnPoPartii } from "../achievementy/VPartii.tsx";
import type { SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { textHlasky } from "./useHra.ts";

export interface KoniecHryProps {
  readonly view: ClientState;
  readonly data: GameData;
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
}

export function KoniecHry({ view, data, mena, menoKarty, frajerina, achievementy = null, onZavri, opustit, rodJa = null, rody = [null, null] }: KoniecHryProps) {
  const koniec = view.koniec;
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
  // Rozpis po starších tým istým bodovaním ako na konci hry — súperove
  // nepriznané kliatby pozná view z verejného počtu, takže sa sčíta na
  // koniec.body (playtest 20261021-041728: predtým dva rôzne súčty v jednom okne).
  // Pri vzdaní, exekúcii či vydesení sa nebodovalo — rozpis by mýlil.
  const rozpis = koniec.body === null ? null : bodyTeraz(data, view);
  const zmena = frajerina?.[ja];

  return (
    <div className="koniec-vrstva" role="dialog" aria-modal="true" aria-labelledby="koniec-nadpis">
      <div className={`koniec-okno ${koniec.vitaz === null ? "" : koniec.vitaz === ja ? "vyhra" : "prehra"}`}>
        <h2 id="koniec-nadpis">{nadpis}</h2>
        <p className="koniec-dovod">{dovod}</p>
        {koniec.body !== null && (
          <p className="koniec-skore">
            <span className="moje">
              ty <b>{koniec.body[ja]}</b>
            </span>
            <span className="dvojbodka">:</span>
            <span className="superove">
              <b>{koniec.body[su]}</b> {mena[su]}
            </span>
          </p>
        )}
        {rozpis !== null && (
          <div className="koniec-rozpis">
            <RozpisBodov
              body={rozpis}
              starsi={view.starsi}
              data={data}
              ja={ja}
              menoSupera={mena[su]}
              menoKarty={menoKarty}
              nadpis="Body po starších — každá aktívna podmienka boduje obom"
            />
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
          <button onClick={onZavri}>pozrieť stôl</button>
          {/* Hodnotenie hry tými istými kritériami ako AI playtesteri (Michal 2026-10-21). */}
          <Odkaz href="/spatna-vazba#hodnotenie" className="tlacidlo">
            ohodnotiť hru
          </Odkaz>
          <button className="tlacidlo-hlavne" onClick={opustit} autoFocus>
            späť do lobby
          </button>
        </div>
      </div>
    </div>
  );
}
