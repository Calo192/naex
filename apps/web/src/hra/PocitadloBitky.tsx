// Počítadlo bitky (Michal 2026-10-23, roadmapa „Počítadlo bitky“): pri vyhodnotení
// bitky výsledok rastie po vlnách od lokality von — karta sa rozsvieti a vyletí jej
// príspevok k tuhému, zdvojený sa roztrasie; potom bonusy, Viera súpera ako štít
// a nakoniec obe čísla na výsledku (ten istý ako v Účte bitky). 3–5 s, klik, Esc
// alebo medzerník preskočí; pri prefers-reduced-motion sa vôbec nespustí (HernaPlocha).
// Línia je vlastná kópia stola v okamihu bitky — server bitku často vyhodnotí aj
// s upratovaním naraz a skutočná línia zo stola zmizne skôr, než počítadlo dobehne.

import { useEffect, useState, type ReactNode } from "react";
import type { KrokPocitadla, PlayerId, PocitadloBitky as Pocitadlo } from "@naex/core";
import { stavPocitadla } from "@naex/core";

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
}

export function PocitadloBitky({ p, ja, mena, menoKarty, rad, onKoniec }: PocitadloBitkyProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const posledna = p.vln - 1;
  const [vlna, setVlna] = useState(-1);
  const hotovo = vlna >= posledna;
  // Spolu 3–5 s: krok podľa počtu vĺn, výsledok potom chvíľu ostane.
  const krokMs = Math.max(260, Math.min(650, 3600 / Math.max(1, p.vln)));

  useEffect(() => {
    const t = hotovo ? setTimeout(onKoniec, 1300) : setTimeout(() => setVlna((v) => v + 1), vlna < 0 ? 350 : krokMs);
    return () => clearTimeout(t);
  }, [vlna, hotovo, krokMs, onKoniec]);

  const preskoc = (): void => {
    if (hotovo) onKoniec();
    else setVlna(posledna);
  };
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      preskoc();
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  });

  const cislo = hotovo ? p.tuhe : vlna < 0 ? ([0, 0] as const) : stavPocitadla(p, vlna);
  const vitaz = p.tuhe[ja] === p.tuhe[su] ? null : p.tuhe[ja] > p.tuhe[su] ? ja : su;
  const popis = (k: KrokPocitadla): string => {
    const z = k.zmena > 0 ? `+${k.zmena}` : `−${-k.zmena}`;
    if (k.druh === "karta") return `${z}${k.nasobok > 1 ? ` ×${k.nasobok}` : ""}`;
    if (k.druh === "spolu") return `${k.zmena < 0 ? "skryté Absťáky / dno 0" : "ostatné"} ${z}`;
    const meno = k.zdroj === null ? "" : (ZDROJ[k.zdroj] ?? menoKarty(k.zdroj));
    return `${k.druh === "zrazka" ? "🛡 " : ""}${meno} ${z}`;
  };
  const viditelne = hotovo ? p.kroky : p.kroky.filter((k) => k.vlna <= vlna);
  // Bonusy, zrážky a dorovnanie ostávajú pod číslami, kým počítadlo beží.
  const zoznam = viditelne.filter((k) => k.druh !== "karta");

  return (
    <div
      className="pocitadlo-bitky"
      role="status"
      aria-live="polite"
      aria-label={`Bitka: ty ${cislo[ja]}, ${mena[su]} ${cislo[su]}`}
      onClick={preskoc}
      onContextMenu={(e) => {
        e.preventDefault();
        preskoc();
      }}
    >
      <div className="pocitadlo-scena">
        <div className={`pocitadlo-panel${hotovo ? " hotovo" : ""}`}>
          <span className="pocitadlo-nadpis">Bitka · tuhé</span>
          <span className="pocitadlo-cisla">
            <b className={`ja${hotovo && vitaz === ja ? " vyhra" : ""}`}>{cislo[ja]}</b>
            <span className="pocitadlo-dvojbodka">:</span>
            <b className={`su${hotovo && vitaz === su ? " vyhra" : ""}`}>{cislo[su]}</b>
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
          {hotovo && (
            <span className="pocitadlo-verdikt">
              {vitaz === null ? "Remíza v tuhom" : vitaz === ja ? `Vyhrávaš o ${p.tuhe[ja] - p.tuhe[su]}` : `Prehrávaš o ${p.tuhe[su] - p.tuhe[ja]}`}
            </span>
          )}
          <span className="pocitadlo-tip">klik, Esc alebo medzerník preskočí</span>
        </div>
      </div>
    </div>
  );
}
