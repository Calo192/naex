// Lupa: karta zo stola alebo z vrstvy (šenok, lokality) zväčšená na 200 %,
// nad všetkým ostatným.
//
// Línia aj vrstvy sa posúvajú (overflow), takže zväčšenie priamo v nich by
// orezali. Lupa je preto portál s pevnou polohou, vystredený na pôvodnú
// kartu a celý ju prekrýva — myš je v nej hneď po otvorení a dá sa ňou
// prejsť na akcie zväčšenej karty. Zavrie sa, keď myš opustí jej plochu
// alebo keď sa niečo posunie (poloha by už nesedela).

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const OKRAJ = 8;

export interface LupaProps {
  /** Poloha pôvodnej karty na obrazovke. */
  readonly rect: DOMRect;
  readonly mierka: number;
  readonly onZavri: () => void;
  /** Karta sa dá chytiť aj zo zväčšenej kópie (lupa leží nad originálom). */
  readonly onPointerDown?: ((e: ReactPointerEvent<HTMLElement>) => void) | undefined;
  readonly children: ReactNode;
}

export function Lupa({ rect, mierka, onZavri, onPointerDown, children }: LupaProps) {
  const zavriRef = useRef(onZavri);
  zavriRef.current = onZavri;

  const w = rect.width * mierka;
  const h = rect.height * mierka;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const left = Math.max(OKRAJ, Math.min(cx - w / 2, window.innerWidth - w - OKRAJ));
  const top = Math.max(OKRAJ, Math.min(cy - h / 2, window.innerHeight - h - OKRAJ));

  useEffect(() => {
    // Hranice z vypočítanej polohy, nie z DOM — počas animácie je lupa
    // ešte menšia a myš pri okraji by ju hneď zavrela.
    const pohyb = (e: PointerEvent): void => {
      if (e.clientX < left || e.clientX > left + w || e.clientY < top || e.clientY > top + h) zavriRef.current();
    };
    const zavri = (): void => zavriRef.current();
    window.addEventListener("pointermove", pohyb);
    window.addEventListener("scroll", zavri, true);
    window.addEventListener("resize", zavri);
    window.addEventListener("blur", zavri);
    return () => {
      window.removeEventListener("pointermove", pohyb);
      window.removeEventListener("scroll", zavri, true);
      window.removeEventListener("resize", zavri);
      window.removeEventListener("blur", zavri);
    };
  }, [left, top, w, h]);

  return createPortal(
    <div
      className={onPointerDown !== undefined ? "lupa chytitelna" : "lupa"}
      style={{ left, top, width: w, transformOrigin: `${cx - left}px ${cy - top}px` } as CSSProperties}
      onPointerDown={onPointerDown}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}
