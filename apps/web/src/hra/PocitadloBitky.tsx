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
import type { CardInstance, CardLineEval, KrokPocitadla, LineEval, PlayerId, PocitadloBitky as Pocitadlo, RekapitulaciaBitky, StolBitky } from "@naex/core";
import { stavPocitadla, vlnyKariet } from "@naex/core";
import { IkonaPoldeci } from "./Panely.tsx";
import { RekapBitky, riadkovRekapitulacieBitky, type OdpovedNaNaex, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";

/** Zdroje bonusov a zrážok, ktoré nie sú kartou. */
const ZDROJ: Readonly<Record<string, string>> = {
  cirhoza: "Cirhózy súpera",
  BITKAR: "priazeň Bitkára",
  Viera: "Viera súpera",
  pasca: "pasca",
  abstak: "Absťáky",
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
}

export function PocitadloBitky({ p, ja, mena, menoKarty, rad, onKoniec, vysledokHned = false, rekap = null, vlnyKariet, piktogramy, odpovede = [] }: PocitadloBitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
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
    if (k.druh === "spolu") return `ostatné ${z}`;
    const meno = k.zdroj === null ? "" : (ZDROJ[k.zdroj] ?? menoKarty(k.zdroj));
    // Štít len pri Viere súpera (obrana); Absťáky a pasca sú trest, nie obrana (UI inšpekcia).
    const znak = k.druh !== "zrazka" ? "" : k.zdroj === "Viera" ? "🛡 " : "↓ ";
    if (k.naNule === true) return `${znak}${meno} (už na 0)`;
    return `${znak}${meno} ${z}`;
  };
  const viditelne = hotovo ? p.kroky : p.kroky.filter((k) => k.vlna <= vlna);
  // Bonusy, zrážky a dorovnanie ostávajú pod číslami, kým počítadlo beží.
  const zoznam = viditelne.filter((k) => k.druh !== "karta");
  // Riadky rekapitulácie podľa toho, kedy svieti ich karta; čo nie je kartou, s bonusmi.
  const vlnaKarty = (uid: number | null): number => (uid === null ? p.vlnaBonusov : (vlnyKariet?.get(uid) ?? 0));

  return (
    <div
      className={`pocitadlo-bitky${hotovo ? " hotova" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Bitka: ty ${cislo[ja]}, ${mena[su]} ${cislo[su]}`}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest(".rk-dalej")) dobehni();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        dobehni();
      }}
    >
      <div className={`pocitadlo-scena${rekap !== null && piktogramy !== undefined ? " s-rekapom" : ""}`}>
        <div className={`pocitadlo-panel${hotovo || vysledokHned ? " hotovo" : ""}`}>
          <span className="pocitadlo-nadpis">Bitka · tuhé</span>
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
          />
        )}
        <div className="pocitadlo-pata">
          {zoznam.length > 0 && (
            <span className="pocitadlo-zoznam">
              {zoznam.map((k, i) => (
                <span key={i} className={`${k.kto === ja ? "ja" : "su"}${k.druh === "zrazka" ? " stit" : ""}`}>
                  {k.kto === ja ? "ty" : mena[su]}: {popis(k)}
                </span>
              ))}
            </span>
          )}
          <div className="pocitadlo-koniec">
            {(hotovo || vysledokHned) && (
              <span className="pocitadlo-verdikt">
                {vitaz === null ? "Remíza v tuhom" : vitaz === ja ? `Vyhrávaš o ${p.tuhe[ja] - p.tuhe[su]}` : `Prehrávaš o ${p.tuhe[su] - p.tuhe[ja]}`}
              </span>
            )}
            {hotovo && (
              <button type="button" className="rk-dalej" onClick={onKoniec} autoFocus>
                Ďalej
              </button>
            )}
          </div>
          <span className="pocitadlo-tip">{hotovo ? "Enter alebo Ďalej zavrie" : "klik, Esc alebo medzerník dobehne"}</span>
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
  };
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly karta: KreslenieKarty;
  readonly menoKarty: (defId: string) => string;
  readonly piktogramy: PiktogramyRekapitulacie;
  readonly onKoniec: () => void;
  readonly vysledokHned?: boolean;
}

/**
 * Výška vrstvy bez kariet a jeden riadok rekapitulácie (px). Nízke okno má kompaktné
 * rozloženie a široké nízke okno skóre a Ďalej vedľa tabuľky (hra.css).
 */
function rozmeryVrstvy(vyska: number, sirka: number): { readonly pevne: number; readonly riadok: number } {
  if (vyska >= 860) return { pevne: 330, riadok: 42 };
  return sirka >= 1000 ? { pevne: 110, riadok: 29 } : { pevne: 250, riadok: 29 };
}

/** Počítadlo s líniou z okamihu bitky: tvoja strana od lokality doľava, súperova doprava. */
export function PocitadloSLiniou({ vrstva, ja, mena, karta, menoKarty, piktogramy, onKoniec, vysledokHned = false }: PocitadloSLiniouProps) {
  const { stol, linia, rekap } = vrstva;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const lok = stol.ciel?.lokalita ?? null;
  const poradie: readonly { readonly card: CardInstance; readonly playedBy: PlayerId | null; readonly naexBy?: PlayerId | undefined }[] = [
    ...[...stol.strany[ja]].reverse(),
    ...(lok === null ? [] : [{ card: lok, playedBy: null }]),
    ...stol.strany[su],
  ];
  // Karty sa zmestia na šírku aj s rekapituláciou na výšku — notebook 1366×650 bez scrollovania.
  const { pevne, riadok } = rozmeryVrstvy(window.innerHeight, window.innerWidth);
  const vyskaKariet = window.innerHeight - pevne - (rekap === null ? 0 : riadok * riadkovRekapitulacieBitky(rekap));
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
          <span className="naex-nad pocitadlo-naex" title={`NA EX — poldeci ${pl.naexBy === ja ? "tvoj" : `hráča ${mena[pl.naexBy]}`}`}>
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
    />
  );
}
