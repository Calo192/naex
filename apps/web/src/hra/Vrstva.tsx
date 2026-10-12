// Vrstva cez celú obrazovku pre to, čo na stole netreba mať stále:
// šenok, lokality v hre a log. Ruka s pásom pokynov ostáva nad ňou, takže
// sa dá medzi vrstvami prepínať. Počas ťahania karty sa vrstva skryje —
// karta zo šenku či lokalít sa púšťa na stôl alebo do ruky pod ňou.

import { useEffect, useRef, type ReactNode } from "react";

export interface VrstvaProps {
  readonly nazov: ReactNode;
  readonly pozn?: ReactNode;
  /** Počas ťahania: neviditeľná a priepustná pre myš. */
  readonly skryta: boolean;
  readonly onZavri: () => void;
  /** Tlačidlá dole vo vrstve (napr. „umiestniť“) — výber bez ťahania. */
  readonly paticka?: ReactNode;
  readonly children: ReactNode;
}

export function Vrstva({ nazov, pozn, skryta, onZavri, paticka, children }: VrstvaProps) {
  const zavriRef = useRef(onZavri);
  zavriRef.current = onZavri;
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") zavriRef.current();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, []);

  return (
    <div
      className={skryta ? "vrstva skryta" : "vrstva"}
      role="dialog"
      aria-modal="true"
      // Klik na pozadie zavrie; klik do panela nie.
      onClick={(e) => e.target === e.currentTarget && onZavri()}
    >
      <div className="vrstva-panel">
        <header className="vrstva-hlava">
          <h2>{nazov}</h2>
          {pozn !== undefined && <span className="vrstva-pozn">{pozn}</span>}
          <button className="vrstva-zavriet" onClick={onZavri} aria-label="Zavrieť" title="Zavrieť (Esc)">
            ✕
          </button>
        </header>
        <div className="vrstva-obsah">{children}</div>
        {paticka !== undefined && <footer className="vrstva-paticka">{paticka}</footer>}
      </div>
    </div>
  );
}
