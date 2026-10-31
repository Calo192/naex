// Medziobrazovka pri prechode fázy (Michal 2026-10-27): veľký názov fázy a 1–2 vety, čo sa
// ide diať. Ostane, kým hráč neklikne „Rozumiem“; vypína sa v profile. Hra medzitým beží
// (súper ani bot nečakajú) — zakrýva len stôl tohto hráča.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Medziobrazovka as Obsah } from "./prechodFazy.ts";

export interface MedziobrazovkaProps {
  readonly obsah: Obsah;
  readonly onRozumiem: () => void;
  /** Obsah pod textom (lokalita, ktorú vybral súper). */
  readonly children?: ReactNode;
  /** „Rozumiem“ príde až po tomto čase — hráč si má obsah najprv prezrieť, nie ho preklikať. */
  readonly tlacidloPoMs?: number;
  /** Poznámka o vypínači v profile — len pri medziobrazovkách, ktoré profil naozaj vypína. */
  readonly vypinac?: boolean;
  readonly trieda?: string;
  /** Ťuk mimo okna ho zavrie ako „Rozumiem“ (okná zdrojov a odhadu na telefóne). */
  readonly zavrietMimo?: boolean;
}

export function Medziobrazovka({ obsah, onRozumiem, children, tlacidloPoMs = 0, vypinac = true, trieda, zavrietMimo = false }: MedziobrazovkaProps) {
  // Skratky stola (K, P, N, Esc…) by stlačili tlačidlá pod ňou — kým je hore, klávesy
  // nedôjdu ďalej než sem. Enter a medzera ostanú tlačidlu „Rozumiem“ (predvolená akcia).
  useEffect(() => {
    const zadrz = (e: KeyboardEvent): void => {
      if (e.key !== "Tab") e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", zadrz, true);
    return () => window.removeEventListener("keydown", zadrz, true);
  }, []);
  const [tlacidloPre, setTlacidloPre] = useState<string | null>(tlacidloPoMs > 0 ? null : obsah.kluc);
  useEffect(() => {
    if (tlacidloPoMs <= 0) {
      setTlacidloPre(obsah.kluc);
      return;
    }
    const t = setTimeout(() => setTlacidloPre(obsah.kluc), tlacidloPoMs);
    return () => clearTimeout(t);
  }, [obsah.kluc, tlacidloPoMs]);
  return (
    <div
      className={trieda === undefined ? "medziobrazovka" : `medziobrazovka ${trieda}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medziobrazovka-nadpis"
      onClick={zavrietMimo ? (e) => e.target === e.currentTarget && onRozumiem() : undefined}
    >
      <div className="medziobrazovka-okno" key={obsah.kluc}>
        <span className="medziobrazovka-nad">{obsah.nadnadpis}</span>
        <h2 id="medziobrazovka-nadpis">{obsah.nadpis}</h2>
        {obsah.text !== "" && <p>{obsah.text}</p>}
        {children}
        {tlacidloPre === obsah.kluc ? (
          <button type="button" className="tlacidlo-hlavne" onClick={onRozumiem} autoFocus>
            Rozumiem
          </button>
        ) : (
          // Miesto tlačidla drží ubúdajúci pásik — okno neposkočí, keď tlačidlo príde.
          <span className="medziobrazovka-caka" style={{ "--caka-ms": `${tlacidloPoMs}ms` } as CSSProperties} aria-hidden="true">
            <span />
          </span>
        )}
        {vypinac && <span className="medziobrazovka-pozn">Vypnúť ich môžeš v profile.</span>}
      </div>
    </div>
  );
}
