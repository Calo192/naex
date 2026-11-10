// Obrazovka konca hry (playtest 20261012-055944): víťaz, špaky, krčmová
// nástenka a účet špakov (v6), zmena Frajeriny a návrat do lobby. Kým bol koniec
// len riadok v páse pokynov, hráči ho prehliadli a nevedeli, odkiaľ body sú.

import { useEffect, useRef } from "react";
import type { ClientState, GameData, Rod, Vykupne } from "@naex/core";
import { KONSTANTY, VERZIA_PRAVIDIEL, rozpisSpakov, opponentOf } from "@naex/core";
import { t, tr, tRod } from "../i18n/jazyk.tsx";
import { Odkaz } from "../lib/router.tsx";
import { UcetSpakov } from "./UcetSpakov.tsx";
import { RadyNaKonci } from "./Pata.tsx";
import { Nastenka, PocetSpakov } from "./Spaky.tsx";
import { PasStarsich } from "./PasStarsich.tsx";
import { favourPodlaId } from "./priazenKola.ts";
import { SuhrnPoPartii } from "../achievementy/VPartii.tsx";
import type { SuhrnAchievementov, ZmenyFrajeriny } from "./useHra.ts";
import { textHlasky } from "./useHra.ts";
import { vyhraStrachomBitky } from "./vyhraStrachom.ts";

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
  /** S dátami a portrétmi ukáže pás starších s krúžkami priazne (Michal 2026-10-31). */
  readonly starsi?: { readonly data: GameData; readonly obrazok: (defId: string) => string | null } | undefined;
}

/** „2 plné poldeci a 7 cigariet = +3“ — čo sa hráčovi na konci vykúpilo. */
function vykupneText(v: Vykupne | undefined): string {
  if (v === undefined) return t("koniec.nic");
  return t("koniec.vykupne", { poldeci: t("koniec.plnychPoldeci", { n: v.poldeci }), cigarety: t("koniec.cigariet", { n: v.cigarety }), n: v.spaky });
}

export function KoniecHry({ view, mena, menoKarty, frajerina, achievementy = null, onZavri, opustit, rodJa = null, rody = [null, null], avatary = [null, null], starsi }: KoniecHryProps) {
  const koniec = view.koniec;
  // Fokus na „späť do lobby“ bez posunu — autoFocus vyroloval vysoké okno nadol a výsledok
  // hore hráč nevidel (UI inšpekcia 2026-10-24).
  const lobbyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => lobbyRef.current?.focus({ preventScroll: true }), [koniec === null]);
  if (koniec === null) return null;
  const ja = view.ja;
  const su = opponentOf(ja);
  const nadpis =
    koniec.vitaz === null ? t("koniec.remiza") : koniec.vitaz === ja ? tRod("koniec.vyhra", rodJa) : tRod("koniec.prehra", rodJa);
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
        {view.pata !== undefined && starsi !== undefined && <RadyNaKonci view={view} data={starsi.data} mena={mena} obrazok={starsi.obrazok} />}
        {view.pata === undefined && <p className="koniec-skore koniec-spaky">
          <span className="moje">
            {t("koniec.ty")}
            <PocetSpakov n={koniec.body?.[ja] ?? view.spaky[ja]} kto="moj" velky />
          </span>
          <span className="dvojbodka">:</span>
          <span className="superove">
            <PocetSpakov n={koniec.body?.[su] ?? view.spaky[su]} kto="superov" velky />
            {mena[su]}
          </span>
        </p>}
        {view.pata === undefined && view.nastenka.length > 0 && (
          <Nastenka
            nastenka={view.nastenka}
            zostava={[]}
            ciel={null}
            ja={ja}
            mena={mena}
            avatary={avatary}
            menoKarty={menoKarty}
            favour={starsi === undefined ? undefined : (id) => favourPodlaId(starsi.data, view, id)}
            kompaktna
            koniec
            vyhraStrachom={(b) => vyhraStrachomBitky(view, b.kolo)}
          />
        )}
        {view.pata === undefined && starsi !== undefined && <PasStarsich view={view} data={starsi.data} mena={mena} menoKarty={menoKarty} obrazok={starsi.obrazok} />}
        {view.pata === undefined && view.nastenka.length > 0 && rozpis !== null && (
          // Súčet čísel pri lokalitách nie je celkové skóre — playtest 20261031-191322 v tom hľadal chybu.
          <p className="koniec-cirhozy koniec-pozn-lokalit">{t("koniec.poznLokalit")}</p>
        )}
        {rozpis !== null && (
          <div className="koniec-rozpis">
            <UcetSpakov rozpis={rozpis} ja={ja} mena={mena} />
            {(koniec.vykupne?.[0]?.spaky ?? 0) + (koniec.vykupne?.[1]?.spaky ?? 0) > 0 && (
              <p className="koniec-cirhozy">
                {t("koniec.vykupneRiadok", { zaPoldeci: KONSTANTY.SPAKY_ZA_POLDECI, zaCigarety: KONSTANTY.CIGARIET_ZA_SPAK, ja: vykupneText(koniec.vykupne?.[ja]), meno: mena[su], su: vykupneText(koniec.vykupne?.[su]) })}
              </p>
            )}
            {(koniec.vazni?.[0] ?? 0) + (koniec.vazni?.[1] ?? 0) > 0 && (
              <p className="koniec-cirhozy">{t("koniec.vazni", { ja: koniec.vazni?.[ja] ?? 0, meno: mena[su], su: koniec.vazni?.[su] ?? 0 })}</p>
            )}
            {(koniec.cirhozy?.[0] ?? 0) + (koniec.cirhozy?.[1] ?? 0) > 0 && (
              <p className="koniec-cirhozy">
                {t("koniec.cirhozy", { spaky: t("koniec.spakov", { n: KONSTANTY.SPAKY_ZA_CIRHOZU }), ja: koniec.cirhozy?.[ja] ?? 0, meno: mena[su], su: koniec.cirhozy?.[su] ?? 0 })}
              </p>
            )}
          </div>
        )}
        {zmena !== undefined && (
          <p className="koniec-frajerina">
            {tr("koniec.frajerina", { pred: zmena.pred, po: zmena.po, zmena: `${zmena.po - zmena.pred > 0 ? "+" : zmena.po - zmena.pred < 0 ? "−" : "±"}${Math.abs(zmena.po - zmena.pred)}` })}
          </p>
        )}
        {achievementy !== null && <SuhrnPoPartii suhrn={achievementy} />}
        <div className="koniec-tlacidla">
          {/* Na akých pravidlách sa hralo — v riadku tlačidiel, aby okno na notebooku nenarástlo. */}
          <span className="koniec-verzia">{t("koniec.pravidla", { verzia: VERZIA_PRAVIDIEL })}</span>
          <button onClick={onZavri}>{t("koniec.pozrietStol")}</button>
          {/* Hodnotenie hry tými istými kritériami ako AI playtesteri (Michal 2026-10-21). */}
          <Odkaz href="/spatna-vazba#hodnotenie" className="tlacidlo">
            {t("koniec.ohodnotit")}
          </Odkaz>
          <button ref={lobbyRef} className="tlacidlo-hlavne" onClick={opustit}>
            {t("koniec.spatDoLobby")}
          </button>
        </div>
      </div>
    </div>
  );
}
