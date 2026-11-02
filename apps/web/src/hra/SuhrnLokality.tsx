// Súhrn odohranej lokality po kliku na nástenke (Michal 2026-10-31: „kliknúť a zobraziť súmar
// Pitiek a bitky, ktorý hráč v ktorej Pitke koľko čoho získal a ako prebehla bitka“). Vrstva
// v štýle rekapitulácie: vľavo Pitky kola a posuny starších, vpravo rekapitulácia bitky
// (ten istý RekapBitky ako po bitke) so špakmi zo záznamu nástenky. Pitka sa dá rozkliknúť
// na svoju rekapituláciu. Čísla skladá obsahSuhrnuLokality.ts, históriu posiela server.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { BitkaNaNastenke, Favour, LokalitaVHistorii, PitkaVHistorii, PlayerId } from "@naex/core";
import { jeFinaleNaNastenke, opponentOf } from "@naex/core";
import { FavourStarsich, PilulkaPriazne } from "./KruzokPriazne.tsx";
import { Avatar } from "../komponenty.tsx";
import { RekapBitky, RekapitulaciaPitkyVrstva, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";
import { SpakyBitky, spakyPredBitkou, rozpisLokality } from "./Spaky.tsx";
import { odpovedeKola, riadkySuhrnuLokality } from "./obsahSuhrnuLokality.ts";
import { NAZOV_ZDROJA, textZmeny } from "./textyStarsich.ts";
import "./suhrn-lokality.css";

export interface SuhrnLokalityProps {
  /** Záznam nástenky — špaky po celom kole (aj starší a Robota). */
  readonly b: BitkaNaNastenke;
  /** História kola zo servera; null = nezaznamenaná (napr. prehrávač archívu). */
  readonly zaznam: LokalitaVHistorii | null;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly avatary: readonly [string | null, string | null];
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly onZavri: () => void;
  /** Priazeň staršieho podľa id — krúžok pri posunoch a v rozpise za starších (Michal 2026-10-31). */
  readonly favour?: ((elderId: string) => Favour | null) | undefined;
}

export function SuhrnLokality(props: SuhrnLokalityProps) {
  const obsah = <SuhrnLokalityObsah {...props} />;
  return props.favour === undefined ? obsah : <FavourStarsich.Provider value={props.favour}>{obsah}</FavourStarsich.Provider>;
}

function SuhrnLokalityObsah({ b, zaznam, ja, mena, avatary, menoKarty, piktogramy, onZavri, favour = () => null }: SuhrnLokalityProps) {
  const su = opponentOf(ja);
  const idNadpisu = useId();
  const [detail, setDetail] = useState<PitkaVHistorii | null>(null);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const zavriRef = useRef(onZavri);
  zavriRef.current = onZavri;
  const zavriet = useRef<HTMLButtonElement>(null);
  // Fokus na Zavrieť bez posunu — na nízkom okne (1366 × 650) musí súhrn začať zhora.
  useEffect(() => zavriet.current?.focus({ preventScroll: true }), []);
  // Skratky stola pod vrstvou nesmú reagovať; Esc zavrie najprv rekapituláciu Pitky, potom súhrn.
  useEffect(() => {
    const kam = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const klaves = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Tab") return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (detailRef.current !== null) setDetail(null);
        else zavriRef.current();
        return;
      }
      e.stopPropagation();
    };
    window.addEventListener("keydown", klaves, true);
    return () => {
      window.removeEventListener("keydown", klaves, true);
      // Fokus späť na lístok, z ktorého sa súhrn otvoril (klávesnica).
      if (kam?.isConnected === true) kam.focus();
    };
  }, []);

  const finale = jeFinaleNaNastenke(b);
  const nazov = b.lokalita === null ? (finale ? "Finále" : "lokalita") : menoKarty(b.lokalita.defId);
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const { spolu } = rozpisLokality(b, menoKarty);
  const bitka = zaznam?.bitka ?? null;
  const vysledok = b.vitaz === null ? "sekera — remíza" : b.vitaz === ja ? "tvoja výhra" : `výhra – ${mena[b.vitaz]}`;
  const rozhodlo = b.rozhodlo === "abstak" ? " (remíza v tuhom → menej Absťákov)" : b.rozhodlo === "dlhy" ? " (remíza v tuhom → menej Dlhov)" : "";
  const riadky = zaznam === null ? [] : riadkySuhrnuLokality(zaznam);
  const pitkyCelkom = zaznam?.pitky[0]?.rekap.pitkyCelkom ?? zaznam?.pitky.length ?? 0;
  const cipy = (xs: RiadokZmien, p: PlayerId): ReactNode =>
    xs[p].length === 0 ? (
      <span className="sl-nic">—</span>
    ) : (
      xs[p].map((z, i) => (
        <span key={`${z.kluc}${i}`} className={`sl-cip ${z.ton}`}>
          {z.text}
        </span>
      ))
    );

  return (
    <>
      <div
        className="pocitadlo-bitky hotova suhrn-lokality"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idNadpisu}
        onClick={(e) => {
          if (e.target === e.currentTarget) onZavri();
        }}
      >
        <div className="pocitadlo-scena">
          <div className="pocitadlo-panel hotovo sl-panel">
            <span className="pocitadlo-nadpis">{finale ? "Finále" : `Kolo ${b.kolo}`} · súhrn lokality</span>
            <span className="sl-vysledok">
              {b.vitaz !== null && <Avatar meno={mena[b.vitaz]} avatar={avatary[b.vitaz]} velkost={36} farba={b.vitaz === ja ? "ja" : "su"} />}
              <span className="pocitadlo-vyhodnotena" id={idNadpisu}>
                {nazov}
              </span>
            </span>
            <span className="pocitadlo-mena">
              {vysledok}
              {rozhodlo}
              {bitka !== null && ` · tuhé ${bitka.tuheSpolu[ja]} : ${bitka.tuheSpolu[su]}`} · špaky za lokalitu: ty {zn(spolu[ja])}, {mena[su]} {zn(spolu[su])}
            </span>
          </div>
          <div className="sl-telo">
            <section className="sl-stlpec" aria-label="Pitky kola">
              <h3 className="sl-nadpis">
                Pitky{pitkyCelkom > 0 ? ` · ${pitkyCelkom}` : ""}
                <small>kto čo získal a stratil</small>
              </h3>
              {zaznam === null ? (
                <p className="sl-pozn">Priebeh Pitiek sa pre túto lokalitu nezaznamenal.</p>
              ) : (
                <div className="rekap sl-pitky" role="table" aria-label="Pitky kola po hráčoch">
                  <div className="sl-riadok sl-hlava" role="row">
                    <span role="columnheader" className="moje">
                      ty
                    </span>
                    <span role="columnheader" />
                    <span role="columnheader" className="superove">
                      {mena[su]}
                    </span>
                  </div>
                  {riadky.map((r) => {
                    const pk = r.pitka === null ? undefined : zaznam.pitky.find((x) => x.pitka === r.pitka);
                    return (
                      <div key={r.kluc} className={`sl-riadok${r.pitka === null ? " sl-bitka-riadok" : ""}`} role="row">
                        <span className="sl-bunka l" role="cell">
                          {cipy(r.zmeny, ja)}
                        </span>
                        <span className="sl-stred" role="rowheader">
                          <b>{r.nazov}</b>
                          {pk !== undefined && (
                            <button type="button" className="sl-rozpis" onClick={() => setDetail(pk)}>
                              rekapitulácia
                            </button>
                          )}
                        </span>
                        <span className="sl-bunka r" role="cell">
                          {cipy(r.zmeny, su)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {zaznam !== null && <p className="sl-pozn">Pitka 1 ráta aj stavbu šenku a prvé Zhromaždenie, každá ďalšia aj svoje Zhromaždenie.</p>}
              {zaznam !== null && zaznam.posuny.length > 0 && (
                <>
                  <h3 className="sl-nadpis">Strach a reči starších</h3>
                  <ul className="sl-posuny">
                    {zaznam.posuny.map((x, i) => (
                      <li key={i} className={x.kto === ja ? "moje" : "superove"}>
                        {(() => {
                          // Krúžok: priazeň hráča, ktorého marker sa zmenil — piktogram povie, ktorý starší.
                          const fav = favour(x.elderId);
                          return fav === null ? null : <PilulkaPriazne fav={fav} p={{ komu: x.hrac === ja ? "ja" : "su", sila: 0 }} />;
                        })()}{" "}
                        <b>{x.defId === null ? x.elderId : menoKarty(x.defId)}</b>: {textZmeny(x, ja, mena)}{" "}
                        <small>
                          ({NAZOV_ZDROJA[x.zdroj]} · {kto(x.kto)})
                        </small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="sl-stlpec sl-bitka" aria-label="Bitka">
              <h3 className="sl-nadpis">
                Bitka
                <small>akcie ty vs. {mena[su]}, špaky a starší</small>
              </h3>
              {bitka !== null ? (
                <RekapBitky
                  // Špaky zo záznamu nástenky — rekapitulácia ich má z okamihu výsledku, bez starších na konci kola.
                  r={{ ...bitka, spaky: b }}
                  ja={ja}
                  menoSupera={mena[su]}
                  menoKarty={menoKarty}
                  piktogramy={piktogramy}
                  vlna={Number.MAX_SAFE_INTEGER}
                  hotovo
                  vlnaKarty={() => 0}
                  vlnaRusenia={0}
                  vlnaUcinku={0}
                  mena={mena}
                  odpovede={zaznam === null ? [] : odpovedeKola(zaznam)}
                />
              ) : (
                <div className="rk-spaky-blok">
                  <SpakyBitky b={b} ja={ja} mena={ja === 0 ? ["ty", mena[su]] : [mena[su], "ty"]} pred={spakyPredBitkou(b)} menoKarty={menoKarty} />
                </div>
              )}
            </section>
          </div>
          <div className="pocitadlo-pata">
            <button type="button" className="rk-dalej" onClick={onZavri} ref={zavriet}>
              Zavrieť <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      </div>
      {detail !== null && (
        <RekapitulaciaPitkyVrstva
          key={`suhrn-pitka-${b.kolo}-${detail.pitka}`}
          r={detail.rekap}
          ja={ja}
          mena={mena}
          nadpis={`Pitka ${detail.pitka} / ${detail.rekap.pitkyCelkom} · ${nazov}`}
          menoKarty={menoKarty}
          piktogramy={piktogramy}
          onKoniec={() => setDetail(null)}
          odpovede={detail.odpovede}
        />
      )}
    </>
  );
}

type RiadokZmien = ReturnType<typeof riadkySuhrnuLokality>[number]["zmeny"];

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
