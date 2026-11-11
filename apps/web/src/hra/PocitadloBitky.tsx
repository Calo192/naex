// Počítadlo bitky (Michal 2026-10-23, roadmapa „Počítadlo bitky“): pri vyhodnotení
// bitky výsledok rastie po vlnách od lokality von — karta sa rozsvieti a vyletí jej
// príspevok k tuhému, zdvojený sa roztrasie; potom bonusy, Viera súpera ako štít
// a nakoniec obe čísla na výsledku (ten istý ako v Účte bitky). Klik, Esc alebo
// medzerník dobehne animáciu; pri prefers-reduced-motion je hneď na konci.
// Pod ním rekapitulácia (roadmapa #106, Michal 2026-10-26): riadky nabiehajú s tými
// istými vlnami, 2× pomalšie ako pôvodné počítadlo, a vrstva sama nezmizne — zavrie
// ju až Ďalej (Enter). Čakanie je len u tohto hráča, server ide ďalej.
// Línia je vlastná kópia stola v okamihu bitky — server bitku často vyhodnotí aj
// s upratovaním naraz a skutočná línia zo stola zmizne skôr, než počítadlo dobehne.

import { useEffect, useState, type ReactNode } from "react";
import type { CardInstance, CardLineEval, KrokPocitadla, LineEval, Moment, PlayerId, PocitadloBitky as Pocitadlo, RekapitulaciaBitky, StolBitky } from "@naex/core";
import { stavPocitadla, vlnyKariet, opponentOf } from "@naex/core";
import { IkonaPoldeci } from "./Panely.tsx";
import { PilulkaPriazne } from "./KruzokPriazne.tsx";
import { NAZOV_PRIAZNE, type PriazneBitky } from "./priazenKola.ts";
import type { VyhraStrachom } from "./vyhraStrachom.ts";
import { RekapBitky, StitkyMomentov, VysledokBitky, riadkovRekapitulacieBitky, type OdpovedNaNaex, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";
import { t } from "../i18n/jazyk.tsx";

/** Zdroje bonusov a zrážok, ktoré nie sú kartou. */
const ZDROJ: Readonly<Record<string, () => string>> = {
  cirhoza: () => t("pocitadlo.cirhoza"),
  BITKAR: () => t("pocitadlo.bitkar"),
  Viera: () => t("pocitadlo.viera"),
  pasca: () => t("pocitadlo.pasca"),
  abstak: () => t("pocitadlo.abstak"),
};

export interface PocitadloBitkyProps {
  readonly p: Pocitadlo;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly menoKarty: (defId: string) => string;
  /** Línia v okamihu bitky zľava doprava (tvoja strana · lokalita · súperova), už nakreslené karty. */
  readonly rad: readonly { readonly uid: number; readonly karta: ReactNode }[];
  readonly onKoniec: () => void;
  /**
   * Výučba: konečný výsledok je na paneli od začiatku a karty len ukazujú, odkiaľ je. Rastúce
   * číslo „1 : 0“ sa bilo s Melicharom, ktorý hovorí o 7 : 2 (playtest výučby 20261025, K6).
   */
  readonly vysledokHned?: boolean;
  /** Rekapitulácia z udalosti bitkaVysledok; chýba v starších záznamoch. */
  readonly rekap?: RekapitulaciaBitky | null;
  /** Vlna karty v línii (vlnyKariet zo stola v okamihu bitky). */
  readonly vlnyKariet?: ReadonlyMap<number, number>;
  readonly piktogramy?: PiktogramyRekapitulacie;
  /** Odpovede na NA EX v Pitkách kola — rekapitulácia ich povie slovami. */
  readonly odpovede?: readonly OdpovedNaNaex[];
  /**
   * Telefón na šírku (Michal 2026-10-31, oprava 4): jeden stĺpec ako pruh pokynu — hore výsledok
   * a Ďalej, pod ním kto čo dostal a záložky; náhľady kariet línie vypadnú (línia je hneď na stole).
   */
  readonly naSirku?: boolean;
  /** Momenty bitky (Výprask…) — na telefóne štítok v pruhu namiesto pečiatky cez obsah. */
  readonly momenty?: readonly Moment[];
  /** Hádka po starších a mená starších podľa priazne (krúžok priazne v rekapitulácii). */
  readonly priazne?: PriazneBitky | undefined;
  /** Bitka skončila hru výhrou strachom (vyhraStrachomBitky). */
  readonly vyhraStrachom?: VyhraStrachom | null | undefined;
}

export function PocitadloBitky({ p, ja, mena, menoKarty, rad, onKoniec, vysledokHned = false, rekap = null, vlnyKariet, piktogramy, odpovede = [], naSirku = false, momenty = [], priazne, vyhraStrachom = null }: PocitadloBitkyProps) {
  const su = opponentOf(ja);
  const posledna = p.vln - 1;
  const tlmene = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [vlna, setVlna] = useState(tlmene ? posledna : -1);
  const hotovo = vlna >= posledna;
  // Pôvodne 3–5 s; s rekapituláciou 2× pomalšie, aby sa riadky stihli prečítať (mock 2).
  const krokMs = 2 * Math.max(260, Math.min(650, 3600 / Math.max(1, p.vln)));

  useEffect(() => {
    if (hotovo) return;
    const t = setTimeout(() => setVlna((v) => v + 1), vlna < 0 ? 700 : krokMs);
    return () => clearTimeout(t);
  }, [vlna, hotovo, krokMs]);

  const dobehni = (): void => {
    if (!hotovo) setVlna(posledna);
  };
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" && e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Enter" && hotovo) onKoniec();
      else dobehni();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  });

  const cislo = hotovo || vysledokHned ? p.tuhe : vlna < 0 ? ([0, 0] as const) : stavPocitadla(p, vlna);
  const vitaz = p.tuhe[ja] === p.tuhe[su] ? null : p.tuhe[ja] > p.tuhe[su] ? ja : su;
  const popis = (k: KrokPocitadla): string => {
    const z = k.zmena > 0 ? `+${k.zmena}` : `−${-k.zmena}`;
    if (k.druh === "karta") return `${z}${k.nasobok > 1 ? ` ×${k.nasobok}` : ""}`;
    // „spolu“ dorovná rozdiel oproti výsledku zo servera (Absťáky sú od v8.2 verejné).
    if (k.druh === "spolu") return t("pocitadlo.ostatne", { z });
    const meno = k.zdroj === null ? "" : (ZDROJ[k.zdroj]?.() ?? menoKarty(k.zdroj));
    // Štít len pri Viere súpera (obrana); Absťáky a pasca sú trest, nie obrana (UI inšpekcia).
    const znak = k.druh !== "zrazka" ? "" : k.zdroj === "Viera" ? "🛡 " : "↓ ";
    if (k.naNule === true) return `${znak}${t("pocitadlo.uzNaNule", { meno })}`;
    return `${znak}${meno} ${z}`;
  };
  const viditelne = hotovo ? p.kroky : p.kroky.filter((k) => k.vlna <= vlna);
  // Bonusy, zrážky a dorovnanie ostávajú pod číslami, kým počítadlo beží.
  const zoznam = viditelne.filter((k) => k.druh !== "karta");
  // Riadky rekapitulácie podľa toho, kedy svieti ich karta; čo nie je kartou, s bonusmi.
  const vlnaKarty = (uid: number | null): number => (uid === null ? p.vlnaBonusov : (vlnyKariet?.get(uid) ?? 0));
  const verdikt = vitaz === null ? t("pocitadlo.remiza") : vitaz === ja ? t("pocitadlo.vyhravas", { n: p.tuhe[ja] - p.tuhe[su] }) : t("pocitadlo.prehravas", { n: p.tuhe[su] - p.tuhe[ja] });

  if (naSirku) {
    return (
      <div
        className={`pocitadlo-bitky rk-telefon${hotovo ? " hotova" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Bitka: ty ${cislo[ja]}, ${mena[su]} ${cislo[su]}`}
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest(".rk-dalej, .rk-rezim")) dobehni();
        }}
      >
        <div className="rk-tel-pruh">
          <span className="rk-tel-hlava">
            <span className="rk-tel-nadpis">{t("pocitadlo.nadpis")}</span>
            <span className="pocitadlo-cisla" aria-live="polite">
              <b className={`ja${(hotovo || vysledokHned) && vitaz === ja ? " vyhra" : ""}`}>{cislo[ja]}</b>
              <span className="pocitadlo-dvojbodka">:</span>
              <b className={`su${(hotovo || vysledokHned) && vitaz === su ? " vyhra" : ""}`}>{cislo[su]}</b>
            </span>
            {(hotovo || vysledokHned) && <span className={`rk-tel-verdikt${vitaz === null ? "" : vitaz === ja ? " ja" : " su"}`}>{verdikt}</span>}
            {hotovo && <StitkyMomentov momenty={momenty} ja={ja} />}
          </span>
          <button type="button" className={`rk-dalej rk-tel-akcia${hotovo ? "" : " caka"}`} onClick={hotovo ? onKoniec : dobehni} autoFocus={hotovo}>
            {hotovo ? t("pocitadlo.dalej") : t("pocitadlo.hnedVysledok")}
          </button>
        </div>
        {hotovo && rekap !== null && <VysledokBitky r={rekap} ja={ja} mena={mena} vyhraStrachom={vyhraStrachom} />}
        {rekap !== null && piktogramy !== undefined && (
          <RekapBitky
            r={rekap}
            ja={ja}
            menoSupera={mena[su]}
            menoKarty={menoKarty}
            piktogramy={piktogramy}
            vlna={vlna}
            hotovo={hotovo}
            vlnaKarty={vlnaKarty}
            vlnaRusenia={p.vlnaBonusov}
            vlnaUcinku={p.vlnaZrazok}
            mena={mena}
            odpovede={odpovede}
            priazne={priazne}
            vyhraStrachom={vyhraStrachom}
            telefon
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`pocitadlo-bitky${hotovo ? " hotova" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Bitka: ty ${cislo[ja]}, ${mena[su]} ${cislo[su]}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".rk-dalej, .rk-rezim")) dobehni();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        dobehni();
      }}
    >
      <div className={`pocitadlo-scena${rekap !== null && piktogramy !== undefined ? " s-rekapom" : ""}`}>
        <div className={`pocitadlo-panel${hotovo || vysledokHned ? " hotovo" : ""}`}>
          <span className="pocitadlo-nadpis">{t("pocitadlo.nadpis")}</span>
          <span className="pocitadlo-cisla" aria-live="polite">
            <b className={`ja${(hotovo || vysledokHned) && vitaz === ja ? " vyhra" : ""}`}>{cislo[ja]}</b>
            <span className="pocitadlo-dvojbodka">:</span>
            <b className={`su${(hotovo || vysledokHned) && vitaz === su ? " vyhra" : ""}`}>{cislo[su]}</b>
          </span>
          <span className="pocitadlo-mena">ty · {mena[su]}</span>
        </div>
        <div className="pocitadlo-rad">
          {rad.map(({ uid, karta }) => {
            const teraz = hotovo ? [] : p.kroky.filter((k) => k.uid === uid && k.vlna === vlna);
            const bola = p.kroky.some((k) => k.uid === uid && (hotovo || k.vlna < vlna));
            const kto = teraz[0]?.kto;
            return (
              <div key={uid} className={`pocitadlo-karta${teraz.length > 0 ? ` svieti ${kto === ja ? "ja" : "su"}` : ""}${bola ? " bola" : ""}`}>
                {karta}
                {teraz.map((k) => (
                  <span key={k.kto} className={`pocitadlo-prispevok ${k.kto === ja ? "ja" : "su"}${k.nasobok > 1 ? " nasobok" : ""}`}>
                    {popis(k)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        {rekap !== null && piktogramy !== undefined && (
          <RekapBitky
            r={rekap}
            ja={ja}
            menoSupera={mena[su]}
            menoKarty={menoKarty}
            piktogramy={piktogramy}
            vlna={vlna}
            hotovo={hotovo}
            vlnaKarty={vlnaKarty}
            vlnaRusenia={p.vlnaBonusov}
            vlnaUcinku={p.vlnaZrazok}
            mena={mena}
            odpovede={odpovede}
            priazne={priazne}
            vyhraStrachom={vyhraStrachom}
          />
        )}
        <div className="pocitadlo-pata">
          {zoznam.length > 0 && (
            <span className="pocitadlo-zoznam">
              {zoznam.map((k, i) => (
                <span key={i} className={`${k.kto === ja ? "ja" : "su"}${k.druh === "zrazka" ? " stit" : ""}`}>
                  {k.zdroj === "BITKAR" && priazne !== undefined ? (
                    // Pečiatka priazne menom staršieho a krúžkom (Michal 2026-10-31).
                    <>
                      <PilulkaPriazne fav="BITKAR" p={{ komu: k.kto === ja ? "ja" : "su", sila: k.zmena }} /> {priazne.menoStarsieho("BITKAR") ?? NAZOV_PRIAZNE.BITKAR}: {t("pocitadlo.tuhe", { n: k.zmena })}
                    </>
                  ) : (
                    <>
                      {k.kto === ja ? t("stol.ty") : mena[su]}: {popis(k)}
                    </>
                  )}
                </span>
              ))}
            </span>
          )}
          <div className="pocitadlo-koniec">
            {(hotovo || vysledokHned) && (
              <span className="pocitadlo-verdikt">
                {verdikt}
              </span>
            )}
            {hotovo && (
              <button type="button" className="rk-dalej" onClick={onKoniec} autoFocus>
                {t("pocitadlo.dalej")}
              </button>
            )}
          </div>
          <span className="pocitadlo-tip">{hotovo ? t("pocitadlo.tipZavrie") : t("pocitadlo.tipDobehne")}</span>
        </div>
      </div>
    </div>
  );
}

/** Karta v línii počítadla — HernaPlocha ju kreslí ako na stole. */
export type KreslenieKarty = (k: {
  readonly karta: CardInstance;
  readonly sirka: number;
  readonly otocena: boolean;
  readonly eval: CardLineEval | null;
  readonly bezPopisov: true;
}) => ReactNode;

export interface PocitadloSLiniouProps {
  readonly vrstva: {
    readonly p: Pocitadlo;
    readonly stol: StolBitky;
    readonly linia: LineEval;
    readonly rekap: RekapitulaciaBitky | null;
    readonly odpovede?: readonly OdpovedNaNaex[];
    readonly momenty?: readonly Moment[];
  };
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly karta: KreslenieKarty;
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly onKoniec: () => void;
  readonly vysledokHned?: boolean;
  readonly naSirku?: boolean;
  readonly priazne?: PriazneBitky | undefined;
  readonly vyhraStrachom?: VyhraStrachom | null | undefined;
}

/**
 * Výška vrstvy bez kariet a jeden riadok rekapitulácie (px). Nízke okno má kompaktné
 * rozloženie a široké nízke okno skóre, Ďalej, súčet a špaky vedľa tabuľky (hra.css).
 */
function rozmeryVrstvy(vyska: number, sirka: number): { readonly pevne: number; readonly riadok: number; readonly spakyVedla: boolean } {
  if (vyska >= 860) return { pevne: 330, riadok: 42, spakyVedla: false };
  return sirka >= 1000 ? { pevne: 110, riadok: 29, spakyVedla: true } : { pevne: 250, riadok: 29, spakyVedla: false };
}

/** Počítadlo s líniou z okamihu bitky: tvoja strana od lokality doľava, súperova doprava. */
export function PocitadloSLiniou({ vrstva, ja, mena, karta, menoKarty, piktogramy, onKoniec, vysledokHned = false, naSirku = false, priazne, vyhraStrachom = null }: PocitadloSLiniouProps) {
  const { stol, linia, rekap } = vrstva;
  const su = opponentOf(ja);
  const lok = stol.ciel?.lokalita ?? null;
  const poradie: readonly { readonly card: CardInstance; readonly playedBy: PlayerId | null; readonly naexBy?: PlayerId | undefined }[] = [
    ...[...stol.strany[ja]].reverse(),
    ...(lok === null ? [] : [{ card: lok, playedBy: null }]),
    ...stol.strany[su],
  ];
  // Karty sa zmestia na šírku aj s rekapituláciou na výšku — notebook 1366×650 bez scrollovania.
  const { pevne, riadok, spakyVedla } = rozmeryVrstvy(window.innerHeight, window.innerWidth);
  const vyskaKariet = window.innerHeight - pevne - (rekap === null ? 0 : riadok * riadkovRekapitulacieBitky(rekap, spakyVedla, vyhraStrachom !== null));
  const sirka = Math.max(36, Math.min(110, Math.floor((window.innerWidth - 120) / Math.max(1, poradie.length)), Math.floor(vyskaKariet / 1.4)));
  const rad = poradie.map((pl) => ({
    uid: pl.card.uid,
    karta: (
      <>
        {karta({
          karta: pl.card,
          sirka,
          otocena: pl.playedBy === null ? stol.lokalitaOtocena !== (ja === 1) : pl.playedBy !== ja,
          eval: linia.cards.get(pl.card.uid) ?? null,
          bezPopisov: true,
        })}
        {pl.naexBy !== undefined && (
          <span className="naex-nad pocitadlo-naex" title={pl.naexBy === ja ? t("pocitadlo.naexTvoj") : t("pocitadlo.naexHraca", { meno: mena[pl.naexBy] })}>
            <IkonaPoldeci /> NA EX
          </span>
        )}
      </>
    ),
  }));
  return (
    <PocitadloBitky
      p={vrstva.p}
      ja={ja}
      mena={mena}
      menoKarty={menoKarty}
      rad={rad}
      onKoniec={onKoniec}
      vysledokHned={vysledokHned}
      rekap={rekap}
      vlnyKariet={vlnyKariet(stol)}
      piktogramy={piktogramy}
      odpovede={vrstva.odpovede ?? []}
      naSirku={naSirku}
      momenty={vrstva.momenty ?? []}
      priazne={priazne}
      vyhraStrachom={vyhraStrachom}
    />
  );
}
