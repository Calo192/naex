// Výber páru farieb hráča v hlavičke profilu (Michal 2026-10-27, dizajn farba-hraca-20261027):
// 5 párov a ⇄ v jednom riadku, ktorý sa nezalomí; pod 640 px len kotúče a názov pod nimi.
// Ukladá sa samo ako schéma — v prehliadači aj v účte, súperovi sa neposiela nič.

import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { api } from "../lib/api.ts";
import { PARY, aktualnyPar, popisParu, pouziPar, tonyParu, volbaDoUctu, type VolbaParu } from "../lib/paryHraca.ts";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";

export function VyberParu({ chyba }: { readonly chyba: (err: unknown) => void }) {
  const { nastav } = useUcet();
  const [volba, setVolba] = useState<VolbaParu>(aktualnyPar);
  const mriezka = useRef<HTMLDivElement>(null);

  const zvol = (v: VolbaParu): void => {
    pouziPar(v);
    setVolba(v);
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { par: volbaDoUctu(v) })
      .then((r) => nastav(r.pouzivatel))
      .catch(chyba);
  };

  // Šípky prechádzajú pármi a hneď vyberajú (vzor radiogroup), fokus ide so zvoleným.
  const klaves = (e: KeyboardEvent<HTMLDivElement>): void => {
    const krok = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (krok === 0) return;
    e.preventDefault();
    const i = PARY.findIndex((p) => p.id === volba.par);
    const dalsi = PARY[(i + krok + PARY.length) % PARY.length];
    if (dalsi === undefined) return;
    zvol({ ...volba, par: dalsi.id });
    mriezka.current?.querySelector<HTMLButtonElement>(`[data-par="${dalsi.id}"]`)?.focus();
  };

  const vybrany = PARY.find((p) => p.id === volba.par) ?? PARY[0];

  return (
    <div className="vyber-paru" id="farba">
      <h3 id="vyber-paru-nadpis">Tvoja farba a farba súpera</h3>
      <p className="tlmene">Veľký kotúč si ty, malý súper. Platí len na tvojej obrazovke — súper tvoju voľbu nevidí.</p>
      <div className="rad-parov">
        <div className="rad-parov-mriezka">
          <div ref={mriezka} className="rad-parov-pary" role="radiogroup" aria-labelledby="vyber-paru-nadpis" onKeyDown={klaves}>
            {PARY.map((p) => {
              const tony = tonyParu(p.id, volba.prehod);
              const zvoleny = p.id === volba.par;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="par-volba"
                  role="radio"
                  aria-checked={zvoleny}
                  tabIndex={zvoleny ? 0 : -1}
                  data-par={p.id}
                  title={p.nazov}
                  aria-label={`${p.nazov}: ${popisParu(p, volba.prehod)}`}
                  onClick={() => zvol({ ...volba, par: p.id })}
                >
                  <span className="par-disky" style={{ "--fj": tony.ja, "--fs": tony.su } as CSSProperties} aria-hidden="true">
                    <i className="par-disk-su" />
                    <i className="par-disk-ja" />
                  </span>
                  <span className="par-nazov">{p.nazov}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="par-prehod"
            aria-pressed={volba.prehod}
            title="Prehodiť: moja farba ↔ súperova"
            aria-label="Prehodiť moju a súperovu farbu"
            onClick={() => zvol({ ...volba, prehod: !volba.prehod })}
          >
            ⇄
          </button>
        </div>
      </div>
      {vybrany !== undefined && (
        <p className="par-vybrany" aria-live="polite">
          <b>{vybrany.nazov}</b> · {popisParu(vybrany, volba.prehod)}. Ukladá sa samo.
        </p>
      )}
    </div>
  );
}
