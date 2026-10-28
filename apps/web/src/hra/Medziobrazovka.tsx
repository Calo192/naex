// Medziobrazovka pri prechode fázy (Michal 2026-10-27): veľký názov fázy a 1–2 vety, čo sa
// ide diať. Ostane, kým hráč neklikne „Rozumiem“; vypína sa v profile. Hra medzitým beží
// (súper ani bot nečakajú) — zakrýva len stôl tohto hráča.

import { useEffect } from "react";
import type { Medziobrazovka as Obsah } from "./prechodFazy.ts";

export function Medziobrazovka({ obsah, onRozumiem }: { readonly obsah: Obsah; readonly onRozumiem: () => void }) {
  // Skratky stola (K, P, N, Esc…) by stlačili tlačidlá pod ňou — kým je hore, klávesy
  // nedôjdu ďalej než sem. Enter a medzera ostanú tlačidlu „Rozumiem“ (predvolená akcia).
  useEffect(() => {
    const zadrz = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", zadrz, true);
    return () => window.removeEventListener("keydown", zadrz, true);
  }, []);
  return (
    <div className="medziobrazovka" role="dialog" aria-modal="true" aria-labelledby="medziobrazovka-nadpis">
      <div className="medziobrazovka-okno" key={obsah.kluc}>
        <span className="medziobrazovka-nad">{obsah.nadnadpis}</span>
        <h2 id="medziobrazovka-nadpis">{obsah.nadpis}</h2>
        <p>{obsah.text}</p>
        <button type="button" className="tlacidlo-hlavne" onClick={onRozumiem} autoFocus>
          Rozumiem
        </button>
        <span className="medziobrazovka-pozn">Vypnúť ich môžeš v profile.</span>
      </div>
    </div>
  );
}
