// Karta, ktorú súper vzal zo šenku (#111, Michal 2026-10-26): odletí z miesta
// v šenku k jeho doske, aby hráč videl, čo mu zobral. Na mieste ostane tieň
// (HernaPlocha); toto je len prelet nad stolom, mimo toku stránky.

import type { ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface Obdlznik {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Prelet {
  readonly kluc: string;
  readonly z: Obdlznik;
  readonly na: Obdlznik;
}

/** Ako dlho karta letí (ms) — krátko, aby nebrzdila hru, dosť na prečítanie mena. */
export const DLZKA_PRELETU = 1100;

export function LetiacaKarta({ prelet, children, koniec }: { readonly prelet: Prelet; readonly children: ReactNode; readonly koniec: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const koniecRef = useRef(koniec);
  koniecRef.current = koniec;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || typeof el.animate !== "function") {
      koniecRef.current();
      return;
    }
    const { z, na } = prelet;
    const dx = na.left + na.width / 2 - (z.left + z.width / 2);
    const dy = na.top + na.height / 2 - (z.top + z.height / 2);
    const mierka = Math.max(0.2, Math.min(1, na.height / Math.max(1, z.height)));
    // Karta sa najprv nadvihne (hráč si ju všimne a prečíta), potom letí k súperovi.
    const a = el.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: "translate(0, -14px) scale(1.08)", opacity: 1, offset: 0.3 },
        { transform: `translate(${dx}px, ${dy}px) scale(${mierka})`, opacity: 0.15 },
      ],
      { duration: DLZKA_PRELETU, easing: "cubic-bezier(0.45, 0, 0.3, 1)", fill: "forwards" },
    );
    a.onfinish = () => koniecRef.current();
    return () => a.cancel();
  }, [prelet]);
  return createPortal(
    <div ref={ref} className="letiaca-karta" style={{ left: prelet.z.left, top: prelet.z.top, width: prelet.z.width }} aria-hidden="true">
      {children}
    </div>,
    document.body,
  );
}
