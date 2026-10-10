// Plávajúci popis (tooltip) — portál do <body>, aby ho neorezal okraj karty
// ani posúvaný panel. Funguje na hover aj na fokus z klávesnice.

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface TipObsah {
  readonly nadpis: ReactNode;
  readonly text: ReactNode;
  readonly ikona?: ReactNode;
  readonly farba?: string;
}

interface TipStav extends TipObsah {
  readonly x: number;
  readonly y: number;
  readonly pod: boolean;
}

export function useTip(): {
  readonly tip: ReactNode;
  ukaz(el: Element, obsah: TipObsah): void;
  skry(): void;
} {
  const [stav, setStav] = useState<TipStav | null>(null);
  const ukaz = useCallback((el: Element, obsah: TipObsah) => {
    const r = el.getBoundingClientRect();
    const pod = r.top < 170;
    const x = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150);
    setStav({ ...obsah, x, y: pod ? r.bottom : r.top, pod });
  }, []);
  const skry = useCallback(() => setStav(null), []);
  const tip =
    stav === null
      ? null
      : createPortal(
          <div
            className={stav.pod ? "tip tip-pod" : "tip"}
            style={{ left: stav.x, top: stav.y, ...(stav.farba !== undefined ? { "--farba": stav.farba } : {}) } as CSSProperties}
            role="tooltip"
          >
            <div className="tip-hlava">
              {stav.ikona !== undefined && <span className="tip-ikona">{stav.ikona}</span>}
              {stav.nadpis}
            </div>
            <div className="tip-text">{stav.text}</div>
          </div>,
          document.body,
        );
  return { tip, ukaz, skry };
}
