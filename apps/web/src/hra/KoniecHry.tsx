// Obrazovka konca hry (playtest 20261012-055944): víťaz, body po starších,
// zmena Frajeriny a návrat do lobby. Kým bol koniec len riadok v páse
// pokynov, hráči ho prehliadli a nevedeli, odkiaľ body sú.

import type { ClientState, GameData, PlayerId } from "@naex/core";
import { bodyTeraz } from "@naex/core";
import { RozpisBodov } from "./RozpisBodov.tsx";
import type { ZmenyFrajeriny } from "./useHra.ts";

export interface KoniecHryProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  readonly frajerina: ZmenyFrajeriny | null;
  readonly onZavri: () => void;
  readonly opustit: () => void;
}

export function KoniecHry({ view, data, mena, menoKarty, frajerina, onZavri, opustit }: KoniecHryProps) {
  const koniec = view.koniec;
  if (koniec === null) return null;
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const nadpis = koniec.vitaz === null ? "Remíza" : koniec.vitaz === ja ? "Vyhral si!" : "Prehral si";
  const dovod = koniec.dovod.replace(/Hráč ([12])/g, (_, n: string) => mena[Number(n) - 1] ?? `Hráč ${n}`);
  // Rozpis po starších tým istým bodovaním ako na konci hry. Súperove skryté
  // karty klient nevidí — súčet zo servera (koniec.body) je smerodajný.
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
        <div className="koniec-tlacidla">
          <button onClick={onZavri}>pozrieť stôl</button>
          <button className="tlacidlo-hlavne" onClick={opustit}>
            späť do lobby
          </button>
        </div>
      </div>
    </div>
  );
}
