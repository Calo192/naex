// Plávajúci popis (tooltip) — portál do <body>, aby ho neorezal okraj karty
// ani posúvaný panel. Funguje na hover aj na fokus z klávesnice.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface TipObsah {
  readonly nadpis: ReactNode;
  readonly text: ReactNode;
  readonly ikona?: ReactNode;
  readonly farba?: string;
}

interface TipStav extends TipObsah {
  readonly x: number;
  readonly hore: number;
  readonly dole: number;
  readonly pod: boolean;
}

const OKRAJ = 8;

export function useTip(): {
  readonly tip: ReactNode;
  ukaz(el: Element, obsah: TipObsah): void;
  skry(): void;
} {
  const [stav, setStav] = useState<TipStav | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const kotva = useRef<Element | null>(null);
  const ukaz = useCallback((el: Element, obsah: TipObsah) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 160), document.documentElement.clientWidth - 160);
    kotva.current = el;
    // Predvolene nad prvkom; či sa tam zmestí, sa overí po vykreslení.
    setStav({ ...obsah, x, hore: r.top, dole: r.bottom, pod: r.top < 120 });
  }, []);
  const skry = useCallback(() => {
    kotva.current = null;
    setStav(null);
  }, []);

  // Prvok, ku ktorému tip patrí, zmizol či sa skryl — mouseleave už nepríde a tip by visel (V-02).
  const otvoreny = stav !== null;
  useEffect(() => {
    if (!otvoreny) return;
    const t = setInterval(() => {
      const el = kotva.current;
      if (el === null || !el.isConnected || el.getClientRects().length === 0 || el.closest("[hidden], [inert]") !== null) skry();
    }, 300);
    return () => clearInterval(t);
  }, [otvoreny, skry]);

  // Vysoký popis nad prvkom by vyliezol z okna — vtedy ho otoč pod prvok.
  useLayoutEffect(() => {
    const el = ref.current;
    if (stav === null || stav.pod || el === null) return;
    if (stav.hore - el.offsetHeight - 10 < OKRAJ) setStav({ ...stav, pod: true });
  }, [stav]);

  const tip =
    stav === null
      ? null
      : createPortal(
          <div
            ref={ref}
            className={stav.pod ? "tip tip-pod" : "tip"}
            style={{ left: stav.x, top: stav.pod ? stav.dole : stav.hore, ...(stav.farba !== undefined ? { "--farba": stav.farba } : {}) } as CSSProperties}
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
