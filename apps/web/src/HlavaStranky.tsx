// Hlava stránky (Michal 2026-10-27: „jednotná štruktúra, nie iné zarovnanie na každej
// stránke“, UX K-A, UI A + kriedová tabuľa z B): každá stránka mimo herného stola začína
// touto hlavou — H1 na kriedovej tabuli, najviac jedna veta úvodu, vpravo hlavná akcia,
// pod tabuľou záložky. Dlhé vysvetlenia idú do „Ako to funguje? ▸“.
// Nadpis je na každej stránke na tom istom mieste a v tej istej veľkosti
// (tools/ui-inspektor/kostra.ts), preto nad tabuľu nič nepatrí.

import type { ReactNode } from "react";
import "./hlava-stranky.css";

export function HlavaStranky({
  nadpis,
  uvod,
  akcia,
  zalozky,
  viac,
  viacNazov = "Ako to funguje?",
  idNadpisu,
}: {
  readonly nadpis: ReactNode;
  /** Jedna veta, čo na stránke nájdeš. */
  readonly uvod?: ReactNode;
  /** Hlavná akcia stránky (tlačidlo, odkaz späť, krátky údaj) — vpravo na tabuli. */
  readonly akcia?: ReactNode;
  /** Záložky alebo časti stránky — pod tabuľou. */
  readonly zalozky?: ReactNode;
  /** Dlhšie vysvetlenie, zbalené pod tabuľou. */
  readonly viac?: ReactNode;
  readonly viacNazov?: string;
  readonly idNadpisu?: string;
}) {
  return (
    <header className="hlava-stranky">
      <div className="tabula">
        <div className="tabula-text">
          <h1 id={idNadpisu}>{nadpis}</h1>
          {uvod !== undefined && <p className="tabula-uvod">{uvod}</p>}
        </div>
        {akcia !== undefined && <div className="tabula-akcia">{akcia}</div>}
      </div>
      {viac !== undefined && (
        <details className="hlava-viac">
          <summary>{viacNazov}</summary>
          <div className="hlava-viac-telo">{viac}</div>
        </details>
      )}
      {zalozky !== undefined && <div className="hlava-zalozky">{zalozky}</div>}
    </header>
  );
}
