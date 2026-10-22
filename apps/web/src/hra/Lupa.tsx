// Lupa: karta zo stola alebo z vrstvy (šenok, lokality) zväčšená podľa
// nastavenia hráča v profile (150 – 400 %, predvolene 200 %),
// nad všetkým ostatným.
//
// Otvára sa pri prejdení myšou s krátkym oneskorením a susedia uhnú do strán
// (Michal 2026-10-22: klik na zväčšenie bol otravný; 2026-10-20 sa naopak
// zväčšovalo klikom), klávesnicou fokusom, na dotyku ťuknutím — viď nadLupou
// v HernaPlocha. Línia aj vrstvy sa posúvajú
// (overflow), takže zväčšenie priamo v nich by orezali. Lupa je preto portál
// s pevnou polohou, vystredený na pôvodnú kartu a celý ju prekrýva — dá sa
// ňou prejsť na akcie zväčšenej karty. Zavrie sa klikom (na kartu s akciou
// akciu aj vykoná), pravým klikom, Esc, klikom mimo, odchodom myši alebo
// keď sa niečo posunie (poloha by už nesedela).

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const OKRAJ = 8;

/** Najväčšie zväčšenie, pri ktorom sa karta ešte celá zmestí do okna. */
export function maxMierkaLupy(rect: DOMRect): number {
  return Math.min((window.innerWidth - 2 * OKRAJ) / rect.width, (window.innerHeight - 2 * OKRAJ) / rect.height);
}

export interface LupaProps {
  /** Poloha pôvodnej karty na obrazovke. */
  readonly rect: DOMRect;
  readonly mierka: number;
  /** Zavretie; pri odchode myši s polohou kurzora — HernaPlocha tam môže hneď otvoriť susednú kartu. */
  readonly onZavri: (kde?: { readonly x: number; readonly y: number }) => void;
  /** Karta sa dá chytiť aj zo zväčšenej kópie (lupa leží nad originálom). */
  readonly onPointerDown?: ((e: ReactPointerEvent<HTMLElement>) => void) | undefined;
  /** Pravý klik: to isté, čo pravý klik na pôvodnú kartu (napr. vrátiť návrh do ruky). */
  readonly onOdstran?: (() => void) | undefined;
  readonly children: ReactNode;
}

export function Lupa({ rect, mierka: ziadana, onZavri, onPointerDown, onOdstran, children }: LupaProps) {
  const zavriRef = useRef(onZavri);
  zavriRef.current = onZavri;

  // Hráč si zväčšenie volí v profile (až 400 %) — väčšie, než sa zmestí, nie.
  const mierka = Math.min(ziadana, maxMierkaLupy(rect));
  const w = rect.width * mierka;
  const h = rect.height * mierka;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const left = Math.max(OKRAJ, Math.min(cx - w / 2, window.innerWidth - w - OKRAJ));
  const top = Math.max(OKRAJ, Math.min(cy - h / 2, window.innerHeight - h - OKRAJ));

  useEffect(() => {
    // Hranice z vypočítanej polohy, nie z DOM — počas animácie je lupa
    // ešte menšia a myš pri okraji by ju hneď zavrela.
    const mimo = (e: PointerEvent): boolean =>
      e.clientX < left || e.clientX > left + w || e.clientY < top || e.clientY > top + h;
    // Dotyk nemá „odchod“ — tam lupu zavrie ťuknutie mimo.
    const pohyb = (e: PointerEvent): void => {
      if (e.pointerType === "mouse" && mimo(e)) zavriRef.current({ x: e.clientX, y: e.clientY });
    };
    const stlacenie = (e: PointerEvent): void => {
      if (mimo(e)) zavriRef.current();
    };
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") zavriRef.current();
    };
    const zavri = (): void => zavriRef.current();
    window.addEventListener("pointermove", pohyb);
    window.addEventListener("pointerdown", stlacenie, true);
    window.addEventListener("keydown", klaves);
    window.addEventListener("scroll", zavri, true);
    window.addEventListener("resize", zavri);
    window.addEventListener("blur", zavri);
    return () => {
      window.removeEventListener("pointermove", pohyb);
      window.removeEventListener("pointerdown", stlacenie, true);
      window.removeEventListener("keydown", klaves);
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
      // Klik na kartu s akciou ju najprv vykoná (bublá z karty), potom lupa zmizne.
      onClick={() => zavriRef.current()}
      onContextMenu={(e) => {
        // Portál bublá aj cez strom Reactu — stôl by pravý klik zachytil znova.
        e.preventDefault();
        e.stopPropagation();
        onOdstran?.();
        zavriRef.current();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
